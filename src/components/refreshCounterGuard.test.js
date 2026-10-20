import fs from "node:fs";
import { it, expect } from "vitest";

/**
 * t123: the app's refresh counter, and the smoke suite that reads it.
 *
 * WHY THIS EXISTS. Five smoke assertions check that a DISMISSED reminder
 * banner does not come back on the next due-state refresh. They were
 * vacuous: dispatching a visibilitychange produced zero DOM mutations,
 * because the app is idle and React does not re-render when no state
 * changed. A negative assertion on a state that is SUPPOSED to be unchanged
 * passes identically whether the refresh ran and correctly kept the banner
 * hidden, or whether the refresh never ran at all.
 *
 * The fix is one DOM attribute on <body>, incremented by the refresh handler
 * when it has finished its work, and a smoke helper that WAITS FOR THAT
 * COUNTER TO ADVANCE before reading the DOM. A negative assertion that is
 * paired with a positive signal ("the refresh ran") is a real assertion; one
 * that is not is a comment.
 *
 * WHAT THIS GUARD PROTECTS, and why each part is load-bearing:
 *
 *  1. The attribute exists and is written by the refresh handler. Delete the
 *     hook and the smoke suite's wait times out - which fails loudly, but
 *     only in the 15-minute CI job, and only as a timeout.
 *  2. The counter is stamped AFTER the vault-unlock check, not before. A
 *     counter that ticked on entry would claim "the refresh ran" for a
 *     refresh that bailed out on a locked vault and did no work - the same
 *     vacuous assertion wearing a different hat.
 *  3. The app and the smoke suite use the SAME attribute name. They are two
 *     files that must agree, and nothing in the type system or the bundler
 *     checks that they do.
 */
const APP = "src/App.jsx";
const SMOKE = "scripts/smoke-test.cjs";

const app = fs.readFileSync(APP, "utf8");
const smoke = fs.readFileSync(SMOKE, "utf8");

/**
 * The body of a function, by brace counting.
 *
 * THE FIRST VERSION OF THIS HELPER SLICED TO THE NEXT `\n};`, which is
 * wrong in two ways that both showed up as a red run against correct code:
 * `checkDueMeds` is an ARROW function (`const checkDueMeds = async () => {`),
 * so a search for `function checkDueMeds(` never found it; and the smoke
 * helper's body ends with a bare `}`, not `};`, so the slice ran on to
 * whatever `};` came next and swallowed the rest of the file - including
 * the very `waitForTimeout(2500)` the test was asserting was gone.
 */
function functionBody(source, name) {
  const header = new RegExp(`(function\\s+${name}\\s*\\(|const\\s+${name}\\s*=)`).exec(source);
  expect(header, `${name} was not found`).not.toBeNull();
  const start = header.index;

  let depth = 0;
  let seen = false;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") { depth++; seen = true; }
    else if (source[i] === "}") {
      depth--;
      if (seen && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name}'s body could not be read - unbalanced braces`);
}

it("the refresh handler writes a counter onto <body>", () => {
  expect(app, "the refresh counter is gone from App.jsx").toContain("markRefreshCompleted");
  expect(app).toMatch(/dataset\.shosRefreshCount/);

  // Anti-vacuity: the counter must be written where a test can read it, and
  // the write must be inside the helper rather than nowhere at all.
  const helper = functionBody(app, "markRefreshCompleted");
  expect(helper).toContain("dataset.shosRefreshCount");
  expect(helper).toMatch(/el\.dataset\.shosRefreshCount = String\(next\)/);
});

it("the counter is stamped AFTER the vault-unlock check, so it means real work", () => {
  const check = functionBody(app, "checkDueMeds");
  const unlock = check.indexOf("isVaultUnlocked()");
  const stamp = check.indexOf("markRefreshCompleted()");
  expect(unlock, "the vault-unlock check could not be found").toBeGreaterThan(-1);
  expect(stamp, "the refresh handler no longer stamps the counter").toBeGreaterThan(-1);
  expect(
    stamp,
    "the counter is stamped BEFORE the vault-unlock check, so it would tick for a refresh that did no work",
  ).toBeGreaterThan(unlock);
});

it("the smoke suite reads the SAME attribute the app writes", () => {
  const appNames = [...app.matchAll(/dataset\.(\w+)/g)].map((m) => m[1]);
  const smokeNames = [...smoke.matchAll(/dataset\.(\w+)/g)].map((m) => m[1]);

  expect(appNames.length, "no dataset attribute found in App.jsx").toBeGreaterThan(0);
  expect(smokeNames.length, "no dataset attribute found in the smoke suite").toBeGreaterThan(0);

  const shared = appNames.filter((n) => smokeNames.includes(n));
  expect(
    shared,
    `the app writes [${appNames.join(", ")}] but the smoke suite reads [${smokeNames.join(", ")}] - ` +
      "the two sides have drifted, so the smoke helper would wait for a counter that never moves",
  ).toContain("shosRefreshCount");

  // And the other direction: every attribute the smoke suite reads must be
  // one the app actually writes. A rename on ONE side only leaves the shared
  // name in place, so the "shared" check above would still pass - this is
  // what catches that.
  const appOnly = smokeNames.filter((n) => !appNames.includes(n));
  expect(
    appOnly,
    `the smoke suite reads [${appOnly.join(", ")}], which App.jsx never writes - the two sides have drifted`,
  ).toEqual([]);
});

it("the smoke suite's refresh helper waits for the counter instead of sleeping", () => {
  const helper = functionBody(smoke, "runAppRefresh");
  expect(helper, "the smoke suite's runAppRefresh helper is gone").toContain("shosRefreshCount");
  // A bounded wait on the state actually asserted - not a fixed sleep.
  expect(helper).toContain("waitForFunction");
  // The wait must be on the counter ADVANCING, compared with the value read
  // before the refresh - and with NOTHING else. The first version of this
  // assertion was a regex that ended at "prev", so it matched "> prev + 1000"
  // as well: the mutation that made the wait unsatisfiable SURVIVED, which
  // is exactly what a mutation is for. It now pins the comparison's right
  // hand side to `prev` and forbids an arithmetic offset on it.
  expect(helper).toMatch(/\) > prev,/);
  expect(helper, "the wait compares the counter against something other than the previous value").not.toMatch(/prev\s*\+/);
  // And it must not have fallen back to the old fixed sleep as the mechanism.
  expect(helper).not.toMatch(/waitForTimeout\(2500\)/);
});
