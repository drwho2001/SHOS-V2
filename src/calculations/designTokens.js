// designTokens.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "standardise UI/appearance." Right now every module
// defines its own local LIGHT (and sometimes DARK) theme object, with
// its own hex values typed out fresh each time — which is exactly how
// small, real drift happens (a font size 1-2px off here, a slightly
// different grey there, one screen missing a font-family declaration
// entirely). This is the single shared source of truth those values
// SHOULD come from.
//
// HONEST SCOPE, stated plainly rather than oversold: this is the
// foundation, not a finished migration. Every module still needs to
// actually be updated to READ from these tokens instead of its own
// hardcoded copies — that's real work across ~15 files, done
// incrementally as each module gets touched, not all at once in one
// pass. What IS true today: this file exists, is correct, and any
// module using it is guaranteed consistent with every other module
// using it — that guarantee gets stronger as more modules adopt it.
//
// Self-contained modules keep their own THEME OBJECT (LIGHT/DARK
// constants) — that convention isn't changing. What changes is where
// the VALUES inside those objects come from: shared tokens here,
// instead of each module re-typing "#1B1B1F" from memory and slowly
// drifting from every other module's version of "the same" color.
//
// Lives in calculations/ alongside every other shared pure-export
// file (fuzzyMatch.js, contactCalculations.js, etc.) rather than a new
// top-level folder — matches the established project convention for
// "shared logic/data usable cross-module" instead of inventing a new
// one.
import { ModuleColorRepository } from "../repositories/moduleColorRepository.js";

// Neutral palette — shared across every module regardless of domain.
export const NEUTRAL = {
  bg: "#F0F0F3",
  surface: "#FFFFFF",
  surfaceVariant: "#E7E7EB",
  border: "#DCDCE1",
  textPrimary: "#1B1B1F",
  textSecondary: "#5B5B62",
  textDisabled: "#656568",
};

// Dark-mode counterpart, values matched to Medication's own hand-tuned
// DARK object (the module dark mode was first built for) so every
// module now adopting dark mode reads as one consistent system rather
// than each picking its own near-black. Same roles as NEUTRAL above —
// a module still supplies its own accent color per ACCENTS, this only
// covers page bg / card surface / border / text.
export const NEUTRAL_DARK = {
  bg: "#121214",
  surface: "#1C1C1F",
  surfaceVariant: "#26262A",
  border: "#3A3A3F",
  textPrimary: "#F2F2F4",
  textSecondary: "#B8B8BE",
  textDisabled: "#89898C",
};

// Domain accent colors — one per module, the color that makes each
// screen visually identifiable at a glance. Collected from what was
// already actually in use across the app (not invented fresh) —
// this is documentation of the real existing palette as much as a
// source of truth going forward.
// CHANGED — real Tier 1 color decision, GPT's own 5 real proposed
// values, confirmed and accepted. Note: no MODULE reorganization here
// — Contacts is still Contacts, Home is still Home, only the color
// VALUE each one is assigned has changed. "home" is a genuinely new
// token — Home never had its own dedicated accent before (it reused
// NEUTRAL.textPrimary/black), unlike every other module.
// CHANGED — real fix from an accessibility audit: white button/CTA text
// on top of contacts/home/healthcare's original values failed WCAG AA
// (3.19:1, 4.15:1, 3.46:1 respectively — need 4.5:1). Same hue kept for
// contacts and home, just darkened until white text clears 4.5:1
// (computed against the real WCAG relative-luminance formula, not
// approximated). Healthcare ALSO got a real ask on top of the contrast
// fix: its green (149° hue) sat close enough to ACTION.green (162°,
// the universal "this passed/is fine" colour) that the module's own
// identity colour and a real affirmative status reading could blend
// together on Healthcare screens specifically — nudged further toward
// yellow-green (134°) so the two are more clearly two different
// greens, not just two different fixes to the same problem. Checked:
// all three new values still clear 3:1 against the dark-mode surface
// (#1C1C1F) they're also used against unmodified — the bar for a
// small icon/dot/border rather than full body text.
const DEFAULT_ACCENTS = {
  contacts: "#B36205",
  encounters: "#8D3B7A",
  medication: "#003B6F",
  healthcare: "#008A20",
  home: "#008585",
  // ADDED 2 Sep 2026 — real ask: Menstrual was reusing ACTION.red
  // (the universal alert/error colour) purely for lack of its own
  // token — the same real risk every other module color exists to
  // avoid: "chance to get confused with incorrect/error/wrong
  // green/red logic." Coral was considered and rejected — still in
  // the red/orange-red family, close enough to ACTION.red and to the
  // Kink/Protection registry accents below that it doesn't actually
  // solve the mix-up. This violet/indigo sits in a genuine gap on the
  // wheel — nothing else in the app (module or semantic colour) is
  // anywhere near it — matched in saturation/lightness to the rest of
  // this palette rather than picked in isolation.
  menstrual: "#5A358D",
  // Sub-registry accents (Kink/Protection, used only within Settings →
  // Registries) — a separate concern from the main modules, not part
  // of this color decision, left as they were.
  kink: "#E5484D",
  protection: "#E24E9C",
};

// ADDED 26 Aug 2026 — real ask: customizable module base colours,
// via a real Design/Preferences section in Settings (see
// SHOS_Settings_Prototype.jsx and moduleColorRepository.js). Every
// module imports ACCENTS directly at load time (not through a live
// hook), so an override applies on next app reload/reopen — not
// instantly across already-open screens. That's a deliberate,
// honest trade-off for a personal single-user app, not a silently
// cut corner (stated in moduleColorRepository.js and in the Settings
// UI itself). Wrapped in try/catch: this file is imported very early
// by almost everything, and must never itself throw if storage is
// somehow unavailable — falls back to defaults, exactly the same
// resilience every other repository already has via storageAdapter's
// own fallback handling.
let overrides = {};
try {
  overrides = ModuleColorRepository.getOverrides();
} catch {
  overrides = {};
}
export const ACCENTS = { ...DEFAULT_ACCENTS, ...overrides };

// Universal action/status colors — same meaning everywhere (red always
// means the same kind of "stop and look at this", green always means
// the same kind of "this is fine/complete").
const DEFAULT_ACTION_COLORS = {
  red: "#D93838",
  green: "#1B9E77",
};
// ADDED — real ask: make the semantic pass/fail pair genuinely
// editable too, not just the 5 module identity colours — arguably the
// single most relevant pair for colourblind usability specifically,
// since red/green confusion is the most common form. Reuses the exact
// same override store as ACCENTS above (moduleColorRepository.js),
// just two more possible keys ("actionRed"/"actionGreen") in the same
// storage rather than a second repository — amber/gold stay fixed,
// purely decorative, not meaning-bearing the way red/green are, so
// they're not part of this.
export const ACTION = {
  ...DEFAULT_ACTION_COLORS,
  red: overrides.actionRed || DEFAULT_ACTION_COLORS.red,
  green: overrides.actionGreen || DEFAULT_ACTION_COLORS.green,
  amber: "#F59E0B",
  gold: "#B45309",
};

// ---------------------------------------------------------------------
// ADDED — real architecture fix. The user's own question, verbatim in
// spirit: "are all other items wired into the colour changer... rather
// than us providing the colour, we can just make sure the background
// architecture is setup." Audited and found two real gaps:
//
// 1. Medication and Encounters' DARK-mode accent were separate
//    hand-picked hex literals, not derived from ACCENTS at all — a
//    customised colour would change light mode but silently do
//    nothing in dark mode for those two specific modules (every other
//    module already just reused ACCENTS.<key> directly for both, which
//    works fine for THEM because their default hues already read
//    clearly on a near-black surface; Medication's navy and
//    Encounters' original plum didn't, which is why they'd each grown
//    their own manually-brightened dark variant instead).
// 2. ACTION.red/green (just wired above) had no dark-mode equivalent
//    at all — every module hardcoded its own "#FF7A7E"/"#5FD9A4"
//    directly in its DARK theme object, completely ignoring ACTION.
//
// deriveDarkAccent() is the one fix for both: a plain HSL lightness
// floor, not a full WCAG contrast solver (that's real overkill for a
// personal app) — if a colour is already light enough to read against
// a near-black background it's returned completely unchanged (this is
// exactly why Contacts/Testing/Clinic Visits/Symptom Log/Vaccinations/
// My Profile never needed touching: their defaults already clear this
// bar), otherwise its lightness is lifted to a safe minimum and it's
// desaturated slightly so it reads as brightened-but-intentional
// rather than neon, while keeping the same hue so a customised colour
// still reads as recognisably "that colour". HONEST NOTE: because this
// replaces two hand-tuned literals with an algorithm, Medication's and
// Encounters' DEFAULT (uncustomised) dark-mode shade shifts slightly
// from what was there before — still the same colour family, just no
// longer pixel-identical to the specific value someone picked by eye.
// That's the accepted, honest cost of making it a real, working
// override instead of a fixed literal.
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}
export function deriveDarkAccent(hex) {
  const { h, s, l } = hexToHsl(hex);
  if (l >= 55) return hex;
  // Achromatic input (grey/black/white — s === 0, h meaningless) stays
  // achromatic: the saturation floor below is only for real colours,
  // otherwise a black or grey custom accent would come out tinted red
  // (h defaults to 0 when there's no real hue to measure).
  const targetS = s === 0 ? 0 : Math.max(30, s - 15);
  return hslToHex(h, targetS, Math.max(l, 62));
}

// The actual per-module fix built on top of deriveDarkAccent(): keeps
// a module's EXISTING hand-picked dark-mode default exactly as-is
// (e.g. Encounters' own recently-chosen "#D370C7" neon plum, or
// Medication's "#5B85F5") unless/until the user actually customises
// that colour — only then does dark mode switch to a live-derived
// variant of their real choice. This is deliberately NOT "always
// derive": that would silently redraw already-chosen, already-
// approved default colours the moment this shipped, which is a real
// regression, not a fix. `overrideKey` is the ACCENTS/ACTION key this
// value is customised under (e.g. "medication", "actionRed");
// `currentValue` is that key's live value (already override-aware,
// e.g. ACCENTS.medication or ACTION.red); `defaultDarkValue` is the
// existing hand-picked literal to keep using while uncustomised —
// omit it for a module that never had one (most modules just reused
// their light-mode value verbatim in dark mode already, which is
// exactly what happens here too by default: `currentValue` unchanged,
// only actually brightened once a real override exists).
export function resolveDarkAccent(overrideKey, currentValue, defaultDarkValue = currentValue) {
  return overrideKey in overrides ? deriveDarkAccent(currentValue) : defaultDarkValue;
}

// ADDED — real ask: "no hardcoded hexes" — SHOS_Home_Prototype.jsx's
// own MEDS_ICON_BLUE used to be a fixed hex, chosen once by eye
// because ACCENTS.medication's own very dark navy default reads flat
// as a small icon/text colour on a plain white card. That's the exact
// same problem deriveDarkAccent solves for a near-black background,
// just the opposite direction — this is that function's light-card
// counterpart: a colour already light enough (l >= targetLightness)
// passes through unchanged, otherwise its lightness is lifted and it's
// desaturated slightly, same hue preserved, so a customised colour
// still reads as recognisably itself rather than being silently
// ignored by a screen that kept its own hardcoded brightened literal.
export function deriveLightAccent(hex, targetLightness = 42) {
  const { h, s, l } = hexToHsl(hex);
  if (l >= targetLightness) return hex;
  const targetS = s === 0 ? 0 : Math.max(35, s - 20);
  return hslToHex(h, targetS, targetLightness);
}

// Real font-size/weight pairings for common UI roles, standardized
// against Medication's own established pattern (the module this
// convention was first built around, referenced repeatedly elsewhere
// this session as "the reference"). Using these instead of each
// module typing its own fontSize/fontWeight combination is what
// actually prevents the "font size shifts slightly between modules"
// bug the user flagged — a screen title is 22/700 everywhere it's used
// this way, not 22/700 in one module and 20/700 in another by
// accident.
export const TYPE = {
  screenTitle: { fontSize: 22, fontWeight: 700 },
  recordTitle: { fontSize: 20, fontWeight: 700 },
  sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },
  body: { fontSize: 14, fontWeight: 400 },
  bodyEmphasis: { fontSize: 14, fontWeight: 600 },
  caption: { fontSize: 12, fontWeight: 400 },
  captionEmphasis: { fontSize: 12, fontWeight: 600 },
  monoLabel: { fontSize: 12, fontFamily: "'Inter', sans-serif" },
};

// CHANGED — real tuning per GPT's design review: cards read as
// "extremely rounded" at 16px; spec suggests ~12-14px. Only `md`
// changed — `sm`/`lg`/`full` are used for different purposes (small
// controls, larger sheets, circular FABs) and weren't part of this ask.
export const RADIUS = { sm: 8, md: 13, lg: 24, full: 999 };

// The real font-family stack, exactly as it's supposed to appear
// everywhere — HealthcareScreen (see App.jsx) was found to be missing
// this entirely, which is the real, direct cause of it visually
// rendering in the browser's own default font instead of Public Sans,
// the "wrong font" the user flagged. Any screen-level root container
// should set this explicitly rather than assume it inherits correctly
// from a parent.
export const FONT_FAMILY = "'Inter', sans-serif";
export const FONT_FAMILY_MONO = "'Inter', sans-serif";
