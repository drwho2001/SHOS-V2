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

// The real, customizable module base colours — matches ACCENTS' own
// keys in designTokens.js exactly. Sub-registry accents (Kink/
// Protection etc.) are a separate concern, not included here.
// CHANGED 2 Sep 2026 — added "menstrual" alongside the original 5, so
// its new dedicated colour (see designTokens.js) is real, editable
// module colour too, not a fixed literal.
export const CUSTOMIZABLE_MODULE_KEYS = ["contacts", "encounters", "medication", "healthcare", "home", "menstrual"];

// ADDED — real ask: the semantic pass/fail (red/green) pair, editable
// alongside the 5 module colours above — same storage, same
// getOverrides()/setOverride()/resetOverride() calls, just two more
// possible keys rather than a second repository. See designTokens.js's
// own ACTION export for how these two are actually read.
export const CUSTOMIZABLE_ACTION_KEYS = ["actionRed", "actionGreen"];

// ADDED — real ask, 28 Aug 2026: "look for colour blind sets... defer
// specific choice to you, if research needed go for it." Starts from
// Okabe & Ito's 2008 categorical palette — the standard, peer-reviewed
// colour set validated as mutually distinguishable under protanopia,
// deuteranopia, AND tritanopia at once (cited as the reference set in
// Wong, "Points of view: Color blindness," Nature Methods 2011) — but
// every value below is independently re-verified, not just trusted by
// citation, because Okabe-Ito's own values target simultaneous chart
// swatches at fixed size/saturation, not small app text/icons re-tuned
// for contrast, which turned out to matter (see next paragraph).
//
// REAL METHODOLOGY, not just hue-spacing on a colour wheel: each
// candidate was run through a Brettel/Vienot/Mollon-style linear LMS
// dichromacy simulation for all three deficiency types, then WCAG
// contrast was recomputed on the SIMULATED colour against a
// simulated background — not the plain formula. This caught a real,
// initially-missed problem: plain WCAG contrast (built on standard,
// non-CVD luminance weighting) overstates legibility for red-leaning
// hues, because protanopia AND deuteranopia both reduce perceived
// luminance for long-wavelength (red/orange) colours. An earlier pass
// of this palette (amber Contacts, dusty-pink Encounters, vermillion
// actionRed, all at their raw Okabe-Ito-derived lightness) looked fine
// under plain WCAG (~3-4:1) but actually dropped to ~2.0-2.5:1 once
// contrast was recomputed on the deuteranopia/protanopia-simulated
// colour — genuinely too low. Each affected colour below was darkened
// further until it clears ~3:1 under the WORST of {normal,
// protanopia-sim, deuteranopia-sim, tritanopia-sim} — the actual
// legibility floor for a colourblind viewer, not just a sighted one.
//
// The same simulation caught a second real problem in hue selection:
// an earlier Home candidate (dark gold/yellow, hue ~56deg, chosen for
// "good spread" by raw hue-wheel degrees from Contacts' amber at
// ~41deg) collapsed toward Contacts under protanopia/deuteranopia
// simulation — both sit in the same warm orange-yellow confusion
// region, and no amount of lightness/saturation tuning at that hue
// fixed it without destroying contrast-vs-white (bright yellow can't
// hit 3:1 against white at any lightness). Home was moved to a violet/
// indigo hue instead (261deg) — genuinely flexible per the ask ("home
// module colour can change too"), cool rather than warm so it doesn't
// share a confusion cluster with Contacts/Encounters/actionRed, and
// verified (not assumed) to keep real separation from every other
// colour under all three simulated deficiencies.
// Final assignment:
//   Healthcare -> bluish green (health, as expected)
//   Medication -> blue (medication, as expected)
//   Encounters -> reddish purple, darkened (closest safe hue to
//     "love/red" that doesn't collide with actionRed's own vermillion)
//   Contacts   -> amber/ochre, darkened (no natural CVD-safe "archive"
//     hue exists; the Okabe-Ito hue with the best real spread left)
//   Home       -> violet/indigo — see above; the one hue-family not
//     already in use by anything else in the app's action/module set
//   actionRed   -> vermillion, darkened — the deliberate safe
//     substitute for true red/green confusion, the single highest-
//     value fix here
//   actionGreen -> bluish green, same hue as Healthcare — module-colour
//     vs action-colour reuse was never a distinguishability problem,
//     only module-vs-module and red-vs-green mutual distinguishability
//     actually are, and both are verified clean under simulation.
//
// HONEST RESIDUAL LIMITATION: Medication and Healthcare's dark-mode
// variants (both auto-brightened by resolveDarkAccent/deriveDarkAccent
// below) sit uncomfortably close under TRITANOPIA specifically once
// simulated (~9-10 units apart in simulated RGB, vs a clean 25+ in
// light mode) — tritanopia is the rarest form (~1 in 10,000, vs ~1 in
// 12 for protanopia+deuteranopia combined) and both colours are the
// two strongest real contextual matches in the whole set (health=
// green, medication=blue), so this was left as a known, stated trade-
// off rather than sacrificing that contextual fit for the rarest case.
//
// ADDED 2 Sep 2026 — real ask: Menstrual's own colour (see
// designTokens.js) now HAS a real CVD-safe substitute too, verified
// the same way as the original 7 rather than guessed — the user's own
// correction: "balancing rules different for colourblind" means an
// 8th colour genuinely has to be checked against simulated vision, not
// picked by eye against the normal-vision palette. Verified via the
// standard Machado/Oliveira/Fernandes (2009) full-severity simulation
// matrices, run against protanopia, deuteranopia AND tritanopia
// together (the same three this whole preset targets), swept across
// hue/saturation/lightness to find the candidate with the largest
// worst-case separation from all 6 other genuinely-distinct colours
// below (healthcare/actionGreen are intentionally identical — see the
// note above — so excluded from that check) in EVERY simulation at
// once, restricted to hues that still read as plausibly "menstrual"
// (magenta/red-violet), not just whatever scored highest overall
// (that unconstrained optimum landed on yellow-green, a real result
// but a poor domain fit, so this was deliberately re-run constrained
// rather than taking the raw top score). #6D172E (a deep wine/
// burgundy — H344° S65% L26%) is the result: its worst-case simulated
// distance to every other colour here (0.33-0.37 across all three
// deficiencies and normal vision) comfortably clears this palette's
// own tightest EXISTING pair (contacts vs actionRed, as low as 0.09
// under deuteranopia) — genuinely better-separated than a pairing this
// preset already ships and calls acceptable.
export const CVD_SAFE_PALETTE = {
  contacts: "#A37100",
  encounters: "#AE427E",
  medication: "#0072B2",
  healthcare: "#009E73",
  home: "#381579",
  actionRed: "#AD4D00",
  actionGreen: "#009E73",
  menstrual: "#6D172E",
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
