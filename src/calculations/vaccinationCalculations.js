import { storedDayKey } from "./dateInputHelpers";

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
export const VACCINE_INTERVAL_GUIDANCE = Object.freeze({
  // -----------------------------------------------------------------------
  // ADDED 29 Sep 2026 (t032) — real, sourced UK minimum intervals.
  //
  // THIS TABLE WAS EMPTY ON PURPOSE, and that was correct. It shipped empty
  // because this project has already had to throw out two clinical constants
  // that looked deliberate and turned out to have no source at all, and a
  // wrong interval is not a wrong number on a screen: it is someone
  // concluding a dose they actually received was wasted. Filling it is only
  // legitimate because every entry below carries a document and a date, and
  // a test fails if one ever does not.
  //
  // THE NUMBER IS THE FASTEST VALID UK SCHEDULE, NOT THE ROUTINE ONE. This is
  // the single most important decision in the file. It is a floor, not a
  // target, so it can only ever fire on a dose that is earlier than EVERY
  // schedule the guidance permits. A user on an accelerated or outbreak
  // schedule is therefore never wrongly warned — and that was the entire
  // argument for it, arrived at by pushing back on a second model's claim
  // that a "shortest interval" is unsound.
  //
  // Hep B is the clearest case. UK guidance allows 0,1,6 (routine), 0,1,2,12
  // (accelerated) AND 0, 7 days, 21 days (very rapid, Engerix B only, 18+).
  // An earlier draft of this file used 28/140, taken from the routine
  // schedule — which would have falsely warned on the very rapid one.
  //
  // NO GRACE PERIOD. A second model suggested adding a 4-day grace window and
  // cited it to "CDC/Green Book". Asked for the document, it retracted it: it
  // is a US CDC rule and does not exist in the UK, where the published
  // minimum is the limit. Do not reintroduce a tolerance here without a UK
  // citation, for the same reason the 0.8 and 0.2 medication constants were
  // removed.
  // -----------------------------------------------------------------------

  "Hepatitis A": {
    floor: { 1: 180 },
    // 0, 6-12 months. A single dose is also used in some circumstances
    // (outbreaks, over 40s with chronic liver disease) - the app stores no
    // schedule, so a one-dose course simply never trips this.
    source: "UKHSA Green Book, chapter 17 (Hepatitis A), updated 15 January 2024",
    sourceUrl: "https://www.gov.uk/government/publications/hepatitis-a-the-green-book-chapter-17",
    checkedOn: "2026-09-29",
  },

  "Hepatitis B": {
    floor: { 1: 7, 2: 14 },
    routine: { 1: 28, 2: 140 },
    // 0,1,6 routine; 0,1,2,12 accelerated; 0, 7 days, 21 days very rapid
    // (Engerix B only, aged 18+, used for rapid protection e.g. PWID and
    // prison). There is NO routine booster for immunocompetent adults who
    // completed a primary course - a 5-year booster is for people who inject
    // drugs and healthcare/lab workers only, so the app must never imply one.
    source: "UKHSA Green Book, chapter 18 (Hepatitis B), updated 24 February 2026",
    sourceUrl: "https://www.gov.uk/government/publications/hepatitis-b-the-green-book-chapter-18",
    checkedOn: "2026-09-29",
  },

  "Hepatitis A/B": {
    floor: { 1: 7, 2: 14 },
    routine: { 1: 28, 2: 140 },
    // Twinrix and equivalents: a combined product, scheduled as hepatitis B
    // because that is the schedule the same antigens are given on. In the
    // app's own seed data as "Hepatitis A/B vaccine (Twinrix)".
    source:
      "UKHSA Green Book, chapter 18 (Hepatitis B), updated 24 February 2026 - combined Hep A/B products follow the hepatitis B schedule",
    sourceUrl: "https://www.gov.uk/government/publications/hepatitis-b-the-green-book-chapter-18",
    checkedOn: "2026-09-29",
  },

  HPV: {
    floor: { 1: 28, 2: 28 },
    // 3-dose schedule for people who are HIV-positive or immunosuppressed is
    // 0, 1, 4-6 months. The dose 2 -> 3 minimum is ONE month, not three: the
    // guidance allows a 1-month gap where a patient is unlikely to return,
    // so storing 3 months would falsely warn on a legitimate dose.
    // Note also that the UK routine schedule became a SINGLE dose for
    // eligible under-25s from 1 September 2023, so one HPV dose is often a
    // complete course. The app therefore says NOTHING about completeness.
    source: "UKHSA Green Book, chapter 18a (HPV), updated 20 June 2023",
    sourceUrl: "https://www.gov.uk/government/publications/human-papillomavirus-hpv-the-green-book-chapter-18a",
    checkedOn: "2026-09-29",
  },

  Mpox: {
    floor: { 1: 28 },
    // MVA-BN. The guidance states 28 days is the minimum interval required
    // for a sufficient immune response, and that a dose given sooner may
    // lead to a reduced response.
    source:
      "UKHSA Green Book, chapter 29 (Smallpox and mpox) / GOV.UK mpox vaccination: information for healthcare practitioners",
    sourceUrl:
      "https://www.gov.uk/government/publications/vaccination-against-mpox-information-for-healthcare-practitioners",
    checkedOn: "2026-09-29",
  },

  // The SAME product (4CMenB / Bexsero) used for two different indications
  // with different courses, which is why these are two separate entries and
  // not one. Merged, a user's first gonorrhoea dose reads as a meningitis B
  // booster. They are separate options in the app's own vaccine list, and the
  // seed data already titles them "... vaccine (4CMenB)".
  "Meningitis B": {
    floor: { 1: 28, 2: 28 },
    // 2 primary doses at least 4 weeks apart, then a booster at least 4
    // weeks after dose 2, on or after the first birthday. Bexsero and
    // Trumenba are NOT interchangeable - 28 days between them.
    source: "UKHSA 4CMenB Patient Group Direction v8.0, valid from 1 July 2025 (Green Book chapter 22)",
    sourceUrl:
      "https://www.england.nhs.uk/east-of-england/wp-content/uploads/sites/47/2025/06/PGD19_MenB-v8.0_July2025.pdf",
    checkedOn: "2026-09-29",
  },

  Gonorrhoea: {
    floor: { 1: 28 },
    // 4CMenB given to prevent gonorrhoea in GBMSM. A national selective
    // programme from 1 August 2025. Two doses, at least 4 weeks apart, NO
    // booster. The guidance is explicit that there is no licensed vaccine
    // against N. gonorrhoeae and that this is a second use of a MenB vaccine.
    source: "UKHSA Green Book, Gonorrhoea chapter, 11 June 2025",
    sourceUrl: "https://www.gov.uk/government/publications/gonorrhoea-the-green-book-chapter",
    checkedOn: "2026-09-29",
  },
});

/** Normalised lookup, because the app's option list is free text. */
const GUIDANCE_BY_NORMALISED_NAME = new Map(
  Object.entries(VACCINE_INTERVAL_GUIDANCE).map(([name, entry]) => [
    name.trim().toLowerCase(),
    entry,
  ]),
);

/**
 * Sourced minimum interval for a vaccine, or null.
 *
 * FAIL-CLOSED AND EXACT ON PURPOSE. This is a clinical number, so a loose
 * match is how you get the wrong vaccine: a substring rule once made
 * "Hepatitis A" resolve to the hepatitis B entry, which would have warned
 * about the wrong vaccine entirely. Matching here is exact after trimming
 * and lowercasing, and anything unrecognised returns null so the notice
 * simply does not claim a gap. Silence is the correct answer when the app
 * does not know what was given.
 */
export function getIntervalGuidance(vaccineName) {
  if (typeof vaccineName !== "string") return null;
  return GUIDANCE_BY_NORMALISED_NAME.get(vaccineName.trim().toLowerCase()) || null;
}


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
export function getEarlyDoseNotice(doses, index, vaccineName) {
  if (!Array.isArray(doses) || index == null) return null;
  const current = doses[index];
  const previous = doses[index - 1];
  if (!current || !previous) return null;

  const day = (v) =>
    typeof v === "string" && v.length >= 10 && v.slice(4, 5) === "-" && v.slice(7, 8) === "-"
      ? v.slice(0, 10)
      : "";
  const given = day(current.date);
  if (!given) return null;

  // ---------------------------------------------------------------------
  // FIXED 29 Sep 2026 (t032) — THE TABLE WAS STRUCTURALLY UNREACHABLE.
  //
  // This function read `previous.vaccineName`, but doses do not carry that
  // field — the vaccine name lives on the RECORD. So the lookup was always
  // `undefined`, `guidance` was always null, and the sourced interval could
  // never be consulted no matter what was in the table. Filling the table
  // alone would have changed nothing at all. It is the same failure this
  // project has been bitten by twice: a value computed in one file with no
  // copy of it anywhere the consumer could see.
  //
  // So the name is now passed in by the caller, from the record.
  // ---------------------------------------------------------------------
  const guidance = getIntervalGuidance(vaccineName);

  // Sourced FLOOR check: is this dose closer to the previous one than the
  // fastest valid UK schedule allows? This is the only part of the feature
  // that rests on a clinical number, and it is a sufficient condition - a
  // dose below the floor is outside every schedule the guidance permits, so
  // it cannot fire on a legitimate dose.
  //
  // dosePosition is 1 for the second dose, 2 for the third, and so on.
  const dosePosition = index;
  const previousDate = day(previous.date);
  if (previousDate) {
    const floor = guidance?.floor?.[dosePosition] ?? null;
    if (Number.isFinite(floor)) {
      const gapDays = Math.round(
        (Date.parse(`${given}T00:00:00Z`) - Date.parse(`${previousDate}T00:00:00Z`)) / 86400000,
      );
      if (gapDays >= 0 && gapDays < floor) {
        return {
          kind: "below-minimum",
          gapDays,
          minIntervalDays: floor,
          // The day count is deliberately NOT returned for display. A second
          // model was right about this: on a mis-keyed date "42 days early"
          // is noise, and on a near-miss it manufactures disproportionate
          // anxiety. The number is used to decide, not to scold with.
          guidance,
        };
      }
    }
  }

  const expected = day(previous.nextDue);
  // No due date on the previous dose, so there is no schedule to be early
  // against - the honest answer is silence, not a warning about nothing.
  if (!expected) return null;
  if (given >= expected) return null;

  // Calendar-day difference, not elapsed milliseconds: the two values are
  // plain YYYY-MM-DD dates, and dividing a DST-crossing span by 86400000 to get
  // a day count is the exact bug this project recorded in medication
  // adherence. Both sides parse as UTC midnight, so this is whole days.
  const daysEarly = Math.round(
    (Date.parse(`${expected}T00:00:00Z`) - Date.parse(`${given}T00:00:00Z`)) / 86400000,
  );
  if (!(daysEarly > 0)) return null;

  return { kind: "before-due-date", daysEarly, expectedOn: expected, guidance };
}
// getVaccinationDate — the ONE place that answers "when was this vaccination
// given?", because five consumers had each grown their own answer and they
// disagreed.
//
// THE BUG (pool t034)
//
// The vaccine record moved from one flat date to a dose series. The migration
// copies the old flat fields into a single-element doses[] and DELETES
// injectionSite/provider/nextDue/doseNumber — but deliberately leaves the
// top-level `date`, because other code read it. The edit form now writes ONLY
// dose dates. So the top-level date has two states, and both are wrong:
//
//   1. A record created since the series landed has NO top-level date at all.
//      calendarCalculations.js filtered on `v.date`, so a vaccination the user
//      had genuinely recorded was SILENTLY ABSENT from the phone calendar —
//      the one consumer that leaves the device. monthLabel(undefined) returns
//      "Undated", so it also filed itself under an Undated heading.
//
//   2. A record whose doses were edited keeps the pre-series date forever. Five
//      consumers read that stale value — the Clinic Card timeframe filter and
//      sort, the Vaccinations month grouping, Global Search's subtitle AND its
//      sort date, and the calendar — while the Clinic Card DISPLAY already
//      showed the derived value via getVaccinationNextDue. So the card's own
//      section heading and its own rows disagreed with each other.
//
// This is the same class as the reminder break documented at the top of this
// file: a value with two owners, where one of them stopped being maintained.
// That break is why this is a single exported function rather than five
// call-site patches.
//
// WHY "LATEST NON-SUPERSEDED DOSE", not just "latest dose"
// -------------------------------------------------------
// isDoseDateSuperseded() already exists and says a dose row is void when a LATER
// row in the series has actually been given - that is what happens when someone
// restarts a course or corrects an entry. A superseded dose is not a dose the
// record should be dated by, so the answer has to skip it. This was the one
// design question put to a second model, which agreed: a void dose is not the
// clinical date of the vaccination.
//
// THE RETURNED SHAPE, and why it is not simply the dose's string
// -----------------------------------------------------------
// A dose date comes from <input type="date">, so it is "YYYY-MM-DD". The
// top-level legacy date is a full fake-UTC timestamp. Those two cannot be
// compared with `>=` as strings: "2026-09-01" >= "2026-09-01T00:00:00.000Z" is
// FALSE, because the shorter string sorts first, so a record sitting exactly on
// a "last 30 days" boundary is dropped. Returning one consistent stored-frame
// shape removes that trap for every caller at once, rather than leaving five
// places to each remember it.

/**
 * Normalise any stored date shape to one comparable stored-frame value.
 *
 * `time` is the dose's own HH:mm when there is one. Otherwise the time is taken
 * from the value itself if it carries one - which matters for the legacy
 * top-level date, a full "2025-11-04T09:00:00.000Z". Discarding that and
 * rebuilding from the day key alone turned a 09:00 vaccination into midnight,
 * which is the wrong time on a calendar event. Found by this derivation's own
 * test, not by reading the code: the first version returned 00:00 for a legacy
 * record whose stored value plainly said 09:00.
 */
function toStored(value, time) {
  const day = storedDayKey(value);
  if (!day) return null;
  const fromDose = typeof time === "string" && /^\d{2}:\d{2}$/.test(time) ? time : null;
  // slice(11,16) is the "HH:mm" of a full timestamp, and "" for a date-only
  // value. Index 11, not 10: position 10 is the "T" separator, so slice(10,16)
  // yields "T09:00" and fails the check below. That off-by-one passed my eye
  // twice and was caught only because the test asserted a real clock time.
  const fromValue = value.length >= 16 && /^\d{2}:\d{2}$/.test(value.slice(11, 16)) ? value.slice(11, 16) : null;
  return `${day}T${fromDose || fromValue || "00:00"}:00.000Z`;
}

/**
 * When was this vaccination given?
 *
 * Returns a stored-frame fake-UTC string, or null when the record genuinely has
 * no usable date — the caller decides what to show, and `monthLabel` already
 * renders null as an honest "Undated" rather than dropping the record.
 */
export function getVaccinationDate(vaccination) {
  if (!vaccination) return null;

  const doses = Array.isArray(vaccination.doses) ? vaccination.doses : [];

  // The LATEST DATED DOSE, chosen by maximum date rather than by taking the last
  // row.
  //
  // The first version walked backwards from the end of the array and returned the
  // first row it found with a date. That has two problems, and mutation testing
  // is what found both.
  //
  // 1. It assumed the rows are in date order. Someone adding doses
  //    retrospectively, or correcting an entry, can leave them out of order -
  //    and then "last row" is not "latest date", so a record would be dated by
  //    the wrong dose. Maximum-by-date is order-independent and cannot be wrong
  //    that way.
  //
  // 2. It carried an `isDoseDateSuperseded` check that could never be false on
  //    the row it actually returned. Superseded means "some LATER row has a
  //    date", so walking backwards the first dated row you meet is by definition
  //    not superseded - the check was unreachable, and deleting it changed no
  //    behaviour at all. The "latest non-superseded" rule is not a separate
  //    filter to apply here; it IS the maximum date, because a superseded dose
  //    is always an earlier one. That is why the rule Gemini was asked to confirm
  //    needs no code of its own.
  let best = null;
  let bestDay = null;
  for (const d of doses) {
    if (!d || typeof d.date !== "string") continue;
    const day = storedDayKey(d.date);
    if (!day) continue;
    if (bestDay === null || day > bestDay) { bestDay = day; best = d; }
  }
  if (best) return toStored(best.date, best.time);

  // Legacy fallback: a record that predates the dose series, or one whose
  // migration has not run yet, still carries the value at the top level.
  return toStored(vaccination.date, null);
}
