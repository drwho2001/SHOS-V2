// encounterCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Pure functions only — nothing here stores or fetches anything. This
// is where the Contacts module's four Notion rollups (Encounter Count,
// Average Enjoyment, Highest Enjoyment, Last Interaction) get
// reproduced as calculations instead of stored fields, exactly the
// "store facts, derive state" pattern medicationCalculations.js already
// uses for stock. Call EncounterRepository.getByAttendee(contactId) to
// get the raw encounters, then hand them to these functions.
//
// `timeOfDay` also lives here — it's a Notion FORMULA on the Encounters
// data source (derived from Date), not a stored field, so it's a
// calculation here too rather than something EncounterRepository saves.

// Ports the live Notion "Time of Day" formula's intent (bucket a
// datetime into a plain-language part of day) without needing the
// original formula source, which isn't readable via any fetch tool
// (per the project's own standing note on button/formula internals).
// If the user confirms the exact original bucket boundaries later, adjust
// here only — nothing else depends on the specific cutoffs.
export function timeOfDay(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  // getUTCHours, NOT getHours, and that is not a stylistic preference. A
  // stored date in this app is a deliberate "Z"-suffixed LIE: the digits are
  // literal wall-clock time and the Z is not true UTC (dateInputHelpers.js
  // documents this at length). A local getter therefore re-applies the
  // device's real UTC offset to a value that was already local, so a
  // 00:30 encounter reads as 19:30 and files itself under "Evening" for
  // anyone west of UTC. Reading the digits back with the UTC getter is the
  // read-back-correctly equivalent, and is what makes this bucket the same
  // answer in London, New York and Sydney.
  const hour = d.getUTCHours();
  if (hour < 5) return "Late Night";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
}

// The read side of the Attendees relation, scoped to one contact —
// thin wrapper so calculation functions below share one filter shape.
// (EncounterRepository.getByAttendee already does this filtering
// against the real store; this version works on any already-fetched
// array, e.g. for testing without the repository.)
export function encountersForContact(encounters, contactId) {
  return encounters.filter((e) => e.attendeeIds.includes(contactId) && !e.isArchived);
}

// Mirrors Contacts' "Encounter Count" rollup (aggregation: count).
export function encounterCount(encounters, contactId) {
  return encountersForContact(encounters, contactId).length;
}

// Mirrors "Average Enjoyment" rollup (aggregation: average). Encounters
// with no rating recorded are excluded, not treated as 0 — an unrated
// encounter isn't a bad one, it's just unrated.
export function averageEnjoyment(encounters, contactId) {
  const rated = encountersForContact(encounters, contactId)
    .map((e) => e.enjoymentRating)
    .filter((r) => typeof r === "number");
  if (rated.length === 0) return null;
  return rated.reduce((sum, r) => sum + r, 0) / rated.length;
}

// Mirrors "Highest Enjoyment " rollup (aggregation: max).
export function highestEnjoyment(encounters, contactId) {
  const rated = encountersForContact(encounters, contactId)
    .map((e) => e.enjoymentRating)
    .filter((r) => typeof r === "number");
  return rated.length === 0 ? null : Math.max(...rated);
}

// Mirrors "Last Interaction" rollup (aggregation: latest_date).
export function lastInteraction(encounters, contactId) {
  const dates = encountersForContact(encounters, contactId)
    .map((e) => e.date)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a));
  return dates.length === 0 ? null : dates[0];
}

// Convenience bundle — the four numbers together, for the Contact
// Profile Timeline section in one call rather than four.
export function contactEncounterSummary(encounters, contactId) {
  return {
    count: encounterCount(encounters, contactId),
    averageEnjoyment: averageEnjoyment(encounters, contactId),
    highestEnjoyment: highestEnjoyment(encounters, contactId),
    lastInteraction: lastInteraction(encounters, contactId),
  };
}

// ADDED — real gap found in a performance audit: the Contacts LIST
// was calling contactEncounterSummary(encounters, contact.id) once per
// card (and again per pair compared while sorting by "Last encounter")
// — each call independently re-filters the FULL encounters array four
// times over. With N contacts and M encounters that's O(N×M) work
// redone on every render. This does the equivalent work in one O(M)
// pass over encounters, grouping by attendee, and hands back a
// Map<contactId, summary> — same per-contact shape as
// contactEncounterSummary above, so existing callers of THAT function
// (the single-contact Timeline section, genuinely a one-off) are left
// alone. Build this once via useMemo, then it's an O(1) lookup per
// card/comparison instead of a rescan.
export function contactEncounterSummaries(encounters) {
  const buckets = new Map();
  for (const e of encounters) {
    if (e.isArchived) continue;
    for (const contactId of e.attendeeIds || []) {
      let bucket = buckets.get(contactId);
      if (!bucket) { bucket = { count: 0, ratings: [], dates: [] }; buckets.set(contactId, bucket); }
      bucket.count += 1;
      if (typeof e.enjoymentRating === "number") bucket.ratings.push(e.enjoymentRating);
      if (e.date) bucket.dates.push(e.date);
    }
  }
  const summaries = new Map();
  for (const [contactId, bucket] of buckets) {
    summaries.set(contactId, {
      count: bucket.count,
      averageEnjoyment: bucket.ratings.length === 0 ? null : bucket.ratings.reduce((sum, r) => sum + r, 0) / bucket.ratings.length,
      highestEnjoyment: bucket.ratings.length === 0 ? null : Math.max(...bucket.ratings),
      lastInteraction: bucket.dates.length === 0 ? null : bucket.dates.slice().sort((a, b) => new Date(b) - new Date(a))[0],
    });
  }
  return summaries;
}

import { storedDayKey, localDayKey, calendarDaysBetween } from "./dateInputHelpers";

// Default shape for a contact with no encounters at all — matches
// exactly what contactEncounterSummary(encounters, contactId) returns
// for such a contact, so callers reading from contactEncounterSummaries()
// can fall back to this without a special case.
export const EMPTY_ENCOUNTER_SUMMARY = { count: 0, averageEnjoyment: null, highestEnjoyment: null, lastInteraction: null };

// Relative-date formatting for the Contact Card's "Last Encounter"
// field (B1) and Timeline — "3 weeks ago" style, matching the
// component spec's described format.
export function formatRelativeDate(dateString) {
  if (!dateString) return "—";

  // FIXED 30 Sep 2026 (t037). This compared a REAL instant against a STORED
  // one and divided the result by 86,400,000:
  //
  //   const then = new Date(dateString);   // stored fake-UTC, parsed as an instant
  //   const now = new Date();               // a real instant
  //   const diffDays = Math.floor((now - then) / 86400000);
  //
  // `dateString` in this app is fake-UTC — the digits are the user's own
  // wall-clock and the trailing "Z" is a deliberate lie (dateInputHelpers.js's
  // header). Parsing one gives an instant shifted by the device's real UTC
  // offset, so `now - then` is wrong by that offset and then FLOORED to a whole
  // day. In Pacific/Chatham that is a 12-hour error, which is enough to push an
  // appointment due later today across the boundary and print "yesterday" or
  // "tomorrow" for a date that is neither.
  //
  // This is the function behind the Clinic Card's next-due and overdue rows AND
  // its PDF export, so the wrong word reaches a clinician's printout.
  //
  // The fix is to compare DAYS, not milliseconds: reduce both sides to their own
  // day keys and difference those. `now` becomes the user's LOCAL today (it is
  // a real instant) and `dateString` becomes the STORED day (it is a wall-clock
  // value), and the sign convention is unchanged — positive means past, which is
  // what every branch below already assumes.
  const todayKey = localDayKey();
  const thenKey = storedDayKey(dateString);
  if (!thenKey) return "—";
  // Positive = the stored day is in the past.
  const diffDays = calendarDaysBetween(thenKey, todayKey);

  // CHANGED 15 Sep 2026 — real ask, true globally since every future-
  // date display in the app (Clinic Card's "next due"/overdue rows,
  // its PDF export, and anywhere else this shared function is called)
  // routes through this one function: a predicted date used to just
  // say "in the future" — technically true, not actually useful. Now
  // gives the real calendar date plus a relative offset, symmetric
  // with the past branches below ("3 months ago" becomes a real date
  // "(in 3 months)").
  if (diffDays < 0) {
    const futureDays = -diffDays;
    if (futureDays === 0) return "today";
    if (futureDays === 1) return "tomorrow";
    // Formatted from the stored DAY KEY in the UTC frame, and the year is
    // omitted by comparing the STORED year against the user's CURRENT local
    // year. The old line read the year off a shifted instant, so a new-year
    // appointment could print its year on one side of the boundary and not the
    // other.
    const storedYear = Number(thenKey.slice(0, 4));
    const currentYear = Number(todayKey.slice(0, 4));
    const calendarDate = new Date(`${thenKey}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short", day: "numeric", timeZone: "UTC",
      year: storedYear === currentYear ? undefined : "numeric",
    });
    let relative;
    if (futureDays < 7) relative = `in ${futureDays} days`;
    else if (futureDays < 30) { const weeks = Math.round(futureDays / 7); relative = `in ${weeks} week${weeks === 1 ? "" : "s"}`; }
    else if (futureDays < 365) { const months = Math.round(futureDays / 30); relative = `in ${months} month${months === 1 ? "" : "s"}`; }
    else { const years = Math.round(futureDays / 365); relative = `in ${years} year${years === 1 ? "" : "s"}`; }
    return `${calendarDate} (${relative})`;
  }
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "s"} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? "" : "s"} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) === 1 ? "" : "s"} ago`;
}

// Sorts encounters newest-first — the default order for Activity
// Landing (Doc 4 §3a) and any per-contact timeline.
// `when` is an optional accessor for the value to order by, defaulting to the
// record's own `.date`. ADDED 30 Sep 2026 (t034): a vaccination's real date is
// DERIVED (see vaccinationCalculations.js's getVaccinationDate) rather than
// read from a top-level field the dose-series work stopped maintaining, and
// without a way to pass that in the Clinic Card's vaccination list would have
// kept sorting on the stale value. Optional so every existing call site is
// unchanged.
//
// Note the comparison is `new Date(x) - new Date(y)` on two STORED values, which
// is correct here even though stored dates are fake-UTC: both sides carry the
// same offset, so it cancels and this is a true ordering. It is NOT the
// day-count case, where dividing an elapsed span by 86400000 is the anti-pattern
// this project has been bitten by.
export function sortByDateDesc(encounters, when = (x) => x.date) {
  return [...encounters].sort((a, b) => new Date(when(b)) - new Date(when(a)));
}
