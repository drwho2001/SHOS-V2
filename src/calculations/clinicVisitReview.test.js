// t054 - the follow-up review derivation.
//
// nextReviewDate has been on the clinic visit record since 19 Aug 2026 and, until
// now, nothing outside the frozen seed snapshot read it. This covers the pure
// derivation that finally consumes it.
//
// The cases that are easy to get wrong, and are pinned here because each has
// produced a wrong answer somewhere in this project's history:
//
//   - The day count. Dividing a millisecond span by 86400000 TRUNCATES, so 1h59m
//     reads as 0 days and a review reads as "today" when it is nearly two days
//     away. Rounding is what makes "days until" agree with the calendar.
//   - Unparseable dates must be treated as ABSENT, not as overdue. Inventing a
//     warning from a broken stored string is the fail-open direction, and it
//     would also hide every other visit's warning if it threw instead.
//   - Archived visits must not contribute.
//   - "Soonest" is by DATE, not by state: picking by state would hide an
//     overdue review behind a nearer upcoming one.
//
// The clock is passed in rather than read, so none of this depends on when the
// suite runs (L-054: a test that only passes when the machine is fast is nearly
// as bad as one that cannot fail).

import { describe, it, expect } from "vitest";
import {
  reviewStatusFor,
  soonestReview,
  REVIEW_DUE_SOON_DAYS,
} from "./clinicVisitShape.js";

const NOW = new Date("2026-10-12T12:00:00.000Z");

/** `days` days after NOW, as a stored date string. */
function inDays(days, time = "12:00") {
  const d = new Date(NOW.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10) + "T" + time + ":00.000Z";
}

const visit = (over = {}) => ({
  id: "v1",
  title: "Clinic",
  date: inDays(-30),
  isArchived: false,
  nextReviewDate: null,
  followUpType: "",
  ...over,
});

describe("reviewStatusFor (t054)", () => {
  it("reports a past review as OVERDUE, with days negative", () => {
    const s = reviewStatusFor(visit({ nextReviewDate: inDays(-3) }), NOW);
    expect(s).toBeTruthy();
    expect(s.state).toBe("overdue");
    expect(s.days).toBe(-3);
  });

  it("reports a review inside the courtesy window as DUE SOON", () => {
    const s = reviewStatusFor(visit({ nextReviewDate: inDays(2) }), NOW);
    expect(s.state).toBe("due-soon");
    expect(s.days).toBe(2);
  });

  it("reports a distant review as SCHEDULED, with no warning attached", () => {
    const s = reviewStatusFor(visit({ nextReviewDate: inDays(60) }), NOW);
    expect(s.state).toBe("scheduled");
    expect(s.days).toBe(60);
  });

  it("treats the boundary day itself as due-soon, not scheduled", () => {
    // Off-by-one here is the difference between warning a user on the last
    // useful day and not warning them at all.
    const s = reviewStatusFor(visit({ nextReviewDate: inDays(REVIEW_DUE_SOON_DAYS) }), NOW);
    expect(s.state).toBe("due-soon");
  });

  it("treats the day after the boundary as scheduled", () => {
    const s = reviewStatusFor(
      visit({ nextReviewDate: inDays(REVIEW_DUE_SOON_DAYS + 1) }),
      NOW
    );
    expect(s.state).toBe("scheduled");
  });

  it("a review later TODAY is due-soon, not overdue", () => {
    // Same calendar day, later clock time: days === 0, and 0 is not negative.
    const s = reviewStatusFor(visit({ nextReviewDate: inDays(0, "23:30") }), NOW);
    expect(s.days).toBe(0);
    expect(s.state).toBe("due-soon");
  });

  it("rounds the day count rather than truncating it", () => {
    // THE case that distinguishes round from floor. A review two calendar days
    // out, an hour EARLIER in the day, is a span of 1.958 days:
    //   floor -> 1  (understates urgency by a whole day)
    //   round -> 2  (agrees with the calendar the user is looking at)
    // The first version of this test used 1d+1h, where floor and round agree, so
    // it passed against a truncating implementation. A mutation harness caught
    // it; the test was decorative on the exact property it claimed to pin.
    const s = reviewStatusFor(visit({ nextReviewDate: inDays(2, "11:00") }), NOW);
    expect(s.days).toBe(2);
  });

  it("does not call a review later TODAY overdue", () => {
    // The other end of the same trap, and the dangerous direction: later today
    // is a span of -0.02 days, so floor gives -1, which would report a review
    // the user still has time to attend as OVERDUE. Rounding gives 0.
    const s = reviewStatusFor(visit({ nextReviewDate: inDays(0, "23:30") }), NOW);
    expect(s.days).toBe(0);
    expect(s.state).toBe("due-soon");
  });

  it("reads a review an hour into yesterday as 1 day overdue, not 0", () => {
    // floor gives 0 here, which would report an elapsed review as neither
    // overdue nor due - i.e. no warning at all.
    const s = reviewStatusFor(visit({ nextReviewDate: inDays(-1, "13:00") }), NOW);
    expect(s.days).toBe(-1);
    expect(s.state).toBe("overdue");
  });

  it("returns null when there is no review date at all", () => {
    expect(reviewStatusFor(visit(), NOW)).toBeNull();
    expect(reviewStatusByNull(visit({ nextReviewDate: "" }))).toBeNull();
  });

  it("returns null for an UNPARSEABLE date rather than inventing a warning", () => {
    // The fail-open direction: a broken stored string must not become
    // "overdue". It also must not throw, because a throw here would take the
    // caller's whole loop with it and hide every other visit's review.
    expect(reviewStatusFor(visit({ nextReviewDate: "not-a-date" }), NOW)).toBeNull();
    expect(reviewStatusFor(visit({ nextReviewDate: {} }), NOW)).toBeNull();
  });

  it("carries followUpType through as the KIND, defaulting to empty", () => {
    expect(reviewStatusFor(visit({ nextReviewDate: inDays(-1), followUpType: "Test of cure" }), NOW).kind)
      .toBe("Test of cure");
    expect(reviewStatusFor(visit({ nextReviewDate: inDays(-1) }), NOW).kind).toBe("");
  });
});

function reviewStatusByNull(v) {
  return reviewStatusFor(v, NOW);
}

describe("soonestReview (t054)", () => {
  it("returns null for an empty list", () => {
    expect(soonestReview([], NOW)).toBeNull();
    expect(soonestReview(null, NOW)).toBeNull();
  });

  it("picks by DATE, so an overdue review is not hidden behind a nearer upcoming one", () => {
    // The decision this function exists to get right. Sorting by state would
    // return the due-soon one and lose the fact that something is overdue.
    const list = [
      visit({ id: "soon", nextReviewDate: inDays(2) }),
      visit({ id: "late", nextReviewDate: inDays(-40) }),
    ];
    const best = soonestReview(list, NOW);
    expect(best.visit.id).toBe("late");
    expect(best.status.state).toBe("overdue");
  });

  it("ignores archived visits", () => {
    const list = [
      visit({ id: "archived", isArchived: true, nextReviewDate: inDays(-1) }),
      visit({ id: "real", nextReviewDate: inDays(30) }),
    ];
    const best = soonestReview(list, NOW);
    expect(best.visit.id).toBe("real");
  });

  it("skips visits whose review date is unparseable, without abandoning the list", () => {
    const list = [
      visit({ id: "broken", nextReviewDate: "garbage" }),
      visit({ id: "real", nextReviewDate: inDays(1) }),
    ];
    const best = soonestReview(list, NOW);
    expect(best.visit.id).toBe("real");
  });

  it("skips visits with no review date at all", () => {
    const list = [
      visit({ id: "none" }),
      visit({ id: "real", nextReviewDate: inDays(1) }),
    ];
    expect(soonestReview(list, NOW).visit.id).toBe("real");
  });
});