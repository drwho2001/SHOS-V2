// The PLANNED events - the derivation both calendars read (t139).
//
// THE OWNER'S ASK: "retest to phone calendar - include planned events on
// calendar."
//
// The dates here are FIXED and far from the present on purpose. A
// future-dated fixture that is "next month" is a test that starts failing
// on its own, and one that is "yesterday" is a test that starts failing the
// month after - so the future ones are in 2099 and the past ones in 2001,
// and neither can drift into the wrong side of today.
//
// The rule this file pins is the one the whole feature rests on: a future-
// dated test is a PLAN, and a test dated in the past is something that
// HAPPENED (t127) - and the same distinction the app's own Calendar screen
// and the Testing list already make.
import { describe, it, expect } from "vitest";
import { getPlannedCalendarEvents, PLANNED_EVENT_KIND } from "./plannedCalendarEvents";

const FUTURE = "2099-12-23T10:00:00.000Z";
const PAST = "2001-06-01T10:00:00.000Z";

const test_ = (overrides = {}) => ({
  id: "test_1",
  title: "Routine 3-month screen",
  date: FUTURE,
  isArchived: false,
  ...overrides,
});

const vaccination = (overrides = {}) => ({
  id: "vax_1",
  title: "Hepatitis B",
  vaccine: "Hepatitis B",
  isArchived: false,
  doses: [{ doseNumber: 1, date: "2026-09-01", nextDue: "2099-11-10" }],
  ...overrides,
});

describe("a planned retest", () => {
  it("is a planned event, on the day the test is dated", () => {
    const [event] = getPlannedCalendarEvents({ tests: [test_()] });
    expect(event.kind).toBe(PLANNED_EVENT_KIND.TEST);
    expect(event.date).toBe(FUTURE);
    expect(event.title).toBe("Routine 3-month screen");
    expect(event.genericTitle).toBe("Test due");
  });

  it("is keyed by the test, NOT by its date - so a moved test is the same plan", () => {
    // The calendar event for a retest that is rescheduled should MOVE, not
    // be deleted and recreated: the plan is the same plan.
    const [before] = getPlannedCalendarEvents({ tests: [test_({ date: FUTURE })] });
    const [after] = getPlannedCalendarEvents({ tests: [test_({ date: "2099-12-30T10:00:00.000Z" })] });
    expect(after.key).toBe(before.key);
    expect(after.date).not.toBe(before.date);
  });

  it("is a plan because it is in the future - a test that happened is not a plan", () => {
    expect(getPlannedCalendarEvents({ tests: [test_({ date: PAST })] })).toHaveLength(0);
  });

  it("is a plan when it is flagged as a routine retest plan, whatever its date", () => {
    // A retest plan is an intention, so it is one even when the date has
    // passed - the app asks about it rather than pretending it happened.
    const events = getPlannedCalendarEvents({
      tests: [test_({ date: PAST, isRoutineRetestPlan: true })],
    });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe(PLANNED_EVENT_KIND.TEST);
  });

  it("is not a plan when the record is archived, or has no date at all", () => {
    expect(getPlannedCalendarEvents({ tests: [test_({ isArchived: true })] })).toHaveLength(0);
    expect(getPlannedCalendarEvents({ tests: [test_({ date: null })] })).toHaveLength(0);
  });
});

describe("a planned vaccination dose", () => {
  it("is a planned event, on the day the dose is due", () => {
    const [event] = getPlannedCalendarEvents({ vaccinations: [vaccination()] });
    expect(event.kind).toBe(PLANNED_EVENT_KIND.VACCINATION);
    expect(event.date).toBe("2099-11-10");
    expect(event.genericTitle).toBe("Vaccination due");
  });

  it("is keyed by the vaccination AND the date - two outstanding dates are two plans", () => {
    // The second dose has NOT been given, so BOTH dates are outstanding:
    // a next-due date is superseded only by a LATER DOSE IN THE SERIES
    // HAVING BEEN GIVEN, which is the app's own rule and this fixture has
    // to respect it to be honest.
    const v = vaccination({
      doses: [
        { doseNumber: 1, date: "2026-09-01", nextDue: "2099-11-10" },
        { doseNumber: 2, date: null, nextDue: "2099-12-08" },
      ],
    });
    const events = getPlannedCalendarEvents({ vaccinations: [v] });
    expect(events).toHaveLength(2);
    expect(events[0].key).not.toBe(events[1].key);
  });

  it("drops a next-due date once a later dose in the series has been given", () => {
    // The same rule, from the other side: giving dose 2 satisfies dose 1's
    // due date, so that date is no longer a plan. (A dose given EARLY still
    // satisfies it - the reminder has already been made to stop nagging for
    // exactly that reason.)
    const v = vaccination({
      doses: [
        { doseNumber: 1, date: "2026-09-01", nextDue: "2099-11-10" },
        { doseNumber: 2, date: "2026-09-29", nextDue: "2099-12-08" },
      ],
    });
    const events = getPlannedCalendarEvents({ vaccinations: [v] });
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2099-12-08");
  });

  it("is not a plan once its date has passed - that is overdue, not planned", () => {
    // The reminder already nags about an overdue dose. Putting the same
    // stale date on a calendar would say it is still coming.
    const v = vaccination({ doses: [{ doseNumber: 1, date: "2026-09-01", nextDue: "2001-01-01" }] });
    expect(getPlannedCalendarEvents({ vaccinations: [v] })).toHaveLength(0);
  });

  it("is not a plan when the vaccination is archived", () => {
    const v = vaccination({ isArchived: true });
    expect(getPlannedCalendarEvents({ vaccinations: [v] })).toHaveLength(0);
  });
});

describe("the derivation is total", () => {
  it("copes with no input at all", () => {
    expect(getPlannedCalendarEvents()).toEqual([]);
    expect(getPlannedCalendarEvents({})).toEqual([]);
  });
});
