// Wiring guard for t034: every consumer of a vaccination's date must read it
// through the derivation, not through the stale top-level field.
//
// WHY A SOURCE GUARD AND NOT JUST THE DERIVATION'S OWN TESTS
// ---------------------------------------------------------
// The derivation has 11 tests and all of them can pass while a consumer still
// reads the old field - the tests never touch the consumers. That gap has cost
// this repo twice before: a full Escape feature whose hook passed every test
// while a sweep silently failed to attach it, and a disclosure resolver wired to
// nothing. So the wiring is asserted directly.
//
// COMMENTS ARE STRIPPED FIRST, and that is not optional. Every one of these
// edits has a comment at it explaining that it used to read the stale field, and
// those comments quote the exact expression being banned. Without stripping, this
// guard would match its own documentation and pass for the wrong reason - the
// fourth recorded instance of that failure in this project, and the one where the
// comment and the fix were written in the same edit.
//
// The stripper is proven non-vacuous: it must still be able to see real code, or
// a broken stripper would make every negative assertion below pass trivially.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Two lessons are baked into this stripper, and both were found by running it.
//
// 1. It must handle a TRAILING comment, not just a whole-line one. The first
//    version used `/^\s*\/\/.*$/gm`, which only matches a comment that starts the
//    line - so `const a = 1; // v.date` kept its `v.date`. Every banned pattern
//    below is written inline, so that gap would have let a fix documented in a
//    trailing comment satisfy the negative assertion. The self-check asserts
//    both forms specifically, so this cannot regress.
//
// 2. It must preserve line numbers, so a failure points at the right line. A
//    guard whose error message says line 331 for a line that is 692 is worse than
//    no guard - and this repo has shipped exactly that.
const stripCommentsKeepLines = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));

const stripComments = (src) => stripCommentsKeepLines(src);

// A vaccination's date is only wrong where the record IS a vaccination. Three
// other record types in these same files legitimately read a top-level `v.date`
// - clinic visits and symptom entries maintain their own - so a file-wide ban
// on the expression produced FOUR false positives the first time it ran. The ban
// is therefore scoped to a region around an anchor in each file.
//
// The region spans lines BEFORE and AFTER the anchor, and that is not a detail:
// the first version only looked forwards, so for the calendar and the Clinic Card
// the stale expression sits BEFORE the anchor and three mutations sailed through
// undetected while the guard sat there green. A guard that is not looking where
// the bug is is worse than no guard, because it looks like coverage.
const region = (code, anchor, beforeLines = 8, afterLines = 8) => {
  const i = code.indexOf(anchor);
  if (i < 0) return "";
  const lineStart = (from) => code.lastIndexOf("\n", from) + 1;
  const start = lineStart(Math.max(0, i - 1));
  let cursor = i, seen = 0, end = code.length;
  while (cursor < code.length && seen < afterLines) {
    const nl = code.indexOf("\n", cursor);
    if (nl < 0) { end = code.length; break; }
    cursor = nl + 1; end = cursor; seen++;
  }
  let back = start, backSeen = 0;
  while (backSeen < beforeLines) {
    const nl = code.lastIndexOf("\n", back - 2);
    if (nl < 0) { back = 0; break; }
    back = nl; backSeen++;
  }
  return code.slice(back, end);
};

const CONSUMERS = [
  {
    file: "src/calculations/calendarCalculations.js",
    why: "the only consumer that leaves the device - a record with no top-level date was dropped from the phone calendar entirely",
    anchor: 'moduleKey: "vaccinations"',
    banned: /&& v\.date/,
  },
  {
    file: "src/modules/SHOS_GlobalSearch_Prototype.jsx",
    why: "the subtitle showed nothing for a date-less record, and the sort date put it in an arbitrary position",
    anchor: 'type: "vaccination"',
    banned: /subtitle:\s*v\.date\s*\?/,
  },
  {
    file: "src/modules/SHOS_Vaccinations_Prototype.jsx",
    why: "a record with no top-level date filed itself under an 'Undated' month heading",
    anchor: "monthLabel(",
    banned: /monthLabel\(v\.date\)/,
  },
  {
    file: "src/modules/SHOS_ClinicCard_Prototype.jsx",
    why: "the section heading and its own rows disagreed - the row display already derived the date on 29 Sep while the filter and sort read the stale value",
    anchor: "getVaccinationDate(v)",
    banned: /withinTimeframe\(v\.date\)/,
  },
];

describe("vaccination date is read through one derivation", () => {
  it("the comment stripper handles both comment forms and keeps line numbers", () => {
    // If this failed, every negative assertion below would pass for the wrong
    // reason - exactly the "detector that never fired" failure. The trailing
    // form is the one that bit the first version.
    const src = "const a = 1; // v.date\n/* v.date\n   still gone */\nconst b = v.date;";
    const out = stripComments(src);
    expect(out).toContain("const a = 1;");
    expect(out).toContain("const b = v.date;");
    expect(out).not.toContain("v.date\n/*");   // block comment removed
    expect(out.split("\n")[0]).not.toContain("v.date"); // trailing comment removed
    expect(out.split("\n").length).toBe(src.split("\n").length);
  });

  for (const c of CONSUMERS) {
    it(`${c.file} no longer reads the stale field in its vaccination region`, () => {
      const code = stripCommentsKeepLines(readFileSync(c.file, "utf8"));
      const scope = region(code, c.anchor);
      expect(scope, `${c.file}: anchor "${c.anchor}" not found - the guard is not looking where it thinks`).not.toBe("");
      expect(
        scope.match(c.banned),
        `${c.file} still reads the stale field - ${c.why}`
      ).toBeNull();
    });

    it(`${c.file} imports the derivation rather than shadowing the name`, () => {
      // MUTATION-FOUND. The first version of this asserted only that the name
      // `getVaccinationDate` appeared in the file, and replacing the import with
      // `const getVaccinationDate = () => null;` satisfied it - a local stub that
      // makes every consumer silently do nothing. Asserting a name is present is
      // not the same as asserting where it came from.
      const code = stripComments(readFileSync(c.file, "utf8"));
      expect(
        code,
        `${c.file} must IMPORT getVaccinationDate, not define a local of that name`
      ).toMatch(/import\s*\{[^}]*\bgetVaccinationDate\b[^}]*\}\s*from\s*"[^"]*vaccinationCalculations"/);
      expect(code).not.toMatch(/(const|let|var|function)\s+getVaccinationDate\b/);
    });
  }

  it("the Clinic Card actually passes the derived date to the sort", () => {
    // The sort helper takes an optional accessor. Cloning the array and sorting
    // it without one is valid JavaScript that silently reverts to `.date` - which
    // is exactly what happened, and exactly what a reviewer would not spot.
    //
    // Scoped to the vaccination sort on purpose. This file has several
    // sortByDateDesc calls and the other record types correctly do NOT pass an
    // accessor, so a file-wide search matched the Testing call first and the
    // assertion failed for the wrong reason - which is the mirror image of the
    // over-broad file-wide ban that produced four false positives earlier.
    const code = stripComments(readFileSync("src/modules/SHOS_ClinicCard_Prototype.jsx", "utf8"));
    const scope = region(code, "when: getVaccinationDate(v)", 2, 10);
    expect(scope, "vaccination sort region not found").not.toBe("");
    expect(scope, "the vaccination list must be sorted through the derivation").toMatch(
      /sortByDateDesc\([\s\S]*?,\s*\(?\s*\w+\s*\)?\s*=>\s*getVaccinationDate\(/
    );
  });

  it("the derivation is the only place that falls back to the legacy field", () => {
    // The fallback is deliberate and must stay in ONE place. If a consumer grows
    // its own `|| v.date` fallback the two drift again, which is the bug.
    const offenders = CONSUMERS
      .map((c) => ({ file: c.file, code: stripComments(readFileSync(c.file, "utf8")) }))
      .filter(({ code }) => /\|\|\s*v\.date|\?\?\s*v\.date/.test(code))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("the sort helper can be given the derived date", () => {
    // sortByDateDesc originally took no accessor, so the Clinic Card's second
    // argument was being silently ignored and the list still sorted on the stale
    // field. A function that accepts an argument nobody can pass is exactly the
    // kind of thing that looks fine in review.
    const src = readFileSync("src/calculations/encounterCalculations.js", "utf8");
    expect(stripComments(src)).toMatch(/export function sortByDateDesc\(\w+,\s*\w+\s*=/);
  });
});
