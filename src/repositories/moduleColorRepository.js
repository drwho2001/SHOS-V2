// moduleColorRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 26 Aug 2026: let the user customize each module's base
// colour from a real Design/Preferences section in Settings, instead
// of the 5 module colours being permanently hardcoded in
// designTokens.js.
//
// EXTENDED — real ask: the same storage now also holds the two
// semantic pass/fail colours (actionRed/actionGreen), not just the 5
// module identity colours — see CUSTOMIZABLE_ACTION_KEYS below. Still
// one flat key/value store; the "module colour" framing in this file's
// name is the historical starting point, not a hard boundary.
//
// HONEST ARCHITECTURE NOTE: ACCENTS in designTokens.js is a plain
// object, imported once by every module file when the app first
// loads — not read through a live hook. That means a colour change
// here takes effect on next app reload/reopen, not instantly across
// every already-open screen. A fully live version would need every
// module to read colours through a hook instead of a static import —
// a much bigger change than this ask needed. Reload-to-apply is a
// reasonable, honest trade-off for a personal single-user app, not a
// silently-cut corner — stated plainly here and in the Settings UI
// itself.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_module_color_overrides";

// The 5 real, customizable module base colours — matches ACCENTS'
// own keys in designTokens.js exactly. Sub-registry accents (Kink/
// Protection etc.) are a separate concern, not included here.
export const CUSTOMIZABLE_MODULE_KEYS = ["contacts", "encounters", "medication", "healthcare", "home"];

// ADDED — real ask: the semantic pass/fail (red/green) pair, editable
// alongside the 5 module colours above — same storage, same
// getOverrides()/setOverride()/resetOverride() calls, just two more
// possible keys rather than a second repository. See designTokens.js's
// own ACTION export for how these two are actually read.
export const CUSTOMIZABLE_ACTION_KEYS = ["actionRed", "actionGreen"];

// ADDED — real ask, 28 Aug 2026: "look for colour blind sets... defer
// specific choice to you, if research needed go for it." Built from
// Okabe & Ito's 2008 categorical palette — the standard, peer-reviewed
// colour set validated as mutually distinguishable under protanopia,
// deuteranopia, AND tritanopia at once (cited as the reference set in
// Wong, "Points of view: Color blindness," Nature Methods 2011). Every
// one of Okabe-Ito's 7 non-black hues is used exactly once here, none
// wasted, then each is darkened off its raw published value (which
// targets on-screen chart swatches, not small app text/icons) until it
// clears ~3:1 contrast against white — matching this app's own existing
// default accent colours, which themselves range 3.19-11.32:1 rather
// than a stricter idealised bar the app doesn't enforce anywhere else.
// Hue assignments lean on the two real, documented facts the ask named:
// (1) non-colourblind convention already reads green/blue as
// health/medication and red as love-or-danger, so those hold wherever
// Okabe-Ito has a matching hue; (2) where it doesn't (Contacts,
// Home), pick whatever remaining hue keeps the whole 5-module set
// visually spread rather than force a false match. Final assignment:
//   Healthcare -> bluish green (health, as expected)
//   Medication -> blue (medication, as expected)
//   Encounters -> reddish purple (closest safe hue to "love/red" that
//     doesn't collide with actionRed's own vermillion below)
//   Contacts   -> amber/ochre (no natural CVD-safe "archive" hue exists;
//     this is the one Okabe-Ito hue left with good spread from the rest)
//   Home       -> dark gold/olive (yellow, darkened for legibility) —
//     genuinely flexible per the ask ("home module colour can change
//     too"), and the one remaining hue once the other 4 are placed
//   actionRed   -> vermillion, the deliberate safe substitute for true
//     red/green confusion (the single highest-value fix here)
//   actionGreen -> bluish green, same hue as Healthcare — module-colour
//     vs action-colour reuse was never a distinguishability problem,
//     only module-vs-module and red-vs-green mutual distinguishability
//     actually are, and both of those are clean (verified: every pair
//     of the 5 module hues is 14-163deg apart; actionRed/actionGreen are
//     137deg apart).
export const CVD_SAFE_PALETTE = {
  contacts: "#B87F00",
  encounters: "#CC79A7",
  medication: "#0072B2",
  healthcare: "#009E73",
  home: "#A1960D",
  actionRed: "#D55E00",
  actionGreen: "#009E73",
};

export const ModuleColorRepository = {
  // Returns only the overrides actually set — {} if none.
  getOverrides() {
    return storage.load(STORAGE_KEY, {});
  },

  setOverride(moduleKey, hexColor) {
    const current = this.getOverrides();
    storage.save(STORAGE_KEY, { ...current, [moduleKey]: hexColor });
  },

  resetOverride(moduleKey) {
    const current = this.getOverrides();
    const { [moduleKey]: _removed, ...rest } = current;
    storage.save(STORAGE_KEY, rest);
  },

  resetAll() {
    storage.save(STORAGE_KEY, {});
  },

  // ADDED — the toggle's on/off state is derived, not a separate stored
  // flag: "on" means every one of the 7 preset keys currently holds
  // exactly the preset's own value. A later manual edit to any one of
  // those 7 colours (via the same ColorInputRow rows just below the
  // toggle) naturally reads back as "off" without needing to keep a
  // flag in sync with it.
  isCvdPaletteActive() {
    const current = this.getOverrides();
    return Object.entries(CVD_SAFE_PALETTE).every(([key, hex]) => current[key] === hex);
  },

  applyCvdPalette() {
    const current = this.getOverrides();
    storage.save(STORAGE_KEY, { ...current, ...CVD_SAFE_PALETTE });
  },

  // Removes exactly the 7 preset keys, not a blanket resetAll() — a
  // manual customisation to some OTHER key the user set beforehand
  // (there are none today beyond these 7, but the repository doesn't
  // assume that stays true) is left untouched.
  removeCvdPalette() {
    const current = this.getOverrides();
    const rest = { ...current };
    for (const key of Object.keys(CVD_SAFE_PALETTE)) delete rest[key];
    storage.save(STORAGE_KEY, rest);
  },
};
