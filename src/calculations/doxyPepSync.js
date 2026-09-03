// doxyPepSync.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// The glue between doxyPepCalculations.js (pure logic) and
// notificationService.js (native scheduling). Deliberately kept
// separate from both: doxyPepCalculations.js stays a pure, easily
// tested function with no repository/plugin dependencies;
// notificationService.js stays generic and DoxyPEP-unaware. This file
// is the one place that reads real data and decides what to do about
// it — call syncDoxyPepAlert() any time something that could change
// the countdown just happened (a new Activity saved, a DoxyPEP dose
// logged) or on app load to catch up on current state.
import { EncounterRepository } from "../repositories/encounterRepository";
import { MedicationRepository } from "../repositories/medicationRepository";
import { LogRepository } from "../repositories/logRepository";
import { getDoxyPepStatus, findDoxyPepMedication } from "./doxyPepCalculations";
import { scheduleNotification, cancelNotification, registerNotificationActionTypes, NOTIFICATION_IDS, DOXYPEP_ACTION_TYPE_ID, moduleSmallIconName } from "../storage/notificationService";
import { NotificationPreferencesRepository } from "../repositories/notificationPreferencesRepository";
import { ACCENTS } from "./designTokens";
import { nowAsStoredDateTime } from "./dateInputHelpers";

// ADDED — real ask: unified notifications on/off switchboard. Gates
// only the NATIVE notification below — the returned `status` object
// (what Home's own in-app banner reads) is computed and returned
// unconditionally either way, since turning off the notification was
// never a request to hide the in-app warning too.
export async function syncDoxyPepAlert() {
  const notifsEnabled = NotificationPreferencesRepository.getPreferences().doxyPepAlertEnabled;
  const doxyMed = findDoxyPepMedication(MedicationRepository.getAll());
  // No DoxyPEP medication set up at all — nothing to track, and
  // nothing should be left scheduled from a stale earlier state.
  if (!doxyMed) {
    await cancelNotification(NOTIFICATION_IDS.doxyPepAlert);
    return { active: false };
  }

  const encounters = EncounterRepository.getAll();
  const doxyLogs = LogRepository.getForMedication(doxyMed.id);
  const status = getDoxyPepStatus(encounters, doxyLogs);

  if (!status.active) {
    // Covers both "never needed it" and "dose was just logged,
    // clearing an active countdown" — either way, nothing should be
    // pending at the OS level.
    await cancelNotification(NOTIFICATION_IDS.doxyPepAlert);
    return status;
  }

  if (status.overdue) {
    // Already past the window by the time this ran (e.g. app was
    // closed through the deadline) — nothing to schedule for the
    // future; the in-app banner (see SHOS_Home_Prototype.jsx) is what
    // surfaces this case, since a native notification can't be
    // usefully scheduled for a time already in the past.
    await cancelNotification(NOTIFICATION_IDS.doxyPepAlert);
    return status;
  }

  if (!notifsEnabled) {
    await cancelNotification(NOTIFICATION_IDS.doxyPepAlert);
    return status;
  }

  // ADDED — real ask: real Take dose/Remind in 30 action buttons,
  // same pattern as Medication's own dose reminders (see
  // notificationService.js's own comment on why a tappable action
  // button doesn't conflict with "DoxyPEP dosing must stay manual").
  await registerNotificationActionTypes();

  // Re-scheduling under the same fixed id naturally replaces any
  // previously-pending alert (e.g. a later qualifying activity within
  // the same still-open window doesn't move the deadline, per
  // doxyPepCalculations.js's own anchoring rule, so this is usually a
  // no-op reschedule to the same time — still safe/idempotent).
  await scheduleNotification({
    id: NOTIFICATION_IDS.doxyPepAlert,
    title: "DoxyPEP dose due",
    body: "It's been close to 72 hours since your last qualifying activity — take your DoxyPEP dose if you haven't already.",
    at: status.deadline,
    actionTypeId: DOXYPEP_ACTION_TYPE_ID,
    smallIcon: moduleSmallIconName("home"),
    iconColor: ACCENTS.home,
  });
  return status;
}

// Handlers for the two real actions — called from the app-level
// notification action listener (App.jsx), same reasoning as
// medicationReminderSync's own handleTakeAll/handleSnooze: a
// notification tap can happen regardless of which screen is currently
// open, so dispatch lives at the shell level, not a module.
// CHANGED 3 Sep 2026 — real ask: "clear notification awareness" — this
// used to run completely silently (App.jsx's action listener called it
// with no confirmation of any kind), the exact same gap medication's
// own Take/Skip/Snooze had before that got fixed — now returns what
// actually happened so App.jsx can show the same real toast.
//
// Also fixed the SAME date-storage bug found while making this change:
// this stored a genuine real-UTC `new Date().toISOString()` while every
// other dose-logging path in this app stores its own fake-UTC
// convention (dateInputHelpers.js) — the manual "Log dose" button was
// fixed earlier this session, medicationReminderSync.js's own
// handleTakeAll() just now, and this was the one remaining real
// dose-logging path still doing it the old, wrong way. A dose logged
// here would display up to 1h off during BST, and feed wrong into
// getDoxyPepStatus()'s own realTimestampFromStored() call
// (doxyPepCalculations.js), which assumes every stored dose date
// follows the fake-UTC convention.
export function handleTakeDoxyDose() {
  const doxyMed = findDoxyPepMedication(MedicationRepository.getAll());
  if (!doxyMed) return { medications: [] };
  LogRepository.create({ medicationId: doxyMed.id, type: "dose", delta: -doxyMed.unitsPerDose, date: nowAsStoredDateTime() });
  syncDoxyPepAlert();
  return { medications: [doxyMed.name] };
}

export function handleSnoozeDoxy() {
  scheduleNotification({
    id: NOTIFICATION_IDS.doxyPepAlert,
    title: "DoxyPEP dose due",
    body: "Reminder snoozed",
    at: new Date(Date.now() + 30 * 60000),
    actionTypeId: DOXYPEP_ACTION_TYPE_ID,
    smallIcon: moduleSmallIconName("home"),
    iconColor: ACCENTS.home,
  });
  return { minutes: 30 };
}
