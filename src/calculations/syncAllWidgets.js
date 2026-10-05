// syncAllWidgets.js
//
// ADDED 4 Oct 2026 - the single place home-screen widgets are pushed from.
//
// WHY THIS FILE EXISTS. Every widget push used to live inside a reminder-sync
// function, on the happy path only. That coupling produced two real bugs found on
// a real device, not by inspection:
//
//   1. "Can't load widget" on the Clinic Card. Two independent paths reached it:
//      syncClinicVisitReminders returns early when the reminder is acknowledged
//      or suppressed, BEFORE reaching the widget push; and updateClinicCardWidget
//      dereferenced `visit` with no null guard, so with no upcoming visit it
//      threw, the catch swallowed it, and no RemoteViews was ever pushed. A host
//      holding no RemoteViews is exactly what the launcher's "Can't load widget"
//      message means.
//
//   2. "Last Test" showing a stale "No tests logged" while the dashboard showed a
//      test from a week ago. syncTestingReminder has FOUR early returns (reminder
//      disabled, no tests, no routine-retest suggestion, already past due) and
//      updateTestWidget was only reached on the happy path. A Positive most-recent
//      test has no routine-retest suggestion, so that return fired on every sync
//      and the widget was never refreshed again.
//
// THE RULE THIS ENCODES. A widget's visual state is UNCONDITIONAL - it must always
// reflect reality. Reminder logic is CONDITIONAL by nature - a reminder is
// correctly suppressed for half a dozen reasons. Coupling the two means every new
// early return added to reminder logic silently breaks the widget, which is
// precisely what happened. Gemini's independent review reached the same
// conclusion: extract rather than wrap each early return in try/finally, because
// try/finally still has to be re-remembered at every new exit.
//
// Each per-widget push function stays where it is, because it owns that widget's
// derivation, and two existing guards slice these files from a known function to
// END OF FILE - moving the code would break them. What changed is that each is now
// exported and self-sufficient: called with no argument it derives its own data,
// and called with an explicit null it renders the "there is none" state.

import { updateTestWidget } from "./testingReminderSync";
// From medicationReminderSync, NOT refillReminderSync. Both files define a
// function called updateRefillWidget sending the same "refillDue" payload to the
// same bridge method - the duplication is acknowledged in refillReminderSync's own
// comment. Only the medicationReminderSync copy also pushes nextDose, so that is
// the one registered here; using the other would leave the Next Dose widget with
// no caller at all, which is the state it was in before this change.
import { updateRefillWidget } from "./medicationReminderSync";
import { updateAppointmentWidget, updateClinicCardWidget } from "./clinicVisitReminderSync";
import { updateDoxyPEPWidget } from "./doxyPepSync";
// Moved out of SHOS_MenstrualHealth_Prototype.jsx on 4 Oct 2026 precisely so this
// file could reach it - a pusher trapped inside a React module can only be called
// from that module's own handlers, which is why the Cycle widget refreshed on
// create and never on edit or delete.
import { updateCycleWidget } from "./cycleWidgetSync";

// Each entry is independent. One failing or absent bridge must not stop the rest
// from being pushed - that is the same "one early return starves everything after
// it" shape this file exists to remove.
const PUSHERS = [
  // One call covers two widgets: this pusher sends refillDue AND nextDose.
  ["refill + nextDose", updateRefillWidget],
  ["lastTest", updateTestWidget],
  ["nextAppointment", updateAppointmentWidget],
  ["clinicCard", updateClinicCardWidget],
  ["doxyPepWindow", updateDoxyPEPWidget],
  ["cycle", updateCycleWidget],
];

// SERIALISED, deliberately. Two rapid saves can both trigger a sync, and both
// read the repositories asynchronously. If the older read finishes last it
// overwrites the newer value, and the widget shows stale data with no error
// anywhere - a race that is very hard to see and very easy to cause. Chaining
// onto one promise makes the second run wait for the first.
let queue = Promise.resolve();

/**
 * True only on a real device. Web genuinely has no widget bridge, so a failed
 * push there is expected and must not be surfaced as a warning.
 *
 * Uses the same dynamic import the pushers themselves use. NOT `window.Capacitor`
 * - that is not exposed in this build, and a guard built on it would never fire,
 * which is the opposite of the point. Verified by grep: no reference to
 * window/globalThis Capacitor anywhere in src/.
 */
async function isNativePlatform() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Push every home-screen widget from current data.
 *
 * Safe to call from anywhere and as often as you like: it never throws, it does
 * no scheduling work, and concurrent calls serialise rather than race.
 */
export function syncAllWidgets() {
  queue = queue
    .then(async () => {
      for (const [name, push] of PUSHERS) {
        try {
          await push();
        } catch (e) {
          // One widget failing must not starve the other five.
          //
          // CHANGED 5 Oct 2026 from console.debug to console.warn, and this is
          // the most useful line in the file. It was console.debug, which is
          // INVISIBLE in a WebView - and that is precisely how the real bug hid
          // for days: every pusher was throwing on its first repository read
          // (Home mounts before the vault unlocks), each throw was swallowed
          // here at debug level, and the only visible symptom was widgets quietly
          // showing stale data. A per-widget guard that cannot be seen failing is
          // not a guard.
          //
          // Still suppressed on web, where an absent bridge is expected rather
          // than a fault - which is why this awaits rather than guessing.
          if (await isNativePlatform()) {
            console.warn(`Widget push FAILED (${name}):`, e);
          }
        }
      }
    })
    .catch((e) => {
      // The queue itself must never enter a rejected state, or every later call
      // would reject immediately and the widgets would silently stop updating
      // forever - a far worse outcome than one missed push.
      console.debug("Widget sync queue recovered:", e);
    });
  return queue;
}

export default syncAllWidgets;