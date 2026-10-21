// The one owner of "what may a home-screen widget show".
//
// WHY THIS EXISTS
// ---------------
// `widgetPrivacy` was written into the settings screen and read by NOTHING. The
// user picked a tier and every widget behaved identically. It was also aimed at
// the wrong widgets: it had keys for the three QuickAdd widgets, which render a
// launch icon and no data at all, while Test, Cycle and ClinicCard - the three
// that disclose the most - had no key and could not be configured at all.
//
// This module makes it real: one place that knows every widget, every tier, what
// each tier is allowed to show, and what the default is when nothing is stored.
//
// THE REDACTED RULE, AND WHY IT IS NOT PER-WIDGET
// ----------------------------------------------
// The first draft of this design gave each widget its own idea of "redacted" -
// "a test is logged" for LastTest, "Tracking" for Cycle, a bare count for
// Refills. That was rejected as incoherent, and the objection was right: with
// seven different meanings the user has no predictable model of what setting a
// widget to Redacted will actually show them, and every future widget invites
// another interpretation.
//
// So there is exactly one rule, applied everywhere:
//
//   REDACTED = category presence without specifics.
//
//   ALLOWED   a category ("Medication", "Refills", "Appointments", "Testing",
//              "DoxyPEP", "Tracking", "Clinic card") and a COUNT or a coarse
//              on/off state.
//   FORBIDDEN names, dates, times, locations, test types, and any per-record
//              detail that identifies.
//
// Counts are allowed deliberately. "2 refills due" identifies nobody; hiding it
// would make the tier useless rather than private. A count stops being allowed
// if a future widget can make the number itself sensitive (a count of one
// pregnancy, say) - which is why the rule is stated here once rather than
// re-decided per widget.
//
// FULL is not the absence of a rule, it is "show what the widget shows at all".
// OFF is "render nothing", which is also what happens when the encrypted widget
// store is unavailable.
//
// FAIL CLOSED, BUT NOT ON FIRST RUN
// ---------------------------------
// An unrecognised stored value resolves to `off`, matching
// `normaliseDisclosureLevel`'s treatment of a bad notification level: a value
// this code does not understand must not be read as permission to disclose.
//
// A MISSING value is different, and deliberately so. It resolves to the per-widget
// default rather than to `off`, because on an upgrade nobody has ever set a tier
// and silently blanking every widget on a phone would be a hostile surprise. The
// distinction is "never configured" versus "configured to something unreadable",
// and collapsing the two would make this feature's first run destructive.

/** The seven widgets that render real data, plus the three that render none. */
export const DATA_WIDGETS = [
  "nextDose",
  "refillDue",
  "lastTest",
  "doxyPepWindow",
  "cycle",
  "clinicCard",
];

/**
 * The QuickAdd widgets, listed so the settings screen can say plainly that they
 * have no tier rather than offering a control that does nothing. They render a
 * launch icon; there is nothing to mask, and inventing a fake "redacted" state
 * for them would be the same defect as the setting that currently does nothing.
 */
export const NO_DATA_WIDGETS = ["quickAddContact", "quickAddEncounter", "quickAddMedication"];

export const TIERS = ["full", "redacted", "off"];

/**
 * Defaults when nothing has been stored.
 *
 * nextDose is `full` deliberately: the owner chose to see the medication name,
 * reversing an earlier decision that it should never be shown. The other data
 * widgets default to `redacted` because none of them has been reviewed by the
 * owner yet, and redacted is the choice that cannot surprise them by disclosing.
 */
export const DEFAULT_TIERS = {
  nextDose: "full",
  refillDue: "redacted",
  lastTest: "redacted",
  doxyPepWindow: "full",
  cycle: "redacted",
  clinicCard: "redacted",
};

/**
 * What each tier is ALLOWED to show, per widget.
 *
 * This is the enforcement point for the rule above. `full` is `null` because it
 * means "no restriction" rather than a specific set. `redacted` lists the only
 * things that may be rendered; a provider that reaches for a field not on this
 * list is the bug the guard exists to catch.
 *
 * Keys are the literal strings a provider may pass to the bridge at this tier.
 */
export const ALLOWED_AT_REDACTED = {
  // CHANGED 2 Oct 2026 - countdownAt is ALLOWED at Redacted, on the owner's
  // decision. My first version excluded it on the grounds that "a countdown
  // timestamp is a time", which is right about an absolute time and wrong about a
  // countdown. "in 4h 12m" says how long you have left; "20:00" reveals your
  // daily routine, which is the thing worth not disclosing and the thing a
  // passer-by could actually use. So the countdown discloses strictly LESS than
  // the wall-clock time it replaces, and excluding it made Redacted worse than
  // useless for the one widget whose whole job is a deadline.
  //
  // The distinction being made is absolute time versus elapsed time. The former
  // is a fact about the user's routine; the latter is only true right now, and
  // goes stale on its own.
  nextDose: ["category", "state", "countdownAt"],
  refillDue: ["category", "count"],
  lastTest: ["category", "state"],
  doxyPepWindow: ["category", "state", "countdownAt"],
  cycle: ["category", "state"],
  clinicCard: ["category", "count"],
};

/** Coarse, non-identifying state text, used when a widget is redacted. */
export const REDACTED_COPY = {
  nextDose: "Medication",
  refillDue: "Refills",
  lastTest: "Testing",
  doxyPepWindow: "DoxyPEP",
  cycle: "Tracking",
  clinicCard: "Clinic card",
};

/** True for a tier this code understands. */
export function isValidTier(value) {
  return TIERS.includes(value);
}

/**
 * True for a widget that renders real data, and so has a tier.
 *
 * The settings screen uses this to decide whether to draw a tier picker at all.
 * It matters because the original screen drew one for every row including the
 * three QuickAdd widgets, offering a choice between Full and Off for a launch
 * icon that displays no data - a control that describes nothing, which reads as
 * working and is worse than no control at all.
 */
export function isDataWidget(widgetKey) {
  return DATA_WIDGETS.includes(widgetKey);
}

/**
 * The tier to use for one widget.
 *
 * @param widgetKey one of DATA_WIDGETS
 * @param stored    the stored map, or null/undefined when nothing is stored
 * @param widgetKeyFallback tier to use for an unknown widget
 */
export function tierFor(widgetKey, stored, fallback = "redacted") {
  if (!DATA_WIDGETS.includes(widgetKey)) return fallback;
  // Never configured -> the per-widget default. Distinguishing this from an
  // unreadable value is deliberate; see the header.
  if (!stored || typeof stored !== "object") return DEFAULT_TIERS[widgetKey];
  const raw = Object.prototype.hasOwnProperty.call(stored, widgetKey) ? stored[widgetKey] : undefined;
  if (raw === undefined) return DEFAULT_TIERS[widgetKey];
  // Configured to something this code cannot read -> disclose nothing.
  return isValidTier(raw) ? raw : "off";
}

/** Every widget's effective tier, for the settings screen and the bridge. */
export function resolveAllTiers(stored) {
  const out = {};
  for (const key of DATA_WIDGETS) out[key] = tierFor(key, stored);
  return out;
}

/**
 * Whether a named field may be sent to a widget at the given tier.
 *
 * Providers call this rather than branching on the tier themselves, so "full
 * allows everything, redacted allows only what is listed, off allows nothing"
 * is stated once. At `redacted` an unlisted field is refused, which is the
 * fail-closed direction: a widget that grows a new field does not start leaking
 * it because someone forgot to update a conditional.
 */
export function fieldAllowed(widgetKey, fieldName, tier) {
  if (tier === "off") return false;
  if (tier === "full") return true;
  const allowed = ALLOWED_AT_REDACTED[widgetKey];
  if (!allowed) return false;
  return allowed.includes(fieldName);
}

/**
 * Compose a Redacted widget line from a category and a coarse detail.
 *
 * ADDED 5 Oct 2026 (t059 follow-on). Shared because it is pure formatting and
 * genuinely identical across five callers - unlike the privacy DECISION, which
 * stays with each widget, because only that file knows what its widget means.
 *
 * Says nothing identifying by construction: both inputs are categories or counts,
 * which the Redacted rule allows, and neither is a name, date, location or type.
 * A count of zero is rendered rather than dropped, so an empty line never reads as
 * a broken widget.
 */
export function redactedWidgetLine(category, detail) {
  const d = detail === null || detail === undefined ? "" : String(detail).trim();
  return d ? `${category} - ${d}` : category;
}

/**
 * The rows a user may hide, per widget (t089).
 *
 * These are the OPTIONAL rows - the ones the widget renders in addition to its
 * title and its headline value. The title and the headline are deliberately
 * absent: a widget that showed nothing at all would be indistinguishable from a
 * broken one, so the minimum is not user-configurable. This mirrors the rule
 * already recorded for the Chronometer on the Next Dose widget, where a view
 * that consumes layout must be GONE rather than blank.
 *
 * `label` is what the settings screen shows, and is kept here so the settings
 * list and the enforcement list can never drift apart - the same single-source
 * rule `clinicVisitShape.js` uses for its group fields.
 *
 * `field` is the BRIDGE field this row would send, which is what the tier check
 * must be asked about. The two names are deliberately different: "may this be
 * SENT" is a privacy question about a payload field, "should this be DRAWN" is
 * a display question, and they must not be the same word.
 *
 * Note for the next reader: `widgetPrivacy.test.js`'s FORBIDDEN_AT_REDACTED
 * scan greps this whole module - comments included - for the identifying field
 * names, because it cannot tell a permission from a mention. The bridge field
 * each row corresponds to therefore lives in `ELEMENT_BRIDGE_FIELDS` in
 * `widgetElements.js`, not here: a mapping belongs with the thing it maps, and
 * keeping it out of this module means the scan sees only real permissions and
 * can stay exactly as strict as it was written to be.
 *
 * Ordering is display order, so the settings list reads in the same sequence as
 * the widget itself.
 */
export const OPTIONAL_ELEMENTS = {
  clinicCard: [
    { key: "showVisitTime", label: "Appointment time" },
    { key: "showLocation", label: "Location" },
    { key: "showClinicNum", label: "Clinic number" },
    { key: "showTests", label: "Tests" },
    { key: "showDocType", label: "Clinician" },
    // ADDED 21 Oct 2026 - what the appointment is FOR ("PrEP review",
    // "Routine screening"), on the owner's instruction that the bigger card
    // could carry "tests/procedures planned for that appt".
    //
    // The clinic's ADDRESS and POSTCODE are not rows of their own: they are
    // part of the location, and the provider shows them with it.
    { key: "showReason", label: "Reason for visit" },
  ],
};

/** The optional rows a widget exposes, in display order. */
export function optionalElementsFor(widgetKey) {
  return OPTIONAL_ELEMENTS[widgetKey] || [];
}

/**
 * The bridge payload field an optional row corresponds to, or null when there
 * is none.
 *
 * `null` is the fail-closed answer for a row with no mapping: see
 * elementVisible's comment for why that direction matters.
 *
 * The map itself lives in `widgetElements.js`, which imports this module. A
 * dependency arrow cannot be reversed to satisfy this, so the map is passed in
 * by that module at load time through `registerElementBridgeFields`. This is
 * deliberate and ugly: the alternative was to write the identifying field names
 * here, where `widgetPrivacy.test.js`'s FORBIDDEN_AT_REDACTED scan greps the
 * whole module for them and could not tell a mapping from a permission. Writing
 * them in this module would have meant either weakening a long-standing privacy
 * guard or disguising the names so a grep could not see them, and both are
 * worse than an explicit registration.
 */
let ELEMENT_FIELD_SUFFIX = {};

export function registerElementBridgeFields(map) {
  ELEMENT_FIELD_SUFFIX = map || {};
}

export function elementBridgeField(widgetKey, elementKey) {
  const forWidget = ELEMENT_FIELD_SUFFIX[widgetKey];
  return (forWidget && forWidget[elementKey]) || null;
}

/**
 * Whether an optional row may be SENT for this widget.
 *
 * The invariant this whole function exists to protect: element choice can only
 * ever NARROW what the tier already permits. It can hide a row the Full tier
 * allows; it can never reveal one the Redacted tier forbids, and it can never
 * override `off`.
 *
 *   fieldAllowed(widgetKey, name, tier)  ->  may the tier show it at all?
 *   elementVisible(widgetKey, name, tier, stored) ->  AND did the user keep it?
 *
 * Composing them in that order is what makes the second answer a strict subset
 * of the first, so a settings UI that gets this wrong still cannot widen the
 * disclosure.
 */
export function elementVisible(widgetKey, elementKey, tier, stored) {
  const rows = OPTIONAL_ELEMENTS[widgetKey];
  const row = rows ? rows.find((r) => r.key === elementKey) : null;

  // A field that is not in this widget's list is not a display choice, it is
  // part of the widget. Treating an unlisted name as user-hideable would let a
  // provider opt its own identifying field out of its rendering by accident, so
  // it falls through to the plain tier check and nothing else.
  if (rows && !row) return fieldAllowed(widgetKey, elementKey, tier);

  // Delegated so the toggle->field mapping lives in widgetElements.js, beside
  // the reasoning for why the two names differ. Until that module has been
  // imported there is no mapping at all, which fails CLOSED: a caller that uses
  // this before importing it sees no optional row, rather than an unchecked one.
  const field = elementBridgeField(widgetKey, elementKey);
  if (!field || !fieldAllowed(widgetKey, field, tier)) return false;

  const raw = stored ? stored[elementKey] : undefined;
  // Absent means "never configured" -> show it. That is the fail-open direction
  // for DISPLAY, and it is the right one here: a missing setting must not blank
  // a widget, because a blank widget looks like data loss to the user. This is
  // the opposite trade to the tier check above, where unknown means hide, and
  // the difference is that the tier protects a SECRET while this only controls
  // which of the user's own, already-disclosed rows are drawn.
  if (raw === undefined) return true;
  return raw !== false;
}

/** Every widget's element choices, for the settings screen. */
export function resolveAllElements(stored) {
  const out = {};
  for (const [key, rows] of Object.entries(OPTIONAL_ELEMENTS)) {
    const perWidget = {};
    for (const row of rows) perWidget[row.key] = elementVisible(key, row.key, "full", stored);
    out[key] = perWidget;
  }
  return out;
}
