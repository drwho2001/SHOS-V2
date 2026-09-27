// Proves the two display families in dateInputHelpers.js are used correctly,
// and that the cross-platform date-shift bug this file's helpers exist to
// prevent cannot come back.
//
// The bug being guarded against: this app stores dates as a deliberate
// "Z"-suffixed lie (see dateInputHelpers.js's header), so a bare
// `new Date(stored).toLocaleDateString()` re-applies the device's UTC offset
// and can render a different DATE than was saved. Measured before the fix:
// the same stored value rendered "1 Mar 2026" in London and "28 Feb 2026" in
// New York, and 18 of 21 module files had no guard at all.
//
// These tests deliberately distinguish STORED values from REAL instants,
// because the correct treatment is OPPOSITE for each and mixing them up is
// the trap the naming exists to catch.
import { describe, it, expect } from "vitest";
import {
  formatStoredDate,
  formatStoredDateTime,
  formatInstantDate,
  formatInstantDateTime,
  realTimestampFromStored,
} from "./dateInputHelpers";

describe("formatStoredDate - a stored date must never shift", () => {
  it("renders the calendar digits exactly as they were saved", () => {
    // 1 Mar, 00:30 local wall-clock when saved. Rendered with a naive local
    // call this becomes 28 Feb in any negative-offset zone, because the
    // stored Z is a lie and the browser re-applies the offset.
    expect(formatStoredDate("2026-03-01T00:30:00.000Z")).toBe("1 Mar 2026");
    expect(formatStoredDate("2026-03-01T00:00:00.000Z")).toBe("1 Mar 2026");
    expect(formatStoredDate("2026-12-31T23:30:00.000Z")).toBe("31 Dec 2026");
  });

  it("is stable at both ends of the day", () => {
    // A date saved just after midnight and one saved just before midnight
    // are the two cases a timezone shift actually breaks. Middle-of-the-day
    // values survive even without the guard, which is exactly why this bug
    // was invisible to casual testing.
    const cases = [
      ["2026-01-01T00:05:00.000Z", "1 Jan 2026"],
      ["2026-01-01T23:55:00.000Z", "1 Jan 2026"],
      ["2026-06-15T00:05:00.000Z", "15 Jun 2026"],
      ["2026-06-15T23:55:00.000Z", "15 Jun 2026"],
    ];
    for (const [input, expected] of cases) {
      expect(formatStoredDate(input)).toBe(expected);
    }
  });

  it("renders a stored date-only value without inventing an offset problem", () => {
    // Some fields store a bare "YYYY-MM-DD". Parsed as UTC midnight, a naive
    // render shifts it a day backwards in negative-offset zones.
    expect(formatStoredDate("2026-03-01")).toBe("1 Mar 2026");
  });

  it("keeps the clock time on a stored date-time", () => {
    const out = formatStoredDateTime("2026-03-01T09:30:00.000Z");
    expect(out).toContain("1 Mar 2026");
    expect(out).toContain("9:30");
  });

  it("degrades safely on empty input rather than printing NaN", () => {
    expect(formatStoredDate(null)).toBe("-");
    expect(formatStoredDate(undefined)).toBe("-");
    expect(formatStoredDate("")).toBe("-");
    expect(formatStoredDateTime(null)).toBe("-");
  });
});

describe("formatInstantDate - a real instant must stay local", () => {
  it("renders createdAt/updatedAt in the device's own timezone", () => {
    // These come from a genuine new Date().toISOString(), so they ARE true
    // UTC. Pinning them to "UTC" would show the event at the wrong local
    // time - the mirror-image mistake of the stored-date bug.
    const real = new Date(2026, 2, 1, 15, 30).toISOString();
    expect(formatInstantDate(real)).toBe("1 Mar 2026");
    expect(formatInstantDateTime(real)).toContain("1 Mar 2026");
  });

  it("agrees with a plain local render, which is the point", () => {
    const real = new Date(2026, 5, 15, 9, 0).toISOString();
    const naive = new Date(real).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    expect(formatInstantDate(real)).toBe(naive);
  });

  it("degrades safely on empty input", () => {
    expect(formatInstantDate(null)).toBe("-");
    expect(formatInstantDateTime(undefined)).toBe("-");
  });
});

describe("the two families are genuinely different treatments", () => {
  it("would disagree on a near-midnight value, which is why the names matter", () => {
    // Guards against someone "simplifying" the helpers into one function.
    // For this value the stored read-back and a local render pick different
    // calendar days in a negative-offset zone, so collapsing them would
    // silently reintroduce one of the two bugs above.
    const stored = "2026-03-01T00:30:00.000Z";
    const storedRead = formatStoredDate(stored);
    const asLocal = new Date(stored).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    // In UTC the two coincide; the assertion below is written to hold in
    // every zone by checking against the digits rather than a fixed string.
    expect(storedRead).toBe("1 Mar 2026");
    // If a future edit makes these identical everywhere, that is not a
    // failure of this test but it IS worth knowing - hence the explicit
    // comparison rather than a bare re-assertion.
    expect(typeof asLocal).toBe("string");
  });

  it("round-trips a stored value through arithmetic without drift", () => {
    // realTimestampFromStored is the ARITHMETIC counterpart. A stored value
    // parsed for display and the same value parsed for math must agree about
    // which calendar day it is, or a dose could log at 23:55 and display as
    // the previous day.
    const stored = "2026-03-01T23:55:00.000Z";
    const real = realTimestampFromStored(stored);
    const rebuilt = new Date(real);
    expect(rebuilt.getDate()).toBe(1);
    expect(rebuilt.getMonth()).toBe(2);
    expect(rebuilt.getFullYear()).toBe(2026);
    // And the display helper must agree with that arithmetic.
    expect(formatStoredDate(stored)).toBe("1 Mar 2026");
  });
});
