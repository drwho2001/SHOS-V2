// healthcareTabs.js — one owner for which Healthcare sub-tabs sit in the pill
// row vs under "More", and the one-line budget that keeps them from wrapping
// onto a second row that would overlap the Episodes/Calendar/Card/Attachments
// shortcut strip.
//
// The cap is a REAL layout measurement, not a guess: on a 1080px-wide Redmi
// Note 13, five compact pills + More wrapped to two rows (row 2 y475-599),
// which overlapped the shortcut row (y561-684). Even four pills + More did
// not fit one line (row 1 already reached x984 with Vaccinations; More is
// ~159px more, past 1080). Three pills + More fit with room to spare. The
// Preferences card uses the same constant to disable further selections, so
// the user cannot create the overlap.

export const HEALTHCARE_TAB_KEYS = [
  "symptomLog",
  "testing",
  "clinicVisits",
  "vaccinations",
  "measurements",
  "menstrualHealth",
];

export const HEALTHCARE_VISIBLE_MAX = 3;

/** Default visible set: the three most-used clinical tabs (+ More). */
export const DEFAULT_VISIBLE_TABS = ["symptomLog", "testing", "clinicVisits"];

/**
 * Resolve the stored preference to a valid visible set.
 * - null / missing / corrupt -> default
 * - unknown keys are dropped; duplicates removed; order follows canonical
 *   tab order (not the stored order) so a preference edit can't scramble the row
 * - over-cap lists are truncated so the row can never wrap to two lines
 */
export function resolveVisibleTabs(stored, availableKeys = HEALTHCARE_TAB_KEYS) {
  const fallback = DEFAULT_VISIBLE_TABS.filter((k) => availableKeys.includes(k));
  if (!Array.isArray(stored)) return fallback;
  const valid = stored.filter((k) => availableKeys.includes(k));
  const unique = [...new Set(valid)];
  const ordered = availableKeys.filter((k) => unique.includes(k));
  if (ordered.length === 0) return fallback;
  return ordered.slice(0, HEALTHCARE_VISIBLE_MAX);
}

/** True when a proposed selection would wrap past one line. */
export function wouldWrap(keys) {
  return Array.isArray(keys) && new Set(keys).size > HEALTHCARE_VISIBLE_MAX;
}
