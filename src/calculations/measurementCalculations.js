// measurementCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Pure derivation for measurement readings. No I/O, no storage, no React.
//
// WHY THIS FILE EXISTS
// --------------------
// Added 30 Sep 2026 by the t053 "one owner per derived fact" audit, which found
// `classifyMeasurement` living inside `SHOS_Measurements_Prototype.jsx` — business
// logic sitting in a component, against this project's repository / calculation /
// sync split (CLAUDE.md: "a calculations file is pure business logic, no I/O").
//
// Severity was LOW and is recorded as such: there was exactly one consumer, so
// nothing could drift yet. This is a placement fix, not a bug fix, and it should
// not be described as anything more.
//
// WHY THE EXCLUDED TYPE IS A PARAMETER
// ------------------------------------
// The blood-pressure type constant lives in `measurementRepository.js`, and the
// established convention in `src/calculations/` is to NOT import repositories —
// `statsCalculations.js` takes resolver callbacks for exactly this reason. So the
// excluded type arrives as an argument rather than the module reaching across a
// layer boundary to import a constant. That is also why this is a judgement call
// worth recording: importing a pure constant would not be I/O, but it would break
// the pattern, and the pattern is the point.

/**
 * Classify a reading against the user's own set range for its type.
 *
 * Deliberately NOT a clinical judgement. A hardcoded "normal blood pressure" or
 * "normal CD4 count" table would edge into the diagnosis engine CLAUDE.md puts
 * permanently out of scope. The range is one the user sets, and no range means
 * no classification at all rather than a guessed default.
 *
 * @param {object} m the measurement reading
 * @param {{ normalRangeByType?: Record<string, { low?: number, high?: number }> }} prefs
 * @param {string} [excludedType] a type that cannot carry a single-value range
 *   (blood pressure is two values, so "low/high/normal" does not apply to it)
 * @returns {"low"|"high"|"normal"|null} null when no range is set, the value is
 *   missing, or the type is excluded
 */
export function classifyMeasurement(m, prefs, excludedType) {
  if (!m || m.value == null) return null;
  if (excludedType && m.type === excludedType) return null;
  const range = prefs && prefs.normalRangeByType ? prefs.normalRangeByType[m.type] : null;
  if (!range || range.low == null || range.high == null) return null;
  if (m.value < range.low) return "low";
  if (m.value > range.high) return "high";
  return "normal";
}
