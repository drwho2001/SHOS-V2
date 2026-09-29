// contraceptionCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// How many days is "repeat every 1 month" actually? The answer is not 30, and
// the app needs a real number because it STORES one - that stored
// `intervalDays` is what the reminder is scheduled from.
//
// CREATED 29 Sep 2026 (t020). This maths lived inside
// SHOS_MenstrualHealth_Prototype.jsx, exported from a component file purely so
// it could be tested at all. That is a boundary the project's own
// repository/calculation/sync split forbids: pure logic with no I/O does not
// belong in a component, and a component file is not a module other code should
// import arithmetic from. It is here now, next to its sibling domain modules.
//
// THE BUG IT CARRIED, which is why it is worth its own file rather than being
// folded into an existing one. The original was local arithmetic over a value
// that is stored fake-UTC:
//
//   const due = new Date(fromDate);       // UTC midnight
//   const startDay = due.getDate();       // LOCAL getter on a UTC instant
//   due.setMonth(due.getMonth() + value);  // LOCAL mutation
//   if (due.getDate() !== startDay) due.setDate(0);
//
// Every operation was individually correct and the combination was wrong. In New
// York a stored "2026-01-31" is 30 January 19:00 local, so the calendar walk
// ran a day ahead:
//
//   1 month from 31 Jan  ->  29 days   (correct: 28)
//   1 month from 31 Mar  ->  31 days   (correct: 30)
//
// UTC and Sydney were already correct, which is the signature of a frame
// mismatch rather than a maths error - and the kind of thing that survives a
// read-through, because nothing here looks wrong.

import { storedDayKey, calendarDaysBetween } from "./dateInputHelpers";

// Days per unit, for the units that are exact. Months are NOT here: a month is
// not a fixed number of days, which is the whole reason this function exists.
// Exported because the interval EDITOR also needs it, to convert the user's
// chosen unit back into the number the form holds. That is a second consumer of
// the same fact, and a second copy of this table is how a screen ends up
// offering "Fortnights" while this module silently treats it as days.
export const INTERVAL_UNITS = { Days: 1, Weeks: 7 };

/**
 * Convert a repeat interval into the number of days, measured from `fromDate`.
 *
 * `fromDate` is a STORED fake-UTC value, so the calendar walk runs entirely in
 * the UTC frame - the frame the stored digits are actually in. Using the local
 * getters here is what made 1 month from 31 January come out as 29 days.
 *
 * The day count itself is a difference between two stored days, so it goes
 * through the canonical primitive rather than dividing elapsed milliseconds.
 */
export function daysForUnit(value, unit, fromDate) {
  if (unit === "Months") {
    const start = storedDayKey(fromDate);
    if (!start || !Number.isFinite(value)) return 0;
    const due = new Date(`${start}T00:00:00Z`);
    const startDay = due.getUTCDate();
    due.setUTCMonth(due.getUTCMonth() + value);
    // Real month-length edge case: setUTCMonth rolls over when the target month
    // is shorter (31 Jan + 1 month -> 3 Mar, not 28/29 Feb), so pull back to the
    // last day of the month that was actually meant.
    if (due.getUTCDate() !== startDay) due.setUTCDate(0);
    return calendarDaysBetween(start, due.toISOString().slice(0, 10));
  }
  return value * (INTERVAL_UNITS[unit] || 1);
}

/**
 * The units the interval editor offers.
 *
 * This exists because "which units are available" was genuinely owned twice: as
 * three hardcoded `<option>` tags in the form, and as INTERVAL_UNITS above. The
 * two cannot disagree today only because nobody has edited the list since - and
 * they are not the same set on purpose. INTERVAL_UNITS holds the units with an
 * EXACT day count; "Months" is absent from it precisely because it has none.
 * Listing the two separately is clearer than trying to derive one from the
 * other, and having the editor read this list means adding a unit is one edit.
 */
export const CONTRACEPTION_INTERVAL_UNITS = ["Days", "Weeks", "Months"];
