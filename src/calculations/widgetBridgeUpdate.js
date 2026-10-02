// The one path every widget update goes through, so a tier cannot be bypassed.
//
// WHY A HELPER RATHER THAN SEVEN CONDITIONALS
// -------------------------------------------
// Six call sites in five files feed the bridge today, and a seventh would arrive
// eventually. Each one deciding for itself whether it may send the medication
// name is the arrangement this repo keeps having to undo: one rule computed in
// several places drifting silently. The Testing reminder banner shipped dead for
// its entire life for exactly this reason - a fingerprint computed in a file the
// scheduler had no copy of.
//
// WHERE THE FILTER LIVES, AND WHY
// -------------------------------
// Here, in JS, rather than in the Java provider. The rule's owner is
// widgetPrivacy.js, which is JS, so this is the only place the rule can be
// applied without the table existing twice. It is also sufficient rather than
// merely convenient: a field that never crosses the bridge never reaches
// EncryptedSharedPreferences, so no provider bug can render what is not stored.
// Filtering at the WRITE boundary means the sensitive value is never resident in
// widget storage in the first place, which is stronger than hiding it at render
// time.
//
// The one thing JS cannot do alone is BLANK a widget: at "off" the payload is
// empty, which would leave the widget's own background and title on screen. So
// the tier is still sent, and the provider hides its root when it reads "off".
// That split is deliberate and is the only part of the rule that exists twice.

import { tierFor, fieldAllowed, isDataWidget } from "./widgetPrivacy";

/**
 * Loads the stored widgetPrivacy map, or null if it cannot be read.
 *
 * Returning null rather than a default is what makes "never configured" and
 * "configured to something unreadable" distinguishable downstream - tierFor
 * maps those to a per-widget default and to `off` respectively, and collapsing
 * them here would make this feature's first run blank every widget on upgrade.
 */
async function loadStoredPrivacy() {
  try {
    const { AppPreferencesRepository } = await import(
      "../repositories/appPreferencesRepository.js"
    );
    const prefs = await AppPreferencesRepository.getPreferences();
    return prefs?.widgetPrivacy ?? null;
  } catch {
    // An unreadable preference file is not a reason to disclose. Null means
    // "cannot tell", which resolves to the safe per-widget default, and the
    // unreadable-value case is handled by tierFor itself.
    return null;
  }
}

/**
 * Sends one widget update, filtered to what its tier permits.
 *
 * @param bridge   the resolved Capacitor plugin (or anything with the methods)
 * @param widgetKey one of DATA_WIDGETS - decides the tier
 * @param method   the bridge method to call, e.g. "updateNextDose"
 * @param payload  the full field set the widget COULD show, unfiltered
 * @param redactedText one pre-formatted line to show instead, when the tier is
 *   Redacted. Computed by the CALLER rather than here, because only the caller
 *   knows what its widget means - this module deliberately knows nothing about
 *   what any widget displays.
 *
 *   Added rather than reusing an existing text field because that field means
 *   something specific at Full ("Active", "Testosterone"), and overwriting it
 *   would mean the provider could no longer tell which tier rendered it.
 *
 * @returns true if the update was sent, false if there was no bridge
 */
export async function sendWidgetUpdate(bridge, widgetKey, method, payload, redactedText) {
  if (!bridge || typeof bridge[method] !== "function") return false;

  if (!isDataWidget(widgetKey)) {
    // Not a data widget, so there is no tier to apply. Only reachable by a
    // mistake, since the QuickAdd widgets are launch intents with no bridge
    // method at all - but a silent pass-through here would be a fail-open.
    throw new Error(`sendWidgetUpdate: "${widgetKey}" is not a data widget`);
  }

  const tier = tierFor(widgetKey, await loadStoredPrivacy());

  if (tier === "off") {
    // Deliberately sends nothing but the tier. Not "send the fields and let the
    // provider hide them": a value that crosses the bridge is a value in widget
    // storage, and the point of Off is that it is not there.
    await bridge[method]({ tier: "off" });
    return true;
  }

  const allowed = {};
  const dropped = [];
  for (const [field, value] of Object.entries(payload || {})) {
    if (fieldAllowed(widgetKey, field, tier)) allowed[field] = value;
    else dropped.push(field);
  }

  // Visible rather than silent, because a field silently dropped is exactly the
  // bug a test has to notice, and a developer adding a field to a payload needs
  // to know their new field is not being sent.
  if (dropped.length && tier === "redacted") {
    console.warn(
      `[widgetPrivacy] ${widgetKey} is redacted; not sending: ${dropped.join(", ")}`
    );
  }

  // ADDED after the provider layer was found not to read the filtered payload.
  //
  // Filtering alone was NOT enough, and the reason is the useful part. With only
  // a filtered payload, every provider fell back to its own default placeholder
  // string - so a Redacted DoxyPEP widget said "No active window" when a window
  // was active. Safe, but a false statement about the user's own health on a
  // home screen, which is worse than useless.
  //
  // The fix is for the CALLER - which understands what its widget means - to
  // supply the redacted wording, so no provider has to understand the tier at
  // all. Java stays dumb; the privacy decision stays in JS where it is testable.
  //
  // Sent ONLY at redacted. At full the real fields are used; at off nothing is
  // sent at all, so an empty string here would still be a value in storage.
  if (tier === "redacted" && redactedText) {
    allowed.redactedText = redactedText;
  }

  await bridge[method]({ ...allowed, tier });
  return true;
}
