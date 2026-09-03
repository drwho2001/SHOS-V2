// customOptionListsRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// The user's real ask: the ability to add/rename/reorder simple option
// values (medication types, reasons for visit, vaccines, etc.) from
// inside the app itself, without needing a code change — the same
// capability the six Registries (Kink/Chems/Protection/Symptoms/
// Organism/Results) already give him for those, extended to the
// simpler flat-string option lists used elsewhere.
//
// WHY THIS IS SAFE ACROSS FUTURE APP UPDATES, stated plainly since
// The user asked directly: stored data lives in the browser's own storage,
// completely separate from this source code. Rewriting this file in a
// future session only changes what NEW installs seed with — it never
// touches what's already stored on the user's own device. The merge below
// (`{ ...SEED_LISTS, ...stored }`) means: a list the user has never
// touched still picks up any future seed update automatically (e.g. if
// a future session adds a new editable category); a list the user HAS
// edited always keeps his version, permanently, regardless of what the
// seed says. STANDING RULE for any future session touching this file:
// never rename STORAGE_KEY or any key inside SEED_LISTS — either would
// orphan the user's own stored edits with no warning.
//
// WHY THIS IS A SEPARATE, SIMPLER MECHANISM THAN THE REGISTRIES
// (simpleRegistry.js): Registry entries are real objects with their
// own ID, referenced BY ID from other records, with a genuine "how
// many places use this" usage count. These option lists are just
// plain strings used directly as values — nothing else in the app
// holds a reference to "medication type entry #3", it just stores the
// string "Injection" wherever that field lives. Building the heavier
// ID/usage-tracking machinery for something that doesn't need it would
// be real over-engineering, not thoroughness.
//
// DELIBERATELY NOT INCLUDED — Testing's "Testing for?" and "Setting"
// lists. Testing for? is read by exact string match inside
// exposureWindows.js's exposure-window flagging (e.g. `"HIV"`,
// `"Chlamydia"`) — a typo or rename here would silently break real
// clinical-timing logic, not just cosmetic display. Setting is checked
// by exact match for the Home-test "Tracking info" field's visibility.
// The user's own read was that this category is unlikely to need new
// values and the downside of getting it wrong is real — agreed, left
// fixed rather than editable.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";
// ADDED — real find during the design-unification audit: every one of
// these 7 option lists is real Healthcare-domain data, all still
// hardcoded to the old pre-Tier-1 blue (#4A80F0). Same class of stale
// value already fixed in Medication/Settings/Contacts/OptionListEditor
// — this file is plain constants (no React dependency), safe to pull
// the real shared token in directly.
import { ACCENTS } from "../calculations/designTokens.js";

const STORAGE_KEY = "shos_custom_option_lists";

const SEED_LISTS = {
  // ADDED — real ask: Contraception's own formulation field (see
  // contraceptionRepository.js) reuses this exact list rather than a
  // parallel one, so a device-based method (IUD/Implant) needed a real
  // category here too — none of the existing values fit a physical
  // device the way Pill/Tablet or Injection fit a substance route.
  medicationType: ["Pill/Tablet", "Capsule", "Injection", "Cream/Gel", "Patch", "Liquid", "Device", "Other"],
  route: ["Oral", "IM - Gluteal", "IM - Deltoid", "SubQ", "Injection"],
  reasonForVisit: ["Symptoms", "Doxy refill", "Routine screening", "PrEP review", "Vaccination", "Treatment", "Pregnancy care", "Other"],
  followUpType: ["TOC", "Routine", "Other", "None"],
  sampleType: ["Blood", "Urine", "Throat swab", "Rectal swab", "Vaginal/front hole swab"],
  // CHANGED 26 Aug 2026 — real ask: removed "Other" — the Vaccine
  // field is already real free text with auto-save-as-suggestion
  // (see VaccineField in the Vaccinations module), so a literal
  // "Other" chip just set the vaccine name to the word "Other",
  // which is meaningless. Typing anything not in this list already
  // does what "Other" was trying to do.
  // ADDED — real ask: "vaccinate MenB" — the literal, on-label use of
  // the same 4CMenB vaccine already seeded above for its off-label
  // Gonorrhoea cross-protection use (see vaccinationRepository.js's
  // own seed comment on that). Kept as a distinct option since they're
  // two different real reasons someone gets the same vaccine.
  vaccine: ["Hepatitis A", "Hepatitis B", "HPV", "Mpox", "Gonorrhoea", "Meningitis B"],
  vaccinationReason: ["Routine", "Occupational", "High-risk status", "Booster"],
  injectionSite: ["Deltoid", "Gluteal", "Other"],
  episodeTriggerReason: ["Partner notification", "Symptom-driven", "Medication-driven", "Routine testing", "Other"],
  // ADDED 19 Aug 2026 — real gap: Medicines Registry's own Category
  // field (Anti-RetroViral (ARV)/Antibiotic/Vaccine/Pain relief/
  // Supplement/IBS/Antidepressant/Other), fetched live from Notion
  // this session, never ported to the app until now. Multi-select in
  // Notion, so stays multi-select here too.
  // ADDED — real ask: HRT lives here as a Medication category, not as
  // its own module — reuses dose/schedule/refill/doseHistory tracking
  // for free (doseHistory in particular already exists specifically
  // for titration, which is exactly what HRT dosing looks like) rather
  // than duplicating that machinery. Deliberately NOT gender-specific:
  // menopause HRT (cis women), TRT (cis men — older men, weight
  // lifters), and gender-affirming HRT (trans men and women) all use
  // this same category.
  medicationCategory: ["Anti-RetroViral (ARV)", "Antibiotic", "Vaccine", "Pain relief", "Supplement", "IBS", "Antidepressant", "HRT", "Other"],
  // ADDED 26 Aug 2026 — real ask: Relationship type (Contacts) should
  // be user-editable, not a fixed list. Same exact option strings as
  // the old hardcoded RELATIONSHIP_TYPE_OPTIONS in contactRepository.js
  // — existing contacts' stored values still match, nothing breaks.
  relationshipType: ["Hookup", "Fuck buddy (casual)", "Friend with Benefit (chill)", "Partner"],
  // ADDED — real ask: trans/hetero inclusivity, first real step. This
  // app's own field choices (myPosition/CUM_LOCATION already having
  // Vaginal options, etc.) were built gay/MSM-first — Gender is a real
  // gap on both My Profile and Contacts. Seeded per the user's own
  // exact spec, same "no Other chip, real free text already covers
  // it" convention as vaccine above — Non-binary and anything else
  // typed in just works via the add-your-own field.
  gender: ["Male", "Female", "Trans-male", "Trans-female", "Non-binary"],
  // ADDED — real ask, from a competitive-research finding: Pronouns
  // (Contacts and My Profile) was plain free text, no suggestions at
  // all — every comparable field on this list already gets real
  // suggestion chips via SuggestField, this one was just missed. Same
  // "no Other chip" convention as gender above.
  pronouns: ["He/him", "She/her", "They/them"],
  // ADDED — real ask: contraception, gated to Female/Trans-male (see
  // both edit screens' own comments on the exact gating condition).
  // Testosterone is included because it's still worth tracking for a
  // trans man (affects fertility/cycle) even though, corrected per the
  // user's own ask, it is NOT reliable contraception on its own —
  // clinical guidance is still to use backup contraception alongside
  // it if avoiding pregnancy matters. No UI copy anywhere implies
  // otherwise. "None" needed since this list has no blank/skip option
  // otherwise (unlike gender, which can just be left empty).
  contraception: ["Combined pill", "Progesterone-only pill", "IUD", "Implant", "Depot", "Testosterone", "None"],
  // ADDED — real ask: Measurements (Healthcare) — a standardised place
  // for any numeric health value (hormone levels, viral load, weight,
  // blood pressure), regardless of whether it's sexual-health-specific
  // or general, and regardless of whether it was taken at home or in
  // clinic. "Blood pressure" is protected (see PROTECTED_VALUES below)
  // — it drives real special-case logic in measurementRepository.js
  // (systolic/diastolic shape, fixed mmHg, its own trend view), so
  // unlike every other entry here it can't be renamed or removed via
  // this same editable-list mechanism.
  measurementType: ["Viral load", "CD4 count", "Estradiol", "Testosterone", "LH", "FSH", "Weight", "Height", "Temperature", "Blood pressure", "Other"],
  // ADDED — real ask: Menstrual Cycle's own Flow field.
  menstrualFlow: ["Spotting", "Light", "Medium", "Heavy"],
  // ADDED — real ask: My Profile's own overall relationship status —
  // a different axis from Contacts' relationshipType above (which
  // describes your connection to one specific person; this describes
  // your own overall situation, independent of and not replacing it).
  relationshipStatus: ["Single", "Married", "Poly", "Aro/Ace", "Dating", "It's complicated"],
};

// ADDED — real ask: unlike every other entry in every list above,
// which stay freely user-editable, a small number of specific values
// have real code depending on their exact string matching (same class
// of risk already called out for Testing's own "Testing for?"/
// "Setting" lists in the comment above, which is why those two aren't
// editable at all). Rather than locking a whole list, this protects
// just the specific value(s) that matter — the rest of that list
// stays fully editable as normal.
const PROTECTED_VALUES = {
  measurementType: ["Blood pressure"],
};

// Friendly labels for the editor screen — separate from the storage
// key names above so the internal names can stay stable even if the
// display wording changes later.
export const OPTION_LIST_LABELS = {
  medicationType: "Medication type",
  route: "Route",
  reasonForVisit: "Reason for visit",
  followUpType: "Follow-up type",
  sampleType: "Sample type",
  vaccine: "Vaccine",
  vaccinationReason: "Vaccination reason",
  injectionSite: "Injection site",
  episodeTriggerReason: "Timeline trigger reason",
  medicationCategory: "Medication category",
  relationshipType: "Relationship type",
  gender: "Gender",
  pronouns: "Pronouns",
  contraception: "Contraception",
  measurementType: "Measurement type",
  menstrualFlow: "Menstrual flow",
  relationshipStatus: "Relationship status",
};

// ADDED 19 Aug 2026 — real ask: same icon+color treatment as the
// Registries screen, applied here too — every editable option
// category, not just half of them. Icon NAMES only (strings), not
// components — this file has no reason to import a UI library, the
// consuming screen (SHOS_OptionListEditor_Prototype.jsx) maps these
// strings to real lucide components. Colors reuse each category's own
// natural domain color already established elsewhere in this app
// (medsBlue for Medication-domain lists, healthcareBlue for
// Healthcare-domain ones, encountersPink for Clinic-Visit-adjacent
// Reason-for-visit) rather than inventing new arbitrary colors.
export const OPTION_LIST_ICONS = {
  medicationType: { icon: "Pill", color: "#3D63C9" },
  route: { icon: "ArrowRightCircle", color: "#3D63C9" },
  reasonForVisit: { icon: "ClipboardList", color: ACCENTS.healthcare },
  followUpType: { icon: "CalendarClock", color: ACCENTS.healthcare },
  sampleType: { icon: "TestTube", color: ACCENTS.healthcare },
  vaccine: { icon: "Syringe", color: ACCENTS.healthcare },
  vaccinationReason: { icon: "CalendarCheck", color: ACCENTS.healthcare },
  injectionSite: { icon: "MapPin", color: ACCENTS.healthcare },
  episodeTriggerReason: { icon: "PlayCircle", color: ACCENTS.healthcare },
  medicationCategory: { icon: "Tag", color: "#3D63C9" },
  relationshipType: { icon: "Heart", color: ACCENTS.contacts },
  gender: { icon: "User", color: ACCENTS.contacts },
  pronouns: { icon: "User", color: ACCENTS.contacts },
  contraception: { icon: "Pill", color: ACCENTS.healthcare },
  measurementType: { icon: "Ruler", color: ACCENTS.healthcare },
  menstrualFlow: { icon: "Drop", color: ACCENTS.healthcare },
  relationshipStatus: { icon: "Heart", color: ACCENTS.contacts },
};

let lists = { ...SEED_LISTS, ...storage.load(STORAGE_KEY, {}) };
function persist() { storage.save(STORAGE_KEY, lists); }

// ADDED 3 Sep 2026 — real ask: "newly added user data should be
// suggested at top of any autofill/suggest as typing. balance that
// with most frequently selected options shown first too." This file's
// own earlier header comment explicitly reasoned real usage-count
// tracking would be over-engineering for a plain string list — that
// was true until this became an actual ask, not a hypothetical one.
// Kept as its OWN storage key, separate from `lists` above: this is
// ranking metadata, not the option data itself, and — critically —
// `.get()` below stays completely UNCHANGED (still returns the raw,
// manually-curated order) since Manage Lists' own drag-to-reorder
// (`.reorder()`) is a real, deliberate feature a silent re-sort would
// undermine. Only `.getRanked()`, a new opt-in method for suggestion/
// autocomplete UI specifically, uses this metadata.
const USAGE_STORAGE_KEY = "shos_custom_option_lists_usage";
let usageMeta = storage.load(USAGE_STORAGE_KEY, {});
function persistUsage() { storage.save(USAGE_STORAGE_KEY, usageMeta); }

// A brand-new entry gets a decaying head start (worth ~5 real uses,
// fading to 0 over 14 days) so it actually surfaces while it's new
// rather than being buried behind established options with real
// history — the literal ask — while a genuinely popular option still
// overtakes it as the boost fades, which is the "balance" half of the
// ask: neither recency nor frequency permanently dominates the other.
const NEW_ITEM_BOOST = 5;
const NEW_ITEM_BOOST_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function scoreFor(name, value, now) {
  const meta = usageMeta[name]?.[value];
  if (!meta) return 0;
  const count = meta.count || 0;
  const addedAt = meta.addedAt ? new Date(meta.addedAt).getTime() : null;
  const age = addedAt != null ? now - addedAt : Infinity;
  const recencyBoost = age < NEW_ITEM_BOOST_WINDOW_MS ? NEW_ITEM_BOOST * (1 - age / NEW_ITEM_BOOST_WINDOW_MS) : 0;
  return count + recencyBoost;
}

export const CustomOptionListsRepository = {
  get(name) {
    return [...(lists[name] || SEED_LISTS[name] || [])];
  },

  // Suggestion/autocomplete order: highest-scoring first (recently
  // added, blended with how often it's actually been picked), original
  // list order as the stable tie-break for anything with no real
  // history yet. Every other consumer of a list (Manage Lists' editor,
  // any place that needs the literal curated order) should keep using
  // plain get() — this is deliberately opt-in, not a replacement.
  getRanked(name) {
    const options = this.get(name);
    const now = Date.now();
    return options
      .map((value, index) => ({ value, index, score: scoreFor(name, value, now) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.value);
  },

  // Called whenever a value is actually chosen — either picked from
  // suggestions or freshly typed as new (add() below calls this
  // itself for the "new" case, so callers only need this explicitly
  // for the "picked an existing suggestion" case).
  recordUsage(name, value) {
    if (!value) return;
    const forList = usageMeta[name] || {};
    const existing = forList[value];
    usageMeta = { ...usageMeta, [name]: { ...forList, [value]: { count: (existing?.count || 0) + 1, addedAt: existing?.addedAt || null } } };
    persistUsage();
  },

  getAllListNames() {
    return Object.keys(SEED_LISTS);
  },

  add(name, value) {
    const trimmed = (value || "").trim();
    if (!trimmed) return this.get(name);
    const current = this.get(name);
    // CHANGED — was a case-SENSITIVE `current.includes(trimmed)` check,
    // so typing "male" when "Male" already existed silently added a
    // second, differently-cased option to the shared suggestion list
    // (audited app-wide across every SuggestField/VaccineField caller —
    // Gender, RelationshipType, Contraception, Vaccine, Medication
    // Category — none of which guard against this themselves). Fixing
    // it once here, at the single shared write path, covers all of them.
    const existingMatch = current.find((o) => o.toLowerCase() === trimmed.toLowerCase());
    if (existingMatch) {
      // ADDED 3 Sep 2026 — real ask: "balance [recency] with most
      // frequently selected options shown first too." add() is this
      // app's universal commit path — nearly every SuggestField-style
      // field across the app calls it on blur/Enter regardless of
      // whether the value was freshly typed or picked from a
      // suggestion chip (audited: Gender, Pronouns, Relationship
      // Status/Type, Contraception, Vaccine, Medication Type/Category/
      // Route, Reason for Visit, Follow-up Type, Sample Type, Episode
      // Trigger, Menstrual Flow — every one of them). Crediting a real
      // USE here, at this one shared spot, is what makes frequency-
      // based ranking (getRanked() above) actually work everywhere
      // that ranking is wired in, without touching each of those files
      // individually — re-picking an existing option is exactly as
      // real a "use" as typing a new one, it just doesn't change the
      // list itself.
      this.recordUsage(name, existingMatch);
      return current;
    }
    lists = { ...lists, [name]: [...current, trimmed] };
    persist();
    // Records WHEN this was added — the "newly added" half of
    // getRanked()'s scoring above. A brand new value starts at count 0
    // (recordUsage would double-count it as "used once" too, which
    // isn't true yet — it was just created, not picked).
    const forList = usageMeta[name] || {};
    usageMeta = { ...usageMeta, [name]: { ...forList, [trimmed]: { count: 0, addedAt: new Date().toISOString() } } };
    persistUsage();
    return lists[name];
  },

  rename(name, oldValue, newValue) {
    if ((PROTECTED_VALUES[name] || []).includes(oldValue)) return this.get(name);
    const trimmed = (newValue || "").trim();
    const current = this.get(name);
    if (!trimmed) return current;
    lists = { ...lists, [name]: current.map((v) => (v === oldValue ? trimmed : v)) };
    persist();
    return lists[name];
  },

  remove(name, value) {
    if ((PROTECTED_VALUES[name] || []).includes(value)) return this.get(name);
    const current = this.get(name);
    lists = { ...lists, [name]: current.filter((v) => v !== value) };
    persist();
    return lists[name];
  },

  isProtected(name, value) {
    return (PROTECTED_VALUES[name] || []).includes(value);
  },

  reorder(name, newOrder) {
    lists = { ...lists, [name]: newOrder };
    persist();
    return lists[name];
  },

  // For backupService.js — one bundled object, all lists together,
  // rather than one storage key per list. Matches the same "combine
  // data updated together" guidance used elsewhere in this project.
  getAllForBackup() {
    return { ...lists };
  },

  replaceAll(newLists) {
    lists = { ...SEED_LISTS, ...newLists };
    persist();
  },
};

// ADDED — real fix, caught before it could silently fail: a seed-list
// edit alone isn't actually guaranteed to reach an existing device.
// `persist()` (above) saves the WHOLE merged `lists` object every time
// ANY list is touched via add()/replace() — so if even one unrelated
// list (e.g. Vaccine) was ever edited, that snapshot already froze
// every OTHER list, including this one, at whatever it was at that
// moment. Same real, explicit one-time migration pattern already used
// for PEP (Protection Registry) and the Kink Registry expansion —
// `add()` itself is idempotent (checks for an existing value first),
// so this is genuinely safe to run even if the value's already there.
const SAMPLE_TYPE_MIGRATION_FLAG = "shos_sampletype_vaginal_added_v1";
try {
  if (typeof localStorage !== "undefined" && !localStorage.getItem(SAMPLE_TYPE_MIGRATION_FLAG)) {
    CustomOptionListsRepository.add("sampleType", "Vaginal/front hole swab");
    localStorage.setItem(SAMPLE_TYPE_MIGRATION_FLAG, "true");
  }
} catch {
  // Same "never let a background convenience break the app" reasoning
  // as every other real-device migration this session.
}
