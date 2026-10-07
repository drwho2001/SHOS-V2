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

/**
 * What a scheduled retest carries over from the test it follows.
 *
 * This copies the OWNER'S OWN previous choices. That distinction is the whole
 * design, and it is what keeps this out of the "no diagnosis engine, no
 * automated clinical risk scoring" line CLAUDE.md puts permanently out of scope:
 * it is "do what you did last time", not "here is what you ought to be tested
 * for". Everything it produces stays editable on the plan.
 *
 * WHY SAMPLE TYPE IS THE ONE THAT EARNS ITS PLACE. BASHH's summary guidance on
 * STI testing (2023) makes the sample SITE behaviour-dependent rather than a
 * detail - "3 site testing required for all sexually active MSM" (throat, urine,
 * rectum), and extragenital swabs "should be guided by sexual history taking",
 * with pharyngeal and rectal sampling explicitly "not recommended for routine
 * screening" in women. So for someone who screens triple-site, a plan that says
 * only "Urine" under-specifies the retest in a way that could silently miss the
 * site that actually matters to them. Copying their own last sample types is
 * accurate for them in a way that a generic default could not be.
 *
 * WHAT IS DELIBERATELY NOT CARRIED, and why each is a different reason:
 *
 *   provider / setting - free text that names a clinic. It is the field most
 *     likely to have changed since last time, and pre-filling it reads as
 *     "we booked you in here" when nothing was booked at all.
 *   notes, writtenPlan, trackingInfo - per-test observations about a test that
 *     has not happened. Reusing them would put a past result's narrative in
 *     front of a future result.
 *   resultIds / organismIds - a plan is an intention, so it has no results. This
 *     is also what stops isRoutineRetestEligible matching a plan and proposing
 *     to retest the plan.
 *   kitCodePk/Sk, kitAccessKey - belong to a specific self-test kit, which is
 *     spent once used.
 *   followUpActionedDate - the follow-up has already happened.
 *
 * WHY testingFor IS THE PANEL AND NOT THE SOURCE TEST'S LIST. Eligibility
 * already requires the source test to have screened the whole panel, so
 * carrying its own list over would only ever ADD one-off extras (Hepatitis B,
 * Mpox, pregnancy) on top of the panel. A ROUTINE plan is the minimum routine
 * set - BASHH's own words are that "the minimum investigations, even if
 * asymptomatic, are tests for chlamydia, gonorrhoea, syphilis and HIV" - and
 * this app has exactly one retest reminder, which is armed on that panel.
 * Smuggling an unscreened-for extra into the plan would make the plan's own
 * title disagree with the record and imply a reminder exists for something it
 * does not cover. One-off extras belong on a test the user adds themselves.
 */
export function routineRetestPrefill(sourceTest) {
  const samples = Array.isArray(sourceTest?.sampleType) ? sourceTest.sampleType : [];
  return {
    testingFor: [...ROUTINE_RETEST_PANEL],
    // COPIED, never aliased. Two persisted records sharing one array is the
    // shape behind this repo's documented "two truths drifted apart" bugs: an
    // in-place edit to one record would silently change the other before either
    // was saved.
    sampleType: [...new Set(samples.filter((s) => typeof s === "string" && s.trim()))],
  };
}

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
