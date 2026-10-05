// cycleWidgetSync.js
//
// ADDED 4 Oct 2026 - the Cycle widget's pusher, moved out of a React module.
//
// WHY IT MOVED. updateCycleWidget lived inside
// SHOS_MenstrualHealth_Prototype.jsx, which meant the central syncAllWidgets could
// not import it - a widget inside a .jsx module cannot be reached from
// src/calculations without dragging the whole component tree in behind it. So the
// Cycle widget was pushed from exactly one place: the create handler. Edit it,
// delete it, or change a preference and the widget kept whatever it last showed.
// That is the same coupling that left Last Test showing "No tests logged" while the
// dashboard showed a test from a week earlier.
//
// The body is moved verbatim. The logic it depends on was already extracted into
// menstrualCalculations.js on 29 Sep precisely because it was untestable while it
// lived inline behind a plugin bridge in a large JSX file; this move finishes that
// job rather than starting a new one. All three defects documented at the call site
// (elapsed-millisecond cycleDay, a predicted date with no timeZone, and an
// unguarded avgLength) came from there and are unchanged.
//
// Note the early `if (cycleDay === null) return;` is preserved deliberately: a user
// with no usable cycle data should see their existing widget rather than have it
// blanked. It is the ONE place a pusher returning without pushing is correct,
// because there is genuinely nothing to say and a stale-but-true reading beats an
// empty box. The "never leave the host with nothing" backstop is in the PROVIDER,
// which is the layer that can see the host at all.

import { registerPlugin } from "@capacitor/core";
import { sendWidgetUpdate } from "./widgetBridgeUpdate";
import {
  getCycleDay,
  getCyclePhase,
  getNextPeriodDayKey,
  formatDayKeyForDisplay,
} from "./menstrualCalculations";
import { redactedWidgetLine } from "./widgetPrivacy";

// Copied from the other four sync files rather than shared. Each one has its own
// copy of this, which is not ideal - it is why the thenable-proxy bug below had to
// be fixed in six places and then had to be fixed twice more. Consolidating it is
// a real cleanup but a separate change from fixing the three device bugs, and this
// file could not exist at all without one.
let WidgetBridge = null;
async function getWidgetBridge() {
  if (WidgetBridge) return { plugin: WidgetBridge };
  try {
    WidgetBridge = false;
    // Never return the raw Capacitor plugin proxy from an async function: `proxy.then`
    // is a function, so the proxy looks thenable and returning it makes the engine
    // invoke `.then()`, which Capacitor rejects as
    // "WidgetBridge.then() is not implemented on android". Verified on a real device.
    WidgetBridge = registerPlugin("WidgetBridge");
  } catch {
    WidgetBridge = false;
  }
  return WidgetBridge ? { plugin: WidgetBridge } : null;
}

export async function updateCycleWidget() {
  try {
    const bridge = await getWidgetBridge();
    if (bridge && bridge.plugin.updateCycle) {
      const { MenstrualCycleRepository } = await import(
        "../repositories/menstrualCycleRepository"
      );
      const cycles = await MenstrualCycleRepository.getAll();
      const activeCycles = cycles
        .filter((c) => !c.isArchived)
        .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
      if (activeCycles.length > 0) {
        const latest = activeCycles[0];
        const avgLength = await MenstrualCycleRepository.getAverageCycleLengthDays();
        const cycleDay = getCycleDay(latest.startDate);
        // No usable cycle data: leave whatever is on screen rather than blanking it.
        if (cycleDay === null) return;
        const phase = getCyclePhase(cycleDay);
        const nextPeriod = formatDayKeyForDisplay(
          getNextPeriodDayKey(latest.startDate, avgLength),
        );
        // Routed through sendWidgetUpdate so a Redacted tier keeps only
        // category + state and the widget reads "Tracking - follicular" rather
        // than going blank.
        await sendWidgetUpdate(bridge, "cycle", "updateCycle", {
          day: cycleDay,
          phase,
          nextPeriod: nextPeriod || null,
          category: "Tracking",
          state: phase,
        },
          cycleRedactedLine(phase));
      }
    }
  } catch (e) {
    console.debug("Cycle widget update skipped:", e);
  }
}

export default updateCycleWidget;

/**
 * ADDED 5 Oct 2026 (t059 follow-on) - the Redacted line for the Cycle widget.
 *
 * ALLOWED_AT_REDACTED permits category + state, so the line keeps the cycle PHASE
 * and drops the day number, the next-period date and the length of the current
 * cycle. The phase is the one coarse fact that still answers "is anything worth
 * acting on"; the rest is a window into the user's cycle.
 */
export function cycleRedactedLine(phase) {
  return redactedWidgetLine("Tracking", phase || "no data");
}
