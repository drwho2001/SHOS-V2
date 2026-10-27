// t082: the dashboard's "Schedule routine retest" shortcut.
//
// REWRITTEN 21 Oct 2026 (t128) - the owner's decision reversed the premise
// this file existed to protect, and a guard that keeps protecting a rejected
// premise is worse than no guard, because it pushes the next session to
// undo the thing the owner just asked for.
//
// WHAT IT USED TO PROTECT, and why the owner overruled it. The shortcut
// NAVIGATED to the Testing list and wrote nothing, on the reasoning that a
// scheduled retest is a real persisted record and a one-tap shortcut should
// not write one the user never saw - including which test it follows. The
// owner's answer was that this is not how they schedule a retest: "currently
// users will be using the new test form and inputting a future date". The
// app now treats a future-dated test as a PLANNED test everywhere (t127), so
// the form IS the place a retest gets scheduled, and a separate scheduling
// sheet would have been a third way to say the same thing.
//
// WHAT IT PROTECTS NOW:
//   1. The shortcut OPENS THE NEW TEST FORM - not a bare navigation to the
//      Testing list, which is what the owner called wrong.
//   2. It is PRE-FILLED: the core panel, and the date three months after the
//      most recent completed negative core-panel test (the app's own rule,
//      not a guess). A blank form would be a worse starting point than the
//      one the Testing screen suggests.
//   3. It still does not WRITE anything by itself. It opens a form; the user
//      sees what is about to be saved and saves it. The original "writes
//      nothing" property was never wrong - it was the DESTINATION that was.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(process.cwd(), "src", "modules", "SHOS_Home_Prototype.jsx"), "utf8");
const translations = JSON.parse(readFileSync(
  path.join(process.cwd(), "src", "i18n", "en.json"), "utf8"));

/** The shortcut's own JSX, from the label to the end of the element. */
function shortcutBlock() {
  const at = source.indexOf('label="Schedule routine retest"');
  expect(at, "the Schedule routine retest shortcut is gone from the dashboard").toBeGreaterThan(-1);
  return source.slice(at - 40, at + 600);
}

describe("the routine-retest shortcut on the dashboard", () => {
  it("exists, with a human-readable title", () => {
    expect(source).toMatch(/label="Schedule routine retest"/);
  });

  it("opens the New test form, pre-filled - the way a retest is actually scheduled", () => {
    const block = shortcutBlock();
    expect(block, "the retest shortcut must open the New test form")
      .toMatch(/onQuickAddWithPrefill\("healthcare", "testing"/);
    // The pre-fill is the core panel - a routine retest screens for the
    // panel, not for one infection.
    expect(block, "the pre-fill must carry the core panel")
      .toMatch(/testingFor: \[\.\.\.ROUTINE_RETEST_PANEL\]/);
    // And a date, when there is one to suggest.
    expect(block, "the pre-fill must carry the suggested date")
      .toMatch(/date: `\$\{retestSuggestionDay\}T12:00:00\.000Z`/);
  });

  it("does not also navigate somewhere else - one action, one destination", () => {
    const block = shortcutBlock();
    expect(block, "the retest shortcut must not navigate as well as opening the form")
      .not.toMatch(/onNavigateToRecord\("healthcare", null, "testing"\)/);
  });

  it("is not a sibling of the vaccination button, which the owner kept as-is", () => {
    // The owner's explicit choice: only the retest action was wanted, because
    // "first vaccine dose" is a wrong label for a booster or a repeat dose. This
    // pins that decision so a future pass does not "helpfully" rename it.
    expect(source).toMatch(/label="Log vaccination"/);
  });
});

describe("the New test form refuses a result for a scheduled test", () => {
  const form = readFileSync(
    path.join(process.cwd(), "src", "modules", "SHOS_Testing_Prototype.jsx"), "utf8");

  it("a future-dated test with a result cannot be saved", () => {
    // A result for a test that has not happened is a record of something that
    // never occurred - and it is exactly the kind of thing that used to reach
    // a clinician's document. The rule itself is a pure function (so it can be
    // tested); this asserts the FORM uses it to gate the save.
    expect(form).toMatch(/hasResultForPlannedDate\(form\)/);
    expect(form).toMatch(/const canSave = !futureDatedWithResult &&/);
  });

  it("and it says so, under the date field, in plain words", () => {
    expect(form).toMatch(/isFutureDated && \(/);
    expect(form).toMatch(/tr\("testing\.futureDatePrefix", "A date in the future is a"\)/);
    expect(form).toMatch(/<strong>\{tr\("testing\.scheduledWord", "scheduled"\)\}<\/strong>/);
    expect(form).toMatch(/tr\("testing\.futureDateSuffix", " test, not a result\./);
    expect(`${translations.testing.futureDatePrefix} ${translations.testing.scheduledWord}${translations.testing.futureDateSuffix}`)
      .toBe("A date in the future is a scheduled test, not a result. It will be shown as planned, and it will not count as a completed test.");
  });
});
