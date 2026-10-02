import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guards t063: the Last Test widget rendered a RAW fake-UTC storage value.
//
// Found on a real device (Redmi Note 13, Android 15) by the owner reporting
// that the widget showed no "No tests logged" state. The Java default is
// correct and is genuinely never reached, because the JS was passing
// `mostRecent.date` - a stored wall-clock string with a deliberate lie in the
// trailing Z, e.g. "2026-09-14T10:00:00.000Z" - straight through to the native
// TextView. That is not a date a person should ever be asked to read.
//
// The guard is deliberately narrow: it asserts this ONE call site formats, and
// that the raw field is not passed. A broad "all widgets format correctly"
// sweep would be a guess about code I have not read, and this repo's standing
// lesson is that a guard matching code it has not verified reports nothing.

const SRC = path.resolve("src");
const FILE = path.join(SRC, "calculations/testingReminderSync.js");

// Strip comments so a negative assertion cannot be satisfied by the very
// comment documenting the fix - a failure mode this repo has hit repeatedly.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("Last Test widget does not render a raw stored value (t063)", () => {
  const raw = fs.readFileSync(FILE, "utf8");
  const code = stripComments(raw);

  it("the file imports formatStoredDate", () => {
    expect(code).toMatch(/import\s*\{[^}]*\bformatStoredDate\b[^}]*\}\s*from\s*"\.\/dateInputHelpers"/);
  });

  it("formats lastTest rather than passing the stored value straight through", () => {
    // The defect, verbatim: `const lastTest = mostRecent.date;`
    expect(code).not.toMatch(/const\s+lastTest\s*=\s*mostRecent\.date\s*;/);
    // The fix.
    expect(code).toMatch(/const\s+lastTest\s*=\s*formatStoredDate\(\s*mostRecent\.date\s*\)/);
  });

  it("still handles the no-tests case explicitly", () => {
    // The owner's report was that this state was missing. It is handled in JS
    // as well as by the Java default, and both must stay: removing either one
    // would put an empty string on a home-screen widget again.
    //
    // WIDENED 2 Oct 2026, by exactly the legitimate amount. This asserted the
    // literal `updateTest({ lastTest:` i.e. that the payload was the FIRST
    // argument of the bridge method. Routing the call through sendWidgetUpdate -
    // so the stored widget tier actually applies - moved the payload behind two
    // arguments, and the assertion failed while the property it protects was
    // untouched: the no-tests case is still handled explicitly in JS.
    //
    // The rule it follows is the one CLAUDE.md records for guards that fire on a
    // legitimate change: widen by the amount the change required, keep the
    // assertion that matters, do not loosen it until it goes green. What
    // matters here is that "No tests logged" is still passed on the no-tests
    // path - so the pattern now tolerates the wrapper while still requiring the
    // method name and the literal value to be adjacent.
    expect(code).toMatch(/updateTest[\s\S]{0,60}lastTest:\s*"No tests logged"/);
  });

  it("routes through sendWidgetUpdate, so the tier cannot be bypassed", () => {
    // Added alongside the widening above, and deliberately asserts something
    // NEW rather than accepting the old form: the call is now filtered by the
    // shared helper. Without this, a future edit could quietly restore a raw
    // `bridge.plugin.updateTest(...)` and the widened pattern above would still
    // pass - which is how a widened guard becomes a weaker one.
    expect(code).toMatch(/sendWidgetUpdate\(\s*bridge,\s*"lastTest",\s*"updateTest"/);
  });

  it("the native default is still correct, so a cold-started widget is never blank", () => {
    const java = fs.readFileSync(
      path.resolve(
        "android/app/src/main/java/com/shos/app/widget/TestWidgetProvider.java",
      ),
      "utf8",
    );
    expect(java).toMatch(/prefs\.getString\(KEY_LAST_TEST,\s*"No tests logged"\)/);
  });
});

describe("no other widget was passing a raw stored datetime", () => {
  // Audited by hand on 1 Oct 2026. Recorded here so a future change that
  // reintroduces the pattern fails loudly rather than shipping a raw ISO
  // string onto a lock screen.
  const WIDGET_CALLS = [
    "calculations/medicationReminderSync.js",
    "calculations/testingReminderSync.js",
    "calculations/refillReminderSync.js",
    "calculations/clinicVisitReminderSync.js",
    "calculations/doxyPepSync.js",
    "modules/SHOS_MenstrualHealth_Prototype.jsx",
  ];

  it("no bridge call passes a bare .date property straight into the payload", () => {
    // Proven by injecting a real defect: an earlier version of this regex
    // required the line to END at `.date`, so a line like
    // `date: med.date });` slipped straight through and the guard passed 6/6
    // with the bug present. A guard that cannot fail is worse than none, so the
    // trailing context is tolerated and the non-vacuity proof below exercises
    // exactly the shapes that used to slip through.
    // Diagnosed once rather than guessed, after this guard shipped three wrong
    // versions, each caught only by an injected mutation that passed clean.
    // Two things I had backwards:
    //   1. The KEY is irrelevant and usually contains no "date" at all -
    //      `lastTest: mostRecent.date` is the exact shipped defect and
    //      "lastTest" has no "date" substring. An earlier version required the
    //      key to match and so could never catch the bug it was written for.
    //   2. The terminator must be an ALTERNATION (`$` or a closing character),
    //      not an optional group. `(?=[,}\);])?\s*$` made the terminator
    //      optional and then demanded end-of-line, which a trailing comma or
    //      `});` can never satisfy.
    // So: match the VALUE being a bare `.date` member access, then require it
    // to end the value - end of line, or one of `, } ) ;`.
    // `: ` then the value, then a terminator. `)` is placed LAST in the character
    // class deliberately: there it is unambiguously a literal, needs no
    // backslash (which eslint rejects as no-useless-escape), and cannot be
    // misread as closing the group. Written earlier in the class it was both a
    // lint error and, unescaped, a silently unterminated group - which cost
    // two of this guard's wrong versions.
    const DIRECT = /:\s*[\w.]+\.date\s*(?:$|[,})])/i;
    for (const rel of WIDGET_CALLS) {
      const code = stripComments(fs.readFileSync(path.join(SRC, rel), "utf8"));
      for (const m of code.matchAll(/bridge\.plugin\.update\w+\(\{([\s\S]*?)\}\)/g)) {
        for (const line of m[1].split("\n")) {
          // Only a DIRECT assignment with no formatter wrapped around it.
          // clinicVisitReminderSync formats correctly through
          // toLocaleDateString, and a regex cannot see that wrapping, so the
          // value must be the bare member access and nothing else.
          if (!DIRECT.test(line)) continue;
          throw new Error(
            `${rel} passes a raw .date into a widget payload unformatted:\n  ${line.trim()}\n` +
              `  Wrap it in a formatter (formatStoredDate for a fake-UTC stored value).`,
          );
        }
      }
    }
  });

  it("the scan detects every shape that has slipped through it before", () => {
    // Non-vacuity proof. This guard shipped three wrong versions and every one of
    // them passed a real injected mutation clean, so the shapes below are every
    // shape that has actually escaped it - plus correctly-formatted lines that
    // must NOT match. If this test is ever deleted the guard goes back to being
    // unfalsifiable, which is worse than having no guard at all.
    const DIRECT = /:\s*[\w.]+\.date\s*(?:$|[,})])/i;
    // Raw .date with nothing wrapped round it - must be caught.
    expect(DIRECT.test("        date: visit.date,")).toBe(true);
    expect(DIRECT.test("  await x({ count, nextRefill, date: med.date });")).toBe(true);
    expect(DIRECT.test("        lastTest: mostRecent.date")).toBe(true);
    expect(DIRECT.test("      nextDue: thing.date }")).toBe(true);
    // `;` is deliberately NOT a terminator here. No widget payload in src uses
    // it, so including it would only widen the pattern for a case that does not
    // exist - an assertion I wrote for it was the one failing while the pattern
    // was right.
    expect(DIRECT.test("        nextDue: thing.date;")).toBe(false);
    // Formatted values - must NOT be caught.
    expect(DIRECT.test("        date: format(visit.date),")).toBe(false);
    expect(DIRECT.test("        lastTest: formatStoredDate(mostRecent.date)")).toBe(false);
    expect(DIRECT.test("        count: count,")).toBe(false);
    expect(DIRECT.test('        title: visit.title || "Appointment",')).toBe(false);
  });
});