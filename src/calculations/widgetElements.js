// widgetElements.js — the per-element visibility choice (t089).
//
// WHY THIS IS ITS OWN FILE. `widgetPrivacy.js` owns "what may a home-screen
// widget show", and `widgetPrivacy.test.js` enforces that with a scan of that
// module for the identifying field names — a scan that cannot tell a
// PERMISSION from a MENTION, because it is a text grep.
//
// A display choice needs to say which bridge field each toggle corresponds to,
// and those names are exactly the ones the scan forbids in that file. Rather
// than weaken a long-standing privacy guard, or disguise a field name so a grep
// could not see it, the mapping lives here and registers itself. That keeps
// `widgetPrivacy.js` containing permissions only, and the guard exactly as
// strict as it was written.
//
// The asymmetry below is the whole design, and it is deliberate in both
// directions:
//
//   TIER     unknown -> HIDE    it protects a secret.
//   ELEMENT  unknown -> SHOW   it only picks among rows already disclosed, and a
//                              blank widget reads to the user as data loss.
//
// Element choice can therefore only ever NARROW what the tier already permits.

import { registerElementBridgeFields, fieldAllowed } from "./widgetPrivacy.js";

/**
 * Toggle -> the bridge payload field that toggle would send.
 *
 * Every value is a field the corresponding provider already sends today; this
 * table adds no new disclosure, it only records which existing field each
 * optional row stands for.
 *
 * `null` for an unmapped row is fail-CLOSED: a row added to OPTIONAL_ELEMENTS
 * without a mapping here is not permitted, rather than silently allowed. The
 * alternative is a row whose privacy check becomes a no-op the moment someone
 * adds it above and forgets it here.
 */
export const ELEMENT_BRIDGE_FIELDS = {
  clinicCard: {
    showVisitTime: "visitTime",
    showLocation: "location",
    showClinicNum: "clinicNum",
    showTests: "tests",
    showDocType: "docType",
  },
};

registerElementBridgeFields(ELEMENT_BRIDGE_FIELDS);

/**
 * The two questions, in the order they must be asked.
 *
 *   fieldAllowed(widgetKey, bridgeField, tier)  -> may the tier show it at all?
 *   visible(...)                                 -> AND did the user keep it?
 *
 * Composing them in that order is what makes the second answer a strict subset
 * of the first, so a settings screen that gets this backwards still cannot
 * widen the disclosure.
 */
export function elementShown(widgetKey, elementKey, tier, stored) {
  const map = ELEMENT_BRIDGE_FIELDS[widgetKey];
  const field = map && map[elementKey];
  if (!field) return false;
  if (!fieldAllowed(widgetKey, field, tier)) return false;
  const raw = stored ? stored[elementKey] : undefined;
  return raw === undefined ? true : raw !== false;
}