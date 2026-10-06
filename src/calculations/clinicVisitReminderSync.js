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
import { realTimestampFromStored, storedDayKey, localDayKey, calendarDaysBetween } from "./dateInputHelpers";
import { AppPreferencesRepository } from "../repositories/appPreferencesRepository";
import { buildClinicVisitSignature, shouldSuppressDeviceNotification, normaliseAcknowledgements } from "./reminderSuppression";
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

/**
 * Every visit that is booked and still in the future, soonest first.
 *
 * ADDED 6 Oct 2026 so the Appointments widget can report an HONEST count.
 * `getSoonestBookedVisit()` returns one visit or null, and the widget derived
 * `count = visit ? 1 : 0` from that - so a user with three appointments booked
 * was told "1 upcoming". That is a small thing to be wrong about, but it is
 * exactly the kind of quiet inaccuracy that makes a glanceable widget lose the
 * user's trust, and the whole point of this round is that "1 upcoming" was not
 * enough to trust in the first place.
 */
export async function getUpcomingBookedVisits() {
  const nowMs = Date.now();
  const booked = (await ClinicVisitsRepository.getAll())
    .filter((v) => !v.isArchived && v.isFutureAppointment && v.date && realTimestampFromStored(v.date) > nowMs);
  return booked.sort((a, b) => realTimestampFromStored(a.date) - realTimestampFromStored(b.date));
}

export async function getSoonestBookedVisit() {
  const booked = await getUpcomingBookedVisits();
  if (booked.length === 0) return null;
  return booked[0];
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

export async function updateAppointmentWidget(visit) {
  try {
    // ADDED 4 Oct 2026 - self-sufficient. A widget's visual state is
    // UNCONDITIONAL while reminder logic is conditional by nature, so this is
    // callable with no argument (from syncAllWidgets) and fetches its own data.
    // Passing undefined is different from passing null on purpose: undefined
    // means "go and look", null means "there genuinely is none".
// ONE repository read, and the count is always the real one.
    //
    // The first version of this change called getSoonestBookedVisit() and then
    // getUpcomingBookedVisits() unconditionally, which read every booked visit
    // twice on every push - and this function runs from syncAllWidgets, which
    // pushes every widget on every app foreground.
    //
    // It is read unconditionally even when the caller passed a visit, because a
    // single passed visit cannot tell us how many OTHERS are booked. The passed
    // visit is still what gets displayed - it is the soonest one by construction -
    // so the two agree, and the count is no longer "1" for a user with three
    // appointments.
    const upcoming = await getUpcomingBookedVisits();
    if (visit === undefined) visit = upcoming[0] || null;
    const count = upcoming.length;
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
          appointmentRedactedLine(count, visit?.date));
    }
  } catch (e) {
    // Widget bridge not available (web) — ignore
    console.debug("Widget update skipped:", e);
  }
}

/**
 * ADDED 5 Oct 2026 (t059) - the pre-formatted one-line wording a Redacted Clinic
 * Card widget shows, mirroring doxyPepRedactedLine().
 *
 * Deliberately says NOTHING identifying: no appointment title, no clinic, no date,
 * no location. The test COUNT survives because the Redacted rule allows category
 * presence plus a coarse count - "3 tests" names nobody - and because "is a clinic
 * appointment coming at all" is the entire question a glance at this widget asks.
 * A count of zero still reads as an answer rather than as a broken widget, which is
 * what a bare "Clinic card" would have looked like.
 */
export function clinicCardRedactedLine(tests) {
  const n = Number(tests);
  if (!Number.isFinite(n) || n <= 0) return "Clinic card - nothing due";
  return `Clinic card - ${n} test${n > 1 ? "s" : ""} booked`;
}

export async function updateClinicCardWidget(visit) {  try {
    // Self-sufficient, and NULL-SAFE - see updateAppointmentWidget above.
    //
    // FIXED 4 Oct 2026, and this was the cause of the launcher showing
    // "Can't load widget" for this widget alone while the other nine rendered.
    // Two independent paths reached it:
    //   1. `visit.linkedTestIds` was dereferenced with no null guard, so when
    //      there was no upcoming visit this threw, the surrounding catch
    //      swallowed it, and no RemoteViews was ever pushed. A host with no
    //      RemoteViews is exactly what "Can't load widget" means.
    //   2. syncClinicVisitReminders returns early when the reminder is
    //      acknowledged or suppressed, BEFORE reaching the widget push - so a
    //      suppressed reminder left this widget permanently unpushed.
    // (1) is fixed here. (2) is fixed by decoupling: syncAllWidgets calls this
    // directly, so the widget no longer depends on the reminder path at all.
    if (visit === undefined) visit = await getSoonestBookedVisit();
    const bridge = await getWidgetBridge();
    if (bridge && bridge.plugin.updateClinicCard) {
      const tests = visit?.linkedTestIds?.length || 0;
      const testsStr = tests > 0 ? `${tests} test${tests > 1 ? "s" : ""}` : "None";
      const docType = visit?.visitType || "";
      const clinicNum = visit?.clinicNumber || "";
      const nhsNum = visit?.nhsNumber || "";

      // CHANGED 2 Oct 2026 - routed through sendWidgetUpdate. This widget
      // discloses more than any other: a location, a test count and a date.
      //
      // nhsNum is still sent and is still discarded by the bridge, which is
      // deliberate and load-bearing rather than an oversight - see
      // widgetPlaintextSink.test.js, which fails if it is ever written.
      await sendWidgetUpdate(bridge, "clinicCard", "updateClinicCard", {
        title: visit?.title || "No upcoming appointment",
        date: visit?.date
          ? new Date(realTimestampFromStored(visit.date)).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
          : "",
        location: visit?.location || "",
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
      // CHANGED 5 Oct 2026 (t059) - the fifth argument is the pre-formatted
      // Redacted line. Supplied HERE rather than inside the payload because this
      // file is the only place that knows what a Clinic Card widget means;
      // widgetBridgeUpdate deliberately knows nothing about what any widget
      // displays.
      //
      // It exists at all because filtering alone was not enough, and that is the
      // lesson recorded from DoxyPEP: with only a filtered payload the provider
      // fell back to its own placeholder. Safe, but a widget that says nothing
      // about what it is for is worse than useless. A test COUNT is allowed under
      // the Redacted rule - "3 tests" identifies nobody - and it is the one number
      // worth having here, since "is a clinic visit coming" is the entire question
      // a glance at this widget is asking.
      clinicCardRedactedLine(tests)
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

/**
 * ADDED 5 Oct 2026 (t059 follow-on) - the Redacted line for the Appointments
 * widget, the sibling of clinicCardRedactedLine below.
 *
 * ALLOWED_AT_REDACTED permits category + count. The appointment's own TITLE is
 * dropped: titles are free text typed by the user and routinely contain the
 * clinic's specialty, which identifies the visit far more than a count does.
 */
/**
 * The Redacted line for the Appointments widget.
 *
 * CHANGED 6 Oct 2026, from the owner's report that "Appointments - 1 upcoming"
 * gave them no confidence the widget was worth having. A bare count answers "is
 * anything on" without answering "do I need to do anything about it", and a
 * glanceable widget that only answers the first question is one nobody glances
 * at.
 *
 * The fix is a RELATIVE day bucket on the soonest booked visit, which stays
 * inside the Redacted rule: elapsed time rather than absolute time, the same
 * distinction already made for the medication and DoxyPEP countdowns in
 * widgetPrivacy.js. "in 3 days" is true only right now and reveals no routine;
 * "Tue 14 Oct at 09:30" is a fact about the user's calendar and reveals the
 * clinic, the specialty and the hour they are usually there.
 *
 * It is deliberately a BUCKET, not an exact figure. "in 3 days" carries the
 * reassurance without being the kind of precise number that adds identifying
 * information back.
 *
 * `nextDate` is the visit's STORED (fake-UTC) date, and the day maths goes
 * through storedDayKey + localDayKey + calendarDaysBetween rather than elapsed
 * milliseconds - this repo has been bitten by dividing a span by 86400000 across
 * a DST boundary, and it is the recorded rule for exactly this shape.
 */
export function appointmentRedactedLine(count, nextDate, now = new Date()) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return redactedWidgetLine("Appointments", "none booked");

  const booked = n === 1 ? "1 booked" : `${n} booked`;
  const from = storedDayKey(nextDate);
  if (!from) return redactedWidgetLine("Appointments", booked);

  const days = calendarDaysBetween(localDayKey(now), from);
  if (days === null) return redactedWidgetLine("Appointments", booked);
  // Same-day and past-dated are stated plainly: a booked visit whose day has
  // arrived is the case where "in 0 days" would read as a bug.
  if (days <= 0) return redactedWidgetLine("Appointments", `${booked} - today`);
  if (days === 1) return redactedWidgetLine("Appointments", `${booked} - tomorrow`);
  return redactedWidgetLine("Appointments", `${booked} - in ${days} days`);
}
