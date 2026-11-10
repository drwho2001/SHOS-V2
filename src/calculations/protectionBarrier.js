// protectionBarrier.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Protection Registry holds a mix of genuinely different things: barriers
// (Condom, Dental dam, internal condom), medication (PrEP, PEP) and the
// explicit non-answer (None). The encounter form can store PrEP-only and say
// nothing about barriers, which reads as "protection was handled" on the card
// even though no condom or dam was used.
//
// This helper answers one question — "did any selected entry name a barrier?"
// — so the form, the read view and the encounter card can all show the same
// derived "No barrier method" line. It is DELIBERATELY a name match rather
// than an id match: the registry is user-editable, so ids cannot be assumed,
// and a user-added "Dental dam" must count the first time they use it.
//
// Nothing here is stored. A derived label that gets written back would go
// stale the moment a condom is added, and would create a fake registry value
// that outlives the encounter that produced it.

// Whole-word matches only. "Condom"/"condoms", "Femidom", "Internal condom",
// "Dental dam" and a bare "Dam" all count; "damn", "Amsterdam" and
// "Dampier" do not. Case and surrounding whitespace are ignored.
const BARRIER_PATTERN = /\b(condoms?|femidoms?|dental\s*dams?|dams?)\b/i;

// A negated barrier is not a barrier. This must be checked BEFORE the positive
// pattern: "No condom" contains the word "condom", so without this a registry
// entry describing the absence of a barrier would be read as one — the exact
// false negative this helper exists to prevent. It also catches "without a
// condom", "not using a dam" and "no barrier".
const NEGATED_BARRIER_PATTERN =
  /\b(no|without|not\s+using|never(?:\s+used)?)\s+(?:a\s+|any\s+)?(?:condoms?|femidoms?|dental\s*dams?|dams?|barrier)\b/i;

export const NO_BARRIER_LABEL = "No barrier method";

export function isBarrierMethod(name) {
  const value = String(name || "").trim();
  if (!value) return false;
  if (NEGATED_BARRIER_PATTERN.test(value)) return false;
  // "PrEP", "PEP", "None" and other medication/abstinence entries contain no
  // barrier word, so they fall through to false without a second exclusion
  // list. A combined entry such as "Condom + PrEP" still counts, because the
  // positive check runs on the whole string.
  return BARRIER_PATTERN.test(value);
}

export function hasBarrierMethod(names) {
  return (Array.isArray(names) ? names : []).some(isBarrierMethod);
}
