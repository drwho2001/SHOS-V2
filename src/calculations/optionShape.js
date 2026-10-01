// The one owner of "what shape is an option, and what do we render or store".
//
// WHY THIS EXISTS
// ---------------
// SHOS has eight independent copies of a `<SelectField>` and five of a
// `<MultiSelectChips>` - the same duplicated-field-component pattern the repo
// documents throughout. Every one of them used to render its option parameter
// raw:
//
//   {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
//   {options.map((opt) => { ... <div key={opt}>{opt}</div> })}
//
// That is only legal while every caller passes plain strings. On 29 Sep 2026 the
// HIV status override began passing `{ value, label }` objects, and opening My
// Profile -> Edit threw React error #31 - "Objects are not valid as a React
// child" - in three published APKs. My Profile's copy was made
// shape-tolerant; the other twelve were not, so the next caller to pass objects
// would have reproduced the crash in a module nobody had opened in a test.
//
// The failure is worse in `MultiSelectChips` than in `SelectField`, and this is
// the part that is easy to miss. An object used as a React child throws loudly,
// which is at least visible. But the same component also does:
//
//   value.includes(opt)          -> false, forever, so the chip never lights up
//   onChange([...value, opt])    -> STORES THE OBJECT
//
// So a single object-valued option in a MultiSelectChips field would not crash.
// It would quietly write `{value, label}` objects into a field that every other
// reader expects to hold strings - travelMode, statedKinks, bdsmRole. That is
// silent data corruption, which is worse than a crash, and it is the reason this
// is a shared module rather than a helper pasted into nine files.
//
// WHY THE OPTIONAL CHAIN. `optionValue(undefined)` returns undefined rather
// than throwing. An option list is user-extensible (custom option lists), so a
// nullish entry is not a shape this repo should crash on - and a picker that
// throws mid-render takes the whole screen down with it.
//
// NOT a place to normalise the whole list. These two functions exist so that a
// render site can be correct in one line. Deciding what a component ACCEPTS is
// the component's own business; this only answers "for this option, what do I
// show, and what do I store".

/**
 * The value to STORE for an option, and to use as a React key.
 *
 * Strings pass through unchanged, so every existing caller that passes a plain
 * string array behaves exactly as it did before this module existed.
 */
export function optionValue(opt) {
  return typeof opt === "string" ? opt : opt?.value;
}

/**
 * The text to DISPLAY for an option.
 *
 * Deliberately not a fallback to `optionValue`: if an object carries no label,
 * showing its value is how a raw stored code ends up in front of a user, which
 * is exactly the defect the label half of this exists to prevent. Returning
 * undefined renders an empty chip, which is visibly wrong and therefore gets
 * fixed.
 */
export function optionLabel(opt) {
  return typeof opt === "string" ? opt : opt?.label;
}