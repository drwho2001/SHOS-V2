// THE PLANNED EVENTS - what the app already knows is going to happen (t139).
//
// THE OWNER'S ASK: "retest to phone calendar - include planned events on
// calendar." Until now the phone's calendar only ever received things that
// had HAPPENED (a dose on the day it was given) and appointments that were
// BOOKED. The future was in the app and nowhere else: a scheduled retest
// and a vaccination's outstanding next dose both have dates the app knows.
//
// WHY THIS FILE EXISTS, AND WHY IT IS THE ONLY PLACE THAT KNOWS.
//
// The app has two calendars: its own Calendar screen, and the phone's real
// one. They have disagreed before - twice, in both directions (t034 wrote
// one event per vaccination RECORD while the phone wrote one per DOSE;
// t130 made them one per dose). So the rule this batch follows is the one
// the repo already learned the hard way: ONE derivation, and both
// calendars read it. This file is that derivation. The phone's calendar
// writes what it finds here; the app's own Calendar screen shows the same
// set. A change here moves both.
//
// TWO KINDS, BOTH OPT-IN.
//
//   A planned retest - a Testing record that is future-dated, or one
//   flagged as a routine retest plan. The date is the record's own.
//
//   A planned vaccination dose - an OUTSTANDING next-due date on a
//   vaccination's dose series. This is a different shape from a dose that
//   has been given (a plain "YYYY-MM-DD" day, not a datetime), and it is
//   the one that goes stale: give the dose and the plan disappears.
//
// WHAT IS NOT HERE, AND WHY.
//
// A next-due date in the PAST is not a plan - it is an overdue dose, which
// is a different thing and is the reminder's business, not the calendar's.
// So only dates from today onwards are planned events. The app's own
// reminder already nags about an overdue dose; putting the same stale date
// on a calendar would say it is still coming.
//
// A test dated in the past is a test that HAPPENED (t127): the Testing
// list, the derived HIV status and the Clinic Card all read that rule
// already, and this file does not get a second opinion on it.
import { isPlannedTest } from "./testingCalculations";
import { getDoseNextDueDates } from "./vaccinationCalculations";
import { localDayKey } from "./dateInputHelpers";

// The kinds, as a frozen set - they are also the marker family's
// discriminator on the phone's calendar, so a typo here would write an
// event the cleanup pass cannot recognise.
export const PLANNED_EVENT_KIND = Object.freeze({
  TEST: "test",
  VACCINATION: "vax",
});

/**
 * Every planned event the app knows about.
 *
 * @param {{tests?: any[], vaccinations?: any[]}} input
 * @returns {Array<{kind: string, key: string, id: string, date: string,
 *   title: string, genericTitle: string}>}
 */
export function getPlannedCalendarEvents({ tests = [], vaccinations = [] } = {}) {
  const events = [];

  (tests || []).forEach((test) => {
    if (!test || test.isArchived || !test.date) return;
    // The same rule the Testing list and the app's own calendar use, so the
    // two calendars cannot disagree about what is planned.
    if (!isPlannedTest(test)) return;
    events.push({
      kind: PLANNED_EVENT_KIND.TEST,
      // The key identifies the thing, not its date: a retest that is moved
      // to another day is the SAME plan, and its calendar event should move
      // with it rather than being deleted and recreated.
      key: test.id,
      id: test.id,
      date: test.date,
      title: test.title || (test.testingFor || []).join("/") || "Test",
      // The generic wording is the same in both calendars, and it is what
      // the opt-in "generic title" setting puts on the phone's event.
      genericTitle: "Test due",
    });
  });

  const today = localDayKey();
  (vaccinations || []).forEach((vaccination) => {
    if (!vaccination || vaccination.isArchived) return;
    getDoseNextDueDates(vaccination).forEach((due) => {
      if (!due) return;
      // A plain "YYYY-MM-DD" day, so a plain string comparison is both
      // correct and chronological. A day already past is overdue, not
      // planned.
      if (due < today) return;
      events.push({
        kind: PLANNED_EVENT_KIND.VACCINATION,
        // Here the DATE is part of the key, because a vaccination can have
        // more than one outstanding date and each is its own plan. It also
        // means a date that moves is a different plan - the old event is
        // cleaned up and the new one written, which is the right outcome
        // for a plan that changed rather than for one that was rescheduled.
        key: `${vaccination.id}:${due}`,
        id: vaccination.id,
        date: due,
        title: vaccination.title || vaccination.vaccine || "Vaccination",
        genericTitle: "Vaccination due",
      });
    });
  });

  return events;
}
