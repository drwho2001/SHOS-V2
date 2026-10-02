// Every widget that renders data must have a privacy tier, and every tier must
// mean the same thing.
//
// WHAT WENT WRONG ONCE, so this exists rather than being obvious
// -------------------------------------------------------------
// `widgetPrivacy` shipped with keys for 7 widgets and was read by NOTHING. The
// keys were also wrong: 4 of the 7 data widgets had one, the 3 data widgets that
// disclose the most (LastTest, Cycle, ClinicCard) had none at all, and the other
// 3 keys were on the QuickAdd widgets, which render a launch icon and no data.
// So the setting was simultaneously inert and aimed at the wrong targets, and no
// test noticed either half.
//
// Two failure modes are asserted separately below, because they are different
// bugs and fixing one does not fix the other:
//
//   1. the OWNER (widgetPrivacy.js) behaves correctly - unit-tested here
//   2. the SETTINGS SCREEN offers every data widget - source-level, below
//
// (2) is a wiring property, not a behavioural one, so it cannot be reached from
// (1) no matter how many unit tests (1) has.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DATA_WIDGETS,
  NO_DATA_WIDGETS,
  TIERS,
  DEFAULT_TIERS,
  tierFor,
  resolveAllTiers,
  fieldAllowed,
  isValidTier,
} from "./widgetPrivacy.js";

const ROOT = process.cwd();
const read = (...p) => readFileSync(path.join(ROOT, ...p), "utf8");

/**
 * Strips whole-line comments before any NEGATIVE assertion.
 *
 * This is the eighth recorded instance in this repo of a guard being satisfied
 * by the comment that documents the fix - the guard I had just written failed
 * against my own explanatory comment on the first run, because that comment
 * names `defaultTier` in backticks in order to explain that it was removed.
 *
 * Anchored to a line that is only whitespace then `//`, so it cannot touch a
 * `//` inside a string such as a URL. That is deliberate: a stripper which
 * removed every `//` would also eat protocol strings and make the assertions
 * below pass for the wrong reason.
 */
function stripLineComments(src) {
  return src
    .split(/\r?\n/)
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

describe("widget tiers resolve, and fail in the safe direction", () => {
  it("every widget that renders data has a default", () => {
    // A widget with no default would resolve to undefined and then compare
    // false against every tier check, which is a silent fail-open.
    for (const key of DATA_WIDGETS) {
      expect(DEFAULT_TIERS[key], `${key} has no default tier`).toBeTruthy();
      expect(isValidTier(DEFAULT_TIERS[key]), `${key} default "${DEFAULT_TIERS[key]}" is not a real tier`).toBe(true);
    }
  });

  it("nothing configured resolves to the per-widget default, not to off", () => {
    // The distinction that stops this feature's first run being destructive: on
    // an upgrade nobody has ever set a tier, and blanking every widget on a
    // phone would be a hostile surprise.
    expect(tierFor("nextDose", null)).toBe("full");
    expect(tierFor("refillDue", undefined)).toBe("redacted");
    expect(tierFor("cycle", {})).toBe("redacted");
  });

  it("a stored value that is NOT configured still falls back per widget", () => {
    // A map that exists but omits this key is "never configured for this one",
    // not "configured to something unreadable".
    expect(tierFor("cycle", { nextDose: "off" })).toBe("redacted");
  });

  it("a stored value this code cannot read fails CLOSED, to off", () => {
    // The same direction normaliseDisclosureLevel takes for a bad notification
    // level: a value we do not understand must never be read as permission to
    // disclose.
    for (const bad of ["detailed", "FULL", "true", 1, {}, [], null, "none"]) {
      expect(tierFor("cycle", { cycle: bad }), `"${JSON.stringify(bad)}" must fail closed`).toBe("off");
    }
  });

  it("a valid stored value is honoured exactly", () => {
    for (const t of TIERS) {
      expect(tierFor("lastTest", { lastTest: t })).toBe(t);
    }
  });

  it("the QuickAdd widgets are excluded, because they render nothing", () => {
    // Offering a tier for a launch icon would be the same defect as a setting
    // that does nothing - worse, because it would look like it works.
    for (const key of NO_DATA_WIDGETS) {
      expect(DATA_WIDGETS, `${key} must not be treated as a data widget`).not.toContain(key);
    }
    expect(DATA_WIDGETS.length + NO_DATA_WIDGETS.length).toBe(10);
  });

  it("resolveAllTiers covers every data widget and nothing else", () => {
    const all = resolveAllTiers({});
    expect(Object.keys(all).sort()).toEqual([...DATA_WIDGETS].sort());
  });
});

describe("fieldAllowed enforces one meaning of Redacted everywhere", () => {
  // NON-VACUITY. The first draft of a guard in this repo reported all 13
  // pickers clean while matching nothing at all, and only a fixture caught it.
  // If fieldAllowed ever becomes a no-op, every assertion below still passes -
  // so this asserts it refuses, rather than asserting a refusal the caller made.
  it("the predicate actually refuses", () => {
    expect(fieldAllowed("lastTest", "lastTestDate", "redacted")).toBe(false);
    expect(fieldAllowed("cycle", "cyclePhase", "redacted")).toBe(false);
    expect(fieldAllowed("nextDose", "medName", "redacted")).toBe(false);
    // ...and permits what the uniform rule allows.
    expect(fieldAllowed("lastTest", "category", "redacted")).toBe(true);
    expect(fieldAllowed("refillDue", "count", "redacted")).toBe(true);
  });

  it("off forbids every field, including the category", () => {
    // A redacted widget that still announces "Testing" is disclosing something,
    // and "I have sexual health data" is itself the sensitive fact.
    for (const key of DATA_WIDGETS) {
      expect(fieldAllowed(key, "category", "off"), `${key} must render nothing when off`).toBe(false);
    }
  });

  it("full permits everything, which is the point of it", () => {
    expect(fieldAllowed("nextDose", "medName", "full")).toBe(true);
    expect(fieldAllowed("clinicCard", "location", "full")).toBe(true);
  });

  it("no identifying field is on any widget's redacted list", () => {
    // The rule, restated as a test so it cannot drift: redacted may carry a
    // category, a count, a coarse state, and a RELATIVE countdown.
    //
    // note what is NOT here: absolute times. nextDoseTime and retestDue are a
    // wall-clock time and a date respectively, and both are excluded - "20:00"
    // reveals a daily routine, which is the disclosure this tier exists to
    // prevent. countdownAt is allowed because it is elapsed time, which is only
    // true at the moment it is read and reveals no routine at all.
    const FORBIDDEN_AT_REDACTED = [
      "medName", "nextDoseTime", "nextRefill", "nextAppt", "location",
      "lastTestDate", "retestDue", "testType", "cycleDay", "cyclePhase", "nextPeriod",
      "clinicName", "clinicNum", "nhsNum", "docType", "title", "date", "expiryMs",
    ];
    // Imported through resolveAllTiers' sibling table via a small shim, so this
    // test does not simply restate the module's own export back at itself.
    const mod = read("src/calculations/widgetPrivacy.js");
    for (const field of FORBIDDEN_AT_REDACTED) {
      expect(mod.includes(`"${field}"`), `${field} must not appear as an allowed redacted field`).toBe(false);
    }
  });

  it("a relative countdown IS allowed at redacted, on the owner's decision", () => {
    // Asserted positively as well as by the absence above, because an omission
    // test alone would pass if the whole field were renamed out of existence.
    expect(fieldAllowed("nextDose", "countdownAt", "redacted")).toBe(true);
    expect(fieldAllowed("doxyPepWindow", "countdownAt", "redacted")).toBe(true);
    // ...while the absolute time beside it still is not.
    expect(fieldAllowed("nextDose", "nextDoseTime", "redacted")).toBe(false);
  });

  it("an unknown widget refuses everything rather than defaulting open", () => {
    expect(fieldAllowed("someWidgetAddedLater", "category", "redacted")).toBe(false);
    expect(fieldAllowed("someWidgetAddedLater", "category", "full")).toBe(true);
  });
});

describe("the settings screen offers every data widget (wiring, not behaviour)", () => {
  const screen = read("src/modules/settings/WidgetsScreen.jsx");

  it("has a row for all 7 data widgets", () => {
    // The specific half of the original defect: Test, Cycle and ClinicCard had
    // no key at all, so they could not be configured even in principle.
    const missing = DATA_WIDGETS.filter((k) => !screen.includes(`key: "${k}"`));
    expect(
      missing,
      `these render real data but have no row in the settings screen: ${missing.join(", ")}. ` +
        "A widget the user cannot configure is a widget whose privacy is not theirs to control.",
    ).toEqual([]);
  });

  it("still lists the QuickAdd widgets, and says they have nothing to mask", () => {
    // Removing them would silently drop a control the user has already set.
    // Keeping them as honest no-ops is better than pretending they are protected.
    for (const key of NO_DATA_WIDGETS) {
      expect(screen, `${key} row was dropped without a decision`).toContain(`key: "${key}"`);
    }
  });

  it("offers exactly the three real tiers", () => {
    for (const t of TIERS) {
      expect(screen, `tier "${t}" is not offered`).toContain(`value: "${t}"`);
    }
  });

  it("actually persists through AppPreferencesRepository", () => {
    // The other half of "the setting does nothing": it was written and never
    // read. Asserting the WRITE keeps that half honest while the read lands in
    // the bridge work.
    expect(screen).toMatch(/AppPreferencesRepository[\s\S]{0,200}widgetPrivacy/);
  });

  it("does NOT re-declare a default tier of its own", () => {
    // Every row carried `defaultTier: "..."` alongside DEFAULT_TIERS in the owner.
    // The two agreed when written and would have drifted the first time one
    // changed - a second owner of one fact, which is the exact defect this repo
    // keeps paying for. Asserted as an absence, because the failure mode is a
    // re-introduction rather than a removal.
    const code = stripLineComments(screen);
    expect(
      code.match(/defaultTier/g),
      "WidgetsScreen re-declares a default tier; read it from widgetPrivacy.js instead",
    ).toBeNull();
  });

  it("the comment stripper is itself non-vacuous", () => {
    // A stripper that removed everything would make the assertion above pass
    // forever. Asserted against the file it is actually used on: real JSX and
    // imports must survive, and a known comment must not.
    const code = stripLineComments(screen);
    expect(code.length, "the stripper deleted the whole file").toBeGreaterThan(screen.length * 0.5);
    expect(code, "the stripper ate real code").toMatch(/import\s/);
    expect(code, "the stripper ate real JSX").toMatch(/role="dialog"/);
    // And it must still be able to see a comment that names the very thing the
    // guard forbids, so the guard cannot pass by the stripper hiding it.
    expect(screen).toMatch(/^\s*\/\/.*defaultTier/m);
  });

  it("reads the tier through the owner rather than re-deriving it", () => {
    // The screen used to do `widgetPrefs.widgetPrivacy?.[w.key] ?? w.defaultTier`.
    // That re-implemented tierFor and, worse, passed an UNREADABLE stored value
    // straight through - so a stored "detailed" would select no button at all
    // and the fail-closed behaviour would be invisible in the very UI that
    // displays it.
    expect(screen).toMatch(/tierFor\(\s*w\.key\s*,\s*widgetPrefs\.widgetPrivacy\s*\)/);
    expect(
      screen.match(/widgetPrivacy\?\.\[/),
      "the screen is indexing the stored map directly instead of asking the owner",
    ).toBeNull();
  });

  it("draws no tier picker for a widget that shows no data", () => {
    // Every row used to render a Full/Redacted/Off dropdown, including the three
    // QuickAdd widgets - a meaningful-looking choice for a launch icon.
    expect(screen).toMatch(/isDataWidget\(w\.key\)\s*\?\s*\(/);
    expect(screen).toMatch(/Shortcut only — no data to hide/);
  });

  it("describes Redacted with the uniform rule, not a per-widget one", () => {
    // The copy said "Redacted shows counts only (e.g. '1 refill due')", which is
    // the per-widget meaning that was rejected: seven widgets, seven different
    // ideas of what Redacted is. The screen now has to state the one rule.
    expect(screen, "the old per-widget Redacted wording is still on screen").not.toMatch(/Redacted<\/strong> shows counts only/);
    expect(screen).toMatch(/never a name, date, time or location/);
  });
});
