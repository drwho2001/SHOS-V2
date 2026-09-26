// Pure vaccination derived-state helpers.
//
// ADDED 25 Sep 2026 after an audit found a real, silent break introduced by
// the dose-by-dose series work: `nextDue` was migrated from a top-level
// field into per-dose `doses[].nextDue`, and migrateLegacyVaccinationFields()
// DELETES the top-level field. But eleven read sites still read the old
// top-level `v.nextDue`, so they silently saw `undefined` on every record
// written since the series landed - including the seeded Hepatitis A/B
// booster.
//
// The observable symptom was exactly that: the per-dose "Next due" line in
// the detail view rendered correctly (it reads `dose.nextDue`), while the
// reminder never fired, the overdue counts stayed at zero, the list rows
// showed no date, and Clinic Card showed nothing. One denormalised field
// had quietly split into two truths.
//
// Rather than write the denormalised field back (which is how the two truths
// drifted apart in the first place, and would need its own migration the
// next time the shape changed), this derives the value on read from the
// single source of truth - the dose series - with a fallback to the legacy
// top-level field so any record that somehow still carries one keeps
// working. This is the same "store facts, derive state" rule the rest of the
// app already follows for testing status, adherence and stock.
//
// No I/O here, per the repository/calculation/sync split: callers load the
// records and pass them in.

/**
 * Every non-empty next-due date on a vaccination, oldest first.
 *
 * `nextDue` is a plain "YYYY-MM-DD" calendar date (a <input type="date">
 * value), NOT this app's fake-UTC full-datetime convention - there's no
 * time of day recorded, so plain string comparison is both correct and
 * chronological for this format.
 *
 * Values are normalised to their first 10 characters on the way out. Real
 * records - including this app's own seed data until 25 Sep 2026 - stored a
 * full ISO string here instead, and a datetime compares and sorts as a
 * different length of string than a bare date, which quietly broke both the
 * ordering and the "is it in the past" checks. Normalising at the single
 * point every consumer reads through fixes all of them at once.
 */
export function getDoseNextDueDates(vaccination) {
  if (!vaccination) return [];
  const asDay = (v) =>
    typeof v === "string" && v.length >= 10 && v.slice(4, 5) === "-" && v.slice(7, 8) === "-"
      ? v.slice(0, 10)
      : "";
  const doses = Array.isArray(vaccination.doses) ? vaccination.doses : [];
  const fromDoses = doses.map((d) => asDay(d && d.nextDue)).filter(Boolean);
  // Legacy fallback: a record that predates the dose series (or one whose
  // migration hasn't run yet) still carries the value at the top level.
  const legacy = asDay(vaccination.nextDue);
  return [...new Set([...fromDoses, ...(legacy ? [legacy] : [])])].sort();
}

/**
 * The single date that represents "when is this vaccination next due" -
 * the earliest one across the whole series.
 *
 * Earliest (not soonest-future) is deliberate and matches how every
 * consumer already behaved: the overdue checks, the list rows and the
 * reminder all wanted the date that has passed or passes first, and a
 * multi-dose course whose earliest date is still outstanding genuinely IS
 * the thing to surface.
 */
export function getVaccinationNextDue(vaccination) {
  const dates = getDoseNextDueDates(vaccination);
  return dates.length ? dates[0] : null;
}

/**
 * Is this vaccination overdue as of `today` ("YYYY-MM-DD")?
 * True only when a next-due date exists and is in the past.
 *
 * `today` defaults to the current date, so a caller checking a record
 * against "now" cannot accidentally compare against `undefined` and get a
 * silently-always-false answer - which is exactly the class of failure this
 * whole file exists to undo.
 */
export function isVaccinationOverdue(vaccination, today) {
  const nextDue = getVaccinationNextDue(vaccination);
  if (!nextDue) return false;
  const day = today || new Date().toISOString().slice(0, 10);
  return nextDue < day;
}

/**
 * The soonest still-relevant due date across many vaccinations, ignoring
 * archived ones. Returns the record plus its date, or null.
 *
 * Shared by the reminder's own scheduling and App.jsx's in-app due banner
 * so the two can never disagree about which record is due first.
 */
export function soonestDueVaccination(vaccinations, today) {
  const candidates = (vaccinations || [])
    .filter((v) => v && !v.isArchived)
    .map((v) => ({ vaccination: v, nextDue: getVaccinationNextDue(v) }))
    .filter((x) => x.nextDue)
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0));
  if (candidates.length === 0) return null;
  // Past-due records sort first, which is what both the reminder and the
  // banner want; `today` is accepted for callers that need to reason about
  // staleness and is deliberately not used to filter here.
  void today;
  return candidates[0];
}
