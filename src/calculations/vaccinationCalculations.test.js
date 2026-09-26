import { describe, it, expect } from "vitest";
import {
  getDoseNextDueDates,
  getVaccinationNextDue,
  isVaccinationOverdue,
  soonestDueVaccination,
} from "./vaccinationCalculations";

// The shape every read site used to get wrong. migrateLegacyVaccinationFields()
// DELETES the top-level nextDue, so anything reading v.nextDue sees undefined.
const hepBSeries = {
  id: "vaccination_004",
  vaccine: "Hepatitis B",
  doses: [
    { doseNumber: 1, date: "2024-03-01", nextDue: null },
    { doseNumber: 2, date: "2024-04-01", nextDue: null },
    { doseNumber: 3, date: "2026-11-02", nextDue: "2027-05-02" },
  ],
};

describe("getDoseNextDueDates", () => {
  it("reads per-dose dates, which is where the value actually lives now", () => {
    expect(getDoseNextDueDates(hepBSeries)).toEqual(["2027-05-02"]);
  });

  it("returns several dates oldest-first for a course with more than one due", () => {
    const multi = {
      doses: [
        { doseNumber: 1, nextDue: "2027-01-01" },
        { doseNumber: 2, nextDue: "2026-12-01" },
      ],
    };
    expect(getDoseNextDueDates(multi)).toEqual(["2026-12-01", "2027-01-01"]);
  });

  it("falls back to a legacy top-level value so an unmigrated record still works", () => {
    expect(getDoseNextDueDates({ nextDue: "2026-10-01", doses: [] })).toEqual(["2026-10-01"]);
  });

  it("ignores empty, null and non-string dose values", () => {
    const messy = { doses: [{ nextDue: null }, { nextDue: "" }, {}, { nextDue: "2027-02-02" }] };
    expect(getDoseNextDueDates(messy)).toEqual(["2027-02-02"]);
  });

  it("deduplicates a date present both per-dose and at the top level", () => {
    const dup = { nextDue: "2027-05-02", doses: [{ nextDue: "2027-05-02" }] };
    expect(getDoseNextDueDates(dup)).toEqual(["2027-05-02"]);
  });

  it("tolerates missing, null and malformed input rather than throwing", () => {
    expect(getDoseNextDueDates(null)).toEqual([]);
    expect(getDoseNextDueDates(undefined)).toEqual([]);
    expect(getDoseNextDueDates({})).toEqual([]);
    expect(getDoseNextDueDates({ doses: null })).toEqual([]);
    expect(getDoseNextDueDates({ doses: "nonsense" })).toEqual([]);
  });
});

describe("getVaccinationNextDue", () => {
  it("returns the earliest due date on the series", () => {
    expect(getVaccinationNextDue(hepBSeries)).toBe("2027-05-02");
  });

  it("returns null when nothing is due - NOT undefined, so callers can rely on it", () => {
    expect(getVaccinationNextDue({ doses: [{ nextDue: null }] })).toBeNull();
    expect(getVaccinationNextDue({ doses: [] })).toBeNull();
    expect(getVaccinationNextDue(null)).toBeNull();
  });

  it("prefers a still-outstanding earlier dose over a later one", () => {
    const course = { doses: [{ nextDue: "2026-01-01" }, { nextDue: "2028-01-01" }] };
    expect(getVaccinationNextDue(course)).toBe("2026-01-01");
  });
});

describe("isVaccinationOverdue", () => {
  const today = "2026-09-26";

  it("is true when the earliest due date is in the past", () => {
    expect(isVaccinationOverdue({ doses: [{ nextDue: "2026-01-01" }] }, today)).toBe(true);
  });

  it("is false when the due date is today or in the future", () => {
    expect(isVaccinationOverdue({ doses: [{ nextDue: today }] }, today)).toBe(false);
    expect(isVaccinationOverdue({ doses: [{ nextDue: "2027-01-01" }] }, today)).toBe(false);
  });

  it("is false when there is nothing due at all", () => {
    expect(isVaccinationOverdue({ doses: [{ nextDue: null }] }, today)).toBe(false);
    expect(isVaccinationOverdue({ doses: [] }, today)).toBe(false);
  });

  it("is true for a real outstanding dose even on the other side of a later clock", () => {
    // hepBSeries IS due (2027-05-02), so it reads as overdue once "today"
    // moves past it - the whole point of a next-due date.
    expect(isVaccinationOverdue(hepBSeries, "2028-01-01")).toBe(true);
    expect(isVaccinationOverdue(hepBSeries, "2026-09-26")).toBe(false);
  });
});

describe("soonestDueVaccination", () => {
  it("picks the record with the earliest due date and reports it with its date", () => {
    const result = soonestDueVaccination([
      { id: "a", doses: [{ nextDue: "2027-06-01" }] },
      { id: "b", doses: [{ nextDue: "2026-10-05" }] },
    ]);
    expect(result.vaccination.id).toBe("b");
    expect(result.nextDue).toBe("2026-10-05");
  });

  it("ignores archived records", () => {
    const result = soonestDueVaccination([
      { id: "archived", isArchived: true, doses: [{ nextDue: "2020-01-01" }] },
      { id: "live", doses: [{ nextDue: "2027-01-01" }] },
    ]);
    expect(result.vaccination.id).toBe("live");
  });

  it("returns null when nothing has a due date - the case that silently disabled every reminder", () => {
    expect(soonestDueVaccination([])).toBeNull();
    expect(soonestDueVaccination(null)).toBeNull();
    expect(soonestDueVaccination([{ doses: [] }, { doses: [{ nextDue: null }] }])).toBeNull();
  });
});

// The original regression this file exists for: a record shaped exactly like
// the real seeded Hepatitis course, read the way the old call sites read it.
describe("regression: the shape that silently broke every vaccine reminder", () => {
  it("reading the deleted top-level field finds nothing, the derived one does not", () => {
    expect(hepBSeries.nextDue).toBeUndefined();
    expect(getVaccinationNextDue(hepBSeries)).toBe("2027-05-02");
  });
});

// The second bug this file also had to absorb: real records stored a full
// ISO string in a field every reader treats as a bare calendar date, which
// broke ordering, the past/future check, AND date arithmetic downstream
// (appending "T09:00:00" to one yields an Invalid Date rather than throwing,
// so a reminder just silently never scheduled).
describe("normalising a mis-stored full ISO value", () => {
  const iso = "2026-10-16T10:00:00.000Z";

  it("reads the date part out of a full ISO string", () => {
    expect(getVaccinationNextDue({ doses: [{ nextDue: iso }] })).toBe("2026-10-16");
  });

  it("sorts a mis-stored value correctly against a correctly-stored one", () => {
    // "2026-10-16T10:00:00.000Z" sorts AFTER "2026-09-01" as a raw string,
    // but as a date it is also after - the case that actually matters is the
    // reverse, where the longer string's extra characters make an equal-day
    // pair look ordered.
    const mixed = { doses: [{ nextDue: "2026-10-16" }, { nextDue: "2026-10-16T10:00:00.000Z" }] };
    expect(getDoseNextDueDates(mixed)).toEqual(["2026-10-16"]);
  });

  it("an overdue mis-stored value is still recognised as overdue", () => {
    expect(isVaccinationOverdue({ doses: [{ nextDue: "2020-01-01T10:00:00.000Z" }] }, "2026-09-26")).toBe(true);
  });

  it("a future mis-stored value is still recognised as NOT overdue", () => {
    expect(isVaccinationOverdue({ doses: [{ nextDue: iso }] }, "2026-09-26")).toBe(false);
  });

  it("rejects values that are not date-shaped at all rather than mangling them", () => {
    expect(getDoseNextDueDates({ doses: [{ nextDue: "sometime" }, { nextDue: "2026/10/16" }] })).toEqual([]);
  });
});
