// symptomLogRepository.js
//
// Real live Notion schema, fetched fresh this session (Symptoms
// Tracker database — 8 fields: Symptom Title, symptom_id, Symptom
// [relation → Symptoms Registry], Date Started, Date Resolved,
// Severity, Encounter [relation], Test [relation], Notes). Same
// defensive-default pattern as every repository this session, applied
// from creation.
//
// NAMING — nav-facing module is called "Symptom Log", not "Symptoms
// Tracker", per a deliberate decision locked in the session before
// this one specifically to avoid confusion with "Symptoms Registry"
// (the tag vocabulary already used inside Encounters/Clinic Visits —
// a conceptually different thing: vocabulary vs. dated occurrences).
// The file/repository name follows the nav name for consistency.
//
// "Active vs. resolved" — a real concept Notion already tracks (Date
// Resolved present or empty), not invented for this app. This directly
// replaces the 30-day-Encounters-tag proxy Clinic Card's "Active
// symptoms" section used as a stand-in before this module existed.
//
// RELATIONSHIPS — the user's standing instruction ("wire every relationship
// that can now exist"). Encounters and Testing both exist as real,
// built modules, so both relations here are REAL and wired from
// creation, not stubbed. Stored as arrays (relatedEncounterIds,
// relatedTestIds) matching Notion's own relation shape — deliberately
// not narrowed to a single value the way Encounters' locationId was,
// since a recurring symptom noticed across several encounters, or
// checked at more than one test, is a real and plausible case here,
// unlike Location's genuinely-always-one-per-encounter pattern.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_symptom_log";

export const SEVERITY_OPTIONS = ["Mild", "Moderate", "Severe"];

export const DEFAULT_SYMPTOM_ENTRY = {
  title: "",
  // CHANGED 26 Aug 2026 — real ask, decided (was backlogged, now
  // built): support more than one symptom per entry (e.g. dysuria +
  // urethral discharge together). symptomId (singular) is kept, not
  // removed — real existing entries have it, and normalizeSymptomIds()
  // below migrates it into symptomIds on read, so nothing breaks.
  symptomId: "",           // DEPRECATED — kept for backward compat only, do not write to this going forward, use symptomIds
  symptomIds: [],          // → SymptomsRegistry, real field going forward
  dateStarted: null,
  dateResolved: null,     // empty = active, present = resolved — the real Notion concept
  severity: "",
  relatedEncounterIds: [], // → EncounterRepository, real and wired
  relatedTestIds: [],      // → TestingRepository, real and wired
  notes: "",
  isArchived: false,
};

let entries = storage.load(STORAGE_KEY, []);
let nextEntryNumber = computeNextEntryNumber(entries);

function computeNextEntryNumber(existing) {
  const numbers = existing.map((e) => {
    const match = /^symlog_(\d+)$/.exec(e.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateEntryId() {
  const id = `symlog_${String(nextEntryNumber).padStart(3, "0")}`;
  nextEntryNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, entries);
}

// ADDED 26 Aug 2026 — real migration: an old entry may have only the
// deprecated singular symptomId set, with symptomIds still empty.
// Normalizes on every read, same "merge with DEFAULT, migrate on
// read" pattern already used elsewhere in this repo — not a one-time
// destructive rewrite of stored data.
function normalizeSymptomIds(entry) {
  if ((!entry.symptomIds || entry.symptomIds.length === 0) && entry.symptomId) {
    return { ...entry, symptomIds: [entry.symptomId] };
  }
  return entry;
}

export const SymptomLogRepository = {
  getAll() {
    return structuredClone(entries.map((e) => normalizeSymptomIds({ ...DEFAULT_SYMPTOM_ENTRY, ...e })));
  },

  getById(id) {
    const found = entries.find((e) => e.id === id);
    return found ? structuredClone(normalizeSymptomIds({ ...DEFAULT_SYMPTOM_ENTRY, ...found })) : null;
  },

  // Real, active-only convenience read — "Date Resolved" empty, per the
  // real Notion field this maps to. Used by Clinic Card and the
  // module's own landing screen so the "what counts as active" logic
  // lives in exactly one place.
  getActive() {
    return this.getAll().filter((e) => !e.isArchived && !e.dateResolved);
  },

  create(data) {
    const newEntry = {
      ...DEFAULT_SYMPTOM_ENTRY,
      ...data,
      id: generateEntryId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    entries = [...entries, newEntry];
    persist();
    return newEntry;
  },

  update(id, changes) {
    let updated = null;
    entries = entries.map((e) => {
      if (e.id !== id) return e;
      // ADDED 26 Aug 2026 — real ask: last-updated indicator, rolled
      // out consistently across every module.
      updated = { ...e, ...changes, updatedAt: new Date().toISOString() };
      return updated;
    });
    persist();
    return updated ? structuredClone({ ...DEFAULT_SYMPTOM_ENTRY, ...updated }) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  // ADDED — real ask: "no delete option" — same reasoning as Testing's
  // own delete(): archive stays correct for anything real that's just
  // outdated, this is specifically for a genuinely wrong entry.
  delete(id) {
    entries = entries.filter((e) => e.id !== id);
    persist();
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  // ADDED 26 Aug 2026 — real ask: long-press multi-select rolled out
  // to every module.
  bulkArchive(ids) {
    ids.forEach((id) => this.archive(id));
  },

  bulkDelete(ids) {
    entries = entries.filter((e) => !ids.includes(e.id));
    persist();
  },

  // ADDED 26 Aug 2026 — real ask: undo for delete, not just archive.
  restore(record) {
    if (entries.some((e) => e.id === record.id)) return;
    entries = [...entries, record];
    persist();
  },

  replaceAll(newEntries) {
    entries = newEntries;
    persist();
  },
};
