// vaccinationReminderSync.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real gap found auditing the full notification system (16 Sep 2026):
// every other real reminder type (Medication/DoxyPEP/Testing/Refill/
// Clinic-visit) already has its own *ReminderSync.js file — Vaccinations
// never got one at all, despite vaccinationRepository.js's own real
// `nextDue` field (already used for multi-dose courses like Hepatitis
// A/B) being exactly the kind of date this app's other reminder types
// already alert on. Deliberately simpler than Medication's own
// adaptive/fixed-timing + streak/adherence machinery, per the real ask
// that this doesn't need feature parity — a vaccination due-date has
// no "dose interval" or "streak" concept, just a single date not to
// miss. Same three-layer split and single-fixed-slot shape as
// testingReminderSync.js: one place reads real data and decides what
// to schedule, no separate calculation file needed for something this
// simple.
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { scheduleNotification, cancelNotification, NOTIFICATION_IDS, moduleSmallIconName, VACCINATION_ACTION_TYPE_ID } from "../storage/notificationService";
import { NotificationPreferencesRepository, isVaccinationSnoozed } from "../repositories/notificationPreferencesRepository";
import { ACCENTS } from "./designTokens";

// nextDue is a plain "YYYY-MM-DD" calendar date (a <input type="date">
// value — see SHOS_Vaccinations_Prototype.jsx's own isOverdue(), which
// compares it as a plain string), not this app's fake-UTC full-datetime
// convention (dateInputHelpers.js) — there's no time-of-day recorded at
// all. Scheduling at a fixed 9am local on that date is an honest
// "sometime that day" reminder, not a claim of precision the underlying
// data doesn't actually have.
function nextDueAsDate(nextDue) {
  return new Date(`${nextDue}T09:00:00`);
}

function soonestDueVaccination(vaccinations) {
  const withDue = vaccinations.filter((v) => !v.isArchived && v.nextDue);
  if (withDue.length === 0) return null;
  return withDue.reduce((a, b) => (a.nextDue < b.nextDue ? a : b));
}

// Pure "is a vaccination due right now" read, shared by
// syncVaccinationReminders (decides whether to schedule) and App.jsx's
// in-app due-state banner — same shape as every other reminder type's
// own getXDueState().
export async function getVaccinationDueState() {
  const soonest = soonestDueVaccination(await VaccinationRepository.getAll());
  if (!soonest) return { due: false };
  const dueDate = nextDueAsDate(soonest.nextDue);
  if (isVaccinationSnoozed(await NotificationPreferencesRepository.getPreferences())) {
    return { due: false, vaccination: soonest, dueDate };
  }
  return { due: dueDate <= new Date(), vaccination: soonest, dueDate };
}

export async function syncVaccinationReminders() {
  if (!(await NotificationPreferencesRepository.getPreferences()).vaccinationReminderEnabled) {
    await cancelNotification(NOTIFICATION_IDS.vaccinationReminder);
    return { scheduled: false };
  }

  const soonest = soonestDueVaccination(await VaccinationRepository.getAll());
  if (!soonest) {
    await cancelNotification(NOTIFICATION_IDS.vaccinationReminder);
    return { scheduled: false };
  }

  const dueDate = nextDueAsDate(soonest.nextDue);
  // Already past due by the time this ran — schedule a few seconds
  // out, same "already due" pattern medicationReminderSync/
  // refillReminderSync use, rather than a future timestamp that's
  // actually in the past.
  const at = dueDate <= new Date() ? new Date(Date.now() + 3000) : dueDate;
  await scheduleNotification({
    id: NOTIFICATION_IDS.vaccinationReminder,
    title: "Vaccination due",
    body: `${soonest.vaccine || soonest.title || "Vaccine dose"} — next dose due`,
    at,
    actionTypeId: VACCINATION_ACTION_TYPE_ID,
    smallIcon: moduleSmallIconName("healthcare"),
    iconColor: ACCENTS.healthcare,
  });
  return { scheduled: true, dueDate };
}

// ADDED — real ask: parity with Testing/Clinic-visit's own snooze
// action. No "done" action here for the same reason those two have
// none — logging a real vaccination dose needs a real form (vaccine/
// site/date), not a single tap; App.jsx's due-state banner instead
// offers a "View" shortcut into that real record.
export async function handleSnoozeVaccination() {
  await NotificationPreferencesRepository.update({ vaccinationSnoozedUntil: new Date(Date.now() + 30 * 60000).toISOString() });
  await scheduleNotification({
    id: NOTIFICATION_IDS.vaccinationReminder,
    title: "Vaccination due",
    body: "Reminder snoozed",
    at: new Date(Date.now() + 30 * 60000),
    actionTypeId: VACCINATION_ACTION_TYPE_ID,
    smallIcon: moduleSmallIconName("healthcare"),
    iconColor: ACCENTS.healthcare,
  });
  return { minutes: 30 };
}
