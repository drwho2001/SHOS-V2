// allergyDisplay.js
//
// R4 (18 Nov) — "NKDA / None / N/A / not recorded" is a POSITIVE clinical
// state ("we checked; no allergies"), not a missing/empty one. It must read
// as a clear/green state, never as a warning. Only a real allergy entry gets
// the alert styling. No clinical advice — this is presentation only.
const NO_ALLERGY_SENTINEL = /^(nkda|n\/?a|na|none|nil|no|not recorded|no (known )?allerg(?:y|ies)|unknown|none known)$/i;

/** True when a single recorded value means "no allergies". */
export function isNoAllergyValue(value) {
  return NO_ALLERGY_SENTINEL.test(String(value ?? "").trim());
}

/** True when the whole allergies list carries no real allergy. */
export function hasNoAllergies(allergies) {
  const list = Array.isArray(allergies) ? allergies : [];
  return list.length === 0 || list.every(isNoAllergyValue);
}

/**
 * Tone for an allergies display: "clear" (green) for a no-allergy state,
 * "alert" (red) for a real allergy. Pure so every surface agrees.
 */
export function allergyTone(allergies) {
  return hasNoAllergies(allergies) ? "clear" : "alert";
}

export function noAllergyLabel(allergies) {
  const list = Array.isArray(allergies) ? allergies.filter((a) => String(a ?? "").trim()) : [];
  return list.length ? list.join(", ") : "None recorded";
}
