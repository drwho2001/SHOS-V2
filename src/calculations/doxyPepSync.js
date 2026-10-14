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
import { sendWidgetUpdate } from "./widgetBridgeUpdate";
import { getWidgetBridge } from "./widgetBridge";


// ADDED — real ask: unified notifications on/off switchboard. Gates
// only the NATIVE notification below — the returned `status` object
// (what Home's own in-app banner reads) is computed and returned
// unconditionally either way, since turning off the notification was
// never a request to hide the in-app warning too.
export async function syncDoxyPepAlert() {
  const notifsEnabled = (await NotificationPreferencesRepository.getPreferences()).doxyPepAlertEnabled;
  const doxyMed = findDoxyPepMedication(await MedicationRepository.getAll());
  // No DoxyPEP medication set up at all — nothing to track, and
  // nothing should be left scheduled from a stale earlier state.
  if (!doxyMed) {
    await cancelNotification(NOTIFICATION_IDS.doxyPepAlert);
    return { active: false };
  }

  const encounters = await EncounterRepository.getAll();
  const doxyLogs = await LogRepository.getForMedication(doxyMed.id);
  const status = getDoxyPepStatus(encounters, doxyLogs);
  // ADDED — real ask: the in-app banner needs to navigate to (and,
  // for the "permanent" dismiss below, key off) this specific
  // medication record — cheap to attach here rather than have Home
  // re-look it up itself.
  status.medicationId = doxyMed.id;

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
    // FIXED 13 Oct 2026 (owner) - "last qualifying activity" said the OPPOSITE
    // of what this app does. getDoxyPepStatus anchors the deadline to the
    // EARLIEST qualifying encounter since the last dose
    // (doxyPepCalculations.js, `qualifyingSinceLastDose[0]` off an ascending
    // sort), because sequential exposures do not restart the countdown - that
    // is BASHH's "cover a period of activity with one dose at the end" pattern.
    //
    // So the string told the user the deadline tracked their most recent sex
    // while it tracked their FIRST one. Those differ exactly when it matters:
    // someone who had sex on Monday and again on Wednesday was told the 72
    // hours ran from Wednesday, when Monday's had already expired. Under that
    // reading the app invites a dose later than the guidance allows for the
    // earlier exposure. Corrected to FIRST, which is what the code has always
    // done.
    body: "It's been close to 72 hours since your FIRST qualifying activity — take your DoxyPEP dose if you haven't already.",
    at: status.deadline,
    actionTypeId: DOXYPEP_ACTION_TYPE_ID,
    kind: "DoxyPEP reminder",
    // FIXED 10 Sep 2026 — real audit finding: this used "home"
    // (teal), but Home's own real in-app DoxyPEP banner has always
    // used medsBlue (ACCENTS.medication) — a genuine mismatch between
    // the notification and the feature's own real in-app colour,
    // working against the "module colour for recognition" point of
    // tinting these at all. DoxyPEP is a medication reminder, not a
    // Home-screen concept.
    smallIcon: moduleSmallIconName("medication"),
    iconColor: ACCENTS.medication,
  });
  await updateDoxyPEPWidget(status);
  return status;
}

/**
 * The DoxyPEP widget's bridge payload, as a PURE function of `status`.
 *
 * ADDED 13 Oct 2026. This was an inline object literal, and being inline is how
 * three separate defects lived in it undetected:
 *
 *   - `deadline.getTime()` in two places, on a value that has always been a
 *     number (see updateDoxyPEPWidget's comment for the full account of how that
 *     killed the widget silently);
 *   - a dangling `expiryMs` shorthand referring to a variable that had been
 *     deleted - a ReferenceError on every call, introduced by the very fix for
 *     the first defect and caught by nothing;
 *   - `status: statusText` and `state: statusText` being the same value twice.
 *
 * NONE of these were caught because the payload was built inside a function whose
 * only caller needs a live Capacitor bridge, so no test could execute it. My own
 * replacement test - which COPIED the `countdownAt` expression into the test file
 * - also passed green against the unfixed source, because copying code into a
 * test does not test the code.
 *
 * So the fix is the SEAM, not a stricter assertion: the payload is now a value a
 * test can call. doxyPepDeadlineType.test.js calls this with the real status
 * getDoxyPepStatus produces and asserts the exact fields, which is what makes a
 * regression here visible at all.
 *
 * @param {{active:boolean, overdue:boolean, deadline?:number, windowStartIso?:string}} status
 * @returns {object} the unfiltered payload; tier filtering stays in sendWidgetUpdate
 */
export function buildDoxyPepWidgetPayload(status) {
  const statusText = status.overdue ? "Overdue" : (status.active ? "Active" : "No active window");
  return {
    // category/state are what survive a Redacted tier, so the widget reads
    // "DoxyPEP - Active" rather than going blank.
    category: "DoxyPEP",
    state: statusText,
    // RENAMED from `expiryMs` rather than reused, because "expiryMs" reads like
    // an absolute deadline in any code review and the whole point is that the two
    // are not the same disclosure: a relative countdown reveals no routine.
    // `deadline` is epoch ms and is sent as-is - never `.getTime()`, which is a
    // Date method and this value is a number.
    countdownAt: status.deadline ?? null,
    // ADDED 9 Oct 2026 (t093) - the EVIDENCE line: the stored date of the
    // encounter that opened the window, so the widget shows WHY a window exists
    // rather than a bare countdown.
    //
    // DELIBERATELY NOT in the Redacted allowlist (see widgetPrivacy.js), so it is
    // dropped at that tier automatically - an exposure DATE is identifying, and
    // the Redacted rule is category presence without specifics. Default-deny
    // means not listing it here is the whole privacy decision; no explicit hide
    // is needed on the Java side.
    evidenceAt: status.windowStartIso || null,
  };
}

export async function updateDoxyPEPWidget(status) {
  try {
    // Self-sufficient, like the clinic-visit and test pushers: undefined means
    // "go and derive it", so syncAllWidgets can call this with no argument.
    // Without it, status.overdue would throw on undefined and the widget would
    // silently never update - the same shape of bug as the Clinic Card's.
    if (status === undefined) {
      // Copied from this file's own sync path (lines 53-63) rather than
      // re-derived, because guessing at the repository names here would be
      // exactly how the widget ended up silently broken in the first place.
      const doxyMed = findDoxyPepMedication(await MedicationRepository.getAll());
      const encounters = await EncounterRepository.getAll();
      const doxyLogs = doxyMed ? await LogRepository.getForMedication(doxyMed.id) : [];
      status = getDoxyPepStatus(encounters, doxyLogs);
      if (doxyMed) status.medicationId = doxyMed.id;
    }
    const bridge = await getWidgetBridge();
    if (bridge && bridge.plugin.updateDoxyPEP) {
      const statusText = status.overdue ? "Overdue" : (status.active ? "Active" : "No active window");
      // FIXED 13 Oct 2026 - THIS THREW, AND THE CATCH BELOW SWALLOWED IT, SO THE
      // DoxyPEP WIDGET NEVER UPDATED.
      //
      // `deadline` is not a Date. getDoxyPepStatus builds it as
      // `windowStart + DOXYPEP_WINDOW_HOURS * 3600000` - epoch milliseconds, a
      // plain number. Calling `.getTime()` on it is `undefined is not a
      // function`, every single time this ran, and the surrounding catch logged
      // it at debug level and returned, so the bridge was never called and the
      // widget kept whatever Android last rendered.
      //
      // The dead local it belonged to (`expiryMs`) was not even in the payload -
      // the value is sent as `countdownAt` - so the throw bought nothing at all.
      // Removed rather than corrected, because a variable that is computed and
      // never sent is a second thing to keep in sync with the payload.
      await sendWidgetUpdate(bridge, "doxyPepWindow", "updateDoxyPEP",
        buildDoxyPepWidgetPayload(status),
        // The fifth argument is the pre-formatted Redacted line.
        //
        // Supplied HERE rather than inside the payload because this file is the
        // only place that knows what a DoxyPEP widget means - widgetBridgeUpdate
        // deliberately knows nothing about what any widget displays.
        //
        // It exists at all because filtering alone was not enough: with only a
        // filtered payload the provider fell back to its own placeholder and the
        // widget said "No active window" even when a window was active. Safe,
        // but a false statement about the user's own health on a home screen.
        //
        // Active/Overdue are coarse states that identify nobody, and the hours
        // remaining are elapsed time, so both survive Redacted.
        doxyPepRedactedLine(status)
        );
    }
  } catch (e) {
    console.debug("DoxyPEP widget update skipped:", e);
  }
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
export async function handleTakeDoxyDose() {
  const doxyMed = findDoxyPepMedication(await MedicationRepository.getAll());
  if (!doxyMed) return { medications: [] };
  await LogRepository.create({ medicationId: doxyMed.id, type: "dose", delta: -doxyMed.unitsPerDose, date: nowAsStoredDateTime() });
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
    kind: "DoxyPEP reminder",
    smallIcon: moduleSmallIconName("medication"),
    iconColor: ACCENTS.medication,
  });
  return { minutes: 30 };
}

/**
 * The one line a Redacted DoxyPEP widget shows.
 *
 * Pure and exported so it can be tested directly, which matters because the
 * wording IS the privacy behaviour: a wrong branch here is what makes the widget
 * either leak or lie. formatRemaining() is not used because it takes DAYS and
 * this is a 72-hour window, where "0d remaining" would be both useless and
 * wrong.
 *
 * CHANGED 6 Oct 2026 - the category is now "Antibiotics", not "DoxyPEP".
 *
 * This is not a euphemism preference, it is the reason the tier exists. "DoxyPEP"
 * is an acronym only the sexually-active-in-the-last-72-hours crowd knows, so
 * rendering it on a home screen discloses recent condomless sex to anyone who
 * happens to know the word - to a housemate, a friend over your shoulder, a
 * passer-by on the train. "Antibiotics" says the same thing to the person who
 * chose to place the widget, and nothing at all to anyone else. The owner's
 * decision to this effect is recorded in CLAUDE.md from 2 Oct 2026; it had been
 * written down and never implemented, which is exactly the failure this repo
 * keeps re-learning in a new shape.
 */
export function doxyPepRedactedLine(status) {
  const CATEGORY = "Antibiotics";
  if (status.overdue) return `${CATEGORY} - window overdue`;
  if (!status.active) return `${CATEGORY} - no window`;
  if (!status.deadline) return `${CATEGORY} - window active`;
  // FIXED 13 Oct 2026 - THIRD instance of the same bug, and the reason the DoxyPEP
  // widget showed nothing even at a tier where this line is the ONLY text it
  // renders. `deadline` is epoch milliseconds (a number), never a Date, so
  // `.getTime()` was `undefined is not a function` and the whole Redacted line
  // threw. This one is caught by no try/catch here at all - it is evaluated as
  // an argument to sendWidgetUpdate, so it threw from inside the try in
  // updateDoxyPEPWidget and was swallowed by the same debug-level catch.
  //
  // IT WAS INVISIBLE BECAUSE THE TEST FEED IT THE WRONG TYPE.
  // widgetBridgeUpdate.test.js built `deadline: new Date(...)` - a Date - so the
  // suite exercised a shape getDoxyPepStatus has never produced. A green test
  // over a fixture the real caller cannot create is worse than no test, because
  // it reads as coverage. Those fixtures now use a number, and
  // doxyPepDeadlineType.test.js pins the type from the real producer.
  const remainingMs = status.deadline - Date.now();
  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.floor((remainingMs % 3600000) / 60000);
  return hours > 0 ? `${CATEGORY} - in ${hours}h ${minutes}m` : `${CATEGORY} - in ${minutes}m`;
}