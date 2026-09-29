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

  it("a later dose with its own nextDue supplies the outstanding date instead", () => {
    // The course is not finished - it has genuinely moved on, and the new date
    // is the one that should nag.
    const onCourse = {
      doses: [
        { doseNumber: 1, date: "2026-03-01T10:00:00.000Z", nextDue: "2026-04-01" },
        { doseNumber: 2, date: "2026-05-01T10:00:00.000Z", nextDue: "2026-10-15" },
      ],
    };
    expect(getVaccinationNextDue(onCourse)).toBe("2026-10-15");
  });

  it("a three-dose course resolves to the LAST dose's date", () => {
    const course = {
      doses: [
        { doseNumber: 1, date: "2026-03-01T10:00:00.000Z", nextDue: "2026-04-01" },
        { doseNumber: 2, date: "2026-05-01T10:00:00.000Z", nextDue: "2026-10-15" },
        { doseNumber: 3, date: "2026-11-01T10:00:00.000Z" },
      ],
    };
    // Course complete: the last dose has no nextDue, so nothing is outstanding.
    expect(getDoseNextDueDates(course)).toEqual([]);
  });

  it("a course with NO dose given at all still has its earliest date outstanding", () => {
    // THE case that killed the over-correction, and it is a long-standing test
    // in vaccinationCalculations.test.js that caught it rather than me.
    //
    // The first attempt at this fix took only the LAST dose's nextDue, which
    // looks obviously right and silently breaks this: a user who has entered the
    // whole schedule up front and has not had dose 1 yet is not overdue-free,
    // they are just at the start. The earliest date is genuinely still live.
    //
    // So the rule is position relative to the last dose ACTUALLY GIVEN, not
    // "the last row" — and both earlier attempts got that wrong in opposite
    // directions, one leaving a stale nag and one silencing a course nobody had
    // started.
    const planned = { doses: [{ nextDue: "2026-01-01" }, { nextDue: "2028-01-01" }] };
    expect(getVaccinationNextDue(planned)).toBe("2026-01-01");
    expect(isVaccinationOverdue(planned, "2026-09-26")).toBe(true);
  });

  it("a partly-started course takes the earliest of the last given dose and what follows", () => {
    // Dose 1 given, its own follow-up due in August, dose 2 already planned for
    // November. August is the next real thing, and taking the earliest keeps
    // that stable rather than jumping ahead to the planned row.
    const mid = {
      doses: [
        { doseNumber: 1, date: "2026-07-01T10:00:00.000Z", nextDue: "2026-08-01" },
        { doseNumber: 2, nextDue: "2026-11-01" },
      ],
    };
    expect(getVaccinationNextDue(mid)).toBe("2026-08-01");
  });
});

describe("a genuinely outstanding due date is NOT dropped", () => {
  // The half that matters most, and the shape BOTH earlier fixes broke - one
  // from each direction. "Keep every nextDue" left a stale nag after an early
  // dose; "just take the last dose's nextDue" passed every test below and
  // silently discarded a course nobody had started.

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

  it("a dose given EARLY still supersedes the earlier dose's due date", () => {
    // The owner's SECOND report, two days after the first: the second dose was
    // logged 2 days BEFORE the first dose's due date, and the reminder still
    // fired. The first fix reasoned that an early dose "cannot have satisfied a
    // later due date, because the app does not know when dose 3 is expected" -
    // true, and irrelevant. The question is not whether the LATER date is
    // satisfied; it is whether the EARLIER dose still needs doing. Once a later
    // dose exists it does not, however early it was given, and taking a dose
    // early is ordinary rather than an edge case.
    //
    // This test previously asserted the OPPOSITE and was the reason the bug
    // survived the first fix. It is here in that form deliberately: the wrong
    // reasoning was a considered, argued position, not an oversight, and it
    // took a real report to overturn it.
    const early = {
      doses: [
        { doseNumber: 1, date: "2026-08-01T10:00:00.000Z", nextDue: "2026-09-01" },
        { doseNumber: 2, date: "2026-08-30T10:00:00.000Z" },
      ],
    };
    expect(getDoseNextDueDates(early), "the earlier dose's due date is superseded by the later dose existing")
      .toEqual([]);
    expect(getVaccinationNextDue(early)).toBeNull();
    expect(isVaccinationOverdue(early, TODAY)).toBe(false);
    expect(soonestDueVaccination([early])).toBeNull();
  });

  it("but the LAST dose's own nextDue is still outstanding", () => {
    // The distinction that keeps this from over-correcting into silence: what
    // is superseded is the EARLIER dose's date, never the current one.
    const stillGoing = {
      doses: [
        { doseNumber: 1, date: "2026-08-01T10:00:00.000Z", nextDue: "2026-09-01" },
        { doseNumber: 2, date: "2026-08-30T10:00:00.000Z", nextDue: "2026-12-01" },
      ],
    };
    expect(getVaccinationNextDue(stillGoing)).toBe("2026-12-01");
    expect(isVaccinationOverdue(stillGoing, TODAY)).toBe(false);
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

  it("series order is by doseNumber, not by array position", () => {
    // The editor numbers doses as it adds them, and a hand-edited or legacy row
    // may not be numbered at all. If the last row is taken by array position
    // rather than series order, a re-ordered array silently changes which date
    // nags - with no error and no visible difference.
    const reordered = {
      doses: [
        { doseNumber: 2, date: "2026-05-01T10:00:00.000Z", nextDue: "2026-10-15" },
        { doseNumber: 1, date: "2026-03-01T10:00:00.000Z", nextDue: "2026-04-01" },
      ],
    };
    expect(getDoseNextDueDates(reordered)).toEqual(["2026-10-15"]);
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
