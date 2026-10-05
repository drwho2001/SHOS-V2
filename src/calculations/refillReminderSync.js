// refillReminderSync.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: unified notifications, "when refill due". Same three-layer
// split as doxyPepSync.js/medicationReminderSync.js — computeStock()
// in medicationCalculations.js stays the pure "is this low" answer,
// this file is the one place that reads real data and decides what to
// actually schedule.
//
// WHY THIS FIRES IMMEDIATELY RATHER THAN AT A FUTURE TIME: unlike a
// dose interval or a booked appointment, "stock is low" has no future
// timestamp to schedule ahead for — it's already true or not, the
// moment this runs (which is exactly when a dose/refill/waste entry
// was just logged, or the app was just opened). So this schedules a
// few seconds out, same "already due" pattern medicationReminderSync's
// own due-now case already uses, rather than pretending there's a
// real future due-date to count down to.
import { MedicationRepository } from "../repositories/medicationRepository";
import { LogRepository } from "../repositories/logRepository";
import { computeStock } from "./medicationCalculations";
import { scheduleNotification, cancelNotification, NOTIFICATION_IDS, moduleSmallIconName, REFILL_ACTION_TYPE_ID } from "../storage/notificationService";
import { NotificationPreferencesRepository } from "../repositories/notificationPreferencesRepository";
import { MedicationPreferencesRepository, isRefillSnoozed } from "../repositories/medicationPreferencesRepository";
import { ACCENTS } from "./designTokens";
import { AppPreferencesRepository } from "../repositories/appPreferencesRepository";
// Pure module, no imports of its own, so this cannot cycle - and a static
// import matches this file's style rather than medicationReminderSync's
// dynamic one.
import { buildRefillSignature, shouldSuppressDeviceNotification, normaliseAcknowledgements } from "./reminderSuppression";
import { sendWidgetUpdate } from "./widgetBridgeUpdate";
import { redactedWidgetLine } from "./widgetPrivacy";

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
    WidgetBridge = false;
  }
  // WRAPPED, NOT RETURNED BARE. A Capacitor plugin proxy is a catch-all Proxy, so
  // `proxy.then` is a function and the proxy looks thenable; returning it from an
  // async function makes the engine invoke `.then()` on it, which Capacitor
  // rejects as "WidgetBridge.then() is not implemented on android". Verified live
  // on a real device - it threw before the plugin method was ever reached.
  return WidgetBridge ? { plugin: WidgetBridge } : null;
}

// Pure "what currently needs a refill" read, shared by syncRefillReminder
// (decides whether to schedule) and App.jsx's in-app due-state banner
// (same live check, no separate concept to drift out of sync).
export async function getRefillDueMedications() {
  const prefs = await MedicationPreferencesRepository.getPreferences();
  const meds = await Promise.all(
    (await MedicationRepository.getAll())
      .filter((m) => !m.isArchived && m.inventoryTracked)
      .map(async (m) => ({ ...m, logs: await LogRepository.getForMedication(m.id) }))
  );
  // Already flagged "requested" — the user's already acted on it (see
  // Medication's own markRequested()), a repeat notification for the
  // same low stock would just be noise until it's actually refilled.
  // FIXED — real bug: "Snooze 30 min" only ever rescheduled the native
  // notification, never persisted anything this read checked, so the
  // in-app banner never actually dismissed — see
  // medicationPreferencesRepository.js's own isRefillSnoozed() comment.
  // ADDED 16 Sep 2026 — refillCancelledAt is the same kind of
  // suppression as refillRequestedAt (cleared by the next real logged
  // refill), just without implying an order was actually placed — see
  // the banner's own "Cancel" action in App.jsx.
  return meds.filter((m) => computeStock(m).needsAction && !m.refillRequestedAt && !m.refillCancelledAt && !isRefillSnoozed(prefs, m.id));
}

// ADDED 29 Sep 2026 (Phase 3, t013) - the SECOND stage. Marking a refill
// "requested" currently makes the item disappear completely: getRefillDueMedications
// above filters it out, so the in-app banner stops, the notification stops, and
// the only trace is one line on the medication card. If the pharmacy is out of
// stock, or you simply forget, nothing ever brings it back - which is the same
// silent-loss shape this feature was built to fix, one stage later.
//
// This is DERIVED, not a second stored flag. `refillRequestedAt` is the fact
// ("you asked for this"); whether it is still outstanding is calculated from
// live stock, so logging the refill retires it automatically with no second
// write and no way for the two to disagree. That is the repo's own "store
// facts, derive state" rule, and the reason there is no `refillCollectedAt`.
//
// DELIBERATELY NO TIMER. It is tempting to bring this back after N days, and
// there is no sourced number for N - which is exactly the trap the medication
// lockout's 0.8 and 0.2 factors fell into before the NHS figures were found.
// So the second stage does not nag: it is a passive count, and the item clears
// itself the moment a refill is logged. A reminder that re-appears forever is
// the behaviour this whole feature was built to remove.
//
// `needsAction` is re-checked rather than assumed: if stock recovered on its own
// (say a correction), there is nothing left to collect.
export async function getRefillAwaitingCollection() {
  const meds = await Promise.all(
    (await MedicationRepository.getAll())
      .filter((m) => !m.isArchived && m.inventoryTracked)
      .map(async (m) => ({ ...m, logs: await LogRepository.getForMedication(m.id) }))
  );
  return meds.filter(
    (m) => !!m.refillRequestedAt && !m.refillCancelledAt && computeStock(m).needsAction
  );
}

// ADDED 29 Sep 2026 (t013) - the way back. Marking a refill "requested" hides
// the action that marked it, so a mis-tap on a small button had NO route out
// except logging a refill that never happened. That is the same defect as a
// persisted silence with no escape, which this repo has recorded as a rule
// rather than a preference: one wrong tap must not mean a medication is
// invisible until the user works out why.
//
// It clears BOTH suppression timestamps, not just `refillRequestedAt`, because
// "I didn't order this" and "I cancelled this" are the same statement about the
// same item, and leaving one behind would make it vanish again for a reason the
// user cannot see.
export async function handleUndoRefillRequest(ids = null) {
  const meds = (await getRefillAwaitingCollection()).filter((m) => !ids || ids.includes(m.id));
  const names = meds.map((m) => m.name);
  for (const m of meds) {
    await MedicationRepository.update(m.id, { refillRequestedAt: null, refillCancelledAt: null });
  }
  return { medications: names };
}

export async function syncRefillReminder() {
  if (!(await NotificationPreferencesRepository.getPreferences()).refillReminderEnabled) {
    await cancelNotification(NOTIFICATION_IDS.refillReminder);
    return { scheduled: false };
  }

  const needsRefill = await getRefillDueMedications();

  if (needsRefill.length === 0) {
    await cancelNotification(NOTIFICATION_IDS.refillReminder);
    await updateRefillWidget();
    return { scheduled: false };
  }

  const names = needsRefill.map((m) => m.name).join(", ");

  // ADDED 29 Sep 2026 (Phase 3 / A3) - device-silence, which was wired ONLY for
  // medications, so "also stop my phone notifying me" silently did nothing on
  // this banner.
  //
  // This is the kind where the bug is real rather than theoretical, and it is
  // worth being precise about why. The schedule below uses `at: now + 3s`, and
  // this function runs on the 60-second poll, on mount, and on data change -
  // so while a refill is outstanding the phone was re-armed three seconds out
  // over and over. The banner said "stop reminding me" and the device kept
  // buzzing. Signature-based, so it lasts only while this exact set of
  // medications is outstanding: reorder, and a genuinely new reminder is free
  // to speak up again.
  const appPrefs = await AppPreferencesRepository.getPreferences();
  const acknowledged = normaliseAcknowledgements(
    (await AppPreferencesRepository.getPreferences()).acknowledgedReminders
  );
  if (shouldSuppressDeviceNotification(buildRefillSignature(needsRefill), acknowledged, appPrefs.reminderSuppressionEnabled !== false)) {
    await cancelNotification(NOTIFICATION_IDS.refillReminder);
    await updateRefillWidget();
    return { scheduled: false, acknowledged: true };
  }

  await scheduleNotification({
    id: NOTIFICATION_IDS.refillReminder,
    title: "Refill needed",
    body: `${names} — running low, time to reorder`,
    at: new Date(Date.now() + 3000),
    actionTypeId: REFILL_ACTION_TYPE_ID,
    kind: "Refill reminder",
    smallIcon: moduleSmallIconName("medication"),
    iconColor: ACCENTS.medication,
  });
  await updateRefillWidget();
  return { scheduled: true, needsRefill };
}

export async function updateRefillWidget() {
  try {
    const { getRefillDueMedications } = await import("./refillReminderSync");
    const needsRefill = await getRefillDueMedications();
    const count = needsRefill.length;
    const nextRefill = count > 0 ? needsRefill[0].name : "No refills due";

    const bridge = await getWidgetBridge();
    if (bridge && bridge.plugin.updateRefill) {
      // CHANGED 2 Oct 2026 - routed through sendWidgetUpdate. NOTE this
      // function's twin in medicationReminderSync.js sends the same payload to
      // the same bridge method; both are wired to the shared helper so neither
      // can drift from the tier rule, but the duplication itself is still worth
      // collapsing. Left as-is rather than refactored mid-change.
      await sendWidgetUpdate(bridge, "refillDue", "updateRefill", { count, nextRefill, category: "Refills" },
        refillRedactedLine(count));
    }
  } catch (e) {
    // Widget bridge not available (web) — ignore
    console.debug("Widget update skipped:", e);
  }
}

// ADDED — real ask: parity with Medication/DoxyPEP's own notification
// action buttons. Mirrors Medication Dashboard's existing one-tap
// markRequested() exactly (same field, same real-UTC timestamp
// convention — refillRequestedAt is only ever shown at day granularity
// via daysFromNow(), never an exact time, so real-UTC here matches
// existing precedent rather than needing the fake-UTC helper). Marking
// every currently-due medication as requested naturally clears them
// from getRefillDueMedications() on the next sync, so re-syncing here
// is what actually cancels the notification/banner — same "acting
// clears the reminder" pattern Take-all uses for medication doses.
// `ids`, when given, scopes the action to that subset of currently-due
// medications instead of all of them — used by App.jsx's own banner to
// keep the fuller Requested/Snooze-2h/Snooze-1-day/Cancel action set
// (real ask, 16 Sep 2026) scoped to repeating (daily/custom) medications
// only, never touching a PRN medication that happens to be due at the
// same time.
export async function handleMarkRefillRequested(ids = null) {
  const needsRefill = (await getRefillDueMedications()).filter((m) => !ids || ids.includes(m.id));
  const names = needsRefill.map((m) => m.name);
  for (const m of needsRefill) await MedicationRepository.update(m.id, { refillRequestedAt: new Date().toISOString() });
  return { medications: names };
}

// ADDED 16 Sep 2026 — real ask: a "Cancel" action distinct from
// Requested — "I'm not refilling this cycle" rather than "I've ordered
// it" — see medicationRepository.js's own refillCancelledAt comment
// for why this is a temporary suppression (cleared by the next real
// logged refill), not a permanent dismissal.
export async function handleCancelRefill(ids = null) {
  const needsRefill = (await getRefillDueMedications()).filter((m) => !ids || ids.includes(m.id));
  const names = needsRefill.map((m) => m.name);
  for (const m of needsRefill) await MedicationRepository.update(m.id, { refillCancelledAt: new Date().toISOString() });
  return { medications: names };
}

// CHANGED 16 Sep 2026 — real ask: "Snooze 30 min" replaced with
// Snooze 2h/Snooze 1 day for repeating medications (a 30-minute
// refill-reminder snooze rarely gives enough real time to actually
// place an order) — minutes is now a real parameter instead of a
// hardcoded 30, kept as the default for any caller that doesn't
// specify one (e.g. a native notification action).
export async function handleSnoozeRefill(minutes = 30, ids = null) {
  const needsRefill = (await getRefillDueMedications()).filter((m) => !ids || ids.includes(m.id));
  const names = needsRefill.map((m) => m.name).join(", ");
  // FIXED — real bug: this used to only reschedule the native
  // notification — see medicationPreferencesRepository.js's own
  // isRefillSnoozed() comment for why that never actually dismissed
  // the in-app banner.
  for (const m of needsRefill) await MedicationPreferencesRepository.snoozeRefill(m.id, minutes);
  await scheduleNotification({
    id: NOTIFICATION_IDS.refillReminder,
    title: "Refill needed",
    body: names ? `${names} — running low, time to reorder` : "Reminder snoozed",
    at: new Date(Date.now() + minutes * 60000),
    actionTypeId: REFILL_ACTION_TYPE_ID,
    kind: "Refill reminder",
    smallIcon: moduleSmallIconName("medication"),
    iconColor: ACCENTS.medication,
  });
  return { minutes };
}

/**
 * ADDED 5 Oct 2026 (t059 follow-on) - the Redacted line for the Refills widget.
 *
 * BOTH this file and medicationReminderSync.js push refillDue, so the builder
 * exists in both rather than being imported across a pusher boundary that exists
 * only because syncAllWidgets lists them as one entry. Deliberate duplication,
 * recorded here rather than collapsed mid-change.
 *
 * ALLOWED_AT_REDACTED permits category + count, so the line carries how many
 * medications are low and drops the medication NAME - the field that discloses,
 * since a named medication on a home screen states what the user takes.
 */
export function refillRedactedLine(count) {
  const n = Number(count);
  return redactedWidgetLine("Refills", Number.isFinite(n) && n > 0 ? `${n} due` : "all stocked");
}
