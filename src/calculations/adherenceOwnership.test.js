import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeAdherence } from "./medicationCalculations";

// Real bug found by the t053 "one owner per derived fact" audit, 30 Sep 2026.
//
// windowStats() owns the adherence percentage. It was corrected on 27 Sep to
// report 0% for a medication with no doses ever logged, because 100% had been
// inflating a mixed set to 90% when the only real medication was at 80%. Stats
// and Home both read that corrected value.
//
// AdherencePill did NOT. It was handed `hit` and `expected` and divided them
// itself with the pre-fix `else 100`. So a never-started medication displayed
// 100% on its own card while Home's ring and Stats displayed 0% for the same
// record, at the same moment. The owner was correct, unit-tested, and consumed
// nowhere on that screen.
//
// This file exists so the second owner cannot come back, and so the empty case
// keeps an honest display without breaking the arithmetic the aggregate relies
// on.

const jsDate = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);
const isoDay = (y, m, d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${y}-${p(m)}-${p(d)}T09:00:00.000Z`;
};

const customMed = (logs) => ({
  usagePattern: "custom",
  dosesPerDay: 1,
  scheduleIntervalDays: 14,
  logs,
});

const SOURCE = resolve(
  process.cwd(),
  "src/modules/SHOS_Medication_Dashboard_Prototype.jsx"
);
const src = () => readFileSync(SOURCE, "utf8");

// Comments in this file quote the old code verbatim to explain what was removed,
// so every negative assertion runs against comment-stripped source. Without
// this the guard would be satisfied by the very comment documenting the fix -
// the failure mode this repo has now hit five separate times.
const stripComments = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(Math.max(0, m.length - p1.length)));

describe("adherence: one owner, no second arithmetic", () => {
  beforeEach(() => {});
  afterEach(() => vi.useRealTimers());

  it("the owner distinguishes 'nothing logged' from 'nothing due'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(jsDate(2026, 4, 15));

    // Never started. 0% is right arithmetically and there is nothing to show.
    const never = computeAdherence(customMed([]));
    expect(never.sevenDay.expected).toBe(0);
    expect(never.sevenDay.pct).toBe(0);
    expect(never.sevenDay.hasData).toBe(false);

    // Started, but nothing due inside this window. That is a real 100%, and it
    // is NOT an empty state - collapsing these two is how the two bugs get
    // confused, so both halves are pinned.
    vi.setSystemTime(jsDate(2026, 3, 5));
    const started = computeAdherence(
      customMed([{ type: "dose", delta: -1, date: isoDay(2026, 3, 1), voided: false }])
    );
    expect(started.sevenDay.expected).toBe(1);
    expect(started.sevenDay.pct).toBe(100);
    expect(started.sevenDay.hasData).toBe(true);
  });

  it("pct stays a NUMBER - the aggregate divides it", () => {
    // The tempting fix for "0% reads as failure" is to return null for the
    // empty case. That would be a regression, not a fix: getOverallAdherence
    // filters `typeof pct === "number"`, so null silently drops the medication
    // from the average and reinstates the exact 90%-instead-of-80% inflation
    // the hasHistory guard exists to prevent. The number and the display
    // concern have to stay separate.
    vi.useFakeTimers();
    vi.setSystemTime(jsDate(2026, 4, 15));
    const { sevenDay, sinceRefill } = computeAdherence(customMed([]));
    expect(typeof sevenDay.pct).toBe("number");
    expect(typeof sinceRefill.pct).toBe("number");
    expect(Number.isFinite(sevenDay.pct)).toBe(true);
    expect(Number.isFinite(sinceRefill.pct)).toBe(true);
  });

  it("the component does not recompute the percentage", () => {
    const code = stripComments(src());
    const body = code.slice(code.indexOf("function AdherencePill"));
    expect(body).not.toMatch(/expected\s*>\s*0\s*\?/);
    expect(body).not.toMatch(/hit\s*\/\s*expected/);
    expect(body).toMatch(/\bpct\b/);
  });

  it("both pills are handed the owner's value", () => {
    const code = src();
    for (const win of ["sevenDay", "sinceRefill"]) {
      expect(code).toMatch(new RegExp(`pct=\\{adherence\\.${win}\\.pct\\}`));
      expect(code).toMatch(new RegExp(`hasData=\\{adherence\\.${win}\\.hasData\\}`));
    }
  });

  it("the empty case renders an empty state, not a number", () => {
    expect(src()).toMatch(/No doses logged yet/);
  });
});