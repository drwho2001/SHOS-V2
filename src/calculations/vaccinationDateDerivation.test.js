// Tests for getVaccinationDate — the single owner of "when was this
// vaccination given?" (pool t034).
//
// WHY THIS EXISTS
// ---------------
// Five consumers each had their own answer and they disagreed: the Clinic Card
// timeframe filter and sort, the Vaccinations month grouping, Global Search's
// subtitle AND its sort date, and the phone-calendar export. The first two
// states that make that matter are both real, not hypothetical:
//
//   - A record created since the dose series landed has NO top-level date, so
//     the calendar export dropped it entirely. A vaccination the user recorded
//     was silently absent from their phone.
//   - A record whose doses were edited kept the pre-series date forever, so the
//     Clinic Card's own heading and its own rows disagreed.
//
// THE SHAPE IS PART OF THE CONTRACT, not a convenience. A dose date arrives from
// <input type="date"> as "YYYY-MM-DD"; the legacy top-level date is a full
// fake-UTC timestamp. Compared as strings, "2026-09-01" >= "2026-09-01T00:00:00.000Z"
// is FALSE - the shorter string sorts first - so a record sitting exactly on a
// "last 30 days" boundary gets dropped. One consistent returned shape removes
// that trap for every caller instead of leaving five places to remember it.
import { describe, it, expect, afterEach } from "vitest";
import { getVaccinationDate } from "./vaccinationCalculations";

const originalTz = process.env.TZ;
afterEach(() => { if (originalTz === undefined) delete process.env.TZ; else process.env.TZ = originalTz; });

describe("getVaccinationDate", () => {
  it("uses the dose date for a record that only has the series", () => {
    // The case that was silently missing from the phone calendar: no top-level
    // date at all.
    const v = { id: "v1", vaccine: "Hepatitis B", doses: [{ date: "2026-03-14", time: "11:00" }] };
    expect(getVaccinationDate(v)).toBe("2026-03-14T11:00:00.000Z");
  });

  it("uses the LATEST dose, whichever row it sits in", () => {
    const v = {
      doses: [
        { date: "2026-01-10", time: "09:00" },
        { date: "2026-02-11", time: "09:30" },
        { date: "2026-08-20", time: "14:00" },
      ],
    };
    expect(getVaccinationDate(v)).toBe("2026-08-20T14:00:00.000Z");
  });

  it("is correct when the doses are NOT in date order", () => {
    // MUTATION-FOUND. The first version walked backwards from the last row and
    // returned the first dated row it met, which assumes the rows are in date
    // order. Someone adding a dose retrospectively, or correcting an entry, can
    // leave them out of order - and then "last row" is not "latest date", so the
    // record was dated by the wrong dose. Both permutations below must give the
    // same answer, because nothing guarantees how the user typed them in.
    const inOrder = { doses: [{ date: "2026-08-01", time: "09:00" }, { date: "2026-08-03", time: "16:00" }] };
    const outOfOrder = { doses: [{ date: "2026-08-03", time: "16:00" }, { date: "2026-08-01", time: "09:00" }] };
    expect(getVaccinationDate(inOrder)).toBe("2026-08-03T16:00:00.000Z");
    expect(getVaccinationDate(outOfOrder)).toBe("2026-08-03T16:00:00.000Z");
  });

  it("dates a restarted course by the correction, not the voided dose", () => {
    // A later row that HAS been given supersedes earlier ones - that is what
    // happens when a course is restarted or an entry corrected. Dated 12 Aug is
    // now blank, so the series is given-on 1 Aug then corrected on 3 Aug; the
    // 1 Aug row is void and the record is dated by the 3 Aug row. This is the
    // "latest non-superseded" rule - and it needs no code of its own, because a
    // superseded dose is always an EARLIER one, so it is never the maximum.
    const v = {
      doses: [
        { date: "2026-08-01", time: "09:00" },
        { date: "2026-08-03", time: "16:00" },
        { date: "" },
      ],
    };
    expect(getVaccinationDate(v)).toBe("2026-08-03T16:00:00.000Z");
  });

  it("falls back to the legacy top-level date when there is no series", () => {
    // A record from before the dose series landed. The fallback is deliberately
    // kept inside the derivation rather than dropped: this app restores backups
    // and imports files, and a helper that returned null for those records would
    // make the calendar quietly lose years of history.
    const v = { id: "old", date: "2025-11-04T09:00:00.000Z" };
    expect(getVaccinationDate(v)).toBe("2025-11-04T09:00:00.000Z");
  });

  it("prefers the series over the stale top-level date", () => {
    // The exact drift this fixes: a legacy record that has since had a booster
    // added. Reading the top-level field would report November forever.
    const v = {
      date: "2025-11-04T09:00:00.000Z",
      doses: [
        { date: "2025-11-04", time: "09:00" },
        { date: "2026-09-01", time: "10:00" },
      ],
    };
    expect(getVaccinationDate(v)).toBe("2026-09-01T10:00:00.000Z");
  });

  it("normalises both input shapes to one comparable output", () => {
    // The boundary trap, demonstrated. Same day, two input forms, one output.
    const fromDose = getVaccinationDate({ doses: [{ date: "2026-09-01", time: "09:00" }] });
    const fromLegacy = getVaccinationDate({ date: "2026-09-01T09:00:00.000Z" });
    expect(fromDose).toBe(fromLegacy);
    // And therefore a record on the boundary compares correctly...
    const cutoff = "2026-09-01T00:00:00.000Z";
    expect(fromDose >= cutoff).toBe(true);
    // ...where the raw dose string would have been DROPPED.
    expect("2026-09-01" >= cutoff).toBe(false);
  });

  it("defaults a dose with no time to midnight rather than dropping it", () => {
    expect(getVaccinationDate({ doses: [{ date: "2026-05-06" }] })).toBe("2026-05-06T00:00:00.000Z");
  });

  it("ignores a malformed time rather than emitting an invalid stored value", () => {
    // A bad time must not become "2026-05-06Tgarbage:00.000Z", which would be a
    // value that parses to Invalid Date and disappears from the calendar again.
    expect(getVaccinationDate({ doses: [{ date: "2026-05-06", time: "nine" }] }))
      .toBe("2026-05-06T00:00:00.000Z");
  });

  it("returns null rather than guessing when there is no usable date", () => {
    // The caller decides what to show, and monthLabel already renders null as an
    // honest "Undated" group. Returning a fabricated date would be worse.
    expect(getVaccinationDate(null)).toBeNull();
    expect(getVaccinationDate(undefined)).toBeNull();
    expect(getVaccinationDate({})).toBeNull();
    expect(getVaccinationDate({ doses: [] })).toBeNull();
    expect(getVaccinationDate({ doses: [{ date: "" }] })).toBeNull();
    expect(getVaccinationDate({ doses: "not an array" })).toBeNull();
    expect(getVaccinationDate({ date: "garbage" })).toBeNull();
  });

  it("is stable across timezones, because it never reads a real clock", () => {
    // Nothing in the derivation touches `new Date()`, so the result must be
    // byte-identical everywhere. A derivation that read the local clock to
    // "help" would be wrong in every zone but one.
    const v = { doses: [{ date: "2026-03-08", time: "02:30" }] };
    const first = getVaccinationDate(v);
    for (const tz of ["Europe/London", "UTC", "America/New_York", "Australia/Sydney", "Pacific/Chatham"]) {
      process.env.TZ = tz;
      expect(getVaccinationDate(v), `TZ=${tz}`).toBe(first);
      expect(first).toBe("2026-03-08T02:30:00.000Z");
    }
  });

  it("handles a real seed record's shape end to end", () => {
    // The seeded Hepatitis A/B booster, in the shape migrateLegacyVaccinationFields
    // produces from a pre-series record.
    const migrated = {
      id: "vacc_003",
      vaccine: "Hepatitis B",
      date: "2026-01-15T11:00:00.000Z",
      doses: [{ doseNumber: 1, date: "2026-01-15", time: null, provider: "", injectionSite: "", nextDue: null, notes: "" }],
    };
    // Migrated: the dose has no time, so midnight - NOT the original 11:00.
    // That is correct: the migrated dose genuinely has no time recorded, and
    // inventing the legacy one would be reading a field the series replaced.
    expect(getVaccinationDate(migrated)).toBe("2026-01-15T00:00:00.000Z");
  });
});
