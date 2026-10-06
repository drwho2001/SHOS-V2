// testingCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real feedback-batch ask: "if negative, follow-up defaults to nil or
// routine 3-month retest". This is a
// SUGGESTION shown in the UI, computed fresh every time from the
// test's own real date/testingFor/result — never stored as its own
// field, same "store facts, derive state" principle as everywhere
// else in this app (e.g. Testing's own "open treatment" status is
// derived from Follow-up Actioned Date being empty, not a separate
// stored flag). Purely informational, same spirit as the exposure-
// window flagging in exposureWindows.js — this app stays out of
// automated clinical decision-making (Architecture Lock v1.0's Out of
// Scope section), so this is a suggestion to consider, not a
// scheduled action or a reminder that fires on its own.
//
// CHANGED — Phase 2 encryption groundwork: ResultsRegistry is now
// async. Rather than making this pure calculation function async (it's
// called live, on every keystroke, from TestEditSheet's form preview —
// an async round-trip there would add real, visible lag), it now takes
// a pre-resolved `resultNameById` lookup Map as a parameter instead of
// reading the registry itself — same "pure function takes data as a
// parameter" fix already applied to measurementPreferencesRepository.js's
// getAvailableUnits()/getDefaultUnit() this session, and it keeps this
// file genuinely I/O-free, matching CLAUDE.md's own repository/
// calculation split. Callers resolve the map once via useLoadedMemo
// (or build it inline from an already-loaded TestingRepository read).

// A routine retest is offered only after a completed negative core STI
// screen. A single negative result for one infection is not evidence that
// the full routine panel was done; positive tests belong to treatment/TOC.
export const ROUTINE_RETEST_PANEL = Object.freeze([
  "Gonorrhoea",
  "Chlamydia",
  "HIV",
  "Syphilis",
]);

export function isCompletedTestRecord(test) {
  return Boolean(test && !test.isArchived && !test.isRoutineRetestPlan);
}

export function isRoutineRetestEligible(test, resultNameById, todayIsoDay = new Date().toISOString().slice(0, 10)) {
  if (!isCompletedTestRecord(test) || !test.date || test.date.slice(0, 10) > todayIsoDay) return false;
  const resultNames = (test.resultIds || []).map((id) => resultNameById?.get(id)).filter(Boolean);
  const isPositive = resultNames.some((n) => n.toLowerCase() === "positive");
  const isNegative = resultNames.some((n) => n.toLowerCase() === "negative");
  if (isPositive || !isNegative) return false;
  return ROUTINE_RETEST_PANEL.every((infection) => (test.testingFor || []).includes(infection));
}

/**
 * True when two records screen for at least one of the same infections.
 *
 * WHY NOT ARRAY INTERSECTION. The stored values are user-facing option strings
 * ("HIV", "HIV-1", "Hepatitis B & C"), and the same real infection is genuinely
 * written more than one way in this app's own data - see mostRecentTest.js for
 * why equality was rejected there. Comparing the raw strings would report "a
 * full core panel test does NOT supersede your plan" for a record written
 * "HIV-1", which is the failure that matters here: a plan the user has already
 * gone and done would keep nagging.
 *
 * Shared tokens, same token-set rule as mostRecentTest.testCoversInfection, and
 * deliberately on the SAFE side - a false overlap costs a redundant prompt the
 * user can decline, while a false non-overlap silently keeps a satisfied plan
 * alive.
 */
export function recordsShareInfections(a, b) {
  // NOTE THE SPREAD INSIDE flatMap. `flatMap` flattens ARRAYS only - handing it
  // a function that returns a Set produces an array of Sets, which is truthy and
  // non-empty, so every "is there anything to compare" check downstream still
  // passes while every comparison is against a Set object rather than a token.
  // That is exactly what the first version of this function did, and it made
  // BOTH supersede cases silently report no match.
  const tokensOf = (entry) => [...new Set(
    String(entry ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean),
  )];
  const mine = (a?.testingFor || []).flatMap(tokensOf);
  if (!mine.length) return false;
  const theirs = new Set((b?.testingFor || []).flatMap(tokensOf));
  return mine.some((t) => theirs.has(t));
}

/**
 * The plans that a newly saved COMPLETED test has made moot.
 *
 * WHY THIS IS A QUESTION AND NOT AN ACTION. A scheduled retest that the user has
 * quietly gone and done anyway is not an error to clean up - it is the outcome
 * the plan existed to produce. But deleting or editing the plan unasked would
 * destroy a record the user deliberately created, so this only ever REPORTS.
 * The caller must offer keep / update / archive, per the owner's own decision.
 *
 * "Superseded" means all three of:
 *   - it is a live plan (a performed or archived one is not pending anything);
 *   - the new test actually covers something the plan covers, so an unrelated
 *     Hep B result does not retire a gonorrhoea plan;
 *   - the new test's day has reached or passed the plan's day, because a test
 *     logged early against a future plan is the keep/update case, not this one.
 *
 * @param {object[]} tests every test on file, plans included
 * @param {object} completedTest the just-saved completed test
 * @returns {object[]} the live plans it supersedes, oldest planned day first
 */
export function findSupersededRoutineRetestPlans(tests, completedTest) {
  if (!isCompletedTestRecord(completedTest) || !completedTest?.date) return [];
  const completedDay = completedTest.date.slice(0, 10);
  return (Array.isArray(tests) ? tests : [])
    .filter((t) => t?.isRoutineRetestPlan && !t.isArchived)
    .filter((t) => {
      const plannedDay = t.plannedForDate || t.date?.slice(0, 10);
      return plannedDay && completedDay >= plannedDay && recordsShareInfections(t, completedTest);
    })
    .sort((a, b) => ((a.plannedForDate || a.date) < (b.plannedForDate || b.date) ? -1 : 1));
}

/**
 * A title for a plan that the user has not written themselves.
 *
 * The panel is in the label rather than implied, because a list row that says
 * only "Routine retest" does not say what is being retested - and the whole
 * point of the record is that it is an intention to be tested for something.
 */
export function routineRetestPlanTitle() {
  return `Routine retest — ${ROUTINE_RETEST_PANEL.join(", ")}`;
}

export function suggestedRoutineRetestDate(test, resultNameById, todayIsoDay) {
  if (!isRoutineRetestEligible(test, resultNameById, todayIsoDay)) return null;

  // The eligible routine core panel uses the established three-calendar-month
  // suggestion as one consistent interval, including HIV.
  // FIXED 30 Sep 2026 (t037). `test.date` is a STORED fake-UTC value, so
  // `new Date(test.date)` is shifted by the device's real UTC offset, and
  // `setMonth` is a LOCAL calendar walk on that shifted instant. West of UTC
  // the walk runs a day behind, so the suggested retest date is a day early.
  //
  // This is the same defect as the month-heading bug fixed the same day, in a
  // CLINICAL function: the retest date is what the reminder fires on and what
  // the Testing screen prints.
  //
  // The rollover guard is the same one contraceptiveCalculations.js's daysForUnit
  // uses: setUTCMonth from 30 Nov lands on 30 Feb, which does not exist, and
  // rolls forward into March.
  const d = new Date(test.date);
  const startDay = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 3);
  if (d.getUTCDate() !== startDay) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}
