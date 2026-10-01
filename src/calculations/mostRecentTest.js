// mostRecentTest.js
//
// WHY THIS FILE EXISTS. "What was I last tested for, and when?" had FOUR
// separate implementations, and the two that mattered for HIV were both wrong in
// the same way.
//
// `getAutoLastTestedDate()` was duplicated in SHOS_MyProfile_Prototype.jsx and
// profileShareService.js, byte-identical. Both returned the most recent test of
// ANY kind:
//
//     const sorted = [...tests].sort((a, b) => new Date(b.date) - new Date(a.date));
//     return sorted[0]?.date || null;
//
// So a chlamydia swab could become the date shown next to an HIV status. That
// is a FALSE ASSURANCE, not a cosmetic slip: "HIV - Negative, last tested
// 14 Oct" tells the reader their HIV status was verified on a date when they
// were only screened for something else. It is the same failure the repo's own
// rule exists to prevent - a benign-looking default is only benign where the
// wrong answer is not a medical claim - and this one was a medical claim.
//
// The duplication is why it survived: the comment in profileShareService.js
// described it as "same logic as SHOS_MyProfile_Prototype.jsx's own version
// (duplicated per this app's self-contained-module convention)". Two copies,
// one bug, no test that could fail.
//
// ONE OWNER, per this repo's "store facts, derive state" rule. Pure functions
// taking the records already loaded, per the calculation/repository split - see
// testingCalculations.js's own header for the same convention.

/**
 * Which infections a test actually screened for.
 *
 * NOT string equality, and the reason is Hepatitis. The option list runs
 * "Hepatitis A" through "Hepatitis E", a single test can legitimately read
 * "Hepatitis B & C", and HIV is written several ways across real records
 * ("HIV", "HIV-1", "HIV-2"). Two failure modes follow from equality:
 *
 *   - Too strict, and a genuine HIV test recorded as "HIV-1" reports as no HIV
 *     test at all. Conservative, so not dangerous - just unhelpful.
 *   - Too loose (substring), and "Hepatitis" with no letter would satisfy a
 *     question about Hepatitis B.
 *
 * So this compares TOKEN SETS. Every non-alphanumeric run collapses to a single
 * space, so "Hepatitis B & C" is {hepatitis, b, c} and "HIV-1" is {hiv, 1}.
 * The target's tokens must all be present. That means:
 *
 *   "Hepatitis B" covers "Hepatitis B"              -> yes
 *   "Hepatitis B & C" covers "Hepatitis B"          -> yes, it was screened for
 *   "Hepatitis" covers "Hepatitis B"                -> NO, fails closed
 *   "HIV-1" covers "HIV"                            -> yes
 *
 * Fails closed deliberately. A missed match costs a little convenience; a false
 * match costs someone a false assurance about their own health.
 *
 * @param {object} test
 * @param {string|null} infection e.g. "HIV", "Hepatitis B". Null means "any".
 */
export function testCoversInfection(test, infection) {
  const want = infectionTokens(infection);
  if (want.size === 0) return true; // no infection asked about
  const forThis = test?.testingFor;
  if (!Array.isArray(forThis)) return false;
  return forThis.some((entry) => {
    const have = infectionTokens(entry);
    if (have.size === 0) return false;
    for (const token of want) if (!have.has(token)) return false;
    return true;
  });
}

function infectionTokens(value) {
  return new Set(
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean),
  );
}

/**
 * The date of the most recent completed test, optionally narrowed to one
 * infection.
 *
 * The future-date exclusion is the rule the repo already enforces in four
 * places, and it is kept here rather than relaxed: a scheduled-but-not-yet-happened
 * test must never be reported as "last tested". The comparison is against the
 * UTC day, matching the existing call sites exactly, so this changes WHO can be
 * the most recent test and nothing else.
 *
 * @param {object[]} tests
 * @param {{infection?: string|null, todayIsoDay?: string}} [options]
 * @returns {string|null} the stored fake-UTC date, or null when there is none
 */
export function mostRecentTestDate(tests, options = {}) {
  const { infection = null, todayIsoDay = null } = options;
  const today = todayIsoDay ?? new Date().toISOString().slice(0, 10);
  const eligible = (Array.isArray(tests) ? tests : []).filter(
    (t) => !t?.isArchived && t?.date && t.date.slice(0, 10) <= today,
  );
  const matching = eligible.filter((t) => testCoversInfection(t, infection));
  if (!matching.length) return null;
  // Newest first. Ties are irrelevant here: the caller only wants a date, and
  // the repo already has its own date ordering for anything that cares about
  // order.
  matching.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return matching[0].date;
}