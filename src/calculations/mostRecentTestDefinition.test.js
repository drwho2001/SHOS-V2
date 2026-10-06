import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// t053 finding 3 - "the most recent test" had four owners, and one disagreed
// with the other three.
//
// Home, My Profile and the Encounters "since last test" filter all exclude
// future-dated tests. Clinic Card did not, and because its `tests` array is
// sorted newest-first, a booked test sorted to index 0 and became the cutoff for
// the "Since last test" timeframe. `withinTimeframe` keeps records at or after
// the cutoff, so a cutoff in the future removed EVERY encounter, contact and
// test - the user selected "Since last test" and got a silently empty card.
//
// The rule was never in doubt: testingRepository.js states it outright ("a test
// dated in the future can never be marked most recent") and enforces it on
// write. This guard protects the concept, not a count, because the earlier
// enumeration in this audit undercounted a site formatted across several lines.

const files = [
  "src/modules/SHOS_ClinicCard_Prototype.jsx",
  "src/modules/SHOS_Home_Prototype.jsx",
  "src/modules/SHOS_Encounters_Prototype.jsx",
  // ADDED 1 Oct 2026, and REMOVED My Profile in the same change.
  //
  // This guard fired on its own: after My Profile's duplicated
  // getAutoLastTestedDate() was replaced by a call to the shared owner, that file
  // no longer contained a filtered load and the sweep correctly reported it as
  // vacuous. The rule's INTENT - no consumer of "most recent test" may admit a
  // future-dated one - is unchanged; what changed is that the rule now lives in
  // ONE place instead of four, so it is asserted there (below) rather than
  // re-implemented at every call site.
  //
  // Removing a file from a sweep is exactly the kind of edit that can quietly
  // weaken a guard, so the count is still pinned below, and a new test asserts
  // the central helper itself excludes future-dated tests.
  ];

const read = (p) => readFileSync(resolve(process.cwd(), p), "utf8");

// NO HAND-ROLLED COMMENT STRIPPER, and that is a finding rather than a style
// preference. Three earlier attempts each used one:
//
//   1. Whole-file scanning flagged My Profile's UNFILTERED load at line 966,
//      which legitimately feeds deriveHivStatus() - a different derived fact.
//   2. A regex over the filter expression silently matched ZERO loads in My
//      Profile (it cannot span the nested parens in
//      `new Date().toISOString().slice()`) while still reporting confidently.
//   3. Worst: the block-comment regex matched a `/*` and a distant `*/` and
//      blanked out real CODE. It erased the body of getAutoLastTestedDate,
//      including the very line under test, then reported "no filtered test load
//      found". The non-vacuity check passed because it only inspected a file
//      where nothing happened to break.
//
// A stripper that deletes its own subject still produces confident output. So
// these assertions are POSITIVE and code-anchored: a line must both open a
// filtered load and carry real statement syntax, which a comment cannot
// satisfy. Where comment ranges are genuinely needed this repo already reaches
// for @babel/parser (see components/iconOnlyUIAudit.test.js) - a regex is not a
// parser, and this file is the evidence.
//
// The rule currently exists in FOUR spellings, not the three I first recorded:
//   Clinic Card            !(t.date && new Date(t.date) >  new Date())
//   Encounters              new Date(t.date) <= new Date()
//   Home / My Profile       t.date.slice(0,10) <= new Date().toISOString().slice(0,10)
// The first two compare instants, the third compares calendar days, so a test
// logged for later TODAY is included by some and excluded by others. Not a bug
// in itself - "tested today" is defensible - but it is exactly the ambiguity
// that let a fourth consumer drift out of line with the other three.
//
// `>=` is deliberately NOT accepted. It would admit a future test, which is the
// exact defect this guard exists to prevent, and it is close enough to `<=` that
// a careless edit could smuggle it in.
const FUTURE_EXCLUSION =
  /new Date\(t\.date\)\s*(?:>|<=)\s*new Date\(\)|t\.date\.slice\(0, 10\)\s*<=\s*new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/;

const opensAFilteredLoad = (line) =>
  line.includes("TestingRepository.getAll()).filter(") &&
  (line.includes("const tests =") || line.includes("sortByDateDesc("));

describe("the most recent test: one definition of 'recent'", () => {
  it("the repository enforces the rule it owns", () => {
    const repo = read("src/repositories/testingRepository.js");
    expect(repo).toMatch(/isFuture\s*=/);
    expect(repo).toMatch(/mostRecent:\s*isFuture\s*\?\s*false/);
  });

  it("every filtered test load excludes future-dated tests", () => {
    let checked = 0;
    for (const f of files) {
      const loadLines = read(f).split(/\r?\n/).filter(opensAFilteredLoad);
      expect(loadLines.length, `${f}: no filtered test load found - guard is vacuous`).toBeGreaterThan(0);
      for (const line of loadLines) {
        expect(line, `${f}: does not exclude future-dated tests -> ${line.trim().slice(0, 88)}`).toMatch(
          FUTURE_EXCLUSION
        );
        checked++;
      }
    }
// Pins that the sweep saw what it thinks it saw, and that My Profile's
    // UNFILTERED load (feeding deriveHivStatus - a different derived fact) is not swept
    // in by accident. Was 4; My Profile moved its rule into the shared owner on
    // 1 Oct 2026, so three call sites remain and the fourth is asserted below.
    expect(checked).toBe(3);
  });

  it("the shared owner excludes future-dated tests, since it is where the rule now lives", async () => {
    // The counterpart to the sweep above. Four call sites each re-implemented this
    // rule and one of them got it wrong in a different way (returning a chlamydia
    // swab as an HIV test date), which is why the logic moved here.
    const { mostRecentTestDate } = await import("./mostRecentTest.js");
    const future = "2099-01-01T09:00:00.000Z";
    const past = "2026-01-01T09:00:00.000Z";
    const tests = [
      { id: "t1", date: future, testingFor: ["HIV"] },
      { id: "t2", date: past, testingFor: ["HIV"] },
    ];
    expect(mostRecentTestDate(tests, { infection: "HIV" })).toBe(past);

    // And the rule still holds when a future test is the ONLY one, which is the
    // case that matters: a scheduled test must not become "last tested".
    expect(mostRecentTestDate([tests[0]], { infection: "HIV" })).toBeNull();
  });

  it("the Clinic Card filter that caused the collapse is the fixed one", () => {
    // Retargeted 6 Oct 2026, not loosened. The literal spelling this used to
    // assert no longer exists because the archived/future rule moved into the
    // shared owner `isCompletedTestRecord` - so the assertion now checks the
    // PROPERTY (both exclusions are applied) instead of one exact string, which
    // is strictly stronger: it would still fail if either half came back.
    const card = read("src/modules/SHOS_ClinicCard_Prototype.jsx");
    expect(card).toMatch(/sortByDateDesc\(\(await TestingRepository\.getAll\(\)\)\.filter\(\(t\) => isCompletedTestRecord\(t\) && !\(t\.date && new Date\(t\.date\) > new Date\(\)\)\)\)/);
  });

  it("'Since last test' keeps records at or after the cutoff, so a future cutoff empties it", async () => {
    // The mechanism by which the bug presented as a silent empty result rather
    // than an error. If this comparison is ever inverted, this catches it.
    //
    // Moved 6 Oct 2026 into the shared owner clinicCardCalculations.js. The
    // assertion follows the rule to where it now lives, and EXERCISES it rather
    // than grepping for its text - a grep passes on a function that is never
    // called, and passes on one whose comparison has been inverted in a way the
    // regex does not match. This is the stronger form.
    const card = read("src/modules/SHOS_ClinicCard_Prototype.jsx");
    expect(card).toMatch(/if \(timeframe === "sinceLastTest"\) return lastTestDate;/);
    expect(card).toMatch(/isWithinClinicCardTimeframe/);

    const { isWithinClinicCardTimeframe } = await import("./clinicCardCalculations.js");
    // At or after the cutoff is kept: this is the direction that, if inverted,
    // silently empties the card when the cutoff is in the future.
    expect(isWithinClinicCardTimeframe("2026-10-06", "2026-10-06")).toBe(true);
    expect(isWithinClinicCardTimeframe("2026-10-07", "2026-10-06")).toBe(true);
    expect(isWithinClinicCardTimeframe("2026-10-05", "2026-10-06")).toBe(false);
    // No cutoff means no narrowing, and an undated record is never filtered out
    // by a date window it cannot be measured against.
    expect(isWithinClinicCardTimeframe("2026-10-06", null)).toBe(true);
    expect(isWithinClinicCardTimeframe(null, "2026-10-06")).toBe(true);
  });
});