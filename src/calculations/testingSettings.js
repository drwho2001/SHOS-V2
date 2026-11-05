// The Testing module's "Setting" field: one owner for its stored keys, its
// display labels, and the migration from the values that shipped before
// 5 Nov 2026.
//
// WHY THIS FILE EXISTS (B7 in docs/DESIGN-AUDIT.md)
// -------------------------------------------------
// The field used to store the *display string itself*, complete with emoji:
//
//   "🏥😎 Clinic - Routine"
//   "🏥🤢 Clinic - Symptomatic"
//   "🏥➕ Clinic - Positive test"
//   "🏠 Home"
//
// That breaks two rules at once. Icons are Phosphor-only, so an emoji used as
// an icon is already wrong; and a display glyph used as a data key means the
// rendered text and the stored value cannot change independently. Renaming
// "Clinic - Routine" would either break every saved record or require a
// migration. It also made the "is this a home test?" branch compare against a
// literal that contained a platform-dependent emoji.
//
// The fix is a stable key in storage and a label at the edge. This module is
// deliberately in calculations/ rather than repositories/: seedDivergence.js
// needs the same normalisation to keep unedited demo records deletable, and it
// is pure, so both sides can import it without a repositories -> storage cycle.
//
// WHY THE MIGRATION MATCHES ON THE LABEL SUFFIX, NOT THE WHOLE STRING. The
// emoji differ between builds and platforms (the shipped values carry both a
// place glyph and a mood glyph), so an exact-match table would be correct only
// for the one build it was copied from. Every legacy value ENDS with its label,
// so matching on that suffix is stable across emoji variation and still leaves
// genuinely unknown free text untouched.

/**
 * The field's options, in display order.
 *
 * `value` is what storage holds; `label` is what the user reads. Deliberately
 * shaped as `{ value, label }` so the existing shared field components
 * (`optionValue`/`optionLabel` in optionShape.js) render and store the right
 * half without a second conversion at every call site.
 */
export const SETTING_OPTIONS = [
  { value: "clinicRoutine", label: "Clinic - Routine" },
  { value: "clinicSymptomatic", label: "Clinic - Symptomatic" },
  { value: "clinicPositive", label: "Clinic - Positive test" },
  { value: "home", label: "Home" },
];

export const SETTING_LABELS = Object.freeze(
  Object.fromEntries(SETTING_OPTIONS.map((option) => [option.value, option.label]))
);

const SETTING_KEYS = new Set(SETTING_OPTIONS.map((option) => option.value));

// Legacy display string -> stable key. Matched by suffix; see the header.
const LEGACY_LABEL_TO_KEY = Object.freeze(
  Object.fromEntries(SETTING_OPTIONS.map((option) => [option.label, option.value]))
);
const LEGACY_LABELS = Object.keys(LEGACY_LABEL_TO_KEY);

/**
 * Normalise any stored or in-flight Setting value to a stable key.
 *
 * A current key passes through unchanged. A legacy display string (emoji or
 * not) maps to its key. An unrecognised value is returned untouched rather
 * than blanked: this is a presentation field, and losing the owner's text is
 * worse than showing it.
 */
export function normaliseSetting(value) {
  if (typeof value !== "string" || value === "") return value ?? "";
  if (SETTING_KEYS.has(value)) return value;
  const label = LEGACY_LABELS.find((candidate) => value.endsWith(candidate));
  return label ? LEGACY_LABEL_TO_KEY[label] : value;
}

/**
 * The text to render for a stored Setting value.
 *
 * Handles both new keys and legacy strings, so a record that has not been
 * through the migration still reads correctly. Unknown values fall back to the
 * raw string, which is visibly wrong and therefore gets fixed, rather than an
 * empty row that silently loses the fact.
 */
export function settingLabel(value) {
  if (typeof value !== "string" || value === "") return "";
  const key = normaliseSetting(value);
  return SETTING_LABELS[key] || value;
}

/** True for both the new `home` key and the legacy "🏠 Home" string. */
export function isHomeSetting(value) {
  return normaliseSetting(value) === "home";
}

/** True for either clinic setting, new key or legacy string. */
export function isClinicSetting(value) {
  const key = normaliseSetting(value);
  return key === "clinicRoutine" || key === "clinicSymptomatic" || key === "clinicPositive";
}
