// clinicVisitUrgency.test.js
//
// Guards partitionVisitsByUrgency() - the 14-day "upcoming" window behind the
// Appointments widget (t060).
//
// The test that matters most is BOUNDARY DISCIPLINE. A window can look correct
// and still be measured by the wrong ruler: `Math.round(elapsedMs / 86400000)`
// and "the calendar date 14 days out" agree on almost every input and disagree
// on exactly the one a user would notice. Both of those cases are pinned below
// with the arithmetic written out, because the whole value of this file is that
// a mutation swapping the ruler FAILS - see the MUTATION NOTE on each.

import { describe, it, expect } from "vitest";
import { partitionVisitsByUrgency, UPCOMING_WINDOW_DAYS } from "./clinicVisitShape.js";
import { realTimestampFromStored } from "./dateInputHelpers.js";

/** A visit record as the repository stores it: fake-UTC wall-clock digits. */
const visitOn = (iso, id) => ({ id, date: iso, title: `Visit ${id}` });

// A fixed "now" so nothing here depends on the day the suite runs.
// 13 Oct 2026, 00:30 LOCAL wall-clock - deliberately EARLY in the day, because
// that is what makes the boundary case discriminating (see below).
const NOW = new Date(realTimestampFromStored("2026-10-13T00:30:00.000Z"));
const NOW_DAY_INDEX = Date.UTC(2026, 9, 13); // 13 Oct, re-expressed at UTC midnight

describe("partitionVisitsByUrgency", () => {
  it("puts a visit on the 14th calendar day inside the window", () => {
    // 27 Oct is exactly UPCOMING_WINDOW_DAYS days after 13 Oct.
    const boundaryDay = visitOn("2026-10-27T12:00:00.000Z", "day14");
    const { upcoming, later } = partitionVisitsByUrgency([boundaryDay], NOW);
    expect(upcoming).toEqual([boundaryDay]);
    expect(later).toEqual([]);
  });

  it("puts a visit on the 15th calendar day outside the window", () => {
    const day15 = visitOn("2026-10-28T12:00:00.000Z", "day15");
    const { upcoming, later } = partitionVisitsByUrgency([day15], NOW);
    expect(later).toEqual([day15]);
    expect(upcoming).toEqual([]);
  });

  // THE DISCRIMINATING CASE. Read the arithmetic.
  //
  // now  = 13 Oct 00:30.  visit = 27 Oct 23:00 (the 14th calendar day, late).
  // Elapsed = 14 days 22h30m = 14.9375 days. Math.round(14.9375) === 15.
  //
  // So an implementation that measures with Math.round(elapsed/86400000) and
  // compares `<= 14` calls this visit "later" - on the LAST day of the window,
  // at 11pm, because the user checked the widget in the morning.
  //
  // The calendar-day ruler says 27 Oct <= 27 Oct, so it is "upcoming". That is
  // the answer the owner asked for ("within the next two weeks = upcoming").
  //
  // MUTATION NOTE: replacing localDayIndex(ms) <= horizonDay with
  // Math.round((ms - now.getTime()) / 86400000) <= UPCOMING_WINDOW_DAYS must make
  // this test RED. If it stays green, this file is not testing the ruler.
  it("keeps a late-evening visit on the 14th day inside the window, where an elapsed-time ruler would drop it", () => {
    const lateOnBoundary = visitOn("2026-10-27T23:00:00.000Z", "day14-late");

    // The counter-implementation, computed here so the test states the
    // disagreement rather than merely asserting the right answer.
    const elapsedDays = Math.round(
      (realTimestampFromStored(lateOnBoundary.date) - NOW.getTime()) / 86400000
    );
    expect(elapsedDays).toBe(15);
    expect(elapsedDays <= UPCOMING_WINDOW_DAYS).toBe(false); // the WRONG answer

    const { upcoming, later } = partitionVisitsByUrgency([lateOnBoundary], NOW);
    expect(upcoming).toEqual([lateOnBoundary]); // the RIGHT answer
    expect(later).toEqual([]);
  });

  // The mirror image, same arithmetic, other side of the ruler.
  // now = 13 Oct 23:00. visit = 27 Oct 09:00. Elapsed = 13d10h = 13.4167 days.
  // Math.round -> 13, so an elapsed ruler says "upcoming" here - which happens
  // to be right, but for the wrong reason: it would ALSO say upcoming for a
  // visit 14.4 days out. Pinned so the window's width cannot be quietly widened
  // to `<= 15` or `<= 16` and still pass.
  //
  // MUTATION NOTE: widening the comparison to `<= UPCOMING_WINDOW_DAYS + 1`
  // must make this RED.
  it("does not stretch the window to swallow the 15th day", () => {
    const lateNow = new Date(realTimestampFromStored("2026-10-13T23:00:00.000Z"));
    const earlyOnDay15 = visitOn("2026-10-28T09:00:00.000Z", "day15-early");
    const { upcoming, later } = partitionVisitsByUrgency([earlyOnDay15], lateNow);
    expect(later).toEqual([earlyOnDay15]);
    expect(upcoming).toEqual([]);
  });

  it("keeps a visit later today inside the window", () => {
    const laterToday = visitOn("2026-10-13T18:00:00.000Z", "today");
    const { upcoming, later } = partitionVisitsByUrgency([laterToday], NOW);
    expect(upcoming).toEqual([laterToday]);
  });

  it("separates a mixed list correctly and preserves input order in both buckets", () => {
    // Deliberately NOT sorted, to prove this function does not re-sort - every
    // caller already passes a soonest-first list and a second ordering rule is
    // a second thing to keep correct.
    const far = visitOn("2026-12-01T10:00:00.000Z", "far");
    const soon = visitOn("2026-10-14T10:00:00.000Z", "soon");
    const mid = visitOn("2026-10-27T10:00:00.000Z", "mid");

    const { upcoming, later } = partitionVisitsByUrgency([far, soon, mid], NOW);
    expect(upcoming.map((v) => v.id)).toEqual(["soon", "mid"]);
    expect(later.map((v) => v.id)).toEqual(["far"]);
  });

  it("drops a visit with an unparseable date from BOTH buckets", () => {
    // Not counted as "later" on purpose: a visit whose date is broken is not
    // evidence of a distant appointment, and the widget must not show a number
    // the app cannot substantiate.
    const broken = { id: "broken", date: "not-a-date" };
    const missing = { id: "missing" };
    const nullish = { id: "nullish", date: null };
    const good = visitOn("2026-10-14T10:00:00.000Z", "good");

    const { upcoming, later } = partitionVisitsByUrgency([broken, missing, nullish, good], NOW);
    expect(upcoming.map((v) => v.id)).toEqual(["good"]);
    expect(later).toEqual([]);
  });

  it("ignores null entries without throwing", () => {
    const { upcoming, later } = partitionVisitsByUrgency([null, undefined, visitOn("2026-10-14T10:00:00.000Z", "ok")], NOW);
    expect(upcoming.map((v) => v.id)).toEqual(["ok"]);
    expect(later).toEqual([]);
  });

  it("returns two empty buckets for a non-array input rather than throwing", () => {
    expect(partitionVisitsByUrgency(null, NOW)).toEqual({ upcoming: [], later: [] });
    expect(partitionVisitsByUrgency(undefined, NOW)).toEqual({ upcoming: [], later: [] });
    expect(partitionVisitsByUrgency([], NOW)).toEqual({ upcoming: [], later: [] });
  });

  it("pins the window to 14 days", () => {
    // A bare literal here would let the constant drift silently, and the OWNER's
    // "two weeks" is the requirement, not the number.
    expect(UPCOMING_WINDOW_DAYS).toBe(14);
    expect(NOW_DAY_INDEX + UPCOMING_WINDOW_DAYS * 86400000).toBe(Date.UTC(2026, 9, 27));
  });
});