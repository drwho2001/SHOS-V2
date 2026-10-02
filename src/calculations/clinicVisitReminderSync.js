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
import { NotificationPreferencesRepository, isClinicVisitSnoozed } from "../repositories/notificationPreferencesRepository";
import { ACCENTS } from "./designTokens";
import { realTimestampFromStored } from "./dateInputHelpers";
import { AppPreferencesRepository } from "../repositories/appPreferencesRepository";
import { buildClinicVisitSignature, shouldSuppressDeviceNotification, normaliseAcknowledgements } from "./reminderSuppression";
import { sendWidgetUpdate } from "./widgetBridgeUpdate";

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

export async function getSoonestBookedVisit() {
  const nowMs = Date.now();
  const booked = (await ClinicVisitsRepository.getAll())
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
    kind: "Clinic appointment",
    smallIcon: moduleSmallIconName("healthcare"),
    iconColor: ACCENTS.healthcare,
  });
  return { scheduled: true, reminderAt };
}

export async function syncClinicVisitReminders() {
  const prefs = await NotificationPreferencesRepository.getPreferences();
  const visit = await getSoonestBookedVisit();

  // ADDED 29 Sep 2026 (Phase 3 / A3) - device-silence, previously wired only for
  // medications. Same honest scope as testing: syncOneSlot already cancels once
  // it is inside the window, so there is no repeat to suppress here. This makes
  // the banner's promise hold on all four kinds, and covers a genuine
  // gap - there are TWO slots (A and B) each with their own notification id, so
  // a partial implementation would have left one of them buzzing after the user
  // said stop. Both are cancelled.
  const appPrefs = await AppPreferencesRepository.getPreferences();
  const acknowledged = normaliseAcknowledgements(
    (await AppPreferencesRepository.getPreferences()).acknowledgedReminders
  );
  if (shouldSuppressDeviceNotification(
    buildClinicVisitSignature(await getClinicVisitDueState()), // returns { due, visit }
    acknowledged, appPrefs.reminderSuppressionEnabled !== false
  )) {
    await cancelNotification(NOTIFICATION_IDS.clinicVisitReminderA);
    await cancelNotification(NOTIFICATION_IDS.clinicVisitReminderB);
    return { scheduled: false, acknowledged: true };
  }

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

  await updateAppointmentWidget(visit);
  await updateClinicCardWidget(visit);
  return { visit, resultA, resultB };
}

async function updateAppointmentWidget(visit) {
  try {
    const count = visit ? 1 : 0;
    const nextAppt = visit
      ? `${visit.title || "Appointment"} — ${new Date(realTimestampFromStored(visit.date)).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
      : "No appointments";

    const bridge = await getWidgetBridge();
if (bridge && bridge.plugin.updateAppointment) {
        // CHANGED 2 Oct 2026 - routed through sendWidgetUpdate, so the Redacted
        // and Off tiers in Settings now reach this widget at all.
        await sendWidgetUpdate(bridge, "nextAppointment", "updateAppointment", {
          count,
          nextAppt,
          category: "Appointments",
        },
        // A count identifies nobody. The DATE, the LOCATION and the reason for the
        // visit do not, and the clinical reason is behind the owner's own opt-in.
        count > 0 ? `Appointments: ${count} booked` : "Appointments: none booked"
      );
    }
  } catch (e) {
    // Widget bridge not available (web) — ignore
    console.debug("Widget update skipped:", e);
  }
}

async function updateClinicCardWidget(visit) {
  try {
    const bridge = await getWidgetBridge();
    if (bridge && bridge.plugin.updateClinicCard) {
      const tests = visit.linkedTestIds?.length || 0;
      const testsStr = tests > 0 ? `${tests} test${tests > 1 ? "s" : ""}` : "None";
      const docType = visit.visitType || "";
      const clinicNum = visit.clinicNumber || "";
      const nhsNum = visit.nhsNumber || "";

      // CHANGED 2 Oct 2026 - routed through sendWidgetUpdate. This widget
      // discloses more than any other: a location, a test count and a date.
      //
      // nhsNum is still sent and is still discarded by the bridge, which is
      // deliberate and load-bearing rather than an oversight - see
      // widgetPlaintextSink.test.js, which fails if it is ever written.
      await sendWidgetUpdate(bridge, "clinicCard", "updateClinicCard", {
        title: visit.title || "Appointment",
        date: visit.date ? new Date(realTimestampFromStored(visit.date)).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "",
        location: visit.location || "",
        tests: testsStr,
        docType,
        clinicNum,
        nhsNum,
        // category/count are all that survive a Redacted tier. A test count is
        // allowed deliberately: "3 tests" identifies nobody, and it is the one
        // number worth having without handing over the rest.
          category: "Clinic card",
          count: tests,
        },
        // A test count is allowed deliberately - "3 tests" identifies nobody and it
        // is the one number worth having without handing over the rest. The
        // location, the date and the clinic are not here.
        tests > 0
          ? `Clinic card: ${tests} test${tests > 1 ? "s" : ""} linked`
          : "Clinic card: no tests linked"
      );
    }
  } catch (e) {
    console.debug("ClinicCard widget update skipped:", e);
  }
}

// ADDED — real ask: in-app due-state awareness, same as Medication's
// own due-meds banner. "Due" here means we're inside EITHER reminder
// slot's own window (reminderAt has passed) for the soonest booked
// visit, and the visit itself hasn't happened yet — a plain future
// booking with neither slot's window reached yet is not "due".
export async function getClinicVisitDueState() {
  const prefs = await NotificationPreferencesRepository.getPreferences();
  const visit = await getSoonestBookedVisit();
  if (!visit) return { due: false };
  const nowMs = Date.now();
  const slots = [
    { enabled: prefs.clinicVisitReminderAEnabled, hoursBefore: prefs.clinicVisitReminderAHours },
    { enabled: prefs.clinicVisitReminderBEnabled, hoursBefore: prefs.clinicVisitReminderBHours },
  ];
  const due = slots.some(
    (s) => s.enabled && realTimestampFromStored(visit.date) - s.hoursBefore * 3600000 <= nowMs
  );
  // FIXED — real bug: "Snooze 30 min" only ever rescheduled the native
  // notification — nothing here checked it, so the in-app banner never
  // actually dismissed. See notificationPreferencesRepository.js's own
  // isClinicVisitSnoozed() comment.
  if (due && isClinicVisitSnoozed(prefs)) return { due: false, visit };
  return { due, visit };
}

// ADDED — real ask: parity with Medication/DoxyPEP's own notification
// action buttons. Both fixed reminder slots share one snooze action
// rather than needing to know which specific slot fired — see this
// file's own NOTIFICATION_IDS comment: both are for the same underlying
// booked visit, so snoozing re-arms both 30 minutes out with the same
// "reminder snoozed" body, no orphaned slot either way.
export async function handleSnoozeClinicVisit() {
  const visit = await getSoonestBookedVisit();
  const body = visit ? `${visit.title || "Appointment"} — reminder snoozed` : "Reminder snoozed";
  const at = new Date(Date.now() + 30 * 60000);
  // FIXED — real bug: this used to only reschedule the native
  // notification — see this file's own getClinicVisitDueState() comment.
  await NotificationPreferencesRepository.update({ clinicVisitSnoozedUntil: at.toISOString() });
  await scheduleNotification({
    id: NOTIFICATION_IDS.clinicVisitReminderA,
    title: "Upcoming clinic appointment",
    body,
    at,
    actionTypeId: CLINIC_VISIT_ACTION_TYPE_ID,
    kind: "Clinic appointment",
    smallIcon: moduleSmallIconName("healthcare"),
    iconColor: ACCENTS.healthcare,
  });
  await scheduleNotification({
    id: NOTIFICATION_IDS.clinicVisitReminderB,
    title: "Upcoming clinic appointment",
    body,
    at,
    actionTypeId: CLINIC_VISIT_ACTION_TYPE_ID,
    kind: "Clinic appointment",
    smallIcon: moduleSmallIconName("healthcare"),
    iconColor: ACCENTS.healthcare,
  });
  return { minutes: 30 };
}
