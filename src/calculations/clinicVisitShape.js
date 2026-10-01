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