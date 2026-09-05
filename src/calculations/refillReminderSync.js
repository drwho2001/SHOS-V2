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

// Pure "what currently needs a refill" read, shared by syncRefillReminder
// (decides whether to schedule) and App.jsx's in-app due-state banner
// (same live check, no separate concept to drift out of sync).
export async function getRefillDueMedications() {
  const prefs = await MedicationPreferencesRepository.getPreferences();
  const meds = MedicationRepository.getAll()
    .filter((m) => !m.isArchived && m.inventoryTracked)
    .map((m) => ({ ...m, logs: LogRepository.getForMedication(m.id) }));
  // Already flagged "requested" — the user's already acted on it (see
  // Medication's own markRequested()), a repeat notification for the
  // same low stock would just be noise until it's actually refilled.
  // FIXED — real bug: "Snooze 30 min" only ever rescheduled the native
  // notification, never persisted anything this read checked, so the
  // in-app banner never actually dismissed — see
  // medicationPreferencesRepository.js's own isRefillSnoozed() comment.
  return meds.filter((m) => computeStock(m).needsAction && !m.refillRequestedAt && !isRefillSnoozed(prefs, m.id));
}

export async function syncRefillReminder() {
  if (!NotificationPreferencesRepository.getPreferences().refillReminderEnabled) {
    await cancelNotification(NOTIFICATION_IDS.refillReminder);
    return { scheduled: false };
  }

  const needsRefill = await getRefillDueMedications();

  if (needsRefill.length === 0) {
    await cancelNotification(NOTIFICATION_IDS.refillReminder);
    return { scheduled: false };
  }

  const names = needsRefill.map((m) => m.name).join(", ");
  await scheduleNotification({
    id: NOTIFICATION_IDS.refillReminder,
    title: "Refill needed",
    body: `${names} — running low, time to reorder`,
    at: new Date(Date.now() + 3000),
    actionTypeId: REFILL_ACTION_TYPE_ID,
    smallIcon: moduleSmallIconName("medication"),
    iconColor: ACCENTS.medication,
  });
  return { scheduled: true, needsRefill };
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
export async function handleMarkRefillRequested() {
  const needsRefill = await getRefillDueMedications();
  const names = needsRefill.map((m) => m.name);
  needsRefill.forEach((m) => MedicationRepository.update(m.id, { refillRequestedAt: new Date().toISOString() }));
  return { medications: names };
}

export async function handleSnoozeRefill() {
  const needsRefill = await getRefillDueMedications();
  const names = needsRefill.map((m) => m.name).join(", ");
  // FIXED — real bug: this used to only reschedule the native
  // notification — see medicationPreferencesRepository.js's own
  // isRefillSnoozed() comment for why that never actually dismissed
  // the in-app banner.
  for (const m of needsRefill) await MedicationPreferencesRepository.snoozeRefill(m.id, 30);
  await scheduleNotification({
    id: NOTIFICATION_IDS.refillReminder,
    title: "Refill needed",
    body: names ? `${names} — running low, time to reorder` : "Reminder snoozed",
    at: new Date(Date.now() + 30 * 60000),
    actionTypeId: REFILL_ACTION_TYPE_ID,
    smallIcon: moduleSmallIconName("medication"),
    iconColor: ACCENTS.medication,
  });
  return { minutes: 30 };
}
