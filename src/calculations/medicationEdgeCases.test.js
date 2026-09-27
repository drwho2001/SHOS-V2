// Regression coverage for two figures that were reported as plain text but
// were genuinely wrong numbers.
//
// Both were found by asking "what does this figure actually mean when the
// underlying value is zero?", which is the question that tends to expose
// arithmetic that quietly assumes a non-degenerate input. Neither is
// DST-related (that is medicationAdherenceDST.test.js) and neither needs a
// particular timezone: both pin the clock and use calendar-day fixtures.
//
// A note on the stock fixtures, since getting this wrong wasted a first
// draft: computeStock() SUMS THE LOG DELTAS, and a dose log's delta is
// NEGATIVE, so stock is built by starting from a positive refill and then
// subtracting. The dose lists are generated rather than hand-written, because
// a hand-counted list of "eight" dose entries is exactly the kind of fixture
// that silently disagrees with its own comment.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeStock, computeAdherence } from "./medicationCalculations";

/** A stored datetime string. Month is 1-indexed, as ISO dates are. */
function isoDay(year, month, day, hh = 9, mm = 0) {
  const p = (v) => String(v).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)}T${p(hh)}:${p(mm)}:00.000Z`;
}

/** A real Date for the same calendar day. Month is 0-indexed, as JS is. */
function jsDate(year, month, day, hh = 12) {
  return new Date(year, month, day, hh, 0, 0, 0);
}

/** One positive "refill" log of `units` stock. */
function refillLog(units) {
  return { type: "refill", delta: units, voided: false };
}

/** `count` negative "dose" logs, each taking one unitPerDose. */
function doseLogs(count, date) {
  return Array.from({ length: count }, () => ({ type: "dose", delta: -1, voided: false, ...(date ? { date } : {}) }));
}

/** A PRN medication holding `dosesTaken` doses out of a `stock`-unit refill. */
function prnMed(stock, dosesTaken, overrides = {}) {
  return {
    inventoryTracked: true,
    usagePattern: "prn",
    dosesPerDay: 1,
    unitsPerDose: 1,
    unitsPerContainer: 30,
    refillThreshold: 5,
    logs: [refillLog(stock), ...doseLogs(dosesTaken)],
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("PRN stock: a container size of 0 must not render as Infinity", () => {
  // The Add/Edit form's NumberField is min={0}, so unitsPerContainer === 0 is
  // a value the user can genuinely reach, and a PRN medication may
  // legitimately not track containers at all. Before the fix the card
  // rendered the literal string "22 doses left · Infinity containers", and
  // "-Infinity containers" once stock hit zero.

  it("omits the container clause entirely when unitsPerContainer is 0", () => {
    vi.setSystemTime(jsDate(2026, 8, 27));
    const stock = computeStock(prnMed(30, 8, { unitsPerContainer: 0 }));
    expect(stock.tracked).toBe(true);
    // "22 doses left" is still correct and useful; only the invented
    // container count is dropped.
    expect(stock.supplementary).toBe("22 doses left");
    expect(stock.supplementary).not.toMatch(/Infinity/);
  });

  it("does not render -Infinity when stock is empty and unitsPerContainer is 0", () => {
    vi.setSystemTime(jsDate(2026, 8, 27));
    const stock = computeStock(prnMed(30, 30, { unitsPerContainer: 0 }));
    expect(stock.supplementary).toBe("0 doses left");
    expect(stock.supplementary).not.toMatch(/Infinity/);
  });

  it("still counts containers normally when unitsPerContainer is positive", () => {
    // The guard must not swallow the real, common case. This is the case that
    // would break if the fix were written as "skip the whole supplementary
    // line" instead of "skip the clause" - so it is asserted, not assumed.
    vi.setSystemTime(jsDate(2026, 8, 27));
    const stock = computeStock(prnMed(60, 30, { unitsPerContainer: 30 }));
    expect(stock.supplementary).toBe("30 doses left · 1 containers");
  });
});

describe("a medication that has never been started reports 0%, not 100%", () => {
  // windowStats()'s `expected > 0 ? ... : 100` guard is correct for a window
  // that genuinely contains no due day, and AdherencePill's own NaN guard
  // depends on it. It is the wrong answer for a custom (every-N-days)
  // medication with no dose ever logged: there is no anchor, so
  // computeExpectedDoseDays returns an empty set, and the medication reported
  // "0/0 · 100%" on its card, 100% on Home's Status-at-a-glance ring, and
  // 100% in Stats - where it also INFLATED a mixed set, averaging to 90%
  // when the only real medication was at 80%.
  //
  // computeAdherence() returns { streak, sevenDay, sinceRefill } - the stats
  // are nested, which is how every real UI caller reads them.

  const customMed = (logs) => ({
    usagePattern: "custom",
    dosesPerDay: 1,
    scheduleIntervalDays: 14,
    logs,
  });

  it("reports 0% when a custom medication has no dose log at all", () => {
    vi.setSystemTime(jsDate(2026, 3, 15));
    const { sevenDay } = computeAdherence(customMed([]));
    expect(sevenDay.expected).toBe(0);
    expect(sevenDay.pct).toBe(0);
  });

  it("still reports 100% for a started medication whose window has no due day", () => {
    // The counterpart that must NOT regress. A medication with real history,
    // checked before its next 14-day dose is due, genuinely has nothing to be
    // adherent to - that is a real 100%, not a missing value.
    //
    // "Now" is 5 Mar, dosed 1 Mar, so the next due day is 15 Mar. The 7-day
    // window reaches back to 29 Feb, and the only due day inside it is 1 Mar -
    // which was taken, so expected 1, hit 1, and a genuine 100%.
    //
    // The 1 Mar due day DOES count as expected even though it is 4 days ago,
    // because computeExpectedDoseDays walks forward from the first-ever dose
    // as the anchor. An earlier draft of this test asserted expected === 0
    // here, which was simply wrong about the anchor rule.
    vi.setSystemTime(jsDate(2026, 2, 5));
    const { sevenDay } = computeAdherence(customMed([{ type: "dose", delta: -1, date: isoDay(2026, 3, 1), voided: false }]));
    expect(sevenDay.expected).toBe(1);
    expect(sevenDay.pct).toBe(100);
  });

  it("counts today's own due day as expected, and credits it if it was taken", () => {
    // Pinned because getting it wrong is easy in BOTH directions, and this
    // file's own history has both mistakes in it.
    //
    // A first draft of the neighbouring test asserted that a day which is
    // itself a due day reads expected 0 "because a dose due today has not
    // been missed yet". It is the opposite: the 7-day expected set DOES
    // include today, and taking the dose credits it - expected 1, hit 1, 100%.
    // The rule that excludes today applies to the STREAK walk (a not-yet-
    // due-today slot must not reset a streak), not to the expected-day set.
    //
    // A second draft then read expected 0 here and was wrong for the opposite
    // reason: the fixture was built with jsDate(2026, 3, 15) while the doses
    // were on 15 MARCH, and JS months are 0-indexed - so "now" was actually
    // 15 APRIL, two weeks past the due day and outside the 7-day window
    // entirely. That is the exact month-index trap medicationAdherenceDST.test.js
    // documents at the top of its own file, reintroduced one file over.
    vi.setSystemTime(jsDate(2026, 2, 15));
    const { sevenDay } = computeAdherence(
      customMed([
        { type: "dose", delta: -1, date: isoDay(2026, 3, 1), voided: false },
        { type: "dose", delta: -1, date: isoDay(2026, 3, 15), voided: false },
      ])
    );
    expect(sevenDay.expected).toBe(1);
    expect(sevenDay.hit).toBe(1);
    expect(sevenDay.pct).toBe(100);
  });

  it("computes a real percentage normally once there is history", () => {
    // "Now" is 20 Mar - a few days PAST the 15 Mar due day, so that day is
    // unambiguously in the past and legitimately expected.
    vi.setSystemTime(jsDate(2026, 2, 20));
    const { sevenDay } = computeAdherence(
      customMed([
        { type: "dose", delta: -1, date: isoDay(2026, 3, 1), voided: false },
        { type: "dose", delta: -1, date: isoDay(2026, 3, 15), voided: false },
      ])
    );
    expect(sevenDay.expected).toBe(1);
    expect(sevenDay.hit).toBe(1);
    expect(sevenDay.pct).toBe(100);
  });

  it("no longer inflates a mixed set containing a never-started medication", () => {
    // The actual harm: a 100% phantom was averaged in alongside a genuine
    // 80%, lifting the reported overall figure to 90%. This asserts the
    // phantom now contributes 0, so the mean matches the real medication.
    vi.setSystemTime(jsDate(2026, 3, 15));
    const { sevenDay: neverStarted } = computeAdherence(customMed([]));
    const real = { pct: 80 };
    expect(Math.round((real.pct + 100) / 2)).toBe(90);
    expect(Math.round((real.pct + neverStarted.pct) / 2)).toBe(40);
  });
});
