// clinicVisitReminderSync.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "setup reminder for clinic visit - IE actual booked
// appointment, 24 & 2h in advance (or custom)." A Clinic Visit with
// isFutureAppointment on IS the "actually booked" concept — this
// doesn't invent a new one. Same three-layer split as every other
// sync file this session: this is the one place that reads real data
// (the soonest upcoming booked visit) and decides what to schedule.
//
// TWO FIXED REMINDER SLOTS, not an arbitrary list: notificationPreferencesRepository.js
// holds exactly two independently toggleable/editable offsets (default
// 24h and 2h, matching the user's own named example exactly). That
// keeps each one mapped to its own fixed notification id — no need to
// schedule a variable number of native notifications per visit.
//
// ONLY THE SOONEST upcoming booked visit is tracked. Realistically
// there's one appointment actually on the calendar at a time; if more
// than one is booked, whichever is soonest is the one actually worth a
// countdown right now — the same "earliest" reasoning
// medicationReminderSync already uses for its own "upcoming" case.
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { scheduleNotification, cancelNotification, NOTIFICATION_IDS, moduleSmallIconName, CLINIC_VISIT_ACTION_TYPE_ID } from "../storage/notificationService";
import { NotificationPreferencesRepository } from "../repositories/notificationPreferencesRepository";
import { ACCENTS } from "./designTokens";
import { realTimestampFromStored } from "./dateInputHelpers";

export function getSoonestBookedVisit() {
  const nowMs = Date.now();
  const booked = ClinicVisitsRepository.getAll()
    .filter((v) => !v.isArchived && v.isFutureAppointment && v.date && realTimestampFromStored(v.date) > nowMs);
  if (booked.length === 0) return null;
  return booked.reduce((a, b) => (realTimestampFromStored(a.date) < realTimestampFromStored(b.date) ? a : b));
}

async function syncOneSlot({ visit, enabled, hoursBefore, notificationId, label }) {
  if (!enabled || !visit) {
    await cancelNotification(notificationId);
    return { scheduled: false };
  }
  // realTimestampFromStored, not a plain new Date(visit.date): the
  // visit's date is this app's stored fake-UTC string (see
  // dateInputHelpers.js) — diffing it the plain way against a real
  // Date would shift this reminder's offset by up to an hour (BST/GMT).
  const reminderAt = new Date(realTimestampFromStored(visit.date) - hoursBefore * 3600000);
  if (reminderAt <= new Date()) {
    // Already inside this reminder's own window (or past it) by the
    // time this ran — nothing to schedule for a time already in the
    // past, same reasoning every other sync file here uses.
    await cancelNotification(notificationId);
    return { scheduled: false };
  }
  await scheduleNotification({
    id: notificationId,
    title: "Upcoming clinic appointment",
    body: `${visit.title || "Appointment"} — ${label}`,
    at: reminderAt,
    actionTypeId: CLINIC_VISIT_ACTION_TYPE_ID,
    smallIcon: moduleSmallIconName("healthcare"),
    iconColor: ACCENTS.healthcare,
  });
  return { scheduled: true, reminderAt };
}

export async function syncClinicVisitReminders() {
  const prefs = NotificationPreferencesRepository.getPreferences();
  const visit = getSoonestBookedVisit();

  const resultA = await syncOneSlot({
    visit,
    enabled: prefs.clinicVisitReminderAEnabled,
    hoursBefore: prefs.clinicVisitReminderAHours,
    notificationId: NOTIFICATION_IDS.clinicVisitReminderA,
    label: `in ${prefs.clinicVisitReminderAHours}h`,
  });
  const resultB = await syncOneSlot({
    visit,
    enabled: prefs.clinicVisitReminderBEnabled,
    hoursBefore: prefs.clinicVisitReminderBHours,
    notificationId: NOTIFICATION_IDS.clinicVisitReminderB,
    label: `in ${prefs.clinicVisitReminderBHours}h`,
  });

  return { visit, resultA, resultB };
}

// ADDED — real ask: in-app due-state awareness, same as Medication's
// own due-meds banner. "Due" here means we're inside EITHER reminder
// slot's own window (reminderAt has passed) for the soonest booked
// visit, and the visit itself hasn't happened yet — a plain future
// booking with neither slot's window reached yet is not "due".
export function getClinicVisitDueState() {
  const prefs = NotificationPreferencesRepository.getPreferences();
  const visit = getSoonestBookedVisit();
  if (!visit) return { due: false };
  const nowMs = Date.now();
  const slots = [
    { enabled: prefs.clinicVisitReminderAEnabled, hoursBefore: prefs.clinicVisitReminderAHours },
    { enabled: prefs.clinicVisitReminderBEnabled, hoursBefore: prefs.clinicVisitReminderBHours },
  ];
  const due = slots.some(
    (s) => s.enabled && realTimestampFromStored(visit.date) - s.hoursBefore * 3600000 <= nowMs
  );
  return { due, visit };
}

// ADDED — real ask: parity with Medication/DoxyPEP's own notification
// action buttons. Both fixed reminder slots share one snooze action
// rather than needing to know which specific slot fired — see this
// file's own NOTIFICATION_IDS comment: both are for the same underlying
// booked visit, so snoozing re-arms both 30 minutes out with the same
// "reminder snoozed" body, no orphaned slot either way.
export async function handleSnoozeClinicVisit() {
  const visit = getSoonestBookedVisit();
  const body = visit ? `${visit.title || "Appointment"} — reminder snoozed` : "Reminder snoozed";
  const at = new Date(Date.now() + 30 * 60000);
  await scheduleNotification({
    id: NOTIFICATION_IDS.clinicVisitReminderA,
    title: "Upcoming clinic appointment",
    body,
    at,
    actionTypeId: CLINIC_VISIT_ACTION_TYPE_ID,
    smallIcon: moduleSmallIconName("healthcare"),
    iconColor: ACCENTS.healthcare,
  });
  await scheduleNotification({
    id: NOTIFICATION_IDS.clinicVisitReminderB,
    title: "Upcoming clinic appointment",
    body,
    at,
    actionTypeId: CLINIC_VISIT_ACTION_TYPE_ID,
    smallIcon: moduleSmallIconName("healthcare"),
    iconColor: ACCENTS.healthcare,
  });
  return { minutes: 30 };
}
