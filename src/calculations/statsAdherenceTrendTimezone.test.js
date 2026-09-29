// The third shape in statsCalculations.js, and the one an eyeball sweep is least
// likely to reach because there is no toLocale* call anywhere near it.
//
// getAdherenceTrend builds a per-month adherence figure. Its day-walk and its
// dose-day set BOTH use local operations - new Date(y, m, 1), setDate,
// setHours(0,0,0,0) - but the VALUES are stored fake-UTC strings (m.startDate,
// l.date). setHours(0,0,0,0) floors to midnight in the DEVICE's zone, so in New
// York a stored "2026-08-30" (UTC midnight = 20:00 on 29 Aug local) is filed
// under 29 August.
//
// The visible consequence is bigger than a one-day slip: the last day of a month
// can be attributed to the PREVIOUS month, which changes two adjacent monthly
// percentages rather than nudging one. And the whole chain recomputes that
// figure, so the error is silent and looks like a real adherence change.
//
// This is the same class as the real DST bug this project already fixed in
// medicationCalculations.js - millisecond/local arithmetic standing in for
// calendar arithmetic - reintroduced through a different door.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getAdherenceTrend } from "./statsCalculations.js";

const PINNED_NOW = new Date("2026-09-15T12:00:00.000Z");
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(PINNED_NOW); });
afterAll(() => { vi.useRealTimers(); });

const med = (startDate, logs) => ({
  name: "Test med",
  usagePattern: "daily",
  isArchived: false,
  startDate,
  logs: logs.map((d) => ({ date: d, type: "dose" })),
});

const pctFor = (buckets, label) => buckets.find((b) => b.label === label)?.pct;

describe("adherence trend - a dose is counted on the day the user logged it", () => {
  it("a dose on the last day of a month counts towards THAT month", () => {
    // August: one dose, logged on 31 Aug, in a course that started 1 Aug.
    // If it is filed under 30 Aug or dropped, August reads 0% and the figure is
    // visibly wrong rather than subtly so.
    const buckets = getAdherenceTrend([med("2026-08-01", ["2026-08-31"])], 6);
    const aug = buckets.find((b) => /Aug/i.test(b.label));
    expect(aug, "an August bucket exists").toBeTruthy();
    expect(
      aug.pct,
      `31 Aug must count towards August, got ${aug.pct}. Buckets: ${JSON.stringify(buckets.map((b) => [b.label, b.pct]))}`,
    ).toBeGreaterThan(0);
  });

  it("a dose on the first day of a month counts towards THAT month", () => {
    // The mirror image, and the case that catches a "fix" which shifts
    // everything one way: 1 Sep belongs to September.
    const buckets = getAdherenceTrend([med("2026-09-01", ["2026-09-01"])], 6);
    const sep = buckets.find((b) => /Sep/i.test(b.label));
    expect(sep, "a September bucket exists").toBeTruthy();
    expect(sep.pct, `1 Sep must count towards September, got ${sep.pct}`).toBeGreaterThan(0);
  });

  it("does not credit the previous month for the current month's first day", () => {
    // The specific over-correction this guards: a fix that moved the day-walk
    // but left the dose set alone, or one that shifted every dose a day
    // forward, would make August look better than it is.
    const buckets = getAdherenceTrend([med("2026-08-01", ["2026-09-01"])], 6);
    const aug = buckets.find((b) => /Aug/i.test(b.label));
    const sep = buckets.find((b) => /Sep/i.test(b.label));
    expect(sep.pct, "September must be credited").toBeGreaterThan(0);
    // August's numerator should not include the 1 September dose. The course
    // ran 1 Aug - 31 Aug (31 days) and has exactly one dose, which is not in
    // August, so August's figure must be 0.
    expect(aug.pct, `August must not be credited with the 1 Sep dose, got ${aug.pct}`).toBe(0);
  });

  it("a full month of daily doses still reads 100%", () => {
    // The over-correction in the other direction. A fix that drops the last day
    // of every window, or that compares days across frames, would quietly lower
    // every perfect month and nobody would notice for months.
    const logs = [];
    for (let d = 1; d <= 31; d += 1) {
      logs.push(`2026-08-${String(d).padStart(2, "0")}`);
    }
    const buckets = getAdherenceTrend([med("2026-08-01", logs)], 6);
    const aug = buckets.find((b) => /Aug/i.test(b.label));
    expect(aug.pct, "a fully-dosed August must still read 100%").toBe(100);
  });

  it("produces a bucket for every month requested", () => {
    expect(getAdherenceTrend([], 6)).toHaveLength(6);
  });

  it("the CURRENT month is truncated at today, not run to month end", () => {
    // Pinned "now" is 15 Sep, so September's window is 1-15 Sep: 15 days. One
    // dose on the 1st is 1/15 = 7%. Running the window to the end of the month
    // would give 1/30 = 3%, which is the same shape of error as the
    // misfiled-dose one - reading a half-finished month as a finished one - and
    // it is invisible until someone with a good month watches it fall.
    //
    // This test exists because a mutation that removed the "today" truncation
    // PASSED every other assertion in this file. A guard is only as good as the
    // behaviour it actually pins.
    const buckets = getAdherenceTrend([med("2026-09-01", ["2026-09-01"])], 6);
    const sep = buckets.find((b) => /Sep/i.test(b.label));
    expect(sep.pct, `September must be measured over 15 days, got ${sep.pct}`).toBe(7);
  });
});
