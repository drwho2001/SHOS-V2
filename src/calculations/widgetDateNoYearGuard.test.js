// widgetDateNoYearGuard.test.js
//
// ADDED 18 Oct 2026 - guards the year-less date formatters added for the 2-cell
// widget rebuild.
//
// WHY A GUARD. The bug these exist to prevent is not hypothetical and was
// measured on a real device: at a 2-cell widget's 77dp content width,
// "14 Sep 2026" is about 40% wider than "14 Sep", and the extra width is what
// pushed the Last Test widget's date into truncation. Dropping the year is the
// fix, and the reason it can be a guard rather than a comment is that dropping
// it has three ways to go wrong that all still "work":
//
//   1. Dropping the year AND the frame. formatStoredDate reads stored values in
//      UTC because the stored digits are local wall-clock with a deliberate
//      trailing Z. Render it in local time and the DAY shifts west of UTC -
//      t037 is exactly that bug, already shipped once. A year-less formatter
//      that forgets timeZone:"UTC" is a new route to a live defect.
//   2. Silently changing the app-wide formatters. formatStoredDate and
//      formatDayKey are shared by the whole app, where the year IS load-bearing.
//      If someone removes the year from them to "fix the widget", every screen
//      in the app loses it and only this guard's sibling assertions notice.
//   3. Producing "Invalid Date" for the empty/absent case, which is the shape
//      both widgets actually pass when there is no record - the redacted line
//      builder is handed one of these directly.

import { describe, it, expect } from "vitest";
import {
  formatStoredDate,
  formatStoredDateNoYear,
  formatStoredDateTimeNoYear,
  formatDayKey,
  formatDayKeyNoYear,
} from "./dateInputHelpers.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const STORED = "2026-09-14T10:00:00.000Z";
const DAY_KEY = "2026-12-01";

describe("widget date formatters drop the year and nothing else", () => {
  it("the no-year stored form is the year-bearing form minus the year", () => {
    // Derived rather than hardcoded, so a change to the frame in one is visible
    // as a difference rather than as a silently-passing literal.
    const withYear = formatStoredDate(STORED);
    const without = formatStoredDateNoYear(STORED);
    expect(withYear).toContain("2026");
    expect(without).not.toContain("2026");
    expect(without).toBe(withYear.replace(/[\s,]*2026/, ""));
  });

  it("both read stored values in the UTC frame, so the DAY does not shift", () => {
    // The invariant is that the no-year form names the SAME DAY as the
    // year-bearing one, whatever the year was doing. A formatter that dropped the
    // year and read local time would agree on the year and disagree on the day.
    const dayOfYearBearing = formatStoredDate(STORED).replace(/[\s,]*\d{4}$/, "");
    const dayOfNoYear = formatStoredDateNoYear(STORED);
    expect(dayOfNoYear).toBe(dayOfYearBearing);
  });

  it("the day-key variant agrees with formatDayKey on the day", () => {
    // "2026-12-01" is 1 Dec 00:00 UTC. Formatted in local time it prints as
    // 2 December anywhere east of UTC - the t037 trap, and a day key is exactly
    // what the Last Test widget's retestDue is.
    //
    // Note there is no year to strip here: formatDayKey never emitted one.
    // This is the pure frame check.
    expect(formatDayKeyNoYear(DAY_KEY)).toBe(formatDayKey(DAY_KEY));
    expect(formatDayKeyNoYear(DAY_KEY)).toMatch(/1\b/);
    expect(formatDayKeyNoYear(DAY_KEY)).toMatch(/Dec/);
  });

  it("the date-time variant keeps the time and drops only the year", () => {
    const s = formatStoredDateTimeNoYear(STORED);
    expect(s).not.toContain("2026");
    expect(s).toMatch(/\d{1,2}:\d{2}/);
  });

  it("absent and malformed values return the same placeholder, never Invalid Date", () => {
    // The shape both widgets actually pass when there is no record.
    for (const bad of [null, undefined, "", "not-a-date"]) {
      expect(formatStoredDateNoYear(bad)).toBe("-");
      expect(formatStoredDateTimeNoYear(bad)).toBe("-");
      expect(formatDayKeyNoYear(bad)).toBe("-");
    }
  });

  it("the app-wide formatters still carry the year", () => {
    // The anti-vacuity half. Without this, deleting the year from
    // formatStoredDate - which every screen in the app shares - would pass every
    // assertion above, because they only compare the two forms to each other.
    expect(formatStoredDate(STORED)).toContain("2026");

    // formatDayKey is a DIFFERENT case and asserting a year here was wrong:
    // it never carries one. Its options are day + month + optional weekday, and
    // the weekday variant ("Tue 1 Dec") is what the notification copy uses. So
    // there is no app-wide year to protect on this function, only a weekday
    // prefix that formatDayKeyNoYear must not have invented or dropped. It
    // takes no weekday option at all, and this pins that both forms still agree
    // on the day without one.
    expect(formatDayKey(DAY_KEY)).toBe("1 Dec");
    expect(formatDayKey(DAY_KEY, { weekday: true })).toBe("Tue 1 Dec");
    expect(formatDayKeyNoYear(DAY_KEY)).toBe(formatDayKey(DAY_KEY));
  });
});

describe("the year is dropped for the widget, not for the app", () => {
  const src = readFileSync(
    join(process.cwd(), "src", "calculations", "testingReminderSync.js"),
    "utf8",
  );

  it("the widget payload is built from the no-year form, and the Redacted line from the full one", () => {
    // Both, in that order of importance. The payload is what renders on the home
    // screen and is what had to lose the year. The Redacted line is a
    // category+state string that never contained a date either way, so which
    // form feeds it is a correctness matter rather than a width one - it must
    // stay the year-bearing one, because that is what
    // widgetRedactedRender's vocabulary assertions were written against.
    expect(src).toMatch(/lastTest:\s*lastTestCompact/);
    expect(src).toMatch(/retestDue:\s*retestDueCompact/);
    expect(src).toMatch(/lastTestRedactedLine\(lastTest\)/);
    expect(src).not.toMatch(/lastTestRedactedLine\(lastTestCompact\)/);
  });

  it("the year-bearing form is still computed, not deleted", () => {
    // Both call sites are live. Deleting the year-bearing form along with its
    // use would make the widget right and silently lose the notification copy.
    expect(src).toMatch(/formatStoredDate\(mostRecent\.date\)/);
    expect(src).toMatch(/formatDayKey\(suggested/);
  });
});