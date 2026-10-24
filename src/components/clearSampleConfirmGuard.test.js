import fs from "node:fs";
import { it, expect } from "vitest";

/**
 * t064: clearing the sample data is CONFIRMED, and the confirmation names the
 * records it is about to remove.
 *
 * Until this, "Clear sample data" was ONE TAP in a medical app, over records
 * the user may never have looked at closely, and the only thing on screen was
 * a count. A count says how much; a list says WHAT, and "is any of this mine?"
 * is the question a person can actually answer.
 *
 * WHY A STATIC GUARD. The confirmation lives in two module files whose
 * components are not exported, and the repository function is async, so
 * asserting the behaviour needs either a rendering test or a source check.
 * The properties that matter here are about the WIRING - and the repo has an
 * established pattern for source-level wiring checks (deepLinkConsumerGuard,
 * refreshCounterGuard, widgetDeepLinkWiring).
 *
 * WHAT IS GUARDED, and why each part is load-bearing:
 *
 *  1. BOTH surfaces go through the same shared confirmation component. A copy
 *     in each place would be the near-duplication this repo has been bitten by
 *     before - and one copy showing names while the other showed counts would
 *     be worse than either.
 *  2. The destructive call is behind the confirmation, not behind the
 *     "Clear the demo data" control. This is the whole point of the change:
 *     the control that used to destroy the data now opens a confirmation.
 *  3. The count, the list and the clear share ONE predicate, so the list can
 *     never name a record the clear would keep.
 */
const HOME = "src/modules/SHOS_Home_Prototype.jsx";
const DEVTOOLS = "src/modules/settings/DeveloperToolsScreen.jsx";
const REPO = "src/repositories/clearSampleData.js";
const COMPONENT = "src/components/ClearSampleDataConfirm.jsx";

const home = fs.readFileSync(HOME, "utf8");
const devtools = fs.readFileSync(DEVTOOLS, "utf8");
const repo = fs.readFileSync(REPO, "utf8");
const component = fs.readFileSync(COMPONENT, "utf8");

/** The text around an aria-label, so a control's own handler can be checked. */
function around(source, needle, before = 500, after = 300) {
  const i = source.indexOf(needle);
  expect(i, `"${needle}" was not found`).toBeGreaterThan(-1);
  return source.slice(Math.max(0, i - before), i + after);
}

it("both surfaces offer the SAME shared confirmation component", () => {
  expect(component, "the shared confirmation component is missing").toContain("export default function ClearSampleDataConfirm");
  // It reuses the app's one delete-confirmation component, rather than being
  // a second confirmation pattern - and it does not wire its own Escape
  // handler, because ConfirmDeleteCard owns that (and maps it to cancel).
  expect(component).toContain("ConfirmDeleteCard");
  expect(component, "the confirmation must not wire its own Escape - ConfirmDeleteCard owns that").not.toContain("useEscapeToClose");

  for (const [name, source] of [["Home", home], ["Developer tools", devtools]]) {
    expect(source, `${name} does not import the shared confirmation`).toMatch(/import ClearSampleDataConfirm from/);
    expect(source, `${name} does not render the shared confirmation`).toContain("<ClearSampleDataConfirm");
    expect(source, `${name} does not load the named list`).toContain("listSampleData()");
  }
});

it("the 'Clear the demo data' control OPENS the confirmation - it does not clear", () => {
  for (const [name, source] of [["Home", home], ["Developer tools", devtools]]) {
    const control = around(source, 'aria-label="Clear the demo data"');
    expect(control, `${name}'s control does not open the confirmation`).toMatch(/onClick=\{openSampleClearConfirm\}/);
    expect(
      control,
      `${name}'s control still clears directly - the destructive call must be behind the confirmation`,
    ).not.toMatch(/onClick=\{(clearSample|handleClearSample)\}/);
  }
});

it("the destructive call happens only from the confirmation's confirm action", () => {
  for (const [name, source] of [["Home", home], ["Developer tools", devtools]]) {
    expect(source, `${name} does not pass the clear to the confirmation`).toMatch(/onConfirm=\{(clearSample|handleClearSample)\}/);
  }
});

it("the count, the list and the clear share ONE predicate", () => {
  // The helper exists...
  expect(repo, "the shared predicate is missing").toMatch(/function isRemovableSampleRecord\(/);
  // ...and all three readers use it. The count and the list are what a user
  // sees; the clear is what actually happens. A fourth copy of the rule is
  // how the list and the clear would come to disagree.
  const uses = (repo.match(/isRemovableSampleRecord\(/g) || []).length;
  expect(
    uses,
    "expected the shared predicate to be defined once and used by the count, the list and the clear",
  ).toBeGreaterThanOrEqual(4);
  // And the old inline form must be gone: the clear used to spell the rule
  // out as `!isSampleRecord(...) || referenced.has(...)`, which is the same
  // rule written a second way.
  expect(repo, "the clear still spells the rule out inline").not.toMatch(/!isSampleRecord\(r, seedIds\) \|\| referenced\.has\(r\.id\)/);
});

it("the list is built from the same predicate, not from a second rule", () => {
  const listFn = repo.slice(repo.indexOf("export async function listSampleData("));
  expect(listFn, "listSampleData could not be read").toContain("isRemovableSampleRecord");
  // And the count uses it too.
  const countFn = repo.slice(repo.indexOf("export async function countSampleData("), repo.indexOf("export async function listSampleData("));
  expect(countFn, "countSampleData could not be read").toContain("isRemovableSampleRecord");
});
