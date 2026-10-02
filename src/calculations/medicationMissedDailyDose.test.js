// ADDED 2 Oct 2026 - a daily dose whose scheduled time had already passed was
// silently SKIPPED, found by hand on a real phone.
//
// THE REPORT, which is what makes this test exist: a once-daily medication
// scheduled and reminded at 04:00, last dose logged the previous day at 05:07,
// and at 04:48 the app showed the next dose as ~23h away, the dose button greyed
// out as already-logged, and the banner reporting every daily medication as
// logged. In other words the app did not ask for today's dose and would not
// unlock the button for it. For a PrEP or DoxyPEP course that is not a display
// bug - it is a dose the user does not take.
//
// THE CAUSE: fixedModeDueSlot stepped forward by
// Math.ceil((now - anchor) / interval), which always lands strictly in the
// FUTURE. So the moment a scheduled time passed, that day's slot was skipped
// and the next candidate was a full interval away. Missed doses then compounded,
// because skipping one put the anchor a whole day further out for the next call.
//
// Clock is pinned throughout. These functions read Date.now(), so an unpinned
// suite answers differently depending on what time of day it runs, which is how
// a 04:48-shaped bug passes on a machine that happens not to be at 04:48.
//
// All assertions use LOCAL getters, not UTC ones. scheduleAnchorMs builds the
// anchor with a local Date(y, m, d, h, m), and realTimestampFromStored reads
// the fake-UTC digits as local wall-clock, so the whole calculation lives in
// local time. Asserting in UTC would fail by the machine's offset - which on
// this project is exactly the class of bug the timezone fixes were about.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getNextNotificationTime,
  isDoseLockedOut,
  effectiveDoseIntervalHours,
} from "./medicationCalculations.js";

// 2026-10-02 is the day the bug was found on the device.
const DAY = "2026-10-02";
const storedAt = (day, hhmm) => `${day}T${hhmm}:00.000Z`;

let clock;
beforeEach(() => {
  clock = vi.useFakeTimers();
});
afterEach(() => {
  clock = vi.restoreAllMocks();
});

const setNow = (day, hhmm) => {
  const d = new Date(`${day}T${hhmm}:00.000Z`);
  clock.setSystemTime(d);
  return d;
};

const med = (over = {}) => ({
  id: "med_x",
  name: "PrEP",
  usagePattern: "daily",
  dosesPerDay: 1,
  scheduledTimes: ["04:00"],
  ...over,
});

describe("a scheduled dose that has already passed today is still due today", () => {
  it("the exact device report: scheduled 04:00, last dose yesterday 05:07, now 04:48", () => {
    setNow(DAY, "04:48");
    const lastDose = storedAt("2026-10-01", "05:07");
    const next = getNextNotificationTime(med(), lastDose);

    expect(next).not.toBeNull();
    // Today's 04:00, i.e. ALREADY DUE - not tomorrow's.
    const when = new Date(next);
    expect(when.getDate()).toBe(2);
    expect(when.getHours()).toBe(4);
  });

  it("does not push the next dose a whole interval into the future", () => {
    setNow(DAY, "04:48");
    const lastDose = storedAt("2026-10-01", "05:07");
    const next = getNextNotificationTime(med(), lastDose);
    const hoursAway = (new Date(next) - new Date(`${DAY}T04:48:00.000Z`)) / 3600000;
    // The bug reported ~23h. Anything close to a full interval means today's
    // slot was skipped again.
    expect(hoursAway).toBeLessThan(1);
  });

  it("unlocks the dose button rather than leaving it greyed out", () => {
    setNow(DAY, "04:48");
    const lastDose = storedAt("2026-10-01", "05:07");
    // A day has certainly elapsed, so the half-interval lockout is satisfied.
    // Before the fix the due time was tomorrow, so the button stayed locked.
    expect(isDoseLockedOut(med(), lastDose)).toBe(false);
  });

  it("still steps forward once today's dose IS logged", () => {
    setNow(DAY, "04:48");
    const takenToday = storedAt(DAY, "04:10");
    const next = getNextNotificationTime(med(), takenToday);
    const when = new Date(next);
    expect(when.getDate()).toBe(3);
    expect(when.getHours()).toBe(4);
  });

  it("a dose taken exactly ON the slot counts as logged, so it advances", () => {
    setNow(DAY, "04:48");
    const takenExactly = storedAt(DAY, "04:00");
    const when = new Date(getNextNotificationTime(med(), takenExactly));
    expect(when.getDate()).toBe(3);
  });

  it("does NOT resurrect a genuinely old missed dose as due", () => {
    // The old comment's intent is preserved: a slot from days ago, already
    // passed and not logged, must not become today's answer either - the
    // medication should offer the CURRENT slot instead.
    setNow(DAY, "04:48");
    const lastDose = storedAt("2026-09-20", "05:07");
    const when = new Date(getNextNotificationTime(med(), lastDose));
    expect(when.getDate()).toBe(2);
    expect(when.getHours()).toBe(4);
  });
});

describe("the same rule before the scheduled time arrives", () => {
  it("is not due early - before 04:00 today's slot has not happened yet", () => {
    setNow(DAY, "02:00");
    const lastDose = storedAt("2026-10-01", "05:07");
    const when = new Date(getNextNotificationTime(med(), lastDose));
    expect(when.getDate()).toBe(2);
    expect(when.getHours()).toBe(4);
  });
});

describe("a medication with no schedule is unaffected", () => {
  it("still counts a plain interval forward from the last dose", () => {
    setNow(DAY, "04:48");
    const lastDose = storedAt("2026-10-01", "05:07");
    const unscheduled = med({ scheduledTimes: [] });
    expect(effectiveDoseIntervalHours(unscheduled)).toBe(24);
    const when = new Date(getNextNotificationTime(unscheduled, lastDose));
    // 05:07 yesterday + 24h.
    expect(when.getDate()).toBe(2);
    expect(when.getHours()).toBe(5);
  });
});
