// encounterRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// This is the Encounters module's repository — same shape as
// ContactRepository and MedicationRepository (getAll/getById/create/
// update/archive, opaque human-readable IDs, structuredClone on every
// read so nothing outside this file can mutate stored data directly).
//
// BUILT FROM A FRESH LIVE NOTION FETCH, 18 Aug 2026 — not from any
// cached summary. The live Encounters data source has 21 properties.
//
// RELATION FIELDS — six of them, split into two real groups:
//
// 1. Attendees → Contacts. Contacts module is already built, so this is
//    a REAL link: `attendeeIds` is the one stored fact (an array of
//    contact_XXX ids). Everything Contacts already shows as a Notion
//    rollup — Encounter Count, Average/Highest Enjoyment, Last
//    Interaction — is NOT duplicated onto the contact record. It's
//    computed on read from Encounters, in encounterCalculations.js,
//    the same "store facts, derive state" pattern already used for
//    Medication stock. Contact<->Encounter linking is one-directional
//    in storage (Encounter holds attendeeIds) and two-directional in
//    the UI (both screens can show the relationship).
//
// 2. Location, Kinks Involved, Protection Used, Chems/Alcohol used,
//    Symptoms noted → all point to Notion registries that don't exist
//    as app modules yet. Inlined here as plain text/array fields,
//    exactly the precedent set by the Contacts module (Stated Kinks,
//    Limits, etc. before a Kink Registry module exists).
//
//    "Doxy doses" (→ the real, already-built Medications Log) is
//    DELIBERATELY NOT a field here at all, per the user's 18 Aug 2026
//    reasoning: DoxyPEP is event-triggered in principle, but in
//    practice it only gets acknowledged/logged alongside his other
//    daily medications — not from within an Encounter record. So this
//    isn't a "not built yet" stub like the others above, it's a "this
//    link isn't the right model" call. `myDoxyPepStatus` (his DoxyPEP
//    coverage/status AT the time of the encounter, a real Notion
//    select field with genuine data) is kept — that's a different,
//    still-relevant fact from the doses-taken relation.
//
// `Time of Day` is a Notion FORMULA (derived from Date) — not a stored
// field here either. See encounterCalculations.js: timeOfDay(date).

import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_encounters";

// ---------------------------------------------------------------------
// Known option sets — copied verbatim from the live Notion select/
// multi-select option lists fetched this session. Not reordered or
// edited; SPAG cleanup, if wanted, is a separate Notion-side pass per
// the project's own standing rule (fix schema issues during a database
// pass, not silently while porting).
// ---------------------------------------------------------------------

export const ENCOUNTER_TYPE_OPTIONS = ["Hookup", "Group", "Date/Chill", "Sauna", "Event", "Other"];

// CHANGED 18 Aug 2026 — "Anal – top"/"Anal - bottom" renamed to
// "Anal - giving"/"Anal - receiving" for consistency with every other
// item here (the user's real feedback: Top/Bottom is anal-sex-specific
// terminology, Giving/Receiving is the term that actually fits all of
// these). Nothing removed — Kissing/Cuddling/Groping/Mutual
// masturbation/Kink/Toys stay exactly as they were; the UI (see
// GivingReceivingChips in SHOS_Encounters_Prototype.jsx) is what
// changed, splitting the "- giving"/"- receiving" pairs into two
// columns and showing everything else in a third group below, not this
// list itself.
// CHANGED 19 Aug 2026 — reordered per the user's ask (Oral > Rimming >
// Fingering > Anal > Vaginal), and Vaginal added as a new giving/
// receiving pair — didn't exist as an option before.
export const MY_POSITION_OPTIONS = [
  "Oral - giving", "Oral - receiving",
  "Rimming - giving", "Rimming - receiving",
  "Fingering - giving", "Fingering - receiving",
  "Anal - giving", "Anal - receiving",
  "Vaginal - giving", "Vaginal - receiving",
  "Kissing", "Cuddling", "Groping", "Mutual masturbation", "Kink", "Toys",
];

export const CUM_LOCATION_OPTIONS = [
  "Internal - Mouth", "Internal - Ass", "Internal - Vagina",
  "External - Body/Face", "External - Hand", "Didn't happen",
];

// CHANGED 19 Aug 2026 — real feedback: "Dom, Switch" was a leftover
// combo value from before Dom and Switch existed as separate options —
// redundant now that both exist individually, removed. "Neither" also
// dropped — the user's own reordering explicitly listed only these 5,
// and it overlapped conceptually with N/A anyway. Reordered to Dom >
// Switch > Sub > Vanilla > N/A, and "Vanilla / N/A" split into its
// own two separate options rather than one combined choice.
// CHANGED 19 Aug 2026 — real ask: same house style fix as
// BDSM_ROLE_OPTIONS in contactRepository.js — "Dom" capitalized, "sub"
// lowercase.
export const MY_ROLE_OPTIONS = ["Dom", "Switch", "sub", "Vanilla", "N/A"];

export const PREP_COVERAGE_OPTIONS = [
  "Adequate - daily (≥4/week)", "Adequate - Event-based (2-1-1)",
  "Missed dose", "Inadequate/recently started", "Not on PrEP",
];

export const DOXYPEP_STATUS_OPTIONS = [
  "Not indicated", "Indicated - taken", "Indicated - not yet taken",
  "Indicated - missed window", "N/A",
];

export const WOULD_MEET_AGAIN_OPTIONS = ["Fuck YES 💖", "Yes", "If he makes effort", "Maybe", "No"];

// ---------------------------------------------------------------------
// Default shape — single source of truth for "what does an empty
// encounter look like", same role DEFAULT_CONTACT plays for Contacts.
// ---------------------------------------------------------------------

export const DEFAULT_ENCOUNTER = {
  title: "",
  date: "", dateEnd: "", isDateTime: false,
  encounterType: "",
  attendeeIds: [],
  // CHANGED 18 Aug 2026 — Location, Kinks Involved, Protection Used,
  // Chems/Alcohol used, and Symptoms noted now hold REGISTRY IDs, not
  // free text. Locations, Kink Registry, Protection Registry, Chems
  // Registry, and Symptoms Registry are all real, built modules as of
  // this session. `locationId` is singular (was `location`, a string)
  // — Notion's Location relation technically allows several, but every
  // real Type option ("His House", "His Car") reads as inherently one
  // location per encounter; flagged as a deliberate simplification, not
  // an oversight, same as AttendeePicker's single-contact-per-Location
  // choice in locationsRepository.js.
  locationId: "",
  myPosition: [],
  kinksInvolved: [],
  myRole: "",
  whereICame: [],
  whereHeCame: [],
  myDoxyPepStatus: "",
  myPrepCoverage: "",
  chemsAlcoholUsed: [],
  wouldMeetAgain: "",
  protectionUsed: [],
  // FLAGGED OBSOLETE 18 Aug 2026 (the user): too ambiguous in practice — could
  // mean "should I meet this person again" (already covered by
  // wouldMeetAgain above) or "this entry is incomplete, come back to it".
  // Removed from the UI entirely (no checkbox, no read-only display) per
  // The user's direct ask. Left here rather than deleted, staged for manual
  // removal — same standing pattern as other obsolete fields flagged
  // this project (e.g. Medication Log's old Next refill date): a live
  // field is never silently dropped from the data model, only from the
  // UI, until a deliberate cleanup pass removes it for real.
  followUpNeeded: false,
  notes: "",
  enjoymentRating: null,
  symptomsNoted: [],
};

// ---------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------

// ADDED 1 Sep 2026 — real ask: richer example data with relative
// dates rather than the hardcoded ones below, which drift stale as
// real time passes. Same daysAgo approach as logRepository.js/
// contactRepository.js's own seed data.
function daysAgo(n, hour = 19, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let seedEncounters = [
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_001",
    title: "Alex — coffee then back to his",
    date: "2026-07-20T19:30:00.000Z",
    isDateTime: true,
    encounterType: "Date/Chill",
    attendeeIds: ["contact_001"],
    myRole: "Switch",
    enjoymentRating: 85,
    wouldMeetAgain: "Yes",
    notes: "Second time meeting up.",
    createdAt: "2026-07-20T21:00:00.000Z",
    isArchived: false,
  },
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_002",
    title: "Sauna trip",
    date: "2026-08-02T15:00:00.000Z",
    isDateTime: true,
    encounterType: "Sauna",
    attendeeIds: ["contact_002", "contact_003"],
    myRole: "Dom, Switch",
    enjoymentRating: 70,
    followUpNeeded: false,
    createdAt: "2026-08-02T18:00:00.000Z",
    isArchived: false,
  },
  // ADDED 1 Sep 2026 — real ask: the exposure Encounter behind the
  // example Timeline episode (see episodeRepository.js) — this is the
  // one EpisodeRepository's seed startEncounterId points at. DoxyPEP
  // taken and PrEP adequately covered, but neither is 100% protective
  // against Gonorrhoea specifically — the real, clinically-accurate
  // reason the episode below still happens despite both.
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_003",
    title: "F. Mercury — his place",
    date: daysAgo(14, 22, 30),
    isDateTime: true,
    encounterType: "Hookup",
    attendeeIds: ["contact_005"],
    myPosition: ["Oral - giving", "Anal - receiving"],
    myRole: "sub",
    myDoxyPepStatus: "Indicated - taken",
    myPrepCoverage: "Adequate - daily (≥4/week)",
    protectionUsed: [],
    enjoymentRating: 90,
    wouldMeetAgain: "Yes",
    createdAt: daysAgo(14, 23, 0),
    isArchived: false,
  },
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_004",
    title: "Sylvie — drinks then hers",
    date: daysAgo(6, 21, 0),
    isDateTime: true,
    encounterType: "Date/Chill",
    attendeeIds: ["contact_006"],
    myRole: "Switch",
    myDoxyPepStatus: "Not indicated",
    myPrepCoverage: "Adequate - daily (≥4/week)",
    protectionUsed: ["protection_001"], // FIXED — real bug found by the new orphan-reference checker (orphanReferenceCheck.js): this seed data stored Protection Registry's own display NAME ("Condom") instead of its real generated id. ProtectionRegistry's seedNames ["Condom", "PrEP", "PEP", "None"] deterministically produce protection_001/002/003/004 (see simpleRegistry.js's own generateId()) — "Condom" is always protection_001 on a fresh install.
    enjoymentRating: 80,
    wouldMeetAgain: "Yes",
    createdAt: daysAgo(6, 22, 0),
    isArchived: false,
  },
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_005",
    title: "Grace — first date",
    date: daysAgo(2, 19, 0),
    isDateTime: true,
    encounterType: "Date/Chill",
    attendeeIds: ["contact_007"],
    enjoymentRating: 75,
    wouldMeetAgain: "Yes",
    notes: "Good first date, meeting again next week.",
    createdAt: daysAgo(2, 21, 0),
    isArchived: false,
  },
  // ADDED — real example thread: a monogamous relationship with Morgan
  // across the same 4-month window as everything else, spanning
  // before/during/after the pregnancy story (pregnancyRepository.js,
  // clinicVisitsRepository.js, contraceptionRepository.js).
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_006",
    title: "Morgan — first date",
    date: daysAgo(111, 19, 30),
    isDateTime: true,
    encounterType: "Date/Chill",
    attendeeIds: ["contact_008"],
    myRole: "Switch",
    protectionUsed: ["protection_001"], // FIXED — real bug found by the new orphan-reference checker (orphanReferenceCheck.js): this seed data stored Protection Registry's own display NAME ("Condom") instead of its real generated id. ProtectionRegistry's seedNames ["Condom", "PrEP", "PEP", "None"] deterministically produce protection_001/002/003/004 (see simpleRegistry.js's own generateId()) — "Condom" is always protection_001 on a fresh install.
    enjoymentRating: 88,
    wouldMeetAgain: "Yes",
    notes: "Really clicked — seeing her again.",
    createdAt: daysAgo(111, 22, 0),
    isArchived: false,
  },
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_007",
    title: "Morgan — hers, exclusive now",
    date: daysAgo(96, 20, 0),
    isDateTime: true,
    encounterType: "Date/Chill",
    attendeeIds: ["contact_008"],
    myRole: "Switch",
    protectionUsed: [],
    enjoymentRating: 92,
    wouldMeetAgain: "Yes",
    notes: "Decided to be exclusive — stopping the pill, not using condoms going forward.",
    createdAt: daysAgo(96, 22, 30),
    isArchived: false,
  },
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_008",
    title: "Morgan — weekend away",
    date: daysAgo(82, 18, 0),
    isDateTime: true,
    encounterType: "Date/Chill",
    attendeeIds: ["contact_008"],
    myRole: "Switch",
    protectionUsed: [],
    enjoymentRating: 95,
    wouldMeetAgain: "Yes",
    createdAt: daysAgo(82, 23, 0),
    isArchived: false,
  },
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_009",
    title: "Morgan — hers",
    date: daysAgo(33, 20, 0),
    isDateTime: true,
    encounterType: "Date/Chill",
    attendeeIds: ["contact_008"],
    myRole: "Switch",
    protectionUsed: [],
    enjoymentRating: 80,
    wouldMeetAgain: "Yes",
    notes: "First time together again since the miscarriage — took it slow.",
    createdAt: daysAgo(33, 22, 0),
    isArchived: false,
  },
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_010",
    title: "Morgan — mine",
    date: daysAgo(11, 20, 30),
    isDateTime: true,
    encounterType: "Date/Chill",
    attendeeIds: ["contact_008"],
    myRole: "Switch",
    protectionUsed: [],
    enjoymentRating: 90,
    wouldMeetAgain: "Yes",
    createdAt: daysAgo(11, 22, 0),
    isArchived: false,
  },
  // ADDED — real ask: "variety of hookups" across the 4-month window,
  // not just the most recent fortnight the existing seed data already
  // covered.
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_011",
    title: "Jordan — his place",
    date: daysAgo(70, 21, 0),
    isDateTime: true,
    encounterType: "Hookup",
    attendeeIds: ["contact_002"],
    myPosition: ["Anal - giving"],
    myRole: "Dom",
    myDoxyPepStatus: "Not indicated",
    myPrepCoverage: "Adequate - daily (≥4/week)",
    protectionUsed: ["protection_001"], // FIXED — real bug found by the new orphan-reference checker (orphanReferenceCheck.js): this seed data stored Protection Registry's own display NAME ("Condom") instead of its real generated id. ProtectionRegistry's seedNames ["Condom", "PrEP", "PEP", "None"] deterministically produce protection_001/002/003/004 (see simpleRegistry.js's own generateId()) — "Condom" is always protection_001 on a fresh install.
    enjoymentRating: 85,
    wouldMeetAgain: "Yes",
    createdAt: daysAgo(70, 23, 0),
    isArchived: false,
  },
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_012",
    title: "Sauna trip",
    date: daysAgo(45, 16, 0),
    isDateTime: true,
    encounterType: "Sauna",
    attendeeIds: ["contact_003"],
    myRole: "Switch",
    myDoxyPepStatus: "Not indicated",
    myPrepCoverage: "Adequate - daily (≥4/week)",
    protectionUsed: ["protection_001"], // FIXED — real bug found by the new orphan-reference checker (orphanReferenceCheck.js): this seed data stored Protection Registry's own display NAME ("Condom") instead of its real generated id. ProtectionRegistry's seedNames ["Condom", "PrEP", "PEP", "None"] deterministically produce protection_001/002/003/004 (see simpleRegistry.js's own generateId()) — "Condom" is always protection_001 on a fresh install.
    enjoymentRating: 72,
    createdAt: daysAgo(45, 18, 0),
    isArchived: false,
  },
];

// Real startup: load whatever's actually been saved before, same
// pattern as ContactRepository — fall back to seed data only on a
// genuinely first run.
let encounters = storage.load(STORAGE_KEY, seedEncounters);

function persist() {
  storage.save(STORAGE_KEY, encounters);
}

// Same ID-safety approach as ContactRepository: derived from the actual
// IDs present, not array length.
function computeNextEncounterNumber(existingEncounters) {
  const numbers = existingEncounters.map((e) => {
    const match = /^encounter_(\d+)$/.exec(e.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}
let nextEncounterNumber = computeNextEncounterNumber(encounters);

function generateEncounterId() {
  const id = `encounter_${String(nextEncounterNumber).padStart(3, "0")}`;
  nextEncounterNumber += 1;
  return id;
}

// ---------------------------------------------------------------------
// The repository itself.
// ---------------------------------------------------------------------

// ADDED 18 Aug 2026 — same shape change and migration as Contacts'
// statedKinks, applied to kinksInvolved: was a flat array of Kink
// Registry IDs, is now an array of {kinkId, role} selections. The user's
// ask covers this exact per-session case: "fisting happened" is enough
// on its own, with an OPTIONAL role if he wants to note "I was fisting
// top" for that specific session — role stays null otherwise, same
// selection shape as Contacts either way. See contactRepository.js's
// normalizeKinkSelections() for the full reasoning; duplicated here
// rather than imported since it's a small pure function and Encounters
// deliberately doesn't depend on Contacts' internals for anything else.
// ADDED 20 Aug 2026 — same fix as contactRepository.js: the 19 Aug
// "Bottom"→"bottom"/"Sub"→"sub" house-style rename (KINK_ROLE_OPTIONS/
// MY_ROLE_OPTIONS above) only changed the option lists going forward,
// not values already saved under the old casing. Duplicated here for
// the same reason normalizeKinkSelections is duplicated rather than
// imported.
const LEGACY_ROLE_CASING = { Bottom: "bottom", Sub: "sub" };
function normalizeRoleCasing(role) {
  return role == null ? role : (LEGACY_ROLE_CASING[role] ?? role);
}

function normalizeKinkSelections(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((entry) => {
    if (typeof entry === "string") return { kinkId: entry, role: null };
    if (entry && typeof entry === "object" && entry.kinkId) {
      return { kinkId: entry.kinkId, role: normalizeRoleCasing(entry.role ?? null) };
    }
    return null;
  }).filter(Boolean);
}

export const EncounterRepository = {
  // CHANGED 18 Aug 2026 — same defensive-merge fix applied across every
  // repository this session: an encounter saved before some future
  // field existed now reads back with that field defaulted from
  // DEFAULT_ENCOUNTER, not missing entirely. Also runs kinksInvolved
  // through normalizeKinkSelections() so old flat-ID-array encounters
  // and new role-aware encounters both read back in the current shape.
  getAll() {
    return structuredClone(
      encounters.map((e) => {
        const merged = { ...DEFAULT_ENCOUNTER, ...e };
        return { ...merged, kinksInvolved: normalizeKinkSelections(merged.kinksInvolved), myRole: normalizeRoleCasing(merged.myRole) };
      })
    );
  },

  getById(id) {
    const found = encounters.find((e) => e.id === id);
    if (!found) return null;
    const merged = { ...DEFAULT_ENCOUNTER, ...found };
    return structuredClone({ ...merged, kinksInvolved: normalizeKinkSelections(merged.kinksInvolved), myRole: normalizeRoleCasing(merged.myRole) });
  },

  // Every encounter that lists this contact as an attendee — the read
  // side of the Attendees relation. Used by encounterCalculations.js
  // and by the Contact Profile Timeline.
  getByAttendee(contactId) {
    return structuredClone(
      encounters
        .filter((e) => e.attendeeIds.includes(contactId))
        .map((e) => {
          const merged = { ...DEFAULT_ENCOUNTER, ...e };
          return { ...merged, kinksInvolved: normalizeKinkSelections(merged.kinksInvolved), myRole: normalizeRoleCasing(merged.myRole) };
        })
    );
  },

  create(data) {
    const newEncounter = {
      ...DEFAULT_ENCOUNTER,
      ...data,
      id: generateEncounterId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    encounters = [...encounters, newEncounter];
    persist();
    return newEncounter;
  },

  update(id, changes) {
    let updatedEncounter = null;
    encounters = encounters.map((e) => {
      if (e.id !== id) return e;
      // ADDED 26 Aug 2026 — real ask: last-updated indicator, rolled
      // out consistently across every module.
      updatedEncounter = { ...e, ...changes, updatedAt: new Date().toISOString() };
      return updatedEncounter;
    });
    persist();
    return updatedEncounter;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  // ADDED — real ask: "no delete option" — same reasoning as every
  // other module's own delete() this session: archive stays correct
  // for anything real that's just outdated, this is specifically for
  // a genuinely wrong entry.
  delete(id) {
    encounters = encounters.filter((e) => e.id !== id);
    persist();
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  // ADDED 26 Aug 2026 — real ask: long-press multi-select rolled out
  // to every module, same pattern as Contacts' own bulk methods.
  bulkArchive(ids) {
    ids.forEach((id) => this.archive(id));
  },

  bulkDelete(ids) {
    encounters = encounters.filter((e) => !ids.includes(e.id));
    persist();
  },

  // ADDED 26 Aug 2026 — real ask: undo for delete, not just archive.
  // Reinserts the exact record (same id, same timestamps), unlike
  // create() which always generates a fresh id.
  restore(record) {
    if (encounters.some((e) => e.id === record.id)) return;
    encounters = [...encounters, record];
    persist();
  },

  // Wholesale replace — used only by backup restore, same contract as
  // ContactRepository.replaceAll.
  replaceAll(newEncounters) {
    encounters = newEncounters;
    nextEncounterNumber = computeNextEncounterNumber(encounters);
    persist();
  },
};
