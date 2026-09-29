// hivStatusCalculations.js
//
// WHY THIS EXISTS. The owner's own call, scoping t025 on 29 Sep: HIV status is a
// real, recorded fact, not an inference. It gates whether PrEP is relevant at
// all, it changes what a clinician asks, and "undetectable" versus not is a
// materially different situation for someone reading their own history. It
// belongs on My Profile and on Contacts, because partner notification already
// operates on the assumption that someone's status matters to someone else.
//
// WHAT IT DELIBERATELY DOES NOT DO. It does not decide vaccine eligibility.
// That was the original framing for this task, and it was the wrong one:
// eligibility requires inferring facts the app does not hold (UK hepatitis-B
// eligibility turns largely on HIV status, which the app had no field for at
// all), so an "eligibility" banner would be a guess computed from a partial
// profile and shown on a home screen - which is exactly the automated clinical
// risk scoring CLAUDE.md puts permanently out of scope.
//
// PURE, NO I/O. Takes the tests, the result-name map and the measurements as
// parameters, per the repository/calculation split this project follows
// throughout (see testingCalculations.js's own header for the same convention).
import { realTimestampFromStored } from "./dateInputHelpers.js";

/**
 * The four states, exactly as the owner specified them.
 * `untested` is the default and means never tested OR unknown - the two are the
 * same thing to this app, because "we don't know" and "we never looked" lead to
 * the same advice.
 */
export const HIV_STATUS = {
  UNTESTED: "untested",
  NEGATIVE: "negative",
  POSITIVE_SUPPRESSED: "positive-suppressed",
  POSITIVE_UNSUPPRESSED: "positive-unsuppressed",
};

export const HIV_STATUS_OPTIONS = [
  { value: HIV_STATUS.UNTESTED, label: "Untested / unknown" },
  { value: HIV_STATUS.NEGATIVE, label: "Negative" },
  { value: HIV_STATUS.POSITIVE_SUPPRESSED, label: "Positive - undetectable" },
  { value: HIV_STATUS.POSITIVE_UNSUPPRESSED, label: "Positive - high viral load" },
];

export const DEFAULT_HIV_STATUS = HIV_STATUS.UNTESTED;

export function isValidHivStatus(value) {
  return Object.values(HIV_STATUS).includes(value);
}

/** Defensive: restored-from-backup data can hold anything, including nothing. */
export function normaliseHivStatus(value) {
  return isValidHivStatus(value) ? value : DEFAULT_HIV_STATUS;
}

/** Only tests that actually screened for HIV. See the trap note below. */
function isHivTest(test) {
  return (test?.testingFor || []).some((t) => String(t).toLowerCase() === "hiv");
}

/**
 * THE TRAP, stated because it is the whole risk of this feature.
 *
 * Status is derived from Testing records, and ONLY from tests whose
 * `testingFor` includes "HIV". A negative chlamydia result says NOTHING about
 * HIV status, so a latest-test-wins rule across all tests would be confidently
 * wrong - and confidently wrong about a medical fact, which is the worst kind of
 * wrong this app can be. Result names are compared with the same exact
 * lowercase "positive"/"negative" rule testingCalculations.js already uses, so
 * the two never disagree about what counts as positive.
 */
export function deriveHivStatus(tests, resultNameById, measurements = []) {
  const hivTests = (tests || [])
    .filter(isHivTest)
    .filter((t) => t.date)
    .sort((a, b) => realTimestampFromStored(b.date) - realTimestampFromStored(a.date));

  const latest = hivTests[0];
  if (!latest) {
    return { status: DEFAULT_HIV_STATUS, since: null, source: "no-hiv-test" };
  }

  const names = (latest.resultIds || []).map((id) => resultNameById?.get(id)).filter(Boolean);
  const isPositive = names.some((n) => n.toLowerCase() === "positive");
  const isNegative = names.some((n) => n.toLowerCase() === "negative");
  // An HIV test with a result this app doesn't recognise (Pending, Lost sample)
  // establishes NOTHING. Reporting "untested" is honest; guessing either way
  // from a result we could not read is not.
  if (!isPositive && !isNegative) {
    return { status: DEFAULT_HIV_STATUS, since: null, source: "unreadable-result" };
  }

  const since = latest.date;
  if (isNegative) {
    return { status: HIV_STATUS.NEGATIVE, since, source: "test" };
  }

  return {
    status: resolveSuppression(latest, measurements),
    since,
    source: "test",
  };
}

/**
 * Positive tests cannot tell suppressed from unsuppressed.
 *
 * A combo / fourth-generation HIV test gives positive or negative and nothing
 * finer. Suppression comes from a VIRAL LOAD measurement - and this app already
 * has a "Viral load" measurement type, so it is grounded in a real recorded fact
 * rather than a guess. Where no viral-load result exists, the status is
 * positive-without-known-suppression rather than defaulting to one side: "we do
 * not know" must not be rendered as "they are well".
 */
function resolveSuppression(latestTest, measurements) {
  const testAt = realTimestampFromStored(latestTest.date);
  const viralLoads = (measurements || []).filter((m) => isViralLoad(m) && m.date);
  if (!viralLoads.length) return HIV_STATUS.POSITIVE_UNSUPPRESSED;

  // Only a load taken AT OR AFTER the positive test describes the current
  // state. An older reading is not evidence about now.
  const after = viralLoads
    .map((m) => ({ m, at: realTimestampFromStored(m.date) }))
    .filter((x) => x.at >= testAt)
    .sort((a, b) => b.at - a.at);

  if (!after.length) return HIV_STATUS.POSITIVE_UNSUPPRESSED;

  const latestValue = after[0].m.value;

  // The lab's own wording FIRST. "Undetectable" is not a number, and
  // Number("Undetectable") is NaN - so a numeric guard placed ahead of this
  // check would reject the very result it exists to recognise, and report
  // someone on effective treatment as having a high viral load. That ordering
  // bug was in the first version of this function and the test below caught it.
  const text = String(latestValue ?? "").toLowerCase();
  if (text.includes("undetect") || text.includes("not detected")) {
    return HIV_STATUS.POSITIVE_SUPPRESSED;
  }

  const numeric = typeof latestValue === "number" ? latestValue : Number(latestValue);
  if (!Number.isFinite(numeric)) return HIV_STATUS.POSITIVE_UNSUPPRESSED;

  // Sourced figure, not a magic number: 20 copies/mL is the threshold UK
  // labs use to report "undetectable" on a routine viral load.
  return numeric < 20 ? HIV_STATUS.POSITIVE_SUPPRESSED : HIV_STATUS.POSITIVE_UNSUPPRESSED;
}

function isViralLoad(m) {
  const type = String(m?.type || "").toLowerCase();
  return type.includes("viral load") || type.includes("viral_load") || type.includes("viral-load");
}

/**
 * The manual override, and why it is not optional.
 *
 * Someone tested elsewhere, or is on PrEP with results held at another service,
 * will have NO record in this app. A derived-only field would report "untested"
 * for a person who is on treatment, which is the most damaging kind of wrong
 * this feature can produce. So a stated status always wins over a derived one,
 * and the two are distinguishable - which is why `since` is nullable and blank
 * is a real, meaningful value rather than missing data.
 */
export function resolveHivStatus(stated, derived) {
  const d = derived || { status: DEFAULT_HIV_STATUS, since: null };
  if (!isValidHivStatus(stated)) return d;
  if (stated === d.status) return d;
  return { status: stated, since: null, source: "stated" };
}

/**
 * Plain-language line for display, including the test date.
 * Blank "since" is rendered as "date not recorded" rather than omitted, so the
 * reader can tell "we don't know how old this is" from "this is current".
 */
export function describeHivStatus(resolved) {
  const s = normaliseHivStatus(resolved?.status);
  const label = HIV_STATUS_OPTIONS.find((o) => o.value === s)?.label || s;
  if (!resolved?.since) {
    return s === HIV_STATUS.UNTESTED ? "Untested / unknown" : `${label} (date not recorded)`;
  }
  const d = new Date(realTimestampFromStored(resolved.since));
  const when = Number.isNaN(d.getTime())
    ? "date not recorded"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${label} - as of ${when}`;
}

/**
 * Whether anonymise mode should hide this.
 *
 * HIV status is arguably the most sensitive single fact this app holds, so it
 * is included in the masked set rather than being an oversight - but it is
 * MASKED, not hidden entirely, and it is still shown to the person themselves.
 * Anonymise mode is about what shows when the phone is handed to someone else,
 * not about what the user can read about themselves.
 */
export function shouldMaskHivStatus(anonymiseModeActive) {
  return !!anonymiseModeActive;
}
