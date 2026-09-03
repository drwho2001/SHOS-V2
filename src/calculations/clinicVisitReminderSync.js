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
import { scheduleNotification, cancelNotification, NOTIFICATION_IDS, moduleSmallIconName } from "../storage/notificationService";
import { NotificationPreferencesRepository } from "../repositories/notificationPreferencesRepository";
import { ACCENTS } from "./designTokens";
import { realTimestampFromStored } from "./dateInputHelpers";

function getSoonestBookedVisit() {
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
