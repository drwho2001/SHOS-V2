// t082: the dashboard's "Schedule routine retest" shortcut.
//
// Two properties worth protecting, and neither is visible in the UI:
//
// 1. It NAVIGATES and does not write. A scheduled retest is a real persisted
//    record (isRoutineRetestPlan), so a one-tap shortcut that created one would
//    write a plan the user never saw or confirmed - including which test it
//    follows. The action deliberately lives on that test's detail screen.
//
// 2. It goes where those actions actually are: Testing, not a blank Add form.
//    Opening the Add form would be actively wrong here, since a plan is not a
//    completed test and saving one there would record a test that has not
//    happened.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(process.cwd(), "src", "modules", "SHOS_Home_Prototype.jsx"), "utf8");

describe("the routine-retest shortcut on the dashboard", () => {
  it("exists, with a human-readable title", () => {
    expect(source).toMatch(/label="Schedule routine retest"/);
  });

  it("navigates to Testing rather than opening the blank Add form", () => {
    expect(source).toMatch(/onClick=\{\(\) => onNavigateToRecord\("healthcare", null, "testing"\)\}/);
    // The trap this guards: onQuickAdd("healthcare", "testing") opens the blank
    // New-test form, which is where a completed test belongs and NOT where a
    // scheduled plan belongs.
    const block = source.slice(source.indexOf('label="Schedule routine retest"') - 400,
                               source.indexOf('label="Schedule routine retest"') + 120);
    expect(block, "the retest shortcut must not use the blank-add quick-add path")
      .not.toMatch(/onQuickAdd\("healthcare", "testing"\)/);
  });

  it("is not a sibling of the vaccination button, which the owner kept as-is", () => {
    // The owner's explicit choice: only the retest action was wanted, because
    // "first vaccine dose" is a wrong label for a booster or a repeat dose. This
    // pins that decision so a future pass does not "helpfully" rename it.
    expect(source).toMatch(/label="Log vaccination"/);
  });
});