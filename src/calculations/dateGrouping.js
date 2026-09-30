// ADDED — real ask: desktop card grids for date-based record lists
// (Episodes, Encounters, Testing, Clinic Visits, Vaccinations, Symptom
// Log, Attachments) read as "cluttered" once converted from a single
// column to a multi-column grid — grouping consecutively by month, with
// a subheading per group, breaks a long grid into readable chunks
// without re-sorting anything the module's own list already sorted.
//
// Deliberately CONSECUTIVE grouping, not a full re-bucket-then-sort —
// several of these lists have a real, intentional primary sort ahead of
// date (e.g. Episodes puts open episodes before resolved ones, Symptom
// Log splits Active/Resolved into separate sections). Grouping by
// contiguous run of the same key naturally respects that: an "Open" or
// non-chronological run stays its own single group instead of being
// scattered across date-based buckets.
export function groupConsecutive(items, getKey) {
  const groups = [];
  let current = null;
  for (const item of items) {
    const key = getKey(item);
    if (!current || current.key !== key) {
      current = { key, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }
  return groups;
}

// A stored date/datetime string or Date -> "September 2026". Returns
// "Undated" for anything that doesn't parse, so a record with a blank/
// malformed date still renders (in its own honestly-labeled group)
// rather than being silently dropped.
//
// FIXED 30 Sep 2026 - the missing `timeZone: "UTC"`, which is the whole defect
// in one property. This function reads STORED dates, which in this app are
// fake-UTC: the digits are the user's own wall-clock time and the trailing "Z"
// is a deliberate lie (see dateInputHelpers.js's header). Reading one back
// without naming the frame hands it to the device's LOCAL zone, which re-applies
// the real UTC offset to digits that were never in UTC. A vaccination logged at
// 23:30 on 31 August is therefore read as 1 September in London and grouped
// under the wrong month, in a heading a clinician reads.
//
// Every one of the eight call sites passes a record date - a.date, v.date,
// e.date, e.dateStarted, e.dateResolved, t.date, resolvedDate - and none
// passes a real instant, so naming the frame here is unambiguous. `timeZone:
// "UTC"` is exactly what formatStoredDate does for the same reason.
//
// Found while chasing a different vaccination bug: dateGrouping.js is a
// calculations/ file that the storedDateRenderGuard does not scan, so the guard
// that exists specifically to catch this could not see it. It is added to that
// guard's scope in the same change.
export function monthLabel(dateInput) {
  if (!dateInput) return "Undated";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "Undated";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
