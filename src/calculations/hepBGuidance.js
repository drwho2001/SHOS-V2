// Generalised Hepatitis B vaccine guidance (t025).
//
// WHY THIS IS GUIDANCE AND NOT AN ELIGIBILITY CHECK — the distinction is the
// whole point of the file, and it is the reason t025 was rescoped.
//
// UK hepatitis-B eligibility turns substantially on HIV status, and until
// t025 this app held NO HIV status field at all. An "eligibility" banner
// would therefore have had to infer a fact it does not have, from a partial
// profile, and render the result on a home screen. That is the automated
// clinical risk scoring CLAUDE.md puts permanently out of scope, and it is
// worse than not shipping: a confidently wrong eligibility verdict changes
// what someone goes and asks a clinician for.
//
// So the rule enforced here is structural, not stylistic:
//
//   1. This module NEVER returns a verdict about the individual. It returns
//      publicly-published advice, or nothing.
//   2. It NEVER branches on a status it does not fully understand. Unknown
//      and untested take the SAME path, because the difference between them
//      is not a fact the app can establish.
//   3. It NEVER says "you need this" or "you do not need this". It says what
//      the guidance says, and links out to the NHS.
//
// Pure functions, no I/O — the repository/calculation split this repo enforces.

import { HIV_STATUS, isValidHivStatus } from "./hivStatusCalculations.js";

const NHS_HEP_B_GUIDANCE = "https://www.nhs.uk/conditions/vaccinations-and-immersions/";

/**
 * True when a record is for hepatitis B.
 *
 * Deliberately loose on the name. Users type "Hep B", "Hepatitis B", "HepB",
 * and this app's own option lists are free text, so an exact match would miss
 * real records and produce guidance for a vaccine the user already has. A
 * false positive is merely a redundant line of general advice; a false
 * negative silently withholds advice that may apply.
 *
 * B ONLY, and never as a bare character class after "hep" - the first version
 * was `hep\s*\(?[ab]\)?`, which matches "Hepatitis A" as hepatitis B because
 * the `[ab]` lands on the "a" of "atitis". Hepatitis A is a different vaccine
 * and suppressing its guidance on the strength of that is exactly the kind of
 * confidently-wrong this app keeps paying for. A test caught it.
 */
export function isHepatitisB(record) {
  return /\bhep(?:atitis)?[\s-]*\(?b\)?\b/i.test(String(record?.name || ""));
}

/**
 * The owner's HIV status, as recorded. Accepts a resolved object, a raw
 * status string, or null.
 *
 * Only a POSITIVE status produces different wording, and even then the
 * wording is about what the guidance recommends for people who are living
 * with HIV — not about what this person has. Negative and unknown read the
 * same, deliberately: the guidance is the general one either way.
 */
function readHivStatus(input) {
  const raw =
    typeof input === "string" ? input
    : isValidHivStatus(input?.status) ? input.status
    : null;
  return isValidHivStatus(raw) ? raw : null;
}

/**
 * Returns guidance, or null when there is genuinely nothing to say.
 *
 * `null` is a real answer and must not be rendered as "you are up to date" —
 * the caller shows nothing at all, which is the honest outcome for a screen
 * this app has no opinion about.
 */
export function getHepatitisBGuidance({ hivStatus = null, hasHepB = false } = {}) {
  // Already recorded against a hepatitis B vaccine. Saying anything about
  // hepatitis B to someone who has it logged would be noise, and this app is
  // explicitly a quiet, no-alarm tracker.
  if (hasHepB) return null;

  const status = readHivStatus(hivStatus);

  if (status === HIV_STATUS.POSITIVE_SUPPRESSED || status === HIV_STATUS.POSITIVE_UNSUPPRESSED) {
    return {
      title: "Hepatitis B",
      body:
        "People living with HIV are usually advised to be vaccinated against hepatitis B. " +
        "This app does not work out whether that applies to you or how many doses you need — " +
        "your clinic will know from your records.",
      link: NHS_HEP_B_GUIDANCE,
    };
  }

  // Everyone else, including anyone whose status is unknown or untested.
  // Identical wording in all three cases is the point: the difference between
  // "negative", "untested" and "never recorded" is not something this app can
  // establish, and tailoring the advice on a guess is what this file exists
  // to prevent.
  return {
    title: "Hepatitis B",
    body:
      "Hepatitis B vaccination is recommended for some people and not others, " +
      "depending on things like your health, where you were born, and what you do. " +
      "The NHS page explains who it is usually offered to.",
    link: NHS_HEP_B_GUIDANCE,
  };
}

/** True if the text would read as a verdict about the individual. */
export function makesEligibilityClaim(guidance) {
  if (!guidance) return false;
  return /\b(you (need|do not need|must|should) (be )?(have|get)|you are eligible|you are not eligible)\b/i.test(
    guidance.body
  );
}
