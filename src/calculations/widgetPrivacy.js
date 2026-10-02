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
  "nextAppointment",
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
  nextAppointment: "redacted",
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
  nextAppointment: ["category", "count"],
  lastTest: ["category", "state"],
  doxyPepWindow: ["category", "state", "countdownAt"],
  cycle: ["category", "state"],
  clinicCard: ["category", "count"],
};

/** Coarse, non-identifying state text, used when a widget is redacted. */
export const REDACTED_COPY = {
  nextDose: "Medication",
  refillDue: "Refills",
  nextAppointment: "Appointments",
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
