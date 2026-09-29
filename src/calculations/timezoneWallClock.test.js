// Timezone / wall-clock correctness — the unit layer.
//
// The browser flow (testTimezoneWallClockRoundTrip in scripts/smoke-test.cjs)
// proves the real screens route a stored value correctly under three real
// device timezones. This file covers the half a browser cannot easily prove:
// that the derivation itself is identical in every zone, including the ones
// the flow does not run, and that it is identical for the right REASON.
//
// The distinction matters and is easy to get backwards. A stored date in this
// app is a "Z"-suffixed lie: the digits are literal wall-clock time and the Z
// is not real UTC. So:
//   - DISPLAY of a stored value must read the digits back literally, which is
//     formatStoredDate/formatStoredDateTime (they pass timeZone: "UTC").
//   - DERIVING a fact from a stored value (which part of the day was this?) is
//     the same "read the digits literally" rule, just with a UTC getter
//     instead of a formatter option.
//   - A REAL instant (createdAt/updatedAt) is the opposite case and must
//     render in local time. formatInstantDate/formatInstantDateTime own that.
//
// Every assertion below is written so that the naive version — the code this
// replaced — produces a DIFFERENT answer in at least one zone. A test that
// passes either way measures nothing, which this repo has now recorded as its
// single most repeated mistake.

import { describe, it, expect } from "vitest";
import { timeOfDay } from "./encounterCalculations";
import { formatStoredDate, formatStoredDateTime, formatInstantDateTime } from "./dateInputHelpers";

// Not a coincidence: the BST->GMT transition is 25 Oct 2026 in the UK, and
// this project's home audience is UK-based. A stored evening time on 24 Oct
// therefore has to survive a fall-back hour without slipping a day.
const ZONES = [
  "Europe/London",
  "UTC",
  "America/New_York",
  "Australia/Sydney",
  "Asia/Kolkata", // a half-hour offset, which no whole-hour zone can catch
  "Pacific/Chatham", // +12:45, the largest real offset on earth
];

function withZone(zone, fn) {
  const prev = process.env.TZ;
  process.env.TZ = zone;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

// LOCALE-INDEPENDENT date assertions, and this file's second recorded lesson
// of the same kind.
//
// These helpers format with an `undefined` locale, so "14 Mar 2026" (en-GB,
// this machine) and "Mar 14, 2026" (en-US, CI) are the same date in two
// spellings. Asserting the literal string passed locally and failed in CI -
// three separate times in this one change, including after I had already
// caught and fixed it in the DST test above. The fix is to assert the DAY and
// YEAR as standalone numbers, which both orderings contain, and to assert the
// shifted day is ABSENT, which is the actual bug signature.
//
// The failure was worth the round trip: it is a property of the test, not the
// app, and a test that only passes on the machine that wrote it is not a test.
const hasDay = (s, day) => new RegExp(`(^|[^0-9])${day}([^0-9]|$)`).test(s);
const assertDate = (s, { day, year }) => {
  expect(s, `year in "${s}"`).toContain(year);
  expect(hasDay(s, day), `"${s}" must show day ${day}`).toBe(true);
  // The bug always showed the PREVIOUS day at a negative offset, so pinning
  // the absence of day-1 is what makes this discriminating rather than merely
  // permissive.
  if (day > 1) expect(hasDay(s, day - 1), `"${s}" must NOT show day ${day - 1}`).toBe(false);
};

// THE ASSERTION HELPERS PROVE THEMSELVES.
//
// I could not verify these tests under CI's en-US locale locally: setting
// LANG/LC_ALL does not change Node's ICU default locale on Windows, and
// checking that rather than assuming it is the difference between a real
// verification and a green run that measured nothing — which is the sixth
// recorded instance of that failure in this project, and the second one I
// built myself inside this single change. A browser context CAN be given a
// real locale, which is why the flow is verified that way instead.
//
// So rather than claim coverage I cannot demonstrate, the helpers below are
// tested against BOTH spellings directly. If assertDate ever stops accepting
// "Mar 14, 2026" — or ever starts accepting "13 Mar 2026" — this fails, which
// is exactly the property CI taught me the hard way.
describe("the locale-independence helpers themselves", () => {
  it("accepts the date in either common ordering", () => {
    for (const spelling of ["14 Mar 2026", "Mar 14, 2026"]) {
      expect(() => assertDate(spelling, { day: 14, year: "2026" })).not.toThrow();
    }
  });

  it("rejects the day the bug actually produced", () => {
    // The whole point: with the bug, New York rendered 13 Mar. If this ever
    // passed, the checks above would have gone vacuous.
    for (const shifted of ["13 Mar 2026", "Mar 13, 2026"]) {
      expect(() => assertDate(shifted, { day: 14, year: "2026" })).toThrow();
    }
  });

  it("does not confuse the day with a digit inside another number", () => {
    // "2026" must not satisfy hasDay(_, 2)-style confusion, and the year must
    // not be read as a day.
    expect(hasDay("14 Mar 2026", 14)).toBe(true);
    expect(hasDay("14 Mar 2026", 13)).toBe(false);
    expect(hasDay("Mar 14, 2026", 14)).toBe(true);
  });
});

describe("wall-clock time is independent of the device's timezone", () => {
  it("an encounter at 00:30 is always dated the day it was typed, in every zone", () => {
    // The sharp edge. Rendered without `timeZone: "UTC"`, this stored value
    // is 19:30 the previous day in New York — a wrong DATE on a medical
    // record, not merely a wrong time.
    const STORED = "2026-03-14T00:30:00.000Z";
    for (const z of ZONES) {
      assertDate(withZone(z, () => formatStoredDate(STORED)), { day: 14, year: "2026" });
    }
  });

  it("an encounter at 23:30 is dated the day it was typed, in every zone", () => {
    // The opposite direction. A positive offset renders an evening time as
    // the NEXT day, so testing only 00:30 would pass while Sydney is broken.
    const STORED = "2026-03-14T23:30:00.000Z";
    for (const z of ZONES) {
      assertDate(withZone(z, () => formatStoredDate(STORED)), { day: 14, year: "2026" });
    }
  });

  it("a stored time either side of a DST fall-back is zone-independent", () => {
    // 24 Oct 2026 22:30 is unambiguously before London's 25 Oct fall-back, and
    // 12 Oct 22:30 unambiguously after it. Neither may slip a day or an hour.
    //
    // Deliberately asserting CROSS-ZONE IDENTITY rather than a literal string:
    // formatStoredDateTime formats with an `undefined` locale, so whether the
    // hour renders "22:30" or "10:30" depends on the machine's locale, not on
    // anything this app controls. A literal would be a flake waiting for a CI
    // box with a different default locale — and this file's own first draft was
    // exactly that flake, caught by running it. What actually matters is that
    // the device's timezone cannot change the answer.
    for (const iso of ["2026-10-24T22:30:00.000Z", "2026-10-12T22:30:00.000Z"]) {
      const rendered = ZONES.map((z) => withZone(z, () => formatStoredDateTime(iso)));
      for (const r of rendered) {
        expect(r, `${iso} in every zone`).toBe(rendered[0]);
      }
      assertDate(rendered[0], {
        day: iso.startsWith("2026-10-24") ? 24 : 12,
        year: "2026",
      });
    }
  });

  it("time of day is derived from the stored wall-clock hour, not the device's", () => {
    // 00:30 is "Late Night" in London. With the old local getHours() it is
    // 19:30 in New York, which is "Evening" — the encounter is filed under a
    // completely different part of the day, purely by geography.
    const STORED = "2026-03-14T00:30:00.000Z";
    for (const z of ZONES) {
      expect(withZone(z, () => timeOfDay(STORED)), z).toBe("Late Night");
    }
  });

  it("every time-of-day bucket is stable across zones", () => {
    // Each boundary gets a value on the correct side of it, plus one exactly
    // on the boundary itself, since an off-by-one at a boundary is the shape
    // this bug actually took.
    const CASES = [
      ["00:30", "Late Night"],
      ["04:59", "Late Night"],
      ["05:00", "Morning"],
      ["11:59", "Morning"],
      ["12:00", "Afternoon"],
      ["16:59", "Afternoon"],
      ["17:00", "Evening"],
      ["20:59", "Evening"],
      ["21:00", "Night"],
      ["23:30", "Night"],
    ];
    for (const [hm, expected] of CASES) {
      const stored = `2026-06-15T${hm}:00.000Z`;
      for (const z of ZONES) {
        expect(withZone(z, () => timeOfDay(stored)), `${hm} in ${z}`).toBe(expected);
      }
    }
  });

  it("a real instant still renders in local time — the deliberate opposite case", () => {
    // Guards the trap the naming exists to prevent. A genuine createdAt is
    // true UTC and must be shown relative to the viewer, so it is correct for
    // it to DIFFER between zones here. If this ever starts agreeing, someone
    // has routed a real instant through formatStoredDateTime instead.
    const REAL_INSTANT = "2026-03-14T00:30:00.000Z";
    const inLondon = withZone("Europe/London", () => formatInstantDateTime(REAL_INSTANT));
    const inNewYork = withZone("America/New_York", () => formatInstantDateTime(REAL_INSTANT));
    expect(inLondon).not.toBe(inNewYork);
    // Locale-independent: en-GB renders "14 Mar 2026, 00:30" and en-US renders
    // "Mar 14, 2026, 12:30 AM". Asserting the literal was what failed in CI.
    assertDate(inLondon, { day: 14, year: "2026" });
    assertDate(inNewYork, { day: 13, year: "2026" });
  });
});
