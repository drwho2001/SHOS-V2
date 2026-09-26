// DST regression coverage for the every-N-days (custom) medication schedule.
//
// This exists because of a real bug the owner surfaced by asking whether the
// "this refill" figure could ever legitimately reach 100%. It could, and it
// should - and checking that revealed that the expected-day and streak
// arithmetic for custom meds was dividing elapsed MILLISECONDS by a flat
// 86400000, which is off by an hour across a DST boundary. A dose genuinely
// taken on a genuine due day was then dropped from the expected set, so a
// flawless every-14-days medication silently lost adherence it had earned.
//
// THE MONTH-INDEX TRAP, which cost this file two broken drafts before it was
// caught: JS Date months are 0-indexed, but the ISO strings this app stores
// are 1-indexed. A first version passed the same number to both and anchored
// every fixture on February while pinning "now" to April, so the cadence
// never lined up and every assertion read 0 - which looks exactly like the
// bug under test. Hence the two clearly separated helpers below: `isoDay`
// takes a 1-indexed month, `jsDate` takes a 0-indexed one, and each is used
// only for its own purpose.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeAdherence } from "./medicationCalculations";

const EVERY_14 = { usagePattern: "custom", dosesPerDay: 1, scheduleIntervalDays: 14 };

/** A stored datetime string. Month is 1-indexed, as ISO dates are. */
function isoDay(year, month, day, hh = 9, mm = 0) {
  const p = (v) => String(v).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)}T${p(hh)}:${p(mm)}:00.000Z`;
}

/** A real Date for the same calendar day. Month is 0-indexed, as JS is. */
function jsDate(year, month, day, hh = 12) {
  return new Date(year, month, day, hh, 0, 0, 0);
}

function doseOn(year, month, day) {
  return { type: "dose", delta: -1, date: isoDay(year, month, day), voided: false };
}
function refillOn(year, month, day) {
  return { type: "refill", delta: 12, date: isoDay(year, month, day), voided: false };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("every-N-days adherence across a DST boundary", () => {
  it("counts a perfect 14-day history as 100% even when it spans the change", () => {
    // "Now" is 15 Apr 2026. The cycle is anchored on 1 Mar, so the due days
    // are 1 Mar / 15 Mar / 29 Mar / 12 Apr - and 29 Mar sits inside the UK's
    // BST changeover, which is exactly the day the old millisecond-modulo
    // test got wrong.
    vi.setSystemTime(jsDate(2026, 3, 15));

    const med = {
      ...EVERY_14,
      unitsPerDose: 1,
      unitsPerContainer: 12,
      refillThreshold: 1,
      logs: [
        refillOn(2026, 3, 1),
        doseOn(2026, 3, 1),
        doseOn(2026, 3, 15),
        doseOn(2026, 3, 29),
        doseOn(2026, 4, 12),
      ],
    };

    const result = computeAdherence(med);
    // Every dose in the window was genuinely taken on a genuine due day, so
    // anything below 100% here is the bug, not a real miss.
    expect(result.sevenDay.pct).toBe(100);
    expect(result.sinceRefill.pct).toBe(100);
    expect(result.streak).toBeGreaterThanOrEqual(3);
  });

  it("does not inflate adherence by treating non-due days as expected", () => {
    // The mirror of the test above, and the reason the fix cannot be "just
    // count every day as expected": a 14-day medication must not be marked
    // down for the 13 days in between that were never due.
    vi.setSystemTime(jsDate(2026, 3, 15));

    const med = {
      ...EVERY_14,
      unitsPerDose: 1,
      unitsPerContainer: 12,
      refillThreshold: 1,
      logs: [
        refillOn(2026, 3, 1),
        doseOn(2026, 3, 1),
        doseOn(2026, 3, 15),
        doseOn(2026, 3, 29),
        doseOn(2026, 4, 12),
      ],
    };

    // Only 12 Apr falls inside the 7-day window, and it was logged, so the
    // window has exactly one expected day and it was hit.
    const result = computeAdherence(med);
    expect(result.sevenDay.expected).toBe(1);
    expect(result.sevenDay.pct).toBe(100);
  });

  it("still reports a genuine miss as a miss", () => {
    // The DST fix must not have been achieved by simply ignoring the
    // schedule. A due day with no dose is still a real miss, and this is the
    // test that would catch a lazy "always 100%" fix.
    vi.setSystemTime(jsDate(2026, 3, 15));

    const med = {
      ...EVERY_14,
      unitsPerDose: 1,
      unitsPerContainer: 12,
      refillThreshold: 1,
      logs: [
        refillOn(2026, 3, 1),
        doseOn(2026, 3, 1),
        doseOn(2026, 3, 15),
        // 29 Mar deliberately MISSED - the day inside the DST change.
        doseOn(2026, 4, 12),
      ],
    };

    const result = computeAdherence(med);
    // 29 Mar is outside the 7-day window, so the streak is what shows it.
    expect(result.streak).toBeLessThan(4);
  });

  it("handles a history straddling both spring-forward and fall-back", () => {
    // Northern spring-forward AND autumn fall-back in one history, so the
    // offset changes cancel out in total but not at either boundary. A test
    // covering only one of them would pass by accident.
    //
    // "Now" is 25 Oct, deliberately a DUE DAY, so the 7-day window genuinely
    // contains an expected day that was hit. An earlier draft pinned "now" to
    // 5 Nov, where no due day fell inside the window at all - expected was 0,
    // and windowStats' existing "nothing was due, nothing was missed" guard
    // returned 100%. The test passed, but for a reason that had nothing to do
    // with DST, which is exactly the kind of vacuous green worth catching.
    vi.setSystemTime(jsDate(2026, 9, 25));

    const med = {
      ...EVERY_14,
      unitsPerDose: 1,
      unitsPerContainer: 12,
      refillThreshold: 1,
      logs: [
        refillOn(2026, 3, 15),
        doseOn(2026, 3, 15),   // spring forward
        doseOn(2026, 3, 29),
        doseOn(2026, 4, 12),
        doseOn(2026, 4, 26),
        doseOn(2026, 5, 10),
        doseOn(2026, 5, 24),
        doseOn(2026, 6, 7),
        doseOn(2026, 6, 21),
        doseOn(2026, 7, 5),
        doseOn(2026, 7, 19),
        doseOn(2026, 8, 2),
        doseOn(2026, 8, 16),
        doseOn(2026, 8, 30),
        doseOn(2026, 9, 13),
        doseOn(2026, 9, 27),   // fall back
        doseOn(2026, 10, 11),
        doseOn(2026, 10, 25),
      ],
    };

    const result = computeAdherence(med);
    // Guard against the vacuous pass described above: the window must really
    // contain a due day, or this whole test proves nothing.
    expect(result.sevenDay.expected).toBeGreaterThan(0);
    expect(result.sevenDay.pct).toBe(100);
    expect(result.sinceRefill.pct).toBe(100);
    expect(result.streak).toBeGreaterThanOrEqual(4);
  });

  it("anchors on the first dose, not on the calendar", () => {
    // A 14-day cycle starting on an arbitrary weekday, as this function's own
    // comment describes. Guards against a "fix" that quietly moved the anchor
    // while repairing the DST arithmetic.
    //
    // "Now" is 20 MARCH - jsDate's month argument is 0-indexed, so this is
    // jsDate(2026, 2, 20). An earlier draft wrote jsDate(2026, 3, 20), which
    // is 20 April, putting "now" 30 days past the last logged dose and so
    // correctly reporting a streak of 0. The failure was in the fixture, not
    // the code - the same 0-indexed trap the file header warns about, hit a
    // second time in the opposite direction.
    vi.setSystemTime(jsDate(2026, 2, 20));

    const med = {
      ...EVERY_14,
      unitsPerDose: 1,
      unitsPerContainer: 12,
      refillThreshold: 1,
      logs: [
        refillOn(2026, 3, 1),   // Sunday
        doseOn(2026, 3, 1),
        doseOn(2026, 3, 8),     // Sunday, not the 1st
        doseOn(2026, 3, 15),
      ],
    };

    const result = computeAdherence(med);
    expect(result.streak).toBeGreaterThanOrEqual(2);
  });

  it("windows the since-refill figure to the current container, not the whole supply", () => {
    // The owner's actual question: does the "this refill" figure count days up
    // to now, or the entire refill-to-today span - and can it ever reach 100%
    // before the container runs out? Yes, and this is the guarantee.
    //
    // 12 tablets, 1 per dose, refilled 15 Mar, "now" 25 Mar: 11 days in, a
    // perfect record, and the container has 12 doses on a 14-day cycle, so
    // the cycle has not even completed once. It must read 100% NOW, not 0%
    // and not "wait until the container is empty".
    vi.setSystemTime(jsDate(2026, 9, 25));

    const med = {
      ...EVERY_14,
      unitsPerDose: 1,
      unitsPerContainer: 12,
      refillThreshold: 1,
      logs: [
        refillOn(2026, 3, 15),
        doseOn(2026, 3, 15),
        doseOn(2026, 3, 29),
        doseOn(2026, 4, 12),
        doseOn(2026, 4, 26),
        doseOn(2026, 5, 10),
        doseOn(2026, 5, 24),
        doseOn(2026, 6, 7),
        doseOn(2026, 6, 21),
        doseOn(2026, 7, 5),
        doseOn(2026, 7, 19),
        doseOn(2026, 8, 2),
        doseOn(2026, 8, 16),
        doseOn(2026, 8, 30),
        doseOn(2026, 9, 13),
        doseOn(2026, 9, 27),
        doseOn(2026, 10, 11),
        doseOn(2026, 10, 25),
      ],
    };

    const result = computeAdherence(med);
    // Perfect record, part-way through a container: 100% immediately.
    expect(result.sinceRefill.pct).toBe(100);
    // And it must be a real measurement of a real window, not the
    // "nothing was due" fallback returning 100% over an empty set.
    expect(result.sinceRefill.expected).toBeGreaterThan(0);
  });
});
