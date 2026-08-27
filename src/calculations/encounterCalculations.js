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
  if (!dateString) return "—";
  const d = new Date(dateString);
  const hour = d.getHours();
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

// Relative-date formatting for the Contact Card's "Last Encounter"
// field (B1) and Timeline — "3 weeks ago" style, matching the
// component spec's described format.
export function formatRelativeDate(dateString) {
  if (!dateString) return "—";
  const then = new Date(dateString);
  const now = new Date();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "in the future";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "s"} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? "" : "s"} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) === 1 ? "" : "s"} ago`;
}

// Sorts encounters newest-first — the default order for Activity
// Landing (Doc 4 §3a) and any per-contact timeline.
export function sortByDateDesc(encounters) {
  return [...encounters].sort((a, b) => new Date(b.date) - new Date(a.date));
}
