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

// NON-ANSWER entries ("None", "N/A", a user-added "No condom", "no barrier"…)
// describe the absence of protection. They are NOT distinct protection methods
// and must never appear next to the derived NO_BARRIER_LABEL — that double
// label ("None" + "No barrier method") was the exact redundancy reported.
// Negated barriers are already caught by NEGATED_BARRIER_PATTERN; the rest are
// explicit non-answer words. Whole-value match only (no "Amsterdam" false hit).
const NON_ANSWER_PATTERN = /^(none|n\/a|na|not applicable|nil|no protection|no barrier|nothing)$/i;

export function isProtectionNonAnswer(name) {
  const value = String(name || "").trim();
  if (!value) return false;
  return NON_ANSWER_PATTERN.test(value) || NEGATED_BARRIER_PATTERN.test(value);
}

/**
 * Single canonical display list for a record's protection names.
 *
 * Rule (owner, 17 Nov 2026):
 *   - a condom/dam selected  -> show the real methods only
 *   - none selected          -> show exactly one derived "No barrier method"
 * "No barrier method" REPLACES "No condom" and "None" — it is never stored,
 * and a non-answer entry is folded into it rather than shown alongside it.
 */
export function canonicalProtectionNames(names) {
  const list = Array.isArray(names) ? names.filter(Boolean) : [];
  const real = list.filter((n) => !isProtectionNonAnswer(n) && n !== NO_BARRIER_LABEL);
  if (hasBarrierMethod(list)) return real;
  return [NO_BARRIER_LABEL, ...real];
}

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
