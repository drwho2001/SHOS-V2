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
  "src/modules/SHOS_MyProfile_Prototype.jsx",
  "src/modules/SHOS_Encounters_Prototype.jsx",
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
    // UNFILTERED load (feeding deriveHivStatus - a different fact) is not swept
    // in by accident.
    expect(checked).toBe(4);
  });

  it("the Clinic Card filter that caused the collapse is the fixed one", () => {
    expect(read("src/modules/SHOS_ClinicCard_Prototype.jsx")).toMatch(
      /sortByDateDesc\(\(await TestingRepository\.getAll\(\)\)\.filter\(\(t\) => !t\.isArchived && !\(t\.date && new Date\(t\.date\) > new Date\(\)\)\)\)/
    );
  });

  it("'Since last test' keeps records at or after the cutoff, so a future cutoff empties it", () => {
    // The mechanism by which the bug presented as a silent empty result rather
    // than an error. If this comparison is ever inverted, this catches it.
    const card = read("src/modules/SHOS_ClinicCard_Prototype.jsx");
    expect(card).toMatch(/withinTimeframe = \(dateStr\) => !cutoffDate \|\| !dateStr \|\| dateStr >= cutoffDate/);
    expect(card).toMatch(/if \(timeframe === "sinceLastTest"\) return lastTestDate;/);
  });
});