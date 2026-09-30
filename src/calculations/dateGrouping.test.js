// Tests for the month-grouping label.
//
// WHY THIS TEST EXISTS
// --------------------
// monthLabel reads STORED dates, which in this app are fake-UTC: the digits are
// the user's own wall-clock time and the trailing "Z" is a deliberate lie. Read
// one back without naming the frame and the device's LOCAL zone re-applies the
// real UTC offset to digits that were never in UTC.
//
// The concrete damage, measured in Europe/London rather than reasoned about: a
// vaccination logged at 23:30 on 31 August grouped under "September 2026".
// That is a month heading a clinician reads, and it was simply wrong - and it
// was wrong in the one direction the UK can see, with the record filed in the
// wrong month on the one screen whose whole job is summarising a period.
//
// This is the same defect class as the ones the 29 Sep stored-date audit fixed
// in the module files. It survived there because dateGrouping.js lives in
// src/calculations/ and the render guard scans a hardcoded list of eight module
// files only - so the guard written specifically to catch this could not see
// this. The scope gap is recorded rather than fixed here, because widening it
// to all of src/calculations/ surfaces 13 sites that need per-site judgement:
// several are real instants on purpose (realTimestampFromStored, unlockAt from
// lockoutEndsAt), and a blanket rule would flag them.
import { describe, it, expect, afterEach } from "vitest";
import { monthLabel } from "./dateGrouping";

const originalTz = process.env.TZ;
afterEach(() => { if (originalTz === undefined) delete process.env.TZ; else process.env.TZ = originalTz; });

// monthLabel hardcodes "en-GB", so its output is stable regardless of the
// machine's locale. That is deliberate and is why these assertions can be exact.
const ZONES = [
  "Europe/London",
  "UTC",
  "America/New_York",
  "Australia/Sydney",
  "Pacific/Chatham",
  "Asia/Kathmandu",
];

describe("monthLabel", () => {
  it("puts a late-evening stored date in the month the user meant", () => {
    // The bug. 23:30 on 31 Aug, stored. In London that is 00:30 on 1 Sep local,
    // so the old version said "September 2026".
    for (const tz of ZONES) {
      process.env.TZ = tz;
      expect(monthLabel("2026-08-31T23:30:00.000Z"), `TZ=${tz}`).toBe("August 2026");
    }
  });

  it("puts an early-morning stored date in the month the user meant", () => {
    // The opposite boundary, because the two failure directions are not
    // symmetric. Testing only the late-evening case would leave every zone east
    // of UTC still wrong in the other direction.
    for (const tz of ZONES) {
      process.env.TZ = tz;
      expect(monthLabel("2026-09-01T00:30:00.000Z"), `TZ=${tz}`).toBe("September 2026");
    }
  });

  it("handles a date-only stored value, which is what a dose date is", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      expect(monthLabel("2026-08-31"), `TZ=${tz}`).toBe("August 2026");
    }
  });

  it("handles year boundaries in both directions", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      expect(monthLabel("2026-01-01T00:10:00.000Z"), `TZ=${tz} new year, local already`).toBe("January 2026");
      expect(monthLabel("2025-12-31T23:50:00.000Z"), `TZ=${tz} new year, UTC still ahead`).toBe("December 2025");
    }
  });

  it("is unaffected by daylight-saving transitions", () => {
    // 29 Mar 2026 is the UK spring-forward morning. Same value, either side.
    for (const tz of ZONES) {
      process.env.TZ = tz;
      expect(monthLabel("2026-03-29T01:30:00.000Z"), `TZ=${tz}`).toBe("March 2026");
      expect(monthLabel("2026-10-25T01:30:00.000Z"), `TZ=${tz} autumn`).toBe("October 2026");
    }
  });

  it("still labels an undated or malformed record honestly", () => {
    // The "renders in its own group rather than being dropped" behaviour the
    // original comment describes. Worth pinning because a vaccination with no
    // usable date is currently a real state (see t034), not a hypothetical.
    expect(monthLabel(null)).toBe("Undated");
    expect(monthLabel(undefined)).toBe("Undated");
    expect(monthLabel("")).toBe("Undated");
    expect(monthLabel("not a date")).toBe("Undated");
  });

  it("reads a Date object as well as a string", () => {
    // groupConsecutive can be handed either; the guard must not only cover one.
    for (const tz of ZONES) {
      process.env.TZ = tz;
      expect(monthLabel(new Date("2026-08-31T23:30:00.000Z")), `TZ=${tz}`).toBe("August 2026");
    }
  });
});
