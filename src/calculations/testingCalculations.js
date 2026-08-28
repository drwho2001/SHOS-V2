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
import { ResultsRegistry } from "../registries/resultsRegistry.js";

// A test only gets a routine-retest suggestion if it actually came
// back negative (positive moves into the treatment/TOC flow instead,
// which already has its own explicit fields — a retest suggestion
// there would be noise, not help) and has a real date to count from.
export function suggestedRoutineRetestDate(test) {
  if (!test?.date) return null;
  const resultNames = (test.resultIds || []).map((id) => ResultsRegistry.getById(id)?.name).filter(Boolean);
  const isPositive = resultNames.some((n) => n.toLowerCase() === "positive");
  const isNegative = resultNames.some((n) => n.toLowerCase() === "negative");
  if (isPositive || !isNegative) return null;

  // CHANGED — real correction: HIV used to get a longer 6-month
  // interval here, on the (outdated) assumption it needed more
  // caution than other STIs. That's backwards from real current
  // guidance — standard PrEP monitoring requires HIV testing every 3
  // months, the SAME cadence as everything else, not less often. One
  // uniform 3-month interval for every test now.
  const d = new Date(test.date);
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}
