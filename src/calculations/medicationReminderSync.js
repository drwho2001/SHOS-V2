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
// SCOPE: based on daily-pattern medications only, per the user's explicit
// "base it on daily meds" — PRN and custom-interval medications are
// not part of this reminder system (PRN has no fixed due time to
// remind about; custom-interval could be added later the same way if
// wanted, not done here).
import { MedicationRepository } from "../repositories/medicationRepository";
import { MedicationPreferencesRepository, isSkippedToday } from "../repositories/medicationPreferencesRepository";
import { LogRepository } from "../repositories/logRepository";
import { isDoseLockedOut, lockoutEndsAt } from "./medicationCalculations";
import { scheduleNotification, cancelNotification, registerNotificationActionTypes, NOTIFICATION_IDS, MEDICATION_ACTION_TYPE_ID, moduleSmallIconName } from "../storage/notificationService";

function getDailyMedsState() {
  const meds = MedicationRepository.getAll().filter((m) => !m.isArchived && m.usagePattern === "daily");
  const prefs = MedicationPreferencesRepository.getPreferences();

  const due = [];
  const upcoming = [];
  for (const med of meds) {
    if (isSkippedToday(prefs, med.id)) continue;
    const logs = LogRepository.getForMedication(med.id);
    const lastDose = [...logs].filter((l) => l.type === "dose" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (!lastDose || !isDoseLockedOut(med, lastDose.date)) {
      due.push(med);
    } else {
      const unlockAt = lockoutEndsAt(med, lastDose.date);
      if (unlockAt) upcoming.push({ med, unlockAt });
    }
  }
  return { due, upcoming };
}

export async function syncMedicationReminders() {
  const prefs = MedicationPreferencesRepository.getPreferences();
  if (!prefs.doseRemindersEnabled) {
    await cancelNotification(NOTIFICATION_IDS.medicationReminder);
    return { scheduled: false };
  }

  await registerNotificationActionTypes();

  const { due, upcoming } = getDailyMedsState();

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
    });
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
    });
    return { scheduled: true, upcoming: earliest };
  }

  // No daily meds at all — nothing to schedule, and nothing stale
  // should be left pending either.
  await cancelNotification(NOTIFICATION_IDS.medicationReminder);
  return { scheduled: false };
}

// Handlers for the three real actions — called from the app-level
// notification action listener (App.jsx, a genuine cross-cutting
// concern since a notification tap can happen regardless of which
// screen is currently open, same reasoning as the hardware back
// button living there).
export function handleTakeAll() {
  const { due } = getDailyMedsState();
  const timestamp = new Date().toISOString();
  due.forEach((m) => LogRepository.create({ medicationId: m.id, type: "dose", delta: -m.unitsPerDose, date: timestamp }));
  syncMedicationReminders();
}

export function handleSkipToday() {
  const { due } = getDailyMedsState();
  due.forEach((m) => MedicationPreferencesRepository.skipUntilTomorrow(m.id));
  syncMedicationReminders();
}

export function handleSnooze() {
  const prefs = MedicationPreferencesRepository.getPreferences();
  scheduleNotification({
    id: NOTIFICATION_IDS.medicationReminder,
    title: "Medication due",
    body: "Reminder snoozed",
    at: new Date(Date.now() + prefs.snoozeMinutes * 60000),
    actionTypeId: MEDICATION_ACTION_TYPE_ID,
      smallIcon: moduleSmallIconName("medication"),
  });
}
