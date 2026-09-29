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
import { lockoutEndsAt, getNextNotificationTime } from "./medicationCalculations";
import { scheduleNotification, cancelNotification, registerNotificationActionTypes, NOTIFICATION_IDS, MEDICATION_ACTION_TYPE_ID, moduleSmallIconName } from "../storage/notificationService";
import { ACCENTS } from "./designTokens";
import { nowAsStoredDateTime } from "./dateInputHelpers";

let WidgetBridge = null;
async function getWidgetBridge() {
  if (WidgetBridge) return WidgetBridge;
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
  return WidgetBridge || null;
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
    const lastDose = [...logs].filter((l) => l.type === "dose" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
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
  if (shouldSuppressDeviceNotification(buildMedsSignature(due), acknowledged)) {
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
    const { MedicationRepository } = await import("../repositories/medicationRepository");
    const { getRefillDueMedications } = await import("./medicationCalculations");
    const { MedicationPreferencesRepository } = await import("../repositories/medicationPreferencesRepository");

    const meds = await MedicationRepository.getAll();
    const prefs = await MedicationPreferencesRepository.getPreferences();
    const refillDue = getRefillDueMedications(meds, prefs);
    const count = refillDue.length;
    const nextRefill = count > 0 ? refillDue[0].name : "No refills due";

    const bridge = await getWidgetBridge();
    if (bridge && bridge.updateRefill) {
      await bridge.updateRefill({ count, nextRefill });
    }

    // The next-dose widget had a provider, a layout, a manifest receiver and a
    // bridge method, and no caller anywhere in src/ - so it has never once
    // displayed anything. Wired here because this function already runs on
    // every medication-state recompute.
    //
    // Masked by default, which is the owner's explicit decision: the widget
    // shows WHEN, never the medication name, and the name is one tap away in
    // the app. A home-screen widget that names your medication is readable by
    // anyone glancing at your unlocked phone, and encrypting the file at rest
    // does nothing about that - it protects the file, not the screen. The
    // persisted disclosure-level control that should ultimately drive this is
    // separate work and belongs in PrivacyScreen, not here.
    if (bridge && bridge.updateNextDose) {
      const state = await getDailyMedsState();
      const nextUnlock = state.upcoming[0]?.unlockAt;
      await bridge.updateNextDose({
        medName: "",
        nextDoseTime: state.due.length
          ? "Dose due now"
          : nextUnlock
            ? `Next at ${new Date(nextUnlock).toTimeString().slice(0, 5)}`
            : "",
      });
    }
  } catch (e) {
    // Widget bridge not available (web) — ignore
    console.debug("Widget update skipped:", e);
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
      smallIcon: moduleSmallIconName("medication"),
      iconColor: ACCENTS.medication,
  });
  return { minutes: prefs.snoozeMinutes };
}
