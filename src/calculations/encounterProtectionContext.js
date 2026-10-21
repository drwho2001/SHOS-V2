// INFER the "Protection & medication context" fields on an encounter, from
// the medication log the app already keeps.
//
// WHY (the owner's own words): "the doxypep tracking options on new
// encounter form feels clunky.. can we infer this data rather than ask user
// to do it or make it clearer?"
//
// THE ASK IS FAIR because the app ALREADY KNOWS most of it. DoxyPEP doses
// live in the medication log - that is where the 72-hour countdown, the
// DoxyPEP widget and the notification all read them from (doxyPepSync.js).
// So the encounter form was asking the user to re-state a fact the app had
// already logged, in a select whose options are a vocabulary from a
// different data model.
//
// WHAT CAN BE INFERRED, AND WHAT CANNOT:
//
//   DoxyPEP status
//     "Not indicated"           - the encounter has no qualifying position.
//     "Indicated - taken"       - a DoxyPEP dose was logged within 72h
//                                  after the encounter.
//     "Indicated - not yet taken" - the 72h window is still open.
//     "Indicated - missed window"  - the window closed with no dose.
//     "N/A"                     - NOT inferable. Left to the user.
//
//   PrEP coverage
//     "Not on PrEP"             - there is no PrEP medication at all.
//     "Adequate - daily"        - 4 or more PrEP doses in the 7 days before.
//     "Missed dose"             - some PrEP doses, but not 4 in a week.
//     "Inadequate/recently started" - the PrEP medication is under 4 weeks
//                                  old, so it cannot have reached 4/week yet.
//     "Adequate - Event-based (2-1-1)" - NOT inferable. It is a regimen
//                                  the user chooses, not a fact about their
//                                  logs. Left to the user.
//
// THE RULES ARE ABOUT THE ENCOUNTER, NOT ABOUT NOW. An encounter logged
// yesterday is judged against yesterday: the dose that counts is the one
// within 72 hours AFTER that encounter, not the latest dose of the day.
//
// A SUGGESTION IS NOT A FACT. Every function here returns a value AND the
// reason for it, so the caller can show the user where it came from - a
// silent inference that turns out to be wrong is worse than a question,
// because the user would have no reason to look at it.
import { DOXYPEP_STATUS_OPTIONS, PREP_COVERAGE_OPTIONS } from "../repositories/encounterRepository";
import { DOXYPEP_QUALIFYING_POSITIONS, DOXYPEP_WINDOW_HOURS } from "./doxyPepCalculations";
import { realTimestampFromStored } from "./dateInputHelpers";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Is this a medication the user takes as PrEP?
 *
 * By name, the same robustness rule findDoxyPepMedication() already uses
 * (real device data may not share this repo's seed ids, and the medication
 * list is the user's own naming). "Doxycycline (PEP)" is not PrEP, and
 * "PrEP" is not DoxyPEP, so each is matched on its own word.
 */
export function findPrEPMedication(medications) {
  return (
    (medications || []).find(
      (m) => !m.isArchived && /prep/i.test(m.name || "") && !/doxy/i.test(m.name || "")
    ) || null
  );
}

/**
 * The DoxyPEP status implied by the encounter and the dose log.
 *
 * @returns {{value: string, reason: string} | null} null when there is not
 *   enough to go on - an empty position field, for instance, is missing
 *   information rather than evidence of anything.
 */
export function inferDoxyPepStatus({ myPosition = [], date, doseLogs = [], now = new Date() } = {}) {
  const positions = Array.isArray(myPosition) ? myPosition : [];
  // An empty position field is missing information, not a finding. Saying
  // "Not indicated" because the user has not filled in the positions yet
  // would be inventing an answer.
  if (positions.length === 0) return null;

  const qualifying = positions.some((p) => DOXYPEP_QUALIFYING_POSITIONS.includes(p));
  if (!qualifying) {
    return { value: "Not indicated", reason: "no position in this encounter qualifies for PEP" };
  }

  const encounterAt = date ? realTimestampFromStored(date) : null;
  if (encounterAt === null) return null;

  const windowEnd = encounterAt + DOXYPEP_WINDOW_HOURS * 60 * 60 * 1000;
  const doses = (doseLogs || []).filter((l) => l && l.type === "dose" && !l.voided && l.date);
  const taken = doses.find((l) => {
    const at = realTimestampFromStored(l.date);
    return at >= encounterAt && at <= windowEnd;
  });

  if (taken) {
    return {
      value: "Indicated - taken",
      reason: `a DoxyPEP dose is logged within ${DOXYPEP_WINDOW_HOURS}h of this encounter`,
    };
  }
  if (now.getTime() <= windowEnd) {
    return {
      value: "Indicated - not yet taken",
      reason: `this encounter qualifies for PEP and the ${DOXYPEP_WINDOW_HOURS}h window is still open`,
    };
  }
  return {
    value: "Indicated - missed window",
    reason: `this encounter qualifies for PEP and no dose was logged within ${DOXYPEP_WINDOW_HOURS}h`,
  };
}

/**
 * The PrEP coverage implied by the PrEP dose log.
 *
 * `at` is the instant the coverage is judged AS OF - the encounter's own date
 * when there is one, because an encounter logged last week should reflect
 * last week's coverage rather than this week's.
 *
 * @returns {{value: string, reason: string} | null}
 */
export function inferPrepCoverage({ doseLogs = [], hasPrEPMedication = false, at, now: nowArg } = {}) {
  // `at` is the encounter's own date; `now` is accepted as an alias so a
  // caller (or a test) can say which instant it means without both.
  const now = at ? new Date(at) : (nowArg ? new Date(nowArg) : new Date());
  if (!hasPrEPMedication) {
    return { value: "Not on PrEP", reason: "there is no PrEP medication in your list" };
  }
  const doses = (doseLogs || []).filter((l) => l && l.type === "dose" && !l.voided && l.date);
  if (doses.length === 0) {
    return { value: "Missed dose", reason: "a PrEP medication is on your list but no doses are logged" };
  }
  const weekAgo = now.getTime() - 7 * DAY_MS;
  const recent = doses.filter((l) => realTimestampFromStored(l.date) >= weekAgo);
  if (recent.length >= 4) {
    return { value: "Adequate - daily (≥4/week)", reason: `${recent.length} PrEP doses in the 7 days before` };
  }
  // Started too recently to have reached 4/week yet.
  const earliest = doses.reduce(
    (min, l) => Math.min(min, realTimestampFromStored(l.date)),
    Infinity
  );
  if (now.getTime() - earliest < 28 * DAY_MS) {
    return {
      value: "Inadequate/recently started",
      reason: "your PrEP medication is under 4 weeks old",
    };
  }
  return {
    value: "Missed dose",
    reason: `${recent.length} PrEP dose${recent.length === 1 ? "" : "s"} in the 7 days before`,
  };
}

/**
 * Both suggestions at once, for the caller that wants them.
 */
export function inferProtectionContext(input = {}) {
  const doxyPep = inferDoxyPepStatus(input);
  const prep = inferPrepCoverage(input);
  return {
    doxyPepStatus: doxyPep ? DOXYPEP_STATUS_OPTIONS.includes(doxyPep.value) ? doxyPep : null : null,
    prepCoverage: prep ? PREP_COVERAGE_OPTIONS.includes(prep.value) ? prep : null : null,
  };
}