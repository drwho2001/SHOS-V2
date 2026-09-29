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
 * Every next-due date on a vaccination that is still OUTSTANDING, oldest first.
 *
 * A next-due date on a dose that has since been followed by another dose in the
 * same series is not outstanding, and is excluded - see the note inside.
 *
 * `nextDue` is a plain "YYYY-MM-DD" calendar date (an <input type="date">
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
  // Legacy fallback: a record that predates the dose series (or one whose
  // migration hasn't run yet) still carries the value at the top level.
  const legacy = asDay(vaccination.nextDue);

  // ADDED 29 Sep 2026 — real report from the owner, twice. The first report was
  // that a vaccine reminder kept firing after a second dose was logged. The
  // second was sharper: the second dose had been logged TWO DAYS BEFORE the
  // first dose's due date, and the reminder still fired.
  //
  // THE FIRST FIX WAS WRONG IN ITS REASONING, and the second report is what
  // showed it. That fix dropped a `nextDue` only when some dose in the series
  // was given ON OR AFTER it — reasoning that a dose given early cannot have
  // satisfied a later due date, "because the app does not know when dose 3 is
  // expected". True, and irrelevant. The question is not whether the LATER date
  // has been satisfied; it is whether the EARLIER dose still needs doing. Once
  // a later dose exists in the series, it does not — you had the dose, early or
  // not. And taking a dose early is ordinary, not an edge case: nobody waits for
  // the exact date a reminder tells them about.
  //
  // THE OVER-CORRECTION WAS ALSO WRONG, and a long-standing test caught it. The
  // first attempt at the fix took ONLY the last dose's `nextDue`, which reads as
  // clean and obvious and silently breaks a course where no dose has been given
  // yet: a user who has entered the whole schedule up front and had dose 1 has
  // nothing done, so the earliest date is genuinely still outstanding. The rule
  // that satisfies all three shapes is stated here rather than arrived at again:
  //
  //   A dose's nextDue is superseded by a LATER DOSE IN THE SERIES HAVING BEEN
  //   GIVEN. The only dates that can be outstanding are the last dose that was
  //   actually given (its own nextDue, the "what happens after this one" date)
  //   plus anything after it. The earliest of those is the answer.
  //
  // Note what this is NOT: a comparison between two dates. Both earlier attempts
  // compared dates and both were wrong, in opposite directions — one kept
  // nagging after an early dose, the other silenced a course nobody had started.
  // Series POSITION is the thing that actually carries the meaning here, and
  // "given at all" is a property of the row, not of a comparison against it.
  //
  // `doseNumber` is the series order, with array position as the fallback for a
  // row that has not been numbered — the editor numbers as doses are added, and
  // a hand-edited or legacy row may not have one.
  if (!doses.length) return legacy ? [legacy] : [];

  const ordered = doses
    .map((d, i) => ({ d, i }))
    .sort((a, b) => {
      const na = Number(a.d && a.d.doseNumber);
      const nb = Number(b.d && b.d.doseNumber);
      const ha = Number.isFinite(na) ? na : a.i;
      const hb = Number.isFinite(nb) ? nb : b.i;
      return ha - hb;
    })
    .map((x) => x.d);

  // The last dose that has actually been given. With none given, this is -1 and
  // every row stays a candidate, which is what a pre-planned course needs.
  let lastGiven = -1;
  ordered.forEach((d, i) => {
    if (asDay(d && d.date)) lastGiven = i;
  });

  const candidates = ordered
    // Math.max, not raw: with no dose given lastGiven is -1, and `slice(-1)`
    // would mean "the last element" rather than "from the start" - which is
    // exactly the over-corrected behaviour this is replacing.
    .slice(Math.max(0, lastGiven))
    .map((d) => asDay(d && d.nextDue))
    .filter(Boolean);
  if (candidates.length) return [...new Set(candidates)].sort();

  // Nothing in the series carries a date, so the only other candidate is the
  // legacy top-level field. Kept defensively: a pre-migration record should not
  // lose its reminder because a dose row was added.
  //
  // But it still has to survive the same fulfilment check, or a record whose
  // migration never ran would carry a stale date forever - the original bug, in
  // the one shape where there is no per-dose date to reason about. A legacy date
  // that a dose in this series was given on or after has been done.
  if (!legacy) return [];
  const givenDays = ordered.map((d) => asDay(d && d.date)).filter(Boolean);
  if (givenDays.some((given) => given >= legacy)) return [];
  return [legacy];
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
 * archived ones. Returns { vaccination, nextDue } — an object rather than
 * the bare record, so a caller cannot accidentally read a date off a
 * record that no longer has one.
 *
 * "Soonest" includes already-overdue records on purpose: the past-due one
 * genuinely is the next thing that needs attention, and both the reminder
 * and the in-app banner want it first. A record whose due date has passed
 * is therefore returned, not filtered out.
 */
export function soonestDueVaccination(vaccinations) {
  return (vaccinations || [])
    .filter((v) => v && !v.isArchived)
    .map((v) => ({ vaccination: v, nextDue: getVaccinationNextDue(v) }))
    .filter((x) => x.nextDue)
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0))[0] || null;
}

/**
 * Has THIS dose's next-due date been superseded - i.e. did a later dose in the
 * series actually happen?
 *
 * ADDED 29 Sep 2026 after the reminder fix above, and it exists because the
 * detail view was still labelling a superseded date "OVERDUE" in red. The
 * reminder had stopped firing correctly, but the record underneath it still
 * said OVERDUE, which is the one thing a user cannot ignore and exactly the
 * wrong thing to tell them. Fixing a calculation and not the text that renders
 * it leaves the report half-done, and a green unit test on the calculation
 * would not have caught it - it takes a real browser reading the real screen.
 *
 * This is the same rule as the one in getDoseNextDueDates, asked per dose
 * rather than for the record. It is a separate function on purpose: the
 * question "is any of this outstanding?" and the question "is THIS particular
 * line still live?" are different, and a to-clever fix that derives the second
 * from the first is how the red text ended up wrong in the first place.
 */
export function isDoseDateSuperseded(doses, index) {
  if (!Array.isArray(doses) || index == null) return false;
  const hasDate = (d) =>
    d && typeof d.date === "string" && d.date.length >= 10;
  // Any LATER row, in series order, that has actually been given.
  return doses.slice(index + 1).some(hasDate);
}

/**
 * CLINICAL VACCINE INTERVAL GUIDANCE — DELIBERATELY EMPTY.
 *
 * Shape if it is ever filled: `{ "Hepatitis B": { minIntervalDays: 28,
 * source: "<where the number came from>", note: "<what it means>" } }`, keyed
 * by the vaccine name this app already stores.
 *
 * It is empty on purpose, and that is the decision, not an oversight.
 *
 * The owner asked for a warning "if outside BASHH or other clinical
 * recommendations". To honour that literally I would have to write down
 * minimum intervals for Hep A, Hep B and 4CMenB from memory, and this project
 * has already caught and thrown out two unsourced clinical constants that
 * looked deliberate - the 0.8 dose-lockout fraction and the 0.2 OF-interval
 * lateness figure, both replaced once someone traced where their numbers came
 * from and found nothing. A wrong interval here is not a wrong number on a
 * screen: it is a user concluding a dose they actually received was
 * insufficient, or that a course is invalid. That is a health consequence
 * manufactured by a number nobody sourced.
 *
 * So the detection below is real and the verdict is not invented. `getEarlyDoseNotice`
 * reports the arithmetic fact the app can prove from the user's OWN data - this
 * dose was logged before the previous dose's own stated due date - and says
 * nothing about whether that is medically wrong. When an entry is added here
 * WITH a source, the notice picks it up automatically and gains the "outside
 * the recommended interval" sentence; until then it points at the clinic.
 */
export const VACCINE_INTERVAL_GUIDANCE = Object.freeze({});

/**
 * Was a dose logged EARLIER than the previous dose's own stated due date?
 *
 * ADDED 29 Sep 2026 — the same owner report that produced the next-due rule
 * above: a second dose was logged two days before the first dose's due date.
 * The reminder fix was the important half; this is the half that tells them it
 * happened, because the fix is silent and a silent fix reads as "the app had it
 * right all along".
 *
 * It is an ADVISORY, never a block, for the same reason `doseTimingAdvisory()`
 * is one on the medication side: a user recording something that genuinely
 * happened must never be told they cannot. A person who had the dose early -
 * because they were offered one, were travelling, or simply had it to hand -
 * is recording a fact, not making a mistake, and the record has to stay
 * recordable. The worst outcome of this feature would be someone who genuinely
 * had a dose being unable to log it.
 *
 * Returns `null` when there is nothing to say, or
 * `{ kind, daysEarly, expectedOn, guidance }` where `guidance` is the sourced
 * entry when one exists and `null` otherwise.
 *
 * Only the dose IMMEDIATELY before is consulted. A course is a sequence, not a
 * single interval, and comparing a third dose against a first dose's date would
 * report every well-formed course as early.
 */
export function getEarlyDoseNotice(doses, index) {
  if (!Array.isArray(doses) || index == null) return null;
  const current = doses[index];
  const previous = doses[index - 1];
  if (!current || !previous) return null;

  const day = (v) =>
    typeof v === "string" && v.length >= 10 && v.slice(4, 5) === "-" && v.slice(7, 8) === "-"
      ? v.slice(0, 10)
      : "";
  const given = day(current.date);
  const expected = day(previous.nextDue);
  // No due date on the previous dose, so there is no schedule to be early
  // against - the honest answer is silence, not a warning about nothing.
  if (!given || !expected) return null;
  if (given >= expected) return null;

  // Calendar-day difference, not elapsed milliseconds: the two values are
  // plain YYYY-MM-DD dates, and dividing a DST-crossing span by 86400000 to get
  // a day count is the exact bug this project recorded in medication adherence.
  const daysEarly = Math.round(
    (Date.parse(`${expected}T00:00:00Z`) - Date.parse(`${given}T00:00:00Z`)) / 86400000,
  );
  if (!(daysEarly > 0)) return null;

  const guidance = VACCINE_INTERVAL_GUIDANCE[previous.vaccineName] || null;
  return { kind: "early", daysEarly, expectedOn: expected, guidance };
}
