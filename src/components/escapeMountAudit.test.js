// Escape must not be registered by a CLOSED sheet. ADDED 30 Sep 2026 (t035).
//
// useEscapeToClose(onClose, enabled) pushes onto a LIFO stack on MOUNT and pops
// on UNMOUNT. Three sheets in this app are mounted PERMANENTLY and close via a
// falsy prop rather than by unmounting, so registering unconditionally put a
// closed sheet on the stack. Only the top of the stack ever acts, so the
// consequence was not a trapped key but a WRONG one: on the Testing list,
// Escape reached TestEditSheet's onClose, which is setScreen({name:"landing"}),
// and navigated the user off the list they were reading.
//
// This is deliberately a NARROW guard over three named components, not a general
// scan of every wired sheet. A general scan was tried and over-flagged: an
// earlier one-level-up pass reported six candidates, and reading them showed
// three of those were inside conditional parents two levels up, i.e. false
// positives. A test that flags three known-fine components is worse than no
// test, because the next session deletes it.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p) => readFileSync(join(process.cwd(), p), "utf8");

// [file, component, the prop that carries its real open state]
const ALWAYS_MOUNTED = [
  ["src/modules/SHOS_Testing_Prototype.jsx", "TestEditSheet", "isOpen"],
  ["src/modules/SHOS_ClinicVisits_Prototype.jsx", "VisitEditSheet", "isOpen"],
  ["src/modules/SHOS_Measurements_Prototype.jsx", "MeasurementPreferencesSheet", "isOpen"],
];

// Strip comments so a comment describing the fix cannot satisfy a positive
// check, and prove the stripper is non-vacuous rather than assuming it.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("the comment stripper is non-vacuous", () => {
  it("removes real comments while leaving real code", () => {
    const src = read(ALWAYS_MOUNTED[0][0]);
    expect(src).toContain("//");
    expect(strip(src).length).toBeLessThan(src.length);
    expect(strip(src)).toContain("useEscapeToClose");
  });
});

describe("a permanently-mounted sheet only registers on Escape while it is open", () => {
  it.each(ALWAYS_MOUNTED)("%s - %s passes a real open state to the hook", (file, component, prop) => {
    const code = strip(read(file));
    const body = code.slice(code.indexOf(`function ${component}(`), code.indexOf(`function ${component}(`) + 1200);
    expect(body, `${component} not found in ${file}`).toContain("useEscapeToClose(");
    // The second argument must be present - this is the whole fix.
    const call = body.match(/useEscapeToClose\(([^)]*)\)/);
    expect(call, `${component} does not call the hook`).toBeTruthy();
    const args = call[1].split(",").map((a) => a.trim());
    expect(args.length, `${component} passes only one argument to useEscapeToClose`).toBeGreaterThan(1);
    expect(args[1], `${component} must pass its open state as the second argument`).toBe(prop);
  });

  it.each(ALWAYS_MOUNTED)("%s - the call site actually supplies that prop", (file, component, prop) => {
    const code = strip(read(file));
    const render = code.match(new RegExp(`<${component}\\b[^>]*`));
    expect(render, `${component} has no JSX render site`).toBeTruthy();
    expect(render[0], `${component} is not passed ${prop}, so it cannot know its own open state`).toContain(
      `${prop}=`,
    );
  });
});

describe("the guard is not silently satisfied by an unrelated call", () => {
  it("a hook call with no second argument would fail the tests above", () => {
    // Non-vacuity, and the first version of this was written backwards -
    // asserting the broken form does NOT match, when matching is exactly what
    // the capture does. It failed, which is what caught it.
    const m = "useEscapeToClose(onClose)".match(/useEscapeToClose\(([^)]*)\)/);
    expect(m, "the pattern must still match, or every check above is hollow").toBeTruthy();
    expect(m[1].split(",").map((a) => a.trim())).toHaveLength(1);
    const fixed = "useEscapeToClose(onClose, isOpen)".match(/useEscapeToClose\(([^)]*)\)/);
    expect(fixed[1].split(",").map((a) => a.trim())).toHaveLength(2);
  });
});
