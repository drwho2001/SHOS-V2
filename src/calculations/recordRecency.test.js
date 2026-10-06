// The rule that decides whether a Clinic Visit or Symptom entry is drawn as
// current or de-emphasised.
//
// The property worth protecting is NOT INVENTING A CLINICAL THRESHOLD. The obvious
// implementation is to copy Testing's 90-day window, because Testing has one - but
// Testing's figure is only defensible there: it is BASHH's published 3-monthly
// routine screening interval, cited at the constant. There is no published
// interval for "how old a clinic visit should look", so reusing the number would
// be borrowing a sourced figure from the only context that sourced it. That is the
// same shape as the old 0.8/0.2 medication lockout factors: invented numbers that
// read as deliberate right up until someone audits them and finds no source.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isRecentRecord, RECENT_RANK_COUNT } from "./recordRecency.js";

const RECENT = { id: "r1", date: "2026-10-01T10:00:00.000Z" };
const OLD = { id: "o1", date: "2025-01-01T10:00:00.000Z" };
const OLDER = { id: "o2", date: "2024-01-01T10:00:00.000Z" };

describe("isRecentRecord - rank, not a clinical window", () => {
  it("treats the two most recent records as current", () => {
    const all = [RECENT, OLD, OLDER];
    expect(isRecentRecord(RECENT, all)).toBe(true);
    expect(isRecentRecord(OLD, all)).toBe(true);
    expect(isRecentRecord(OLDER, all)).toBe(false);
  });

  it("the count is two, and it is one named constant", () => {
    expect(RECENT_RANK_COUNT).toBe(2);
  });

  it("is not fooled by the order the records arrive in", () => {
    const shuffled = [OLDER, OLD, RECENT];
    expect(isRecentRecord(RECENT, shuffled)).toBe(true);
    expect(isRecentRecord(OLDER, shuffled)).toBe(false);
  });

  it("treats an undated record as current rather than fading it", () => {
    // A missing date is missing data. Fading a record for data the user never
    // entered would read as a judgement about the record itself.
    const undated = { id: "u1", date: null };
    expect(isRecentRecord(undated, [RECENT, undated])).toBe(true);
    expect(isRecentRecord({ id: "u2" }, [{ id: "u2" }])).toBe(true);
  });

  it("does nothing harmful with empty or malformed input", () => {
    expect(isRecentRecord(null, [])).toBe(true);
    expect(isRecentRecord(RECENT, null)).toBe(true);
    expect(isRecentRecord({ id: "x", date: "not-a-date" }, [])).toBe(true);
  });

  it("never fades a record it could not place", () => {
    // The one behaviour worth guaranteeing outright: this helper may only fade a
    // record it positively ranked below the top two. Absence of evidence - an
    // empty pool, a date it cannot parse, a caller whose list does not contain
    // this record - must leave the record alone, because dimming something for
    // failing to measure it is a judgement the app has no basis to make.
    const orphan = { id: "not-in-list", date: "2020-01-01T10:00:00.000Z" };
    expect(isRecentRecord(orphan, [RECENT, OLD])).toBe(true);
    expect(isRecentRecord(orphan, [])).toBe(true);
  });

  it("uses a caller-supplied window ONLY when one is passed", () => {
    const all = [RECENT, OLD, OLDER];
    // No window by default: the 2025 record is simply not among the two most
    // recent, which is a fact rather than a judgement about how long is too long.
    expect(isRecentRecord(OLD, all)).toBe(true); // rank 2 of 3
    const threeBack = { id: "o3", date: "2023-01-01T10:00:00.000Z" };
    expect(isRecentRecord(threeBack, [RECENT, OLD, OLDER, threeBack])).toBe(false);
    // A window is available for a caller that has a SOURCED figure, and it can
    // only ADD recency - it never removes it.
    expect(isRecentRecord(threeBack, [RECENT, OLD, OLDER, threeBack], { windowDays: 20000 })).toBe(true);
    expect(isRecentRecord(RECENT, [RECENT, OLD, OLDER], { windowDays: 1 })).toBe(true);
  });
});

describe("neither module invents a clinical threshold to do this", () => {
  // The point of t081 in one assertion. A guard cannot prove the number is
  // clinically right, but it CAN prove nobody typed one in, which is the actual
  // hazard - and it is the same trap this repo has already walked into twice with
  // timing constants that looked deliberate and were not.
  for (const file of ["SHOS_ClinicVisits_Prototype.jsx", "SHOS_SymptomLog_Prototype.jsx"]) {
    it(`${file} has no days-based recency constant of its own`, () => {
      const src = readFileSync(path.join(process.cwd(), "src", "modules", file), "utf8");
      const code = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
        .join("\n");
      expect(code, `${file} must not define its own recency window - use recordRecency.js`)
        .not.toMatch(/RECENT_\w*DAYS\s*=/);
      expect(code, `${file} must not pass a windowDays literal - that is an unsourced clinical constant`)
        .not.toMatch(/windowDays:\s*\d/);
    });

    it(`${file} reads recency from the shared owner`, () => {
      const src = readFileSync(path.join(process.cwd(), "src", "modules", file), "utf8");
      expect(src, `${file} should use the shared isRecentRecord`).toMatch(/isRecentRecord/);
    });
  }
});
