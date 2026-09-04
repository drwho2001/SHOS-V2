// kinkRegistry.js
//
// Real Notion registry (kink_id, Kink Name, plus relations: Enjoyed by
// and Limit for → Contacts, Performed at → Encounters). Confirmed live
// this session — this was flagged as a future build back on 17 Aug when
// Contacts' Stated Kinks/Limits were still freeform tags.
//
// CHANGED — real ask: prepopulate with a real, sourced kink vocabulary
// instead of leaving it to grow purely from what the user happens to type.
// Two real sources, not invented:
// 1. The user's own actual Notion Kink Registry (queried live this
//    session, 60 real entries) — originally stored as role-suffixed
//    pairs ("Fisting (top)"/"Fisting (bottom)", "CBT (Dom)"/
//    "CBT (sub)", etc.), from BEFORE the app's own later architectural
//    change (role captured separately per-selection via KINK_ROLE_OPTIONS
//    below, not baked into the registry entry's own name). Deduplicated
//    down to the 37 real underlying concepts here — the role split is
//    still fully preserved, just via the mechanism that already exists
//    for it, not by re-fragmenting the registry the way Notion's older
//    schema did.
// 2. A real web search across several gay-male/kink-community sources
//    (Advocate's "kinky terms every gay man needs to know" series,
//    Pride.com, Grindr's own kink glossary, Leather Archives & Museum,
//    KYNK101, Restrained Grace) — cross-referenced for genuinely common,
//    not-already-covered terms, weighted toward gay male/leather
//    community context specifically as asked, not a generic BDSM 101
//    list. Concept names only (no article text reproduced) — this is
//    Claude's own compiled, deduplicated word list, not a copy of any
//    one source's wording.
//
// Deliberately NOT exhaustive — kink terminology is genuinely open-
// ended, and a bigger list than this stops being "prepopulated
// starting point" and starts being noise to scroll past. This is a
// real, sourced foundation; anything missing gets added the normal way
// (typed once, findOrCreate handles the rest), same as before.
import { createSimpleRegistry } from "./simpleRegistry.js";
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";
// ADDED — real ask: "did you mean...?" suggestions for likely typos,
// same fuzzy-matching engine Global Search uses.
import { findClosestMatch } from "../calculations/fuzzyMatch.js";

const SEED_NAMES = [
  // From the user's own real Notion Kink Registry, deduplicated from role-
  // suffixed pairs down to the 37 underlying concepts.
  "Bating", "Blood", "Car play", "CBT", "Chastity", "Choking", "CNC",
  "Cruising", "Cucking", "Deep throating", "Degradation",
  "Double penetration", "Edging", "Extreme pain", "Fingering", "Fisting",
  "Gaping", "Gooning", "Milking", "Needles/sharps", "Nipples",
  "Orgasm denial", "Permanent marks", "Piss", "Praise",
  "Premature ejaculation", "Public play", "Puke", "Rimming", "Rubber",
  "Scat", "Scent", "Sleep play", "Sounding", "Spit", "Toys", "Verbal",
  "Wrestling",
  // Real, sourced additions — genuinely common in gay male/leather
  // kink community context, not already covered by the above.
  // CHANGED — real fix, caught by my own test: several of these are
  // umbrella terms with a real UMBRELLA_TERMS entry below pointing to
  // a more specific alternative (Bondage → Rope bondage, Impact play →
  // Spanking, Sensory deprivation → Blindfold, Group sex → Threesome,
  // Roleplay → Age play/Master/slave, Gear/uniform → Leather/Rubber).
  // Pre-seeding them as their OWN exact-match entries would let them
  // silently win before the umbrella nudge ever got a chance to fire —
  // exactly backwards from what was asked. Removed from here; still
  // fully creatable on request the normal way (typed once, kept as
  // typed) if someone explicitly declines the specific suggestion —
  // just not pre-populated so the nudge actually has a chance to run.
  "Puppy play", "Age play", "Master/slave", "Financial domination", "Leather",
  "Foot fetish", "Wax play", "Electrostimulation", "Gagging", "Figging",
  "Sploshing", "Voyeurism", "Exhibitionism", "Cross-dressing",
  "Frotting", "Docking", "Breeding", "Cum play", "Snowballing",
  "Rope bondage", "Suspension", "Knife play",
  // ADDED — real ask: two things drove these four.
  // (1) "Deep throating" already existed with no real counterpart —
  // The user's own example of a pairing that needs two genuinely
  // different WORDS, not just one entry + Top/bottom role the way
  // Fisting already correctly works ("FF top"/"FF bottom" is exactly
  // that existing, correct pattern — nothing to change there).
  // "Face fucking" is the real, distinct community term for the other
  // side of the same act, added as its own entry to match.
  // (2) The other three are the concrete "specific" options behind
  // three of the umbrella terms below (Impact play → Spanking,
  // Sensory deprivation → Blindfold, Group sex → Threesome) — added so
  // the umbrella-nudge system has somewhere real to point someone
  // toward, not a suggestion pointing at nothing.
  "Face fucking", "Spanking", "Blindfold", "Threesome",
  // ADDED — real ask, the user's own explicit example of the Top/bottom
  // anatomical pairing style. Missing entirely before now.
  "Felching",
];

export const KinkRegistry = createSimpleRegistry({
  storageKey: "shos_kink_registry",
  idPrefix: "kink",
  seedNames: SEED_NAMES,
});

// ADDED — real fix, not just for fresh installs: `seedNames` above only
// ever applies to a genuinely EMPTY registry (see simpleRegistry.js —
// `storage.load(key, seedEntries)` only uses the seed as a fallback
// when nothing exists in storage yet). The user's own registry already has
// real data on his real device, so just editing the seed list would do
// nothing visible for him. This runs the expanded list through
// findOrCreate for real — which is genuinely safe to call repeatedly:
// it checks for an existing case-insensitive name match first (see its
// own implementation in simpleRegistry.js) and only creates what's
// truly missing, so nothing already in the user's registry gets duplicated
// or touched. Guarded by a one-time flag purely so this doesn't re-scan
// the whole list on every single app boot — not required for
// correctness (re-running would still be harmless), just avoids
// pointless repeated work.
// CHANGED 4 Sep 2026 — real groundwork for encryption at rest (see
// CLAUDE.md's Known Issues / the Notion Development log for the full
// plan): this used to touch `localStorage` directly, bypassing
// `storageAdapter` — one of a handful of real bypasses the audit
// found. Routed through the same adapter every other flag/preference
// in this app already uses (storage.load/save already have their own
// internal try/catch — see storageAdapter.js — so the extra wrapper
// here was redundant once routed through it).
const EXPANSION_FLAG_KEY = "shos_kink_registry_expanded_v1";
if (!storage.load(EXPANSION_FLAG_KEY, false)) {
  SEED_NAMES.forEach((name) => KinkRegistry.findOrCreate(name));
  storage.save(EXPANSION_FLAG_KEY, true);
}

// ADDED 18 Aug 2026 — real feedback: typing a common synonym (e.g.
// "watersports") should resolve to the existing canonical entry
// ("Piss") instead of creating a near-duplicate. Deliberately a small,
// explicit map — not automatic fuzzy-matching, which risks false-
// positive merges of genuinely different kinks. Expand as real synonym
// gaps turn up in use, rather than trying to anticipate every possible
// term upfront.
//
// CHANGED — real ask: expanded alongside the registry itself, using
// the same real sources above, so more real-world phrasing resolves
// correctly out of the box rather than needing to hit the same
// unify-bug class again later.
const KINK_SYNONYMS = {
  "watersports": "Piss",
  "golden showers": "Piss",
  "ws": "Piss",
  "bareback": "Breeding",
  "barebacking": "Breeding",
  "raw": "Breeding",
  "raw dogging": "Breeding",
  "pup play": "Puppy play",
  "puppy": "Puppy play",
  "findom": "Financial domination",
  "financial dom": "Financial domination",
  "e-stim": "Electrostimulation",
  "electro": "Electrostimulation",
  "shibari": "Rope bondage",
  "rope": "Rope bondage",
  "cbt (cock and ball torture)": "CBT",
  "cock and ball torture": "CBT",
  "rimjob": "Rimming",
  "ass eating": "Rimming",
  "frot": "Frotting",
  "docking (foreskin)": "Docking",
  "wet and messy": "Sploshing",
  "wam": "Sploshing",
  // ADDED — real ask: the user's own personal shorthand, "so you're
  // familiar with it too". FF = Fisting (not to be confused with the
  // unrelated genre acronym) — already the household abbreviation he
  // actually types, so worth being a real recognized synonym rather
  // than something he has to spell out every time. "ws" → "Piss" was
  // already covered above before the user's note, confirming it was
  // already right.
  "ff": "Fisting",
};

// Resolves a typed name to its canonical registry name if it's a known
// synonym, otherwise returns the name unchanged. Case-insensitive.
// Used by RegistryTagPicker (see its optional `resolveSynonym` prop)
// wherever it's backed by KinkRegistry specifically — Chems/Protection/
// Symptoms don't pass this, so they're unaffected.
export function resolveKinkSynonym(name) {
  const match = KINK_SYNONYMS[name.trim().toLowerCase()];
  return match || name;
}

// ADDED — real ask: the user's own example (breath play = umbrella term,
// choking = the specific act he actually wants recorded) — the
// difference between this and a regular synonym above matters: a
// synonym silently resolves ("watersports" really does just MEAN
// "Piss", there's no information lost treating them as the same
// thing). An umbrella term is different — "Breath play" is a genuinely
// real, broader category that COULD mean choking, could mean
// something else entirely; silently resolving it to "Choking" would
// be guessing at what the user actually meant, not just tidying up
// wording. So this doesn't auto-resolve — it's surfaced as a nudge
// ("did you mean the more specific X?") that can be accepted OR
// declined, keeping the umbrella term exactly as typed if that's
// genuinely what was meant. See RegistryTagPicker's commit logic
// (Contacts, Encounters, My Profile) for where this actually shows up.
//
// The user's own instruction extended past just Breath play/Choking:
// "find umbrella terms for any kinks suggested that we haven't already
// recognised" — applied that check across the real additions from
// this session specifically (not the older Notion-sourced ones, which
// The user already chose deliberately) and found four more real umbrella/
// specific pairs worth the same nudge treatment.
const UMBRELLA_TERMS = {
  "breath play": ["Choking"],
  "bondage": ["Rope bondage"],
  "impact play": ["Spanking"],
  "sensory deprivation": ["Blindfold"],
  "group sex": ["Threesome"],
  "gear": ["Leather", "Rubber"],
  "gear/uniform": ["Leather", "Rubber"],
  "uniform": ["Leather", "Rubber"],
  "roleplay": ["Age play", "Master/slave"],
};

// The one real function all three RegistryTagPicker copies now call
// instead of going straight to findOrCreate. Returns what KIND of
// thing was typed, so the UI can decide whether to just proceed
// (exact match, known regular synonym, genuinely new) or show a real
// "did you mean...?" choice first (umbrella term, fuzzy-close typo).
// Deliberately returns data, not JSX — this file has no business
// knowing what a suggestion prompt looks like, that's each module's
// own UI layer, same separation already used for resolveKinkSynonym.
export function analyzeKinkEntry(normalizedText) {
  const lower = normalizedText.trim().toLowerCase();
  if (!lower) return { type: "empty" };

  const exact = KinkRegistry.getByName(normalizedText);
  if (exact) return { type: "exact", entry: exact };

  const umbrellaSpecifics = UMBRELLA_TERMS[lower];
  if (umbrellaSpecifics) {
    const specificEntries = umbrellaSpecifics.map((name) => KinkRegistry.getByName(name)).filter(Boolean);
    if (specificEntries.length > 0) {
      return { type: "umbrella", typedAs: normalizedText, specific: specificEntries };
    }
    // The umbrella's real specific option isn't in the registry for
    // some reason (shouldn't happen — they're all real seed entries —
    // but falling through to normal synonym/new handling rather than
    // suggesting something that doesn't exist is the safe default).
  }

  const synonymMatch = KINK_SYNONYMS[lower];
  if (synonymMatch) {
    const entry = KinkRegistry.getByName(synonymMatch);
    if (entry) return { type: "synonym", entry };
  }

  const allNames = KinkRegistry.getAll().filter((e) => !e.isArchived).map((e) => e.name);
  const closest = findClosestMatch(allNames, normalizedText);
  if (closest) {
    return { type: "fuzzy-suggestion", typedAs: normalizedText, suggestion: closest };
  }

  return { type: "new", typedAs: normalizedText };
}

// ADDED 18 Aug 2026 — the user's real-world need: for kinks where it
// changes future-meet intentions (his own example: fisting), track
// WHICH ROLE someone takes, not just that the kink applies. Deliberately
// NOT modeled as separate registry entries ("Fisting Top", "Fisting
// Bottom") — that would fragment one real concept into lookalike
// entries, break search/dedup, and fight the whole reason the Kink
// Registry exists. Instead, role is a small optional modifier attached
// to each individual kink SELECTION (on a Contact or an Encounter), not
// a property of the kink itself — see contactRepository.js and
// encounterRepository.js for the {kinkId, role} shape this powers.
// Deliberately a small, generic set (not per-kink-specific labels) so
// it stays meaningful across different kinks without the list growing
// unbounded — expand later if a real need for a specific kink surfaces.
// CHANGED 19 Aug 2026 — real ask: same house style as Dom/sub — the
// dominant/giving-coded term capitalized, the submissive/receiving-
// coded term lowercase. "Vers" stays as-is (neither pole). Confirmed
// via project-wide grep first: nothing checks the exact "Bottom"
// string, so this is a safe, isolated fix.
export const KINK_ROLE_OPTIONS = ["Top", "bottom", "Vers"];

// ADDED — real ask: the user's own original Notion data already knew this
// (CBT/Chastity/Choking etc. used "(Dom)"/"(sub)" suffixes; Fisting/
// Rimming/Gaping/etc. used "(top)"/"(bottom)") — deduplicating that
// data down to single concepts earlier this session flattened that
// real distinction into one generic Top/bottom/Vers set for
// everything, which lost real information the user's own original design
// had gotten right. This restores it, properly: which of three real
// axes a given kink's role actually falls on.
//   anatomical — a physical/penetrative-position pairing (Fisting,
//     Rimming, Gaping, etc.) — Top/bottom/Vers, unchanged from before.
//   dynamic — a power-exchange pairing (CBT, Chastity, Choking, etc.)
//     — Dom/sub/Switch is the real, meaningful pairing here, not
//     Top/bottom, which doesn't actually describe what's happening.
//   mutual — no generic role fits (Frotting, Snowballing, gear/
//     material fetishes like Rubber/Leather, solo acts like Gooning,
//     settings like Public play) — no role shown at all for these.
//
// Classified from two real sources: the user's own original Notion data
// (queried live again this session for precision, not recalled from
// memory) for every one of the 37 original concepts, and reasonable
// judgment for the newer researched additions, using the same real
// anatomical/dynamic/mutual framework the user described.
//
// DELIBERATELY NOT built as per-kink custom role LABELS (e.g. a
// "Milker"/"cow" pair specific to Milking, or "Bull"/"cuck" specific
// to Cucking, both real community terms the user raised as examples) —
// that would re-fragment the registry back toward exactly the
// architecture problem role-as-a-selection-modifier was built to
// avoid, and this app's own established principle is a small, GENERIC
// role set reused across kinks, not a label invented per concept. Real
// terminology noted in comments below for context, not built into the
// UI. Milking keeps the user's own original "dynamic" (Dom/sub) choice;
// Cucking doesn't cleanly fit a two-role axis at all (Bull/cuck/the
// person being cucked-with is genuinely a three-party dynamic a simple
// per-selection role field can't represent) — left with no role
// rather than forcing a bad fit.
//
// Not exhaustive by design, matching the user's own explicit scope call —
// classifies what's actually in this registry, not every kink that
// could ever exist. Anything unlisted here defaults to "anatomical"
// (Top/bottom/Vers), the same behavior every kink already had before
// this — nothing regresses for an unclassified entry.
export const KINK_ROLE_STYLE = {
  // Anatomical — Top/bottom/Vers (from the user's own Notion "(top)"/"(bottom)" data)
  "Fingering": "anatomical",
  "Fisting": "anatomical",
  "Gaping": "anatomical",
  "Rimming": "anatomical",
  "Double penetration": "anatomical",
  "Toys": "anatomical", // Notion's own listing paired this as "(Dom/Top)"/"(sub/bottom)" — kept to the physical half
  "Deep throating": "anatomical",
  "Face fucking": "anatomical", // the real distinct-name counterpart to Deep throating
  "Felching": "anatomical", // the user's own explicit example
  "Breeding": "anatomical",
  "Gagging": "anatomical",

  // Dynamic — Dom/sub/Switch (from the user's own Notion "(Dom)"/"(sub)" data)
  "CBT": "dynamic",
  "Chastity": "dynamic",
  "Choking": "dynamic",
  "CNC": "dynamic",
  "Degradation": "dynamic",
  "Edging": "dynamic",
  "Extreme pain": "dynamic",
  "Milking": "dynamic", // real community terms "Milker"/"cow" exist — see file header, not built as custom labels
  "Orgasm denial": "dynamic",
  "Piss": "dynamic",
  "Praise": "dynamic",
  "Scent": "dynamic",
  "Sleep play": "dynamic",
  "Sounding": "dynamic",
  "Spit": "dynamic",
  "Wrestling": "dynamic",
  "Verbal": "dynamic", // Notion's own "(I speak)"/"(I listen)" maps directly onto Dom/sub
  "Age play": "dynamic",
  "Master/slave": "dynamic",
  "Financial domination": "dynamic",
  "Wax play": "dynamic",
  "Electrostimulation": "dynamic",
  "Figging": "dynamic",
  "Rope bondage": "dynamic",
  "Suspension": "dynamic",
  "Knife play": "dynamic",
  "Spanking": "dynamic",
  "Blindfold": "dynamic",
  "Puppy play": "dynamic", // handler/pup dynamic

  // Mutual — no generic role shown (solo acts, materials/gear, settings, inherently reciprocal acts)
  "Bating": "mutual",
  "Blood": "mutual",
  "Car play": "mutual",
  "Cruising": "mutual",
  "Cucking": "mutual", // real terms "Bull"/"cuck" exist but describe a 3-party dynamic — see file header
  "Gooning": "mutual",
  "Needles/sharps": "mutual",
  "Nipples": "mutual", // Notion's own "(his)"/"(mine)" is about whose, not a role axis
  "Permanent marks": "mutual",
  "Premature ejaculation": "mutual",
  "Public play": "mutual",
  "Puke": "mutual",
  "Rubber": "mutual",
  "Scat": "mutual",
  "Leather": "mutual",
  "Foot fetish": "mutual",
  "Sploshing": "mutual",
  "Voyeurism": "mutual",
  "Exhibitionism": "mutual",
  "Cross-dressing": "mutual",
  "Frotting": "mutual",
  "Docking": "mutual",
  "Cum play": "mutual",
  "Snowballing": "mutual",
  "Threesome": "mutual",
};

const DYNAMIC_ROLE_OPTIONS = ["Dom", "sub", "Switch"];

// The real function Contacts/Encounters/My Profile now call instead of
// always using the one fixed KINK_ROLE_OPTIONS constant. Returns the
// right role set for a given kink NAME (not id — matches how role
// selection already works, resolved before the kink is necessarily a
// real registry entry yet), or null for a "mutual" kink, meaning no
// role picker should show at all.
export function getKinkRoleOptions(kinkName) {
  const style = KINK_ROLE_STYLE[kinkName] || "anatomical";
  if (style === "dynamic") return DYNAMIC_ROLE_OPTIONS;
  if (style === "mutual") return null;
  return KINK_ROLE_OPTIONS;
}
