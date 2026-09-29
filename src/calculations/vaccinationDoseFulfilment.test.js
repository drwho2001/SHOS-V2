// A fulfilled next-due date must stop being outstanding.
//
// Real report from the owner: the vaccine reminder kept firing after they
// logged a second dose. Logging that dose IS what satisfied the first dose's
// due date, and nothing in the derivation knew that - so the fulfilled date sat
// in the past and every consumer that reads this reported it as overdue.
//
// This is worth a file of its own rather than a few assertions because the
// consumers are many and silent: the reminder, the in-app banner, the overdue
// counts, the list rows, the Clinic Card, the PDF export and Stats all read
// these functions. One derivation, one fix, and every one of them is corrected -
// which is only true because they share a single source. The alternative
// (cancelling the notification in the sync file) would have left every other
// consumer still wrong while looking like the bug was fixed.

import { describe, it, expect } from "vitest";
import {
  getDoseNextDueDates,
  getVaccinationNextDue,
  isVaccinationOverdue,
  soonestDueVaccination,
} from "./vaccinationCalculations";

const TODAY = "2026-09-29";

describe("a dose given after an earlier due date satisfies it", () => {
  // The reported case, exactly: dose 1 was due 2026-09-01, and dose 2 was
  // recorded on 2026-09-10.
  const fulfilled = {
    id: "vax_1",
    doses: [
      { doseNumber: 1, date: "2026-01-05T10:00:00.000Z", nextDue: "2026-09-01" },
      { doseNumber: 2, date: "2026-09-10T10:00:00.000Z" },
    ],
  };

  it("the fulfilled date is not outstanding", () => {
    expect(getDoseNextDueDates(fulfilled)).toEqual([]);
    expect(getVaccinationNextDue(fulfilled)).toBeNull();
  });

  it("so the vaccination is not reported overdue", () => {
    // The specific symptom: this is what keeps the reminder alive, because
    // getVaccinationDueState() reads `dueDate <= now`.
    expect(isVaccinationOverdue(fulfilled, TODAY)).toBe(false);
  });

  it("and it is not offered as the soonest thing to attend to", () => {
    expect(soonestDueVaccination([fulfilled])).toBeNull();
  });

  it("a dose given on the due date itself also satisfies it", () => {
    // Not an off-by-one special case: a dose given ON the day it was due is
    // not late, and must not keep nagging.
    const onTheDay = {
      doses: [
        { doseNumber: 1, date: "2026-01-05T10:00:00.000Z", nextDue: "2026-09-01" },
        { doseNumber: 2, date: "2026-09-01T10:00:00.000Z" },
      ],
    };
    expect(getVaccinationNextDue(onTheDay)).toBeNull();
  });

  it("a three-dose course resolves to the LAST outstanding date", () => {
    // The realistic Hepatitis A/B shape: dose 1 due, dose 2 given, dose 3 still
    // to come. Only dose 2's nextDue is live.
    const course = {
      doses: [
        { doseNumber: 1, date: "2026-03-01T10:00:00.000Z", nextDue: "2026-04-01" },
        { doseNumber: 2, date: "2026-05-01T10:00:00.000Z", nextDue: "2026-10-15" },
        { doseNumber: 3, date: "2026-11-01T10:00:00.000Z" },
      ],
    };
    // dose 1's 2026-04-01 is satisfied by the May dose. dose 2's 2026-10-15 is
    // satisfied by the November dose. Nothing outstanding - course complete.
    expect(getDoseNextDueDates(course)).toEqual([]);

    // But if the third dose has NOT been given, dose 2's date stands.
    const inProgress = {
      doses: [
        { doseNumber: 1, date: "2026-03-01T10:00:00.000Z", nextDue: "2026-04-01" },
        { doseNumber: 2, date: "2026-05-01T10:00:00.000Z", nextDue: "2026-10-15" },
      ],
    };
    expect(getVaccinationNextDue(inProgress)).toBe("2026-10-15");
  });
});

describe("a genuinely outstanding due date is NOT dropped", () => {
  // The half that matters most, and the shape a too-clever fix would break.
  // "Just take the last dose's nextDue" passes every test above and silently
  // discards real obligations.

  it("an unfulfilled overdue date still reports overdue", () => {
    const overdue = {
      doses: [
        { doseNumber: 1, date: "2026-07-01T10:00:00.000Z", nextDue: "2026-08-01" },
      ],
    };
    expect(getVaccinationNextDue(overdue)).toBe("2026-08-01");
    expect(isVaccinationOverdue(overdue, TODAY)).toBe(true);
    expect(soonestDueVaccination([overdue])).not.toBeNull();
  });

  it("a dose given EARLY does not satisfy a later due date", () => {
    // Dose 2 given in October when dose 1 said "next due December". The app
    // genuinely does not know when dose 3 is expected, so December is still
    // the honest outstanding date and must survive.
    const early = {
      doses: [
        { doseNumber: 1, date: "2026-07-01T10:00:00.000Z", nextDue: "2026-12-01" },
        { doseNumber: 2, date: "2026-10-01T10:00:00.000Z" },
      ],
    };
    expect(getVaccinationNextDue(early)).toBe("2026-12-01");
  });

  it("a future due date is untouched", () => {
    const future = {
      doses: [
        { doseNumber: 1, date: "2026-08-01T10:00:00.000Z", nextDue: "2027-02-01" },
      ],
    };
    expect(getVaccinationNextDue(future)).toBe("2027-02-01");
    expect(isVaccinationOverdue(future, TODAY)).toBe(false);
  });

  it("a dose with no date yet is a planned dose, not a fulfilled one", () => {
    // A user can add the next dose row before actually having it. That row has
    // no `date`, so it must not satisfy anything - otherwise pre-adding a dose
    // would silently cancel the reminder for the current one.
    const planned = {
      doses: [
        { doseNumber: 1, date: "2026-07-01T10:00:00.000Z", nextDue: "2026-08-01" },
        { doseNumber: 2, nextDue: "2026-11-01" },
      ],
    };
    expect(getDoseNextDueDates(planned)).toEqual(["2026-08-01", "2026-11-01"]);
  });

  it("the seeded Twinrix booster still reports overdue", () => {
    // The app's own seed, unchanged: dose 1 given 160 days ago with no nextDue,
    // dose 2 given 130 days ago with nextDue 20 days ago. Nothing follows it, so
    // it is still outstanding - a real fix must not quietly silence this.
    const twinrix = {
      doses: [
        { doseNumber: 1, date: "2026-04-22T11:00:00.000Z" },
        { doseNumber: 2, date: "2026-06-21T11:00:00.000Z", nextDue: "2026-09-09" },
      ],
    };
    expect(getVaccinationNextDue(twinrix)).toBe("2026-09-09");
    expect(isVaccinationOverdue(twinrix, TODAY)).toBe(true);
  });
});

describe("records without a dose series are unaffected", () => {
  it("a legacy top-level nextDue still works", () => {
    const legacy = { id: "vax_9", nextDue: "2026-08-15" };
    expect(getDoseNextDueDates(legacy)).toEqual(["2026-08-15"]);
    expect(isVaccinationOverdue(legacy, TODAY)).toBe(true);
  });

  it("a legacy top-level nextDue satisfied by a later dose is dropped", () => {
    // The same rule has to apply to the legacy field, or a pre-migration record
    // keeps the reminder alive - which is the same bug with a different field
    // name.
    const legacySatisfied = {
      nextDue: "2026-08-15",
      doses: [{ doseNumber: 2, date: "2026-09-02T10:00:00.000Z" }],
    };
    expect(getDoseNextDueDates(legacySatisfied)).toEqual([]);
  });

  it("an empty or absent record yields nothing", () => {
    for (const v of [null, undefined, {}, { doses: [] }]) {
      expect(getDoseNextDueDates(v)).toEqual([]);
      expect(getVaccinationNextDue(v)).toBeNull();
      expect(isVaccinationOverdue(v, TODAY)).toBe(false);
    }
  });
});
