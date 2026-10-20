import fs from "node:fs";
import { it, expect } from "vitest";

/**
 * t106: the dose-timing advisory must be DISMISSIBLE, and the calculation it
 * dismisses must be left alone.
 *
 * WHY A STATIC GUARD. The advisory is rendered inside a medication card in a
 * 2,500-line module whose components are module-local and not exported, so a
 * rendering test would mean changing files other work depends on. The
 * invariants that matter here are about the SOURCE, and the repo has an
 * established pattern for that (iconOnlyUIAudit, medicationSheetDialogGuard,
 * escapeMountAudit).
 *
 * WHAT IS GUARDED, and why each part is load-bearing:
 *
 *  1. The banner has a dismiss control whose label SAYS what it dismisses.
 *     The repo's own rule is that asserting an attribute exists is not the
 *     same as asserting it says something - the first version of the
 *     icon-only audit's check passed against aria-label={undefined}.
 *  2. The banner is gated on the dismissal, so a dismissed advisory is not
 *     merely covered up.
 *  3. THE CALCULATION IS UNTOUCHED. The two-hour window is NHS-sourced and
 *     the source comment says the fix is a presentation decision, not a
 *     smaller number. A future session "tidying up" the calculation would
 *     silently change a clinical figure, and no other test would say so -
 *     medicationLockout.test.js pins the behaviour, but nothing pins the
 *     CONSTANT.
 */
const MODULE = "src/modules/SHOS_Medication_Dashboard_Prototype.jsx";
const CALC = "src/calculations/medicationCalculations.js";
const STORE = "src/calculations/advisoryDismissal.js";

const mod = fs.readFileSync(MODULE, "utf8");
const calc = fs.readFileSync(CALC, "utf8");
const store = fs.readFileSync(STORE, "utf8");

it("the advisory banner has a dismiss control that says what it dismisses", () => {
  const banner = mod.slice(mod.indexOf("timingAdvisory && !advisoryDismissed"));
  expect(banner, "the advisory banner could not be read").toContain("timingAdvisory");
  // A control that is only an icon still needs a label, and the label has to
  // name the thing being dismissed.
  expect(banner).toMatch(/aria-label=\{`Dismiss the dose timing advice for /);
  expect(banner).toMatch(/onClick=\{dismissTimingAdvisory\}/);
  // Keyboard-reachable, like every other control this app adds.
  expect(banner).toMatch(/tabIndex=\{0\}/);
  expect(banner).toMatch(/onKeyDown=/);
  expect(banner).toMatch(/e\.key === "Enter" \|\| e\.key === " "/);
});

it("the banner is gated on the dismissal, not merely covered up", () => {
  expect(mod).toMatch(/timingAdvisory && !advisoryDismissed/);
  expect(mod).toMatch(/advisoryDismissalKey\(med, lastDose, timingAdvisory\)/);
  // The dismissal has to reach the store, or it is lost the moment the user
  // leaves the tab - the medication module is re-mounted on every tab switch.
  expect(mod).toMatch(/dismissAdvisory\(advisoryKey\)/);
  expect(mod).toMatch(/isAdvisoryDismissed\(advisoryKey\)/);
});

it("the store keys an occurrence by medication, dose and kind - not by the message", () => {
  expect(store).toContain("export function advisoryDismissalKey");
  expect(store).toContain("export function isAdvisoryDismissed");
  expect(store).toContain("export function dismissAdvisory");
  // The key must not be built from the advisory's message: its hour figure
  // changes as the clock moves, so a message-keyed dismissal would expire on
  // its own.
  expect(store).not.toMatch(/\$\{advisory\.message\}/);
  expect(store).not.toMatch(/\$\{advisory\.hours\}/);
});

it("the CALCULATION is unchanged - the two-hour window is NHS-sourced", () => {
  expect(
    calc,
    "MAX_ACCEPTABLE_LAG_HOURS is not 2 any more - that figure is the NHS-sourced one, and the " +
      "fix for the advisory being persistent was PRESENTATION (a dismiss control), not a smaller window",
  ).toMatch(/MAX_ACCEPTABLE_LAG_HOURS\s*=\s*2\b/);
  // The advisory function itself is still the one the card calls.
  expect(calc).toMatch(/export function doseTimingAdvisory\(/);
});
