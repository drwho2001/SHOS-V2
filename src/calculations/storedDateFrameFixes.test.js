// Tests for the t037 date fixes: six call sites that mixed two frames.
//
// THE PATTERN, ONCE
// ------------------
// This app stores dates as fake-UTC - the digits are the user's own wall-clock
// and the trailing "Z" is a deliberate lie (dateInputHelpers.js's header).
// Every bug below is the same mistake: a stored value handed to a LOCAL getter
// or formatter, so the device's real UTC offset is re-applied to digits that
// were never in UTC. The offset is 0 in UTC and 1h in London, so a suite that
// only runs in one zone sees none of it - every case below is pinned across
// several zones for that reason.
//
// WHAT WAS ACTUALLY FOUND, and what was NOT
// -----------------------------------------
// A scan reported 13 sites. Reading each one produced:
//   6 real bugs - fixed here
//   5 correct on purpose (real instants, via realTimestampFromStored, or a
//     local-calendar bucket deliberately paired with a UTC read of a stored day)
//   2 scanner artefacts (the scan window was too small and flagged the app's
//     own correct date formatters)
//
// One suspected bug turned out NOT to exist. statsCalculations' month buckets
// are built on the local calendar and compared against a record's `getUTCMonth()`
// - which looks like a mismatch and is not, because reading a stored fake-UTC
// value with a UTC getter is how you recover the stored wall-clock month. Its
// own comment documents the reasoning. Left alone: a "fix" there would be a
// change with no defect behind it, which is the hardest kind of diff to review.
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { formatRelativeDate } from "./encounterCalculations";
import { suggestedRoutineRetestDate } from "./testingCalculations";
import { label } from "./optionListUsage";
import { isDayKeyDue, formatDayKey } from "./dateInputHelpers";

// Length-preserving strip, so a failure points at the right line - and so a
// comment quoting the banned expression cannot satisfy a negative assertion.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));

const originalTz = process.env.TZ;
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ; else process.env.TZ = originalTz;
  vi.useRealTimers();
});

const ZONES = [
  "Europe/London",      // UTC+1 in summer
  "UTC",                // the zone that hides every one of these
  "America/New_York",   // UTC-5, a day BEHIND
  "Australia/Sydney",   // UTC+11, and a day AHEAD past 10am
  "Pacific/Chatham",    // UTC+12:45 - the worst case in the app's tests
];

// ---------------------------------------------------------------------------
// 1 + 2. optionListUsage: a stored date formatted with no UTC frame
// ---------------------------------------------------------------------------
describe("option list usage labels read the stored frame", () => {
  it("a measurement logged at 23:30 on 31 Aug is not printed as 1 September", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      // Measured before the fix: "1 Sept 2026" in every zone except UTC - the
      // value shifted a whole DAY, not just an hour.
      //
      // The assertion is deliberately locale-agnostic. formatStoredDate passes
      // `undefined` for the locale, so the same correct value renders as
      // "31 Aug 2026" on this UK machine and "Aug 31, 2026" on CI's en-US one.
      // A test that hard-codes either spelling passes on one machine and fails
      // on the other - the recorded lesson from the 28 Sep timezone work.
      // So: assert the day number is 31 and that no standalone "1" appears - the
      // bug shifted 31 August to 1 September, so a bare "1" is the failure and
      // "31" is the success. The year 2026 contains no standalone 1 or 2, so
      // neither can pass by accident.
      const out = label.measurement({ type: "Weight", date: "2026-08-31T23:30:00.000Z" });
      expect(out, `TZ=${tz}`).toContain("Weight");
      expect(out, `TZ=${tz} day number must be 31`).toMatch(/\b31\b/);
      expect(out, `TZ=${tz} must not have slipped to the 1st`).not.toMatch(/\b1\b/);
    }
  });

  it("a cycle start at 00:30 on 1 Sep is not printed as 2 September", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      // The opposite boundary, because the two directions fail differently and
      // testing only the first leaves every zone east of UTC still broken.
      const out = label.cycle({ startDate: "2026-09-01T00:30:00.000Z" });
      expect(out, `TZ=${tz}`).toContain("Cycle starting");
      expect(out, `TZ=${tz} day number`).toMatch(/\b1\b/);
      expect(out, `TZ=${tz} must not have become the 2nd`).not.toMatch(/\b2\b/);
    }
  });

  it("still degrades gracefully when the record has no date", () => {
    expect(label.measurement({ type: "Weight" })).toBe("Weight");
    expect(label.cycle({})).toBe("Cycle");
  });
});

// ---------------------------------------------------------------------------
// 3. formatRelativeDate compared a real instant to a stored one
// ---------------------------------------------------------------------------
describe("formatRelativeDate compares days, not milliseconds", () => {
  // The old code was `Math.floor((new Date() - new Date(stored)) / 86400000)`,
  // which subtracts a shifted "instant" from a real one. In Pacific/Chatham that
  // is a 12h45m error - enough to print "tomorrow" for an appointment that is
  // later the same day. This is the function behind the Clinic Card's next-due
  // and overdue rows AND its PDF export, so the wrong word reaches a printout.
  const pin = (iso) => vi.setSystemTime(new Date(iso));

  it("an appointment later today reads as today, not tomorrow", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      // Now is 09:00 local. A 23:00 appointment is later TODAY.
      pin(new Date(2026, 8, 30, 9, 0, 0).toISOString());
      expect(formatRelativeDate("2026-09-30T23:00:00.000Z"), `TZ=${tz}`).toBe("today");
    }
  });

  it("an appointment earlier today reads as today, not yesterday", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      pin(new Date(2026, 8, 30, 23, 0, 0).toISOString());
      expect(formatRelativeDate("2026-09-30T01:00:00.000Z"), `TZ=${tz}`).toBe("today");
    }
  });

  it("tomorrow and yesterday are right on both sides of midnight", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      pin(new Date(2026, 8, 30, 12, 0, 0).toISOString());
      expect(formatRelativeDate("2026-10-01T12:00:00.000Z"), `TZ=${tz} tomorrow`).toBe("tomorrow");
      expect(formatRelativeDate("2026-09-29T12:00:00.000Z"), `TZ=${tz} yesterday`).toBe("yesterday");
    }
  });

  it("a future date prints the calendar day the user entered", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      pin(new Date(2026, 8, 30, 12, 0, 0).toISOString());
        // 15 days out, so the relative half reads "in 2 weeks". The DATE is the
        // part that was wrong: read off a shifted instant it could print 14 Oct in
        // one zone and 15 Oct in another.
        //
        // THE DAY NUMBER ONLY, and that is a deliberate narrowing. This
        // assertion originally read `toContain("15 Oct")`, passed locally, and
        // FAILED in CI - because formatRelativeDate formats with the DEVICE's
        // default locale: this UK machine renders "15 Oct (in 2 weeks)" and
        // CI's en-US renders "Oct 15, 2026 (in 2 weeks)". Same value, two
        // spellings.
        //
        // Matching the month name too is not a fix, just a narrower version of
        // the same mistake: it then fails on de-DE, which prints "15. Okt.". So
        // assert the DAY - which is the thing that was actually wrong - and the
        // relative half, which is this function's own wording and therefore
        // locale-independent. This is the second assertion in this one file that
        // only held on the machine that wrote it; the first two were caught
        // locally and this one needed CI, which is why the gate runs there.
        const out = formatRelativeDate("2026-10-15T09:00:00.000Z");
        expect(out, `TZ=${tz}`).toMatch(/\b15\b/);
        expect(out, `TZ=${tz}`).not.toMatch(/\b14\b|\b16\b/);
        expect(out, `TZ=${tz}`).toContain("in 2 weeks");
    }
  });

  it("a past date counts whole days", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      pin(new Date(2026, 8, 30, 12, 0, 0).toISOString());
      expect(formatRelativeDate("2026-09-27T09:00:00.000Z"), `TZ=${tz}`).toBe("3 days ago");
    }
  });

  it("a malformed value does not produce a confident wrong answer", () => {
    pin(new Date(2026, 8, 30, 12, 0, 0).toISOString());
    expect(formatRelativeDate(null)).toBe("—");
    expect(formatRelativeDate("")).toBe("—");
    expect(formatRelativeDate("not a date")).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// 5 + 6. The retest reminder's due check and its display date
// ---------------------------------------------------------------------------
// These two live inside an async function that reaches repositories, so the
// behavioural tests above cannot see them - which is exactly how they survived.
// The rules are now ownable functions in dateInputHelpers and tested directly.
describe("day-key rules used by the retest reminder", () => {
  it("is due from the user's own midnight, not from UTC midnight", () => {
    // The bug: `new Date("2026-12-01") <= new Date()`. The left side is UTC
    // midnight, so in Sydney (UTC+11) the reminder went out at 11:00 on 1 Dec -
    // eleven hours early - and in New York (UTC-5) it waited until 19:00 on
    // 30 Nov. Both are wrong by a working day's worth of the user's day.
    expect(isDayKeyDue("2026-12-01", "2026-12-01")).toBe(true);
    expect(isDayKeyDue("2026-12-02", "2026-12-01")).toBe(false);
    expect(isDayKeyDue("2026-11-30", "2026-12-01")).toBe(true);
    // The boundary either way.
    expect(isDayKeyDue("2026-12-02", "2026-12-02")).toBe(true);
    expect(isDayKeyDue("2026-12-03", "2026-12-02")).toBe(false);
  });

  it("rejects anything that is not a day key rather than guessing", () => {
    for (const bad of [null, undefined, "", "not a date", "2026-12", "20261201", 20261201]) {
      expect(isDayKeyDue(bad, "2026-12-01"), String(bad)).toBe(false);
    }
    expect(isDayKeyDue("2026-12-01", "nonsense")).toBe(false);
  });

  it("renders a day key in the UTC frame, so it is never a day late", () => {
    // "2026-12-01" is 1 Dec 01:00 in Sydney. Formatted in local time it prints as
    // 2 December - the notification telling the user to retest a day late.
    for (const tz of ZONES) {
      process.env.TZ = tz;
      // Locale-agnostic for the same reason as the labels above: this machine
      // renders en-GB ("1 Dec") and CI renders en-US ("Dec 1").
      const out = formatDayKey("2026-12-01");
      expect(out, `TZ=${tz}`).toMatch(/\b1\b/);
      expect(out, `TZ=${tz} must not become the 2nd`).not.toMatch(/\b2\b/);
    }
  });

  it("can include the weekday, which the notification copy uses", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      const withDay = formatDayKey("2026-12-01", { weekday: true });
      const without = formatDayKey("2026-12-01");
      // Adding a weekday must lengthen the string, and must not move the date.
      expect(withDay.length, `TZ=${tz}`).toBeGreaterThan(without.length);
      expect(withDay, `TZ=${tz}`).toMatch(/\b1\b/);
    }
  });

  it("degrades honestly on a bad day key", () => {
    expect(formatDayKey(null)).toBe("-");
    expect(formatDayKey("")).toBe("-");
    expect(formatDayKey("2026-13-45")).toBe("-");
  });

  // The behavioural tests above prove the two primitives are correct. They
  // cannot prove the reminder USES them, and reverting the reminder to its old
  // inline forms left the suite GREEN - the fourth time in one session that
  // "the unit tests pass but the consumer was not rewired" has come up (the
  // Escape hook, the vaccination date, the medication sheets, and now this).
  // Asserted at the source level, with comments stripped so this file's own
  // documentation of the old forms cannot satisfy it.
  it("the reminder uses the primitives rather than its old inline forms", () => {
    const src = readFileSync("src/calculations/testingReminderSync.js", "utf8");
    const code = stripComments(src);

    expect(code, "due check must go through isDayKeyDue").toContain("isDayKeyDue(suggested)");
    expect(code, "display must go through formatDayKey").toContain("formatDayKey(suggested");
    // The two exact expressions that were the bugs, scoped so they cannot match
    // a legitimate comparison elsewhere. My first version banned the bare
    // `dueDate <= new Date()` shape and caught an unrelated filter that compares
    // two REAL instants - a false positive, which is the same over-broad ban
    // that produced four of them in the t037 triage itself.
    expect(code, "the due flag must not come from comparing instants").not.toMatch(
      /due:\s*dueDate\s*<=\s*new Date\(\)/
    );
    expect(code, "the day key must not be parsed and formatted locally").not.toMatch(
      /new Date\(suggested\)\.toLocaleDateString/
    );
  });

  it("the stripper is non-vacuous", () => {
    const code = stripComments(readFileSync("src/calculations/testingReminderSync.js", "utf8"));
    expect(code, "real code must survive the strip").toContain("isDayKeyDue");
    // And the banned expression really is present in the comments we strip, so
    // this is not passing for a trivial reason.
    expect(stripComments('const x = 1; // dueDate <= new Date()\nconst y = 2;'))
      .not.toContain("new Date()");
    expect(stripComments('const x = 1; // dueDate <= new Date()\nconst y = 2;'))
      .toContain("const y = 2;");
  });
});

describe("suggestedRoutineRetestDate adds three months in the stored frame", () => {
  const results = (name) => new Map([["r1", name]]);
  // Eligibility needs a full core panel; the DATE arithmetic is what this file
  // exists to pin, so every fixture carries the panel and stays focused on that.
  const CORE_PANEL = ["Gonorrhoea", "Chlamydia", "HIV", "Syphilis"];

  it("is the same date in every timezone", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      // The old code did new Date(stored).setMonth(+3) - a LOCAL walk on a
      // shifted instant, so west of UTC it returned a day early.
      //
      // 31 August + 3 months is 30 November, not 1 December. There is no 31
      // November, so the walk clamps to the last day of the month it lands in -
      // the same rule contraceptiveCalculations.js's daysForUnit already uses,
      // so a "3 months" interval means the same thing wherever it is read.
      // My first expectation here said 2026-12-01, i.e. the unclamped rollover,
      // and the test caught my own arithmetic rather than a defect.
      expect(
        suggestedRoutineRetestDate({ date: "2026-08-31T23:30:00.000Z", resultIds: ["r1"], testingFor: CORE_PANEL }, results("Negative")),
        `TZ=${tz}`
      ).toBe("2026-11-30");
    }
  });

  it("does not roll a short month forward into the next one", () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      // 30 Nov + 3 months is 30 Feb, which does not exist. setUTCMonth rolls it
      // to 1 or 2 March, so the retest would be a month late without the clamp.
      expect(
        suggestedRoutineRetestDate({ date: "2025-11-30T09:00:00.000Z", resultIds: ["r1"], testingFor: CORE_PANEL }, results("Negative")),
        `TZ=${tz}`
      ).toBe("2026-02-28");
    }
  });

it("handles a leap year February", () => {
    process.env.TZ = "Europe/London";
    // The clock is injected because 30 Nov 2027 + 3 months lands in Feb 2028 -
    // the only way to reach a 29 February - and that date is in the future
    // relative to whenever this runs. Without the injectable clock this test
    // could only pass in 2028, which is the "test that only passes sometimes"
    // shape this file exists to avoid.
    expect(
      suggestedRoutineRetestDate({ date: "2027-11-30T09:00:00.000Z", resultIds: ["r1"], testingFor: CORE_PANEL }, results("Negative"), "2027-12-01")
    ).toBe("2028-02-29");
  });

  it("offers nothing for a test dated in the future", () => {
    // NEW RULE, and it is a real behaviour change rather than a detail. A
    // booked test has not happened, so there is nothing to count three months
    // from - previously any future-dated record still produced a suggestion,
    // which is how a not-yet-taken test could generate its own follow-up.
    process.env.TZ = "Europe/London";
    const booked = { date: "2027-11-30T09:00:00.000Z", resultIds: ["r1"], testingFor: CORE_PANEL };
    expect(suggestedRoutineRetestDate(booked, results("Negative"), "2026-10-06")).toBeNull();
    expect(suggestedRoutineRetestDate(booked, results("Negative"), "2027-12-01")).toBe("2028-02-29");
  });

  it("returns null for a positive result or a missing date", () => {
    process.env.TZ = "Europe/London";
    expect(suggestedRoutineRetestDate({ date: "2026-08-31T09:00:00.000Z", resultIds: ["r1"], testingFor: CORE_PANEL }, results("Positive"))).toBeNull();
    expect(suggestedRoutineRetestDate({ resultIds: ["r1"], testingFor: CORE_PANEL }, results("Negative"))).toBeNull();
  });
});
