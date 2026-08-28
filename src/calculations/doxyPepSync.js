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
import { scheduleNotification, cancelNotification, NOTIFICATION_IDS, moduleSmallIconName } from "../storage/notificationService";
import { NotificationPreferencesRepository } from "../repositories/notificationPreferencesRepository";
import { ACCENTS } from "./designTokens";

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
    smallIcon: moduleSmallIconName("home"),
    iconColor: ACCENTS.home,
  });
  return status;
}
