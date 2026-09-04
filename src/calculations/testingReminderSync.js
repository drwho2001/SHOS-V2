// testingReminderSync.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// The glue between testingCalculations.js's suggestedRoutineRetestDate()
// (already real, already shown on the Testing edit/detail screens as a
// purely informational "routine retest suggested around..." note) and
// notificationService.js's native scheduling — same split doxyPepSync.js/
// medicationReminderSync.js already established: the calculation stays
// pure, this file is the one place that reads real data and decides
// what to do about it. Call syncTestingReminder() on app load (Home) or
// any time a test is saved (Testing) to keep the scheduled reminder
// current.
//
// Deliberately reuses suggestedRoutineRetestDate() rather than a
// separate calculation — that function already gets this right (a
// uniform 3-month interval, matching standard PrEP monitoring's
// quarterly HIV testing rather than an outdated longer HIV-specific
// window; only suggests a retest after a real Negative result, not a
// Positive one, which needs treatment/follow-up instead, not a
// routine retest reminder) — one source of truth for "when's my next
// test due", not two that could quietly drift apart.
import { TestingRepository } from "../repositories/testingRepository";
import { suggestedRoutineRetestDate } from "./testingCalculations";
import { scheduleNotification, cancelNotification, NOTIFICATION_IDS, moduleSmallIconName, TESTING_ACTION_TYPE_ID } from "../storage/notificationService";
import { NotificationPreferencesRepository, isTestingSnoozed } from "../repositories/notificationPreferencesRepository";
import { ACCENTS } from "./designTokens";

// Pure "is a retest due right now" read, shared by syncTestingReminder
// (decides whether to schedule) and App.jsx's in-app due-state banner.
// Same suggestedRoutineRetestDate() source of truth as the schedule
// path below — no separate concept to drift out of sync.
export function getTestingDueState() {
  const tests = TestingRepository.getAll().filter((t) => !t.isArchived && t.date && new Date(t.date) <= new Date());
  if (tests.length === 0) return { due: false };
  const mostRecent = [...tests].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const suggested = suggestedRoutineRetestDate(mostRecent);
  if (!suggested) return { due: false };
  const dueDate = new Date(suggested);
  // FIXED — real bug: "Snooze 30 min" only ever rescheduled the native
  // notification — nothing here checked it, so the in-app banner never
  // actually dismissed. See notificationPreferencesRepository.js's own
  // isTestingSnoozed() comment.
  if (isTestingSnoozed(NotificationPreferencesRepository.getPreferences())) return { due: false, dueDate };
  return { due: dueDate <= new Date(), dueDate };
}

export async function syncTestingReminder() {
  // ADDED — real ask: unified notifications on/off switchboard.
  if (!NotificationPreferencesRepository.getPreferences().testingReminderEnabled) {
    await cancelNotification(NOTIFICATION_IDS.testingReminder);
    return { scheduled: false };
  }
  // Same "real tests only, not scheduled-but-not-yet-happened ones"
  // filter used elsewhere in this app (e.g. getTestingFrequencyStats).
  const tests = TestingRepository.getAll().filter((t) => !t.isArchived && t.date && new Date(t.date) <= new Date());
  if (tests.length === 0) {
    await cancelNotification(NOTIFICATION_IDS.testingReminder);
    return { scheduled: false };
  }

  const mostRecent = [...tests].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const suggested = suggestedRoutineRetestDate(mostRecent);
  if (!suggested) {
    // No suggestion for the most recent test — a Positive result
    // (needs treatment/follow-up, not a routine retest reminder) or no
    // recorded result at all yet.
    await cancelNotification(NOTIFICATION_IDS.testingReminder);
    return { scheduled: false };
  }

  const dueDate = new Date(suggested);
  if (dueDate <= new Date()) {
    // Already past the suggested date by the time this ran — nothing
    // to schedule for a deadline already in the past, same reasoning
    // doxyPepSync.js uses for its own overdue case.
    await cancelNotification(NOTIFICATION_IDS.testingReminder);
    return { scheduled: false, overdue: true };
  }

  // Re-scheduling under the same fixed id naturally replaces whatever
  // was previously pending — logging a newer test just moves the due
  // date forward, it doesn't stack a second reminder.
  await scheduleNotification({
    id: NOTIFICATION_IDS.testingReminder,
    title: "Testing due",
    body: "Routine retest suggested around now — 3 months after your last negative test.",
    at: dueDate,
    actionTypeId: TESTING_ACTION_TYPE_ID,
    smallIcon: moduleSmallIconName("healthcare"),
    iconColor: ACCENTS.healthcare,
  });
  return { scheduled: true, dueDate };
}

// ADDED — real ask: parity with Medication/DoxyPEP's own notification
// action buttons. No "done" action here — see this file's own
// notificationService.js action-type comment for why (logging a real
// test needs a real result form, not a single tap); App.jsx's due-state
// banner instead offers a "Log a test" shortcut into that real form.
export async function handleSnoozeTesting() {
  // FIXED — real bug: this used to only reschedule the native
  // notification — see this file's own getTestingDueState() comment.
  NotificationPreferencesRepository.update({ testingSnoozedUntil: new Date(Date.now() + 30 * 60000).toISOString() });
  await scheduleNotification({
    id: NOTIFICATION_IDS.testingReminder,
    title: "Testing due",
    body: "Reminder snoozed",
    at: new Date(Date.now() + 30 * 60000),
    actionTypeId: TESTING_ACTION_TYPE_ID,
    smallIcon: moduleSmallIconName("healthcare"),
    iconColor: ACCENTS.healthcare,
  });
  return { minutes: 30 };
}
