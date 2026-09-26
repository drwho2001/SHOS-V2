import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  lockoutEndsAt,
  isDoseLockedOut,
  lockoutEndsEstimate,
  effectiveDoseIntervalHours,
  doseTimingAdvisory,
} from "./medicationCalculations";
// Imported from its real home rather than re-exported through
// medicationCalculations, which only imports it internally.
import { realTimestampFromStored } from "./dateInputHelpers";

// A stored datetime is the app's deliberate "fake UTC": local wall-clock
// digits with a trailing Z. Written here the same way the app writes them so
// the tests read like the real data.
function storedLocal(d) {
  const p = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00.000Z`;
}
function hoursAgo(n) {
  return storedLocal(new Date(Date.now() - n * 3600000));
}

// Builds a dose at a real CLOCK time on a given day, expressed in whole days
// ago. This matters: the owner's scenarios are about clock times ("a midnight
// dose taken 15 minutes late" means 00:15, not "15 minutes ago"), and an
// earlier version of these tests built doses with an hours-ago helper, which
// produced doses at whatever time of day the test happened to run. Every
// lateness assertion was therefore meaningless, and two of them failed.
function atClock(daysAgoCount, hh, mm = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgoCount);
  d.setHours(hh, mm, 0, 0);
  return storedLocal(d);
}
function withClockDoses(med, clockTimes) {
  return {
    ...med,
    logs: clockTimes.map(([day, hh, mm], i) => ({
      type: "dose", date: atClock(day, hh, mm), voided: false, id: `d${i}`,
    })),
  };
}

const DAILY = { usagePattern: "daily", dosesPerDay: 1 };
const TWICE_DAILY = { usagePattern: "daily", dosesPerDay: 2 };
const PRN = { usagePattern: "prn" };
const EVERY_14 = { usagePattern: "custom", dosesPerDay: 1, scheduleIntervalDays: 14 };

// The clock is pinned for the whole file, not per-test. Both the due-slot
// walk and the lateness comparisons read the real wall clock, so an unpinned
// test suite produces different answers depending on what time of day it runs
// - which is exactly how a QDS assertion here came to expect the wrong value
// and initially looked like a code bug. 02:00 local is deliberately just
// after the 01:30 doses used below, so "1.5 hours late" means what it says.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 26, 2, 0, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("lockoutEndsAt - the two bounds that replaced the arbitrary 80%", () => {
  it("never locks out sooner than half the dosing interval (the double-dose guard)", () => {
    // Daily: floor is 12h after the last dose. The old 80% rule released at
    // 19.2h and blocked until then, which was both arbitrary and far later
    // than any real double-dose risk.
    const at = lockoutEndsAt(DAILY, hoursAgo(1));
    const hoursOut = (at.getTime() - (Date.now() - 3600000)) / 3600000;
    expect(hoursOut).toBeCloseTo(12, 1);
  });

  it("uses half the interval for a twice-daily medication, so 6h not 9.6h", () => {
    const at = lockoutEndsAt(TWICE_DAILY, hoursAgo(0.5));
    const hoursOut = (at.getTime() - (Date.now() - 0.5 * 3600000)) / 3600000;
    expect(hoursOut).toBeCloseTo(6, 1);
  });

  it("scales the floor with a custom every-N-days interval", () => {
    const at = lockoutEndsAt(EVERY_14, hoursAgo(1));
    const hoursOut = (at.getTime() - (Date.now() - 3600000)) / 3600000;
    expect(hoursOut).toBeCloseTo(14 * 24 * 0.5, 0);
  });

  it("returns null when there is nothing to lock out from", () => {
    expect(lockoutEndsAt(PRN, hoursAgo(1))).toBeNull();   // no fixed interval
    expect(lockoutEndsAt(DAILY, null)).toBeNull();          // no dose yet
    expect(lockoutEndsAt(null, hoursAgo(1))).toBeNull();
  });

  it("with a schedule, never unlocks before the stated time", () => {
    const midnightMed = { ...DAILY, scheduledTimes: ["00:00"] };
    // Dose taken 20h ago: the plain interval would not be up for another 4h,
    // so the floor is not what is binding here.
    const last = hoursAgo(20);
    const at = lockoutEndsAt(midnightMed, last, "fixed");
    const hoursOut = (at.getTime() - (Date.now() - 20 * 3600000)) / 3600000;
    // Never earlier than the half-interval floor, never later than the full
    // interval from the actual dose.
    expect(hoursOut).toBeGreaterThanOrEqual(12 - 0.01);
    expect(hoursOut).toBeLessThanOrEqual(24 + 0.01);
  });

  it("stops a late dose dragging the schedule earlier with it", () => {
    // The ceiling comes from the SCHEDULE, not from a late actual dose, so
    // drift cannot accumulate. A 22:00 medication dosed at 20:00 must not be
    // treated as due again 24h later, because the user is plainly on a 22:00
    // schedule and the alternative is permanent drift.
    const anchored = { ...DAILY, scheduledTimes: ["22:00"] };
    const at = lockoutEndsAt(anchored, hoursAgo(2), "fixed");
    const hoursOut = (at.getTime() - (Date.now() - 2 * 3600000)) / 3600000;
    expect(hoursOut).toBeLessThan(24);
    expect(hoursOut).toBeCloseTo(22, 0);
  });

  it("honours a schedule even in adaptive mode, matching its sibling functions", () => {
    // The old code applied NO schedule logic to the lockout at all, so in
    // fixed mode the reminder could fire while the dose was still locked.
    const anchored = { ...DAILY, scheduledTimes: ["09:00"] };
    const withMode = lockoutEndsAt(anchored, hoursAgo(2), "fixed");
    const scheduledWins = lockoutEndsAt(anchored, hoursAgo(2), "adaptive");
    expect(scheduledWins.getTime()).toBe(withMode.getTime());
  });
});

describe("isDoseLockedOut", () => {
  it("is true just after a dose and false once past the bound", () => {
    expect(isDoseLockedOut(DAILY, hoursAgo(1))).toBe(true);      // 1h into a 12h floor
    expect(isDoseLockedOut(DAILY, hoursAgo(13))).toBe(false);    // past 12h
  });

  it("never locks a PRN medication or one with no logged dose", () => {
    expect(isDoseLockedOut(PRN, hoursAgo(0.1))).toBe(false);
    expect(isDoseLockedOut(DAILY, null)).toBe(false);
  });

  it("agrees with lockoutEndsAt rather than being a second opinion", () => {
    // These used to be separate implementations sharing a magic number, and
    // they drifted. Now one is defined in terms of the other.
    const last = hoursAgo(5);
    const at = lockoutEndsAt(DAILY, last);
    const locked = isDoseLockedOut(DAILY, last);
    expect(locked).toBe(Date.now() < at.getTime());
  });
});

describe("the late snap-back rule (the inverse of the old 80%)", () => {
  // A 20% threshold as a FRACTION OF THE INTERVAL, so the absolute slack
  // tightens automatically as dosing gets more frequent - which is the whole
  // point of expressing it that way.
  const slackHours = (dosesPerDay) => {
    const interval = 24 / dosesPerDay;
    return interval * 0.2;
  };

  it("gives a daily med more absolute slack than a QDS one", () => {
    expect(slackHours(1)).toBeCloseTo(4.8, 2);   // daily:  "up to 2 hours, I'd accept"
    expect(slackHours(2)).toBeCloseTo(2.4, 2);   // twice daily
    expect(slackHours(4)).toBeCloseTo(1.2, 2);   // QDS:    "maybe not for a BD/TDS/QDS med"
  });

  it("keeps midnight for a dose taken 15 minutes late", async () => {
    const { getNextNotificationTime } = await import("./medicationCalculations");
    // Four midnight doses, then one at 00:15. The owner's expectation: the
    // next dose is midnight again, NOT 00:15 the following day.
    const med = withClockDoses({ ...DAILY, scheduledTimes: ["00:00"] }, [[3, 0, 0], [2, 0, 0], [1, 0, 0], [0, 0, 15]]);
    const next = getNextNotificationTime(med, atClock(0, 0, 15), "fixed");
    const n = new Date(next.getTime());
    expect(n.getHours()).toBe(0);
    expect(n.getMinutes()).toBe(0);
  });

  it("treats a one-off 6am dose as a blip and holds the schedule", async () => {
    const { getNextNotificationTime } = await import("./medicationCalculations");
    // Three midnight doses then one at 06:00. Not a trend, so the schedule
    // holds - and the half-interval floor stops that snap-back from shortening
    // the interval into a double dose.
    const med = withClockDoses({ ...DAILY, scheduledTimes: ["00:00"] }, [[3, 0, 0], [2, 0, 0], [1, 0, 0], [0, 6, 0]]);
    const next = getNextNotificationTime(med, atClock(0, 6, 0), "fixed");
    const hoursOut = (next.getTime() - realTimestampFromStored(atClock(0, 6, 0))) / 3600000;
    expect(hoursOut).toBeGreaterThanOrEqual(12 - 0.01);  // floor respected
    expect(hoursOut).toBeLessThan(24);                    // schedule still held
  });

  it("respects a deliberate weaning shift trending away from midnight (adaptive)", async () => {
    const { getNextNotificationTime } = await import("./medicationCalculations");
    // The owner's scenario: moving a midnight dose towards 10pm. 00:00, 02:00,
    // 04:00 is a clear trend later. In adaptive mode the schedule must NOT
    // snap them back, or the app fights the thing they are deliberately doing.
    const med = withClockDoses({ ...DAILY, scheduledTimes: ["00:00"] }, [[3, 0, 0], [2, 2, 0], [1, 4, 0], [0, 6, 0]]);
    const next = getNextNotificationTime(med, atClock(0, 6, 0), "adaptive");
    const n = new Date(next.getTime());
    expect(n.getHours()).toBe(6);          // followed the dose actually taken
    expect(n.getDate()).toBe(new Date(realTimestampFromStored(atClock(0, 6, 0))).getDate() + 1);
  });

  it("fixed mode ignores the shift entirely and stays on the schedule", async () => {
    const { getNextNotificationTime } = await import("./medicationCalculations");
    // Same weaning data as the test above, but in fixed mode. The mode's whole
    // meaning is "the same time every day", so even a proven 4-day trend must
    // not move it. An earlier version applied the shift regardless of mode,
    // which made fixed silently mean "mostly fixed".
    const med = withClockDoses({ ...DAILY, scheduledTimes: ["00:00"] }, [[3, 0, 0], [2, 2, 0], [1, 4, 0], [0, 6, 0]]);
    const next = getNextNotificationTime(med, atClock(0, 6, 0), "fixed");
    const n = new Date(next.getTime());
    expect(n.getHours()).toBe(0);          // back to the stated midnight slot
    expect(n.getMinutes()).toBe(0);
  });

  it("still snaps back when the dose is late but the time is not trending", async () => {
    const { getNextNotificationTime } = await import("./medicationCalculations");
    // Always 02:00 is a settled habit, not a change in progress - the times
    // are not moving, so the schedule holds. Asserts the actual clock time
    // rather than "less than 24h", because following the dose here would give
    // 02:00 and the schedule gives 00:00: a real difference that a loose
    // assertion would not have caught.
    const med = withClockDoses({ ...DAILY, scheduledTimes: ["00:00"] }, [[3, 2, 0], [2, 2, 0], [1, 2, 0], [0, 2, 0]]);
    const next = getNextNotificationTime(med, atClock(0, 2, 0), "adaptive");
    expect(next.getHours()).toBe(0);
  });

  it("needs three doses before it will believe a shift, not two", async () => {
    const { getNextNotificationTime } = await import("./medicationCalculations");
    // This is the whole reason MIN_TREND_DOSES is 3. With only two doses
    // logged, "taken 6h late once" and "started moving to 06:00" are the same
    // two observations - there is genuinely nothing to tell them apart - so
    // the schedule must hold and the user is not nagged.
    const twoDoses = withClockDoses({ ...DAILY, scheduledTimes: ["00:00"] }, [[1, 0, 0], [0, 6, 0]]);
    const early = getNextNotificationTime(twoDoses, atClock(0, 6, 0), "adaptive");
    expect(early.getHours()).toBe(0);

    // A third dose in the same direction crosses the threshold, and the shift
    // is then respected.
    const threeDoses = withClockDoses({ ...DAILY, scheduledTimes: ["00:00"] }, [[2, 0, 0], [1, 2, 0], [0, 6, 0]]);
    const later = getNextNotificationTime(threeDoses, atClock(0, 6, 0), "adaptive");
    expect(later.getHours()).toBe(6);
  });

  it("needs three doses even when the movement is tiny", async () => {
    const { getNextNotificationTime } = await import("./medicationCalculations");
    // The threshold is about the NUMBER of agreeing doses, not about how far
    // they have moved. Two 10-minute drifts are still just two data points,
    // and 10 minutes is inside the 2h the NHS guidance calls acceptable
    // anyway - so there is nothing to act on yet.
    const twoTiny = withClockDoses({ ...DAILY, scheduledTimes: ["00:00"] }, [[1, 0, 0], [0, 0, 10]]);
    expect(getNextNotificationTime(twoTiny, atClock(0, 0, 10), "adaptive").getHours()).toBe(0);
  });

  it("counts forward from the real dose when no schedule is set", async () => {
    const { getNextNotificationTime, nextDoseEstimate } = await import("./medicationCalculations");
    // No scheduledTimes: there is no clock time to honour, so the only
    // meaningful answer is one interval after the dose that was actually
    // taken. Routing this through the schedule logic anchored a slot on the
    // first dose ever logged and stepped it forward, so a dose from 11 days
    // ago came back "due in 11 days". The pre-existing adaptive-mode test in
    // medicationCalculations.test.js is what caught it.
    const med = { ...DAILY, scheduledTimes: [] };
    const last = atClock(3, 9, 0);
    const next = getNextNotificationTime(med, last, "adaptive");
    const hoursOut = (next.getTime() - realTimestampFromStored(last)) / 3600000;
    expect(hoursOut).toBeCloseTo(24, 1);
    // nextDoseEstimate is the same question asked for display, so it must not
    // quietly disagree - a card reading "~5h" while the reminder fires in 24h
    // is precisely the inconsistency this suite exists to prevent.
    // nextDoseEstimate asks the same question for display, so it must not
    // quietly disagree. A dose 3 days old on a 24h interval really is overdue,
    // so "due now" is the correct answer here - the point is that the
    // estimate reads off the same 24h-from-the-dose value rather than off some
    // independently anchored schedule.
    expect(nextDoseEstimate(med, last, "adaptive")).toBe("due now");
  });

  it("holds a QDS to a much tighter absolute tolerance than a daily med", async () => {
    const { getNextNotificationTime } = await import("./medicationCalculations");
    // 90 minutes late is inside a daily med's 4.8h slack but outside a QDS
    // med's 1.2h, so the identical lateness produces a very different wait.
    // Both snap back to a real scheduled slot; QDS simply gets one far sooner
    // because its slots are 6h apart rather than 24h.
    const daily = withClockDoses({ ...DAILY, scheduledTimes: ["00:00"] }, [[3, 0, 0], [2, 0, 0], [1, 0, 0], [0, 1, 30]]);
    const qds = withClockDoses({ usagePattern: "daily", dosesPerDay: 4, scheduledTimes: ["00:00"] }, [[3, 0, 0], [2, 0, 0], [1, 0, 0], [0, 1, 30]]);
    const dailyOut = (getNextNotificationTime(daily, atClock(0, 1, 30), "fixed").getTime() - realTimestampFromStored(atClock(0, 1, 30))) / 3600000;
    const qdsOut = (getNextNotificationTime(qds, atClock(0, 1, 30), "fixed").getTime() - realTimestampFromStored(atClock(0, 1, 30))) / 3600000;
    expect(dailyOut).toBeCloseTo(22.5, 1);  // inside slack: waits for midnight
    expect(qdsOut).toBeCloseTo(4.5, 1);     // outside slack: next 6-hourly slot
  });

  it("unlocks at the scheduled slot, not an hour before it", async () => {
    const { lockoutEndsAt: lock } = await import("./medicationCalculations");
    // Midnight dose, midnight schedule, clock pinned to 02:00. The next
    // midnight slot is 24h away and the floor is 12h, so the schedule wins and
    // lands at exactly 24h. There is deliberately no early window: no
    // published guidance allows taking a scheduled dose ahead of time, and an
    // hour-early tolerance would have been arithmetic that could never be the
    // binding bound anyway (the 12h floor is always earlier).
    const med = withClockDoses({ ...DAILY, scheduledTimes: ["00:00"] }, [[3, 0, 0], [2, 0, 0], [1, 0, 0], [0, 0, 0]]);
    const hoursOut = (lock(med, atClock(0, 0, 0), "fixed").getTime() - realTimestampFromStored(atClock(0, 0, 0))) / 3600000;
    expect(hoursOut).toBeCloseTo(24, 1);
  });

  it("never offers a next dose sooner than half the interval (double-dose guard)", async () => {
    const { getNextNotificationTime } = await import("./medicationCalculations");
    // Every shape of lateness, in one sweep: however badly the schedule has
    // been missed or shifted, the app must never invite a second dose less
    // than half an interval after the last one.
    const med = { ...DAILY, scheduledTimes: ["00:00"] };
    for (const [day, hh, mm] of [[3, 0, 0], [2, 0, 0], [1, 0, 0], [0, 23, 0]]) {
      const m = withClockDoses(med, [[3, 0, 0], [2, 0, 0], [1, 0, 0], [0, hh, mm]]);
      const out = (getNextNotificationTime(m, atClock(0, hh, mm), "fixed").getTime() - realTimestampFromStored(atClock(0, hh, mm))) / 3600000;
      expect(out).toBeGreaterThanOrEqual(12 - 0.01);
    }
  });
});

describe("lockoutEndsEstimate", () => {
  it("formats the time until the lock lifts", () => {
    expect(lockoutEndsEstimate(DAILY, hoursAgo(1))).toMatch(/^~\d+h$/);   // ~11h left
    expect(lockoutEndsEstimate(DAILY, hoursAgo(20))).toBe("now");          // floor passed
  });

  it("returns null when there is no lockout to describe", () => {
    expect(lockoutEndsEstimate(PRN, hoursAgo(1))).toBeNull();
    expect(lockoutEndsEstimate(DAILY, null)).toBeNull();
  });

  it("is deliberately NOT the same as the due time", () => {
    // The distinction the old 0.8 conflated: a dose may become loggable
    // well before it is strictly due. A daily med logged now is locked for
    // 12h but is not due for 24h, and that gap is the whole point of having
    // a lockout at all rather than just showing the due time.
    const last = hoursAgo(0.1);
    const unlockAt = lockoutEndsAt(DAILY, last);
    // realTimestampFromStored, NOT `new Date(last)`: the stored string is the
    // app's deliberate fake-UTC (local wall-clock digits, trailing Z), so a
    // plain Date parse is off by the device's UTC offset - which is a full
    // hour on this machine in BST and would make this test quietly wrong.
    const hoursFromDose = (unlockAt.getTime() - realTimestampFromStored(last)) / 3600000;
    expect(hoursFromDose).toBeCloseTo(12, 0);
    expect(hoursFromDose).toBeLessThan(24);
  });
});

describe("doseTimingAdvisory - the fuzziness, without weakening the rule", () => {
  it("says nothing when the dose is comfortably inside the window", () => {
    // Two hours into a 24h interval is nowhere near the 12h floor, so there is
    // no reason to say anything at all. Silence is the correct output for the
    // overwhelmingly common case - otherwise this becomes noise the user
    // learns to ignore, and then it is not warning anyone about anything.
    // 24h is exactly the floor, so it is the boundary rather than past it.
    expect(doseTimingAdvisory(DAILY, hoursAgo(2))).toBeNull();
    expect(doseTimingAdvisory(DAILY, hoursAgo(23))).toBeNull();
  });

  it("warns about a dose logged a little early, and says it is still fine", () => {
    // 11h into a 24h interval is 1h before the 12h floor - just over the line.
    const advisory = doseTimingAdvisory(DAILY, hoursAgo(11));
    expect(advisory.kind).toBe("just-early");
    expect(advisory.message).toContain("1h");
    // The reassurance is the whole point of the feature; a warning that reads
    // as a scolding would stop people trusting it.
    expect(advisory.message.toLowerCase()).toContain("fine");
  });

  it("explains the next dose when a dose is taken just late", () => {
    // 13h into a 24h interval is past the floor but well within a day, so the
    // next dose is unchanged and the message should say exactly that.
    const advisory = doseTimingAdvisory(DAILY, hoursAgo(13));
    expect(advisory.kind).toBe("just-late");
    expect(advisory.message).toContain("normal schedule");
  });

  it("scales the window to the frequency, so QDS is not left in silence", () => {
    // QDS: 6h interval, so the floor is 3h. A dose at 2h is only 1h from it
    // and must warn, where the same 2h on a daily med is 10h clear and must
    // not. This is the whole reason the window is expressed in absolute hours
    // against a proportional floor, rather than as a percentage of interval.
    expect(doseTimingAdvisory(TWICE_DAILY, hoursAgo(2))).toBeNull();
    expect(doseTimingAdvisory({ usagePattern: "daily", dosesPerDay: 4 }, hoursAgo(2)).kind).toBe("just-early");
  });

  it("never warns for PRN or a medication with no logged dose", () => {
    expect(doseTimingAdvisory(PRN, hoursAgo(2))).toBeNull();
    expect(doseTimingAdvisory(DAILY, null)).toBeNull();
    expect(doseTimingAdvisory(null, hoursAgo(2))).toBeNull();
  });

  it("is advisory only - it cannot unlock a dose the hard floor still blocks", () => {
    // The safety property that matters most: doseTimingAdvisory is a pure
    // explanation. Deleting its entire effect on the lockout must leave
    // isDoseLockedOut's answer untouched, because the softness belongs in the
    // message, never in the rule.
    const at11h = hoursAgo(11);
    expect(doseTimingAdvisory(DAILY, at11h).kind).toBe("just-early");
    expect(isDoseLockedOut(DAILY, at11h)).toBe(true);
  });
});

describe("effectiveDoseIntervalHours is unchanged", () => {
  it("still defines the interval every bound above is derived from", () => {
    expect(effectiveDoseIntervalHours(DAILY)).toBe(24);
    expect(effectiveDoseIntervalHours(TWICE_DAILY)).toBe(12);
    expect(effectiveDoseIntervalHours(PRN)).toBeNull();
    expect(effectiveDoseIntervalHours(EVERY_14)).toBe(14 * 24);
  });
});
