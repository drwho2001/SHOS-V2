// clinicVisitShape.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Pure derivation: given why the user came to a clinic visit, which parts of the
// visit form actually apply. No I/O, no storage, no React.
//
// WHY THIS FILE EXISTS
// --------------------
// Added 1 Oct 2026 during the t053 "one owner per derived fact" work, as the
// agreed first step of the owner's "why did you come today?" idea.
//
// `reasonForVisit` has existed on the clinic visit record since the start - a
// multi-select drawn from a user-extensible option list, seeded with real values
// like "Routine screening", "PrEP review", "Vaccination", "Treatment". But it
// was INERT: it appeared in the form, in the read view and in search, and
// selecting any combination caused nothing else on the form to appear.
//
// The owner's framing: "each section may benefit from a quick screen question
// that guides... it should tell a story and not overload the user."
//
// This file is that guidance, expressed as data. The form asks the question once,
// up front, and reveals only the sections the answer implies.
//
// THREE DESIGN DECISIONS, EACH DELIBERATE
// ----------------------------------------
// 1. MULTI-SELECT IS CORRECT, NOT A BUG. The owner's reason for keeping it: "no,
//    multiple reasons may be true - ie testing & vaccination, or prep review &
//    testing." A single-select leading question cannot express that, so the
//    groups below are a UNION over the selected reasons rather than a branch.
//    An earlier draft of this plan proposed single-select; that was wrong.
//
// 2. THE OVERLAP IS THE POINT. "Testing" is implied by three separate reasons
//    (routine screening, PrEP review, and a test-related treatment follow-up).
//    That shared membership is exactly why the option lists overlap, so the
//    mapping is many-reasons-to-some-groups rather than a tree.
//
import { realTimestampFromStored } from "./dateInputHelpers.js";

// 3. AN UNRECOGNISED REASON MUST NEVER HIDE ANYTHING. `reasonForVisit` is a
//    CUSTOM OPTION LIST - the owner can add values from inside the app, without a
//    code change (see customOptionListsRepository.js). So this mapping will go
//    stale the moment a reason is added that isn't listed below, and a stale
//    mapping that HIDES a section would silently swallow whatever the user had
//    typed into it. An unmapped reason therefore contributes no groups, which
//    means every section stays visible - the safe direction. There is a test
//    pinning exactly this, because it is the failure mode that would be
//    invisible until a user lost data.

/**
 * Every group the visit form can reveal, in the order the form shows them.
 *
 * The order is the visit STORY, which was the owner's word for it: a screening
 * or vaccination attendance tests and immunises, medication is what was supplied
 * or reviewed, and symptoms are what was discussed. So a Routine-screening visit
 * reads "tests, then anything else that applies" rather than an arbitrary
 * alphabetical or insertion order.
 *
 * Pinned by a test because the order is now user-visible: changing it silently
 * would reshuffle sections on every existing visit.
 */
export const CLINIC_VISIT_GROUPS = ["testing", "vaccination", "medication", "symptoms"];

/**
 * Reason -> the groups that reason implies.
 *
 * Keys are matched EXACTLY and case-insensitively against the stored value.
 * An absent key means "implies nothing", which hides nothing.
 */
const REASON_GROUPS = {
  // A screening attendance's whole point is the test.
  "routine screening": ["testing"],
  // PrEP review means the drug AND the monitoring tests that go with it.
  "prep review": ["testing", "medication"],
  // A vaccination visit may also be a screening opportunity - hence testing.
  vaccination: ["vaccination", "testing"],
  // Treatment is the medication conversation; a follow-up test is part of it.
  treatment: ["medication", "testing"],
  // Refilling is medication supply, nothing else.
  "doxy refill": ["medication"],
  symptoms: ["symptoms"],
  // Pregnancy care has no group of its own yet. It deliberately maps to nothing
  // rather than to something invented - see the note below.
  "pregnancy care": [],
  // "Other" is the free-text escape hatch. It must not imply anything.
  other: [],
};

/**
 * The groups implied by a set of reasons.
 *
 * Union, never intersection: selecting "Routine screening" + "Vaccination"
 * reveals BOTH the testing and vaccination sections, because both are true.
 *
 * @param {string[]} [reasons] the stored `reasonForVisit` values
 * @returns {string[]} the applicable groups, in CLINIC_VISIT_GROUPS order
 */
export function fieldGroupsForReasons(reasons) {
  if (!Array.isArray(reasons) || reasons.length === 0) return [];
  const implied = new Set();
  for (const raw of reasons) {
    if (typeof raw !== "string") continue;
    const key = raw.trim().toLowerCase();
    const groups = REASON_GROUPS[key];
    // Absent key: contributes nothing. Deliberately not an error and
    // deliberately not a fallback to every group - see decision 3.
    if (!groups) continue;
    for (const g of groups) implied.add(g);
  }
  // Returned in the canonical order rather than Set insertion order, so the form
  // does not reshuffle its sections depending on which order reasons were clicked.
  return CLINIC_VISIT_GROUPS.filter((g) => implied.has(g));
}

/**
 * Whether a group is currently applicable.
 *
 * @param {string} group
 * @param {string[]} [reasons]
 * @returns {boolean}
 */
export function isGroupApplies(group, reasons) {
  return fieldGroupsForReasons(reasons).includes(group);
}

/**
 * Whether the form should reveal its guided sections at all.
 *
 * With no reason chosen there is nothing to guide by, so every section stays
 * visible - an untouched form must not look broken or empty. This is also what
 * makes the feature safe to roll out: an existing visit whose reasons are absent
 * or unrecognised renders exactly as it does today.
 *
 * @param {string[]} [reasons]
 * @returns {boolean}
 */
export function shouldGuideForm(reasons) {
  return fieldGroupsForReasons(reasons).length > 0;
}

/**
 * The fields each group OWNS - one table, shared by gating and by clearing.
 *
 * This is deliberately the single source of truth for both. The form's JSX gates
 * render these fields; `clearPlan` clears these fields. If they were two lists
 * they could drift, and the failure would be silent and destructive: a field
 * rendered inside a gate that the clearing pass does not know about would be
 * HIDDEN while keeping its value - the exact stale-data-behind-a-hidden-field
 * case this whole audit exists to find.
 *
 * `empty` is the value that field takes when cleared, which differs by type:
 * arrays to `[]`, the single string id to `""`.
 */
const GROUP_FIELDS = {
  testing: [{ key: "linkedTestIds", label: "Linked tests", empty: [] }],
  vaccination: [{ key: "vaccinationsGivenIds", label: "Vaccinations given", empty: [] }],
  medication: [
    { key: "medicationsGivenIds", label: "Medications given in clinic", empty: [] },
    { key: "adHocMedicationsGiven", label: "One-off medications given", empty: [] },
    { key: "takeHomeMedications", label: "Medications to take home", empty: [] },
  ],
  symptoms: [
    { key: "symptomTypeIds", label: "Symptom types discussed", empty: [] },
    { key: "symptomsDiscussedIds", label: "Symptom entries discussed", empty: [] },
    { key: "primaryReasonSymptomLogId", label: "Primary reason symptom", empty: "" },
  ],
};

/** The field descriptors a group owns. Exported so a guard can assert on them. */
export function fieldsForGroup(group) {
  return GROUP_FIELDS[group] || [];
}

/** True when a stored value counts as "the user filled this in". */
function hasContent(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

/**
 * Groups that applied under the old reasons but not under the new ones.
 *
 * Only ever a SHRINKING set: adding a reason reveals more, so it can never drop
 * a group. That is what makes the rule safe - selecting is free, deselecting is
 * the only thing that can cost the user something.
 *
 * @param {string[]} oldReasons
 * @param {string[]} newReasons
 * @returns {string[]}
 */
export function droppedGroups(oldReasons, newReasons) {
  const before = new Set(fieldGroupsForReasons(oldReasons));
  const after = new Set(fieldGroupsForReasons(newReasons));
  const dropped = CLINIC_VISIT_GROUPS.filter((g) => before.has(g) && !after.has(g));
  return dropped;
}

/**
 * What removing these reasons would clear - and only the parts actually filled.
 *
 * An empty field is never listed: confirming a clear that would do nothing is
 * noise, and the owner's rule was to confirm before destroying something, not to
 * make every reason change feel risky.
 *
 * @param {string[]} oldReasons
 * @param {string[]} newReasons
 * @param {object} form the current form values
 * @returns {{ groups: string[], fields: Array<{key: string, label: string}> }}
 */
export function clearPlan(oldReasons, newReasons, form) {
  const groups = droppedGroups(oldReasons, newReasons);
  const fields = [];
  const seen = new Set();
  for (const group of groups) {
    for (const field of GROUP_FIELDS[group] || []) {
      if (seen.has(field.key)) continue;
      seen.add(field.key);
      if (hasContent(form ? form[field.key] : undefined)) {
        fields.push({ key: field.key, label: field.label });
      }
    }
  }
  return { groups, fields };
}

/**
 * Apply a clear plan, returning a NEW form object.
 *
 * Never mutates: the caller decides whether to commit, because the whole point
 * is that the user gets to decline first.
 *
 * @param {object} form
 * @param {Array<{key: string}>} fields
 * @returns {object}
 */
export function applyFieldClear(form, fields) {
  if (!form || !Array.isArray(fields) || fields.length === 0) return form;
  const next = { ...form };
  for (const group of CLINIC_VISIT_GROUPS) {
    for (const field of GROUP_FIELDS[group] || []) {
      if (fields.some((f) => f.key === field.key)) next[field.key] = field.empty;
    }
  }
  return next;
}

/**
 * FOLLOW-UP REVIEW DERIVATION (t054).
 *
 * WHY THIS EXISTS. `nextReviewDate` has been on the clinic visit record since
 * 19 Aug 2026, paired with `nextReviewType`/`followUpType` as "what kind of
 * follow-up is arranged". It is editable in the form and readable in the record
 * view, and until now NOTHING consumed it outside the frozen seed snapshot.
 * That is the same INERT-field shape that `reasonForVisit` had when this file
 * was created: a value the user fills in that causes nothing to happen.
 *
 * A visit that arranged a review and has now passed that date is the clearest
 * "you said you'd come back and the date has gone" signal this app owns, and
 * it was sitting unread.
 *
 * WHAT THIS IS NOT. Informational, never a directive, and never clinical
 * advice - the same boundary the exposure-window and DoxyPEP countdowns hold
 * (see the header of doxyPepCalculations.js and the Out-of-Scope list in
 * CLAUDE.md). It never says the user is overdue treatment; it says a review
 * they themselves recorded has passed.
 *
 * PURE on purpose: no I/O, no storage, no React, same contract as everything
 * above. The caller supplies the visits and the clock.
 */

// Days before the date at which a review is worth mentioning. NOT a clinical
// interval - it is a courtesy window so the user hears about a review they
// arranged before it lands, which is the only thing that makes this useful.
// Exported so a test can pin it rather than hard-coding a literal twice.
export const REVIEW_DUE_SOON_DAYS = 7;

/** Whole days from `from` to `to`, by calendar day rather than by elapsed ms. */
function calendarDaysBetween(fromMs, toMs) {
  const MS_PER_DAY = 86400000;
  // Round to the nearest day BEFORE subtracting. Dividing by 86400000 directly
  // truncates, so 1h59m reads as 0 days and a review can read as "tomorrow"
  // when it is actually today. Rounding is what makes "days until" agree with
  // what the user sees on a calendar.
  return Math.round((toMs - fromMs) / MS_PER_DAY);
}

/**
 * Describe a single visit's follow-up review, if it has one.
 *
 * @param {object} visit a clinic visit record
 * @param {Date} [now]
 * @returns {null | {
 *   state: "overdue" | "due-soon" | "scheduled",
 *   days: number,        // negative once overdue
 *   dateMs: number,
 *   kind: string,        // followUpType, free text; "" when unset
 * }}
 *   `null` when the visit has no review date, or the date is unparseable.
 */
export function reviewStatusFor(visit, now = new Date()) {
  if (!visit || !visit.nextReviewDate) return null;

  // Unparseable is treated as absent, NOT as overdue. A broken stored string
  // must not invent a clinical-sounding warning, and must not hide the other
  // visits' warnings either - so it drops out here and the caller carries on.
  const dateMs = new Date(visit.nextReviewDate).getTime();
  if (Number.isNaN(dateMs)) return null;

  const days = calendarDaysBetween(now.getTime(), dateMs);
  const kind = typeof visit.followUpType === "string" ? visit.followUpType : "";

  if (days < 0) return { state: "overdue", days, dateMs, kind };
  if (days <= REVIEW_DUE_SOON_DAYS) return { state: "due-soon", days, dateMs, kind };
  return { state: "scheduled", days, dateMs, kind };
}

/**
 * The soonest follow-up review across a set of visits.
 *
 * "Soonest" is by DATE, not by state. A review three days out is more urgent
 * than one already a week past only in the sense that it is nearer; the caller
 * decides how to present both, and picking by state would hide an overdue one
 * behind a nearer upcoming one.
 *
 * @param {object[]} visits
 * @param {Date} [now]
 * @returns {null | {status: object, visit: object}}
 */
export function soonestReview(visits, now = new Date()) {
  if (!Array.isArray(visits) || visits.length === 0) return null;
  let best = null;
  for (const visit of visits) {
    if (visit && visit.isArchived) continue;
    const status = reviewStatusFor(visit, now);
    if (!status) continue;
    if (!best || status.dateMs < best.status.dateMs) best = { status, visit };
  }
  return best;
}

/**
 * UPCOMING WINDOW (t060).
 *
 * WHY THIS EXISTS. The Appointments widget counted `getUpcomingBookedVisits()`,
 * which filters `date > now` and nothing else - so "upcoming" meant ANY future
 * visit. A user who booked something for next March was told "1 upcoming" on the
 * same footing as one with an appointment tomorrow, and a glanceable widget that
 * cannot tell you whether it matters this week is not earning its space on a home
 * screen.
 *
 * The owner's framing: "within the next two weeks = upcoming, beyond that =
 * labelled future, not upcoming." Both are still SHOWN - the widget must not hide
 * a real appointment just because it is distant - but they are counted and
 * labelled differently, which is the whole ask.
 *
 * WHY CALENDAR DAYS AND NOT ELAPSED MILLISECONDS. "The next two weeks" is a thing
 * people read off a calendar, so the boundary is the calendar DATE 14 days out,
 * not the instant 14*24h from now. The two genuinely disagree, and they disagree
 * in the direction that matters: under elapsed time, an appointment at 23:00 on
 * day 14 is 14.96 days away and rounds past the boundary, so a same-day-as-the-
 * boundary appointment is called "later" depending on what time you happened to
 * book it. `clinicVisitUrgency.test.js` pins both sides of that exact disagreement.
 *
 * PURE on purpose, same contract as the rest of this file: no I/O, no storage, no
 * React, and the caller supplies both the visits and the clock.
 */

/** Days ahead that count as "upcoming". Exported so a test pins it, not a literal. */
export const UPCOMING_WINDOW_DAYS = 14;

/**
 * A sortable day number for a real timestamp, in the USER's timezone.
 *
 * Local Y/M/D are read off and re-expressed at UTC midnight. That is what makes
 * the comparison timezone-proof: two instants on the same calendar day land on the
 * same index in any timezone, and a DST transition cannot move the boundary,
 * because no local midnight ever happens twice on a DST day.
 */
function localDayIndex(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Split future visits into the ones inside the window and the ones beyond it.
 *
 * Input order is PRESERVED in both buckets rather than re-sorted, because every
 * caller already has a soonest-first list and re-sorting would be a second place
 * for the ordering rule to live. A pinned test holds that.
 *
 * A visit with no date, or one whose stored string will not parse, is DROPPED
 * from both buckets rather than counted as "later". A visit whose date is broken
 * is not evidence of a distant appointment, and counting it as one would put a
 * number on the widget that the app cannot substantiate.
 *
 * This does NOT filter out past visits - that is `getUpcomingBookedVisits()`'s
 * existing job, and doing it twice would be two rules for one fact. A caller that
 * passes an unfiltered list gets past visits counted as upcoming, which is why
 * the JSDoc says "future visits" and the test fixture respects it.
 *
 * @param {object[]} visits
 * @param {Date} [now]
 * @returns {{upcoming: object[], later: object[]}}
 */
export function partitionVisitsByUrgency(visits, now = new Date()) {
  const list = Array.isArray(visits) ? visits : [];
  const horizonDay = localDayIndex(now.getTime()) + UPCOMING_WINDOW_DAYS * 86400000;
  const upcoming = [];
  const later = [];
  for (const visit of list) {
    if (!visit || !visit.date) continue;
    // realTimestampFromStored, NOT new Date(visit.date): a visit's date is this
    // app's stored fake-UTC string (see dateInputHelpers.js), so reading it the
    // plain way shifts it by the local UTC offset and can move an appointment
    // across the 14-day boundary - the one number this whole function exists to
    // get right.
    const ms = realTimestampFromStored(visit.date);
    if (Number.isNaN(ms)) continue;
    (localDayIndex(ms) <= horizonDay ? upcoming : later).push(visit);
  }
  return { upcoming, later };
}