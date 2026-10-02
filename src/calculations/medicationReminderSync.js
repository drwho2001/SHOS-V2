// medicationReminderSync.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 26 Aug 2026: custom medication reminder notifications,
// styled on TakeYourPills/Medisafe's own Take/Snooze/Skip pattern
// (confirmed via their real store listings, not guessed) — "Take
// all", "Skip until tomorrow", "Remind in 30 min". Same three-layer
// split as doxyPepSync.js: pure calculation lives in
// medicationCalculations.js, generic scheduling lives in
// notificationService.js, this file is the one place that reads real
// data and decides what to actually schedule.
//
// SCOPE: originally daily-pattern medications only, per the user's
// explicit "base it on daily meds" (26 Aug 2026) — PRN was excluded
// because it has no fixed due time to remind about at all, which still
// holds. Custom-interval (every-N-days) medications were excluded then
// as a scope cut, not a limitation — medicationCalculations.js's own
// isDoseLockedOut()/lockoutEndsAt() already computed a real interval
// for them via effectiveDoseIntervalHours() the whole time, this file
// just never asked. EXTENDED 10 Sep 2026, a real live-audit finding:
// the seed data has an actual every-14-days medication (Testosterone),
// which was silently getting zero reminder coverage — now included on
// exactly the same Take/Skip/Snooze machinery as daily meds, no new
// code paths needed since the calculation layer already treated both
// uniformly.
import { MedicationRepository } from "../repositories/medicationRepository";
import { MedicationPreferencesRepository, isSkippedToday, isDoseSnoozed } from "../repositories/medicationPreferencesRepository";
import { LogRepository } from "../repositories/logRepository";
import { lockoutEndsAt, getNextNotificationTime, latestLogOfType } from "./medicationCalculations";
import { scheduleNotification, cancelNotification, registerNotificationActionTypes, NOTIFICATION_IDS, MEDICATION_ACTION_TYPE_ID, moduleSmallIconName } from "../storage/notificationService";
import { ACCENTS } from "./designTokens";
import { nowAsStoredDateTime } from "./dateInputHelpers";
import { sendWidgetUpdate } from "./widgetBridgeUpdate";

let WidgetBridge = null;
async function getWidgetBridge() {
  if (WidgetBridge) return { plugin: WidgetBridge };
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) {
      WidgetBridge = false;
      return null;
    }
    const { registerPlugin } = await import("@capacitor/core");
    WidgetBridge = registerPlugin("WidgetBridge");
  } catch (e) {
    WidgetBridge = false; // mark as unavailable
  }
  // WRAPPED, NOT RETURNED BARE. A Capacitor plugin proxy is a catch-all Proxy:
  // ANY property access returns a function, so `proxy.then` is a function and the
  // proxy looks *thenable*. Returning one from an async function makes the engine
  // unwrap it by invoking `.then()`, which Capacitor rejects as
  // "WidgetBridge.then() is not implemented on android". That threw before the
  // plugin method was ever reached, so no widget ever updated. Verified live on a
  // real device; the same shape as the earlier ScreenSecurity fix.
  return WidgetBridge ? { plugin: WidgetBridge } : null;
}

// ADDED 3 Sep 2026 — exported (was module-private) — real ask: "clear
// notification awareness" needs an in-app "medication due" banner
// (App.jsx), reading the exact same due/upcoming state the real
// reminder notifications are scheduled from, so the two can never
// disagree with each other.
export async function getDailyMedsState() {
  const meds = (await MedicationRepository.getAll()).filter((m) =>
    !m.isArchived && (m.usagePattern === "daily" || (m.usagePattern === "custom" && m.scheduleIntervalDays))
  );
  const prefs = await MedicationPreferencesRepository.getPreferences();

  const due = [];
  const upcoming = [];
  for (const med of meds) {
    if (isSkippedToday(prefs, med.id)) continue;
    // FIXED — real bug: "Snooze 30 min" rescheduled the native
    // notification but never checked here, so the in-app banner
    // re-showed the exact same medication as due a moment later. Same
    // check as isSkippedToday above, just a shorter horizon.
    if (isDoseSnoozed(prefs, med.id)) continue;
    const logs = await LogRepository.getForMedication(med.id);
    const lastDose = latestLogOfType({ logs }, "dose");
    const unlockAt = lastDose ? getNextNotificationTime(med, lastDose.date, prefs.reminderTimingMode) : null;
    if (!lastDose || !unlockAt || unlockAt <= new Date()) {
      // ADDED 28 Sep 2026 (Phase 3) - `_dueSince` identifies WHICH due
      // instance this is, which is what lets a reminder acknowledgement mean
      // "stop telling me about this dose" rather than "stop telling me about
      // this medication, forever".
      //
      // Without it a signature could only be built from the medication id, and
      // a once-daily medication acknowledged as due this morning would still
      // produce the identical signature tomorrow morning - so the user would
      // never be reminded of tomorrow's dose. Every dose has to be a distinct
      // instance, and the last-dose timestamp is what makes it one.
      //
      // A SPREAD, not a mutation: these are the repository's own objects and
      // adding a field to them in place would leak into anything else holding
      // the same reference. Every existing caller is unaffected - the record
      // still has id, name and every other field it had.
      //
      // Null when the medication has never been dosed, in which case there is
      // no occurrence to distinguish and the id alone stands. Deliberate: see
      // buildMedsSignature's own comment.
      due.push({ ...med, _dueSince: lastDose ? lastDose.date : null });
    } else {
      upcoming.push({ med, unlockAt });
    }
  }
  return { due, upcoming };
}

export async function syncMedicationReminders() {
  const prefs = await MedicationPreferencesRepository.getPreferences();
  if (!prefs.doseRemindersEnabled) {
    await cancelNotification(NOTIFICATION_IDS.medicationReminder);
    return { scheduled: false };
  }

  await registerNotificationActionTypes();

  const { due, upcoming } = await getDailyMedsState();

  // ADDED 28 Sep 2026 (Phase 3) — a "don't remind me about this" that covered
  // the device has to actually withdraw the notification, not just hide the
  // banner. Scoped by the due-content fingerprint, so it is only ever the
  // CURRENT instance that is silenced: take the dose, or wait for the next
  // one, and the signature changes and scheduling resumes normally. A blanket
  // "user said don't remind me about PrEP" flag would have been a medication
  // app quietly deciding a dose doesn't matter, which is exactly the line this
  // project never crosses.
  const { AppPreferencesRepository } = await import("../repositories/appPreferencesRepository");
  const { buildMedsSignature, shouldSuppressDeviceNotification, normaliseAcknowledgements } = await import("./reminderSuppression");
  const appPrefs = await AppPreferencesRepository.getPreferences();
  const acknowledged = normaliseAcknowledgements(appPrefs.acknowledgedReminders);
  if (shouldSuppressDeviceNotification(buildMedsSignature(due), acknowledged, appPrefs.reminderSuppressionEnabled !== false)) {
    await cancelNotification(NOTIFICATION_IDS.medicationReminder);
    await updateRefillWidget();
    return { scheduled: false, acknowledged: true };
  }

  if (due.length > 0) {
    // Already due right now — schedule for a few seconds out (Capacitor
    // needs a future time; "immediately" isn't a valid schedule).
    const names = due.map((m) => m.name).join(", ");
    await scheduleNotification({
      id: NOTIFICATION_IDS.medicationReminder,
      title: "Medication due",
      body: `${names} — due now`,
      at: new Date(Date.now() + 3000),
      actionTypeId: MEDICATION_ACTION_TYPE_ID,
      kind: "Medication reminder",
      smallIcon: moduleSmallIconName("medication"),
      iconColor: ACCENTS.medication,
    });
    await updateRefillWidget();
    return { scheduled: true, due };
  }

  if (upcoming.length > 0) {
    const earliest = upcoming.reduce((a, b) => (a.unlockAt < b.unlockAt ? a : b));
    await scheduleNotification({
      id: NOTIFICATION_IDS.medicationReminder,
      title: "Medication due soon",
      body: `${earliest.med.name} — due at ${new Date(earliest.unlockAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`,
      at: earliest.unlockAt,
      actionTypeId: MEDICATION_ACTION_TYPE_ID,
      kind: "Medication reminder",
      smallIcon: moduleSmallIconName("medication"),
      iconColor: ACCENTS.medication,
    });
    await updateRefillWidget();
    return { scheduled: true, upcoming: earliest };
  }

  // No daily meds at all — nothing to schedule, and nothing stale
  // should be left pending either.
  await cancelNotification(NOTIFICATION_IDS.medicationReminder);
  await updateRefillWidget();
  return { scheduled: false };
}

async function updateRefillWidget() {
  try {
    // FIXED 30 Sep 2026 (audit) — this had THREE stacked defects and the
    // combination was completely silent.
    //
    //   const { getRefillDueMedications } = await import("./medicationCalculations");
    //   ...
    //   const refillDue = getRefillDueMedications(meds, prefs);
    //
    // 1. WRONG MODULE. medicationCalculations.js does not export
    //    getRefillDueMedications at all — it lives in ./refillReminderSync,
    //    which is where every other caller in the codebase already imports it
    //    from (App.jsx, and refillReminderSync's own internal uses).
    // 2. NOT AWAITED. The real function is async and loads its own data.
    // 3. WRONG ARITY. It takes no arguments at all, so `meds` and `prefs` were
    //    both passed to a function that ignores them.
    //
    // The TypeError from (1) was thrown on line 181 and swallowed by the
    // catch at the bottom of this function — so everything AFTER it never ran,
    // including `bridge.plugin.updateNextDose` a few lines below. That means the
    // next-dose widget, which CLAUDE.md records as "wired, masked by default",
    // has still never once displayed anything: the wiring shipped, the comment
    // described it as working, and the only proof was that the code existed.
    //
    // This is the third recorded instance in this repo of a fix being recorded
    // as shipped on the strength of the code being present rather than having
    // been run. The difference here is that it is also the third instance of
    // that stale claim being acted on.
    const { getRefillDueMedications } = await import("./refillReminderSync");

    // Awaited, and called with no arguments — the real signature. `meds` and
    // `prefs` are gone entirely rather than left passed-and-ignored, because
    // two of the three repositories they needed were imported solely for a
    // call that never happened.
    const refillDue = await getRefillDueMedications();
    const count = refillDue.length;
    const nextRefill = count > 0 ? refillDue[0].name : "No refills due";

      const bridge = await getWidgetBridge();
  if (bridge && bridge.plugin.updateRefill) {
        // CHANGED 2 Oct 2026 - routed through sendWidgetUpdate so the stored
        // tier actually applies. Before this, the "Redacted" option in Settings
        // changed nothing at all for this widget.
        await sendWidgetUpdate(bridge, "refillDue", "updateRefill", { count, nextRefill });
        }

    // The next-dose widget had a provider, a layout, a manifest receiver and a
    // bridge method, and no caller anywhere in src/ - so it has never once
    // displayed anything. Wired here because this function already runs on
    // every medication-state recompute.
    //
      // Masked by default was the owner's explicit decision on 29 Sep, and it is
      // now REVERSED - see widgetPrivacy.js for why the owner changed it. This
      // comment is kept rather than deleted because "the setting that decides
      // this lives in Settings, not here" is the part worth preserving: a
      // hardcoded `medName: ""` in this file is exactly what made the tier
      // inert, since no preference could ever reach it.
      if (bridge && bridge.plugin.updateNextDose) {
        const state = await getDailyMedsState();
        const next = state.upcoming[0];
        const nextUnlock = next?.unlockAt;
        await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", {
          // CHANGED - was `medName: ""`, hardcoded, which is why no setting could
          // ever reveal the name. The owner now wants it: this is the widget you
          // look at to know whether to take something, and a blank label made it
          // useless. It is still a tier decision, not a hardcoded one.
          medName: next?.med?.name || "",
          nextDoseTime: state.due.length
            ? "Dose due now"
            : nextUnlock
              ? `Next at ${new Date(nextUnlock).toTimeString().slice(0, 5)}`
              : "",
          // category/state are what survive a Redacted tier, so the widget shows
          // "Medication - due now" instead of going blank and looking broken.
          category: "Medication",
          state: state.due.length ? "due now" : "scheduled",
          // CHANGED 2 Oct 2026 - countdown survives a Redacted tier, on the
          // owner's decision. It discloses LESS than nextDoseTime: "in 4h" is
          // true only right now and reveals no routine, where "20:00" does.
          countdownAt: nextUnlock || null,
        });
      }
  } catch (e) {
    // CHANGED 30 Sep 2026 (audit) — this catch is the reason the bug above was
    // invisible for so long, and the reason is worth recording. Its comment
    // said "Widget bridge not available (web) — ignore", so a TypeError thrown
    // three lines earlier by a bad import was logged at `debug` level, which is
    // below the threshold anyone looks at, and then execution fell through to
    // the end of the function - skipping everything below, including the
    // next-dose widget update. The catch is still correct (web genuinely has no
    // bridge, and throwing would break the web build), so the fix is to make the
    // failure VISIBLE rather than to remove the safety net.
    //
    // Deliberately console.warn and not console.error: the web case really is
    // expected and should not look like a defect, but warn is visible by default
    // where debug was not, so a real error stops being indistinguishable from a
    // missing bridge.
    console.warn("Widget update skipped:", e);
  }
}

// Handlers for the three real actions — called from the app-level
// notification action listener (App.jsx, a genuine cross-cutting
// concern since a notification tap can happen regardless of which
// screen is currently open, same reasoning as the hardware back
// button living there).
// CHANGED 3 Sep 2026 — real ask: "clear notification awareness" — now
// returns what actually happened (which medications, or the snooze
// length) instead of nothing, so a caller (App.jsx's in-app due-meds
// banner, or its notification-action listener) can show a real,
// specific confirmation — "Vitamin D3 logged", not just a silent
// state change with no visible acknowledgment anywhere.
export async function handleTakeAll() {
  const { due } = await getDailyMedsState();
  const names = due.map((m) => m.name);
  await cancelNotification(NOTIFICATION_IDS.medicationReminder);
  // nowAsStoredDateTime(), not new Date().toISOString() — real bug
  // found auditing notification gaps: this stored a genuine real-UTC
  // timestamp while every other dose-logging path in this app (the
  // manual "Log dose" button, fixed earlier this session) stores this
  // app's own fake-UTC convention (see dateInputHelpers.js). A dose
  // logged by tapping Take here would display up to 1h off during BST,
  // and would feed WRONG into isDoseLockedOut/lockoutEndsAt's own
  // realTimestampFromStored() call (medicationCalculations.js), which
  // assumes every stored dose date follows the fake-UTC convention.
  const timestamp = nowAsStoredDateTime();
  for (const m of due) await LogRepository.create({ medicationId: m.id, type: "dose", delta: -m.unitsPerDose, date: timestamp });
  await syncMedicationReminders();
  return { medications: names };
}

export async function handleSkipToday() {
  const { due } = await getDailyMedsState();
  const names = due.map((m) => m.name);
  for (const m of due) await MedicationPreferencesRepository.skipUntilTomorrow(m.id);
  syncMedicationReminders();
  return { medications: names };
}

export async function handleSnooze() {
  const prefs = await MedicationPreferencesRepository.getPreferences();
  // FIXED — real bug found live: this only ever rescheduled the
  // native notification — nothing persisted a "snoozed until" fact
  // the way handleSkipToday's own skipUntilTomorrow() call above
  // does, so the in-app banner's next due-check (getDailyMedsState())
  // found the exact same medications still due and never actually
  // dismissed. Same "snooze applies to whatever's currently showing
  // on the banner" shape as handleSkipToday.
  const { due } = await getDailyMedsState();
  for (const m of due) await MedicationPreferencesRepository.snoozeDose(m.id, prefs.snoozeMinutes);
  scheduleNotification({
    id: NOTIFICATION_IDS.medicationReminder,
    title: "Medication due",
    body: "Reminder snoozed",
    at: new Date(Date.now() + prefs.snoozeMinutes * 60000),
    actionTypeId: MEDICATION_ACTION_TYPE_ID,
    kind: "Medication reminder",
      smallIcon: moduleSmallIconName("medication"),
      iconColor: ACCENTS.medication,
  });
  return { minutes: prefs.snoozeMinutes };
}
