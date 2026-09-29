// The contraception interval-in-days conversion, t020.
//
// Separated out because the function is exported for this test, and because the
// bug it guards is the clearest example in the repo of a FRAME MISMATCH rather
// than bad arithmetic: every operation was individually correct, and the
// combination was wrong in exactly the half of the world behind UTC.
//
// `fromDate` is a stored fake-UTC value, so parsing it yields UTC midnight.
// `getDate()` / `setMonth()` / `setDate()` are LOCAL operations on that instant.
// In New York, a stored "2026-01-31" is 30 January 19:00 local, so the whole
// calendar arithmetic ran a day ahead of the day the user typed:
//
//   1 month from 31 Jan  ->  29 days   (correct: 28)
//   1 month from 31 Mar  ->  31 days   (correct: 30)
//
// That lands in a stored contraception `intervalDays`, which drives a REMINDER -
// so the user is reminded on the wrong day, and the number stored is simply not
// what they asked for.
import { describe, it, expect } from "vitest";
// Re-pointed 29 Sep 2026 (t020) when daysForUnit moved out of the component.
// It was originally exported from SHOS_MenstrualHealth_Prototype.jsx purely so
// it could be tested at all, which is a boundary the project's own
// repository/calculation/sync split forbids - pure arithmetic in a component.
// Importing from a .jsx module to test it is the smell, not the fix.
import { daysForUnit } from "./contraceptionCalculations.js";

describe("a month interval is the real number of days in that month", () => {
  it("31 Jan + 1 month is 28 days, in 2026", () => {
    expect(daysForUnit(1, "Months", "2026-01-31")).toBe(28);
  });

  it("31 Mar + 1 month is 30 days", () => {
    expect(daysForUnit(1, "Months", "2026-03-31")).toBe(30);
  });

  it("31 Jan + 1 month is 29 days in a leap year, because that is the month", () => {
    // The edge case that makes "just use 30 days" wrong, and the reason the
    // function is a real calendar walk rather than a multiplication.
    expect(daysForUnit(1, "Months", "2028-01-31")).toBe(29);
  });

  it("handles a multi-month interval from a mid-month start", () => {
    expect(daysForUnit(3, "Months", "2026-01-15")).toBe(90); // 15 Jan -> 15 Apr
    // 30 Sep -> 30 Mar is 181, not 183: 31+30+31+31+28+30, and 2027 is not a
    // leap year. My first expectation here was 183, which the code correctly
    // refused to match - the failure was in my arithmetic, and the comment
    // records it because "add 30 days a month" is exactly the wrong idea this
    // function exists to prevent.
    expect(daysForUnit(6, "Months", "2026-09-30")).toBe(181);
  });

  it("is unaffected by a mid-time start on the same day", () => {
    // A stored date-time that happens to be a few hours in, rather than a plain
    // YYYY-MM-DD. The answer must be the same, because the user means the day.
    expect(daysForUnit(1, "Months", "2026-01-31T00:30:00.000Z")).toBe(28);
  });
});

describe("day and week units are unchanged", () => {
  it("passes days through", () => {
    expect(daysForUnit(28, "Days", "2026-01-01")).toBe(28);
  });

  it("converts weeks", () => {
    expect(daysForUnit(4, "Weeks", "2026-01-01")).toBe(28);
  });

  it("an unknown unit does not silently become zero days", () => {
    // A stored interval of 0 would mean "every day", which is a real reminder
    // change rather than a missing field - so the fallback is the raw value.
    expect(daysForUnit(3, "Fortnights", "2026-01-01")).toBe(3);
  });
});
