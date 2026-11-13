// vaginalHealthRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Single owner of the user's vaginal-health records: a dated entry per
// episode, with the condition that was recorded and optional notes. The
// urgency tier is NOT stored — it is derived from the condition every time it
// is displayed (see SHOS_VaginalHealth_Prototype.jsx's tierFor()), so a later
// clinical decision about a tier cannot leave old records showing a stale one.
//
// WHY A REPOSITORY AND NOT RAW localStorage. The module's first slice wrote
// `shos_vaginal_health` directly. That works on screen but puts the data
// outside every cross-cutting guarantee the rest of the app has: it was
// missing from backups (buildBackup() enumerates repositories, not storage
// keys), from "reset all app data", and from the encryption-at-rest path that
// storageAdapter.load/save provides. A health record that silently does not
// travel with a backup is a data-loss bug, not a style preference.
//
// No seed data, deliberately. Every other repository seeds demo records so a
// fresh install demonstrates the feature; vaginal health is real clinical
// history with no honest demo value, and seeding it would put invented
// symptoms in front of the user on first run.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_vaginal_health";

export const DEFAULT_VAGINAL_HEALTH_ENTRY = {
  condition: "",
  date: null,
  // ADDED 13 Nov 2026 - treatment and outcome tracking
  treatment: "",          // what was prescribed/done
  outcome: "",            // resolved, recurring, chronic
  notes: "",
};

let entries = null;
let loadPromise = null;
let nextNumber = 1;

async function ensureLoaded() {
  if (entries === null) {
    if (!loadPromise) loadPromise = storage.load(STORAGE_KEY, []);
    const loaded = await loadPromise;
    entries = Array.isArray(loaded) ? loaded : [];
    nextNumber = computeNextNumber(entries);
  }
  return entries;
}

function computeNextNumber(existing) {
  const numbers = existing.map((e) => {
    const match = /^vh_(\d+)$/.exec(e?.id || "");
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateId() {
  const id = `vh_${String(nextNumber).padStart(3, "0")}`;
  nextNumber += 1;
  return id;
}

async function persist() {
  await storage.save(STORAGE_KEY, entries);
}

export const VaginalHealthRepository = {
  // Exposed for storageKeyDrift-style checks and for the backup service's own
  // reasoning about where this data lives.
  storageKey: STORAGE_KEY,

  async getAll() {
    await ensureLoaded();
    return structuredClone(entries.map((e) => ({ ...DEFAULT_VAGINAL_HEALTH_ENTRY, ...e })));
  },

  async getById(id) {
    await ensureLoaded();
    const found = entries.find((e) => e.id === id);
    return found ? structuredClone({ ...DEFAULT_VAGINAL_HEALTH_ENTRY, ...found }) : null;
  },

  async create(data) {
    await ensureLoaded();
    const record = {
      ...DEFAULT_VAGINAL_HEALTH_ENTRY,
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    entries = [...entries, record];
    await persist();
    return structuredClone(record);
  },

  async update(id, changes) {
    await ensureLoaded();
    let updated = null;
    entries = entries.map((e) => {
      if (e.id !== id) return e;
      updated = { ...e, ...changes, updatedAt: new Date().toISOString() };
      return updated;
    });
    await persist();
    return updated ? structuredClone({ ...DEFAULT_VAGINAL_HEALTH_ENTRY, ...updated }) : null;
  },

  async delete(id) {
    await ensureLoaded();
    entries = entries.filter((e) => e.id !== id);
    await persist();
  },

  // Used by backup restore/merge and by "reset all app data". Writes rather
  // than removing the key, so a reset leaves a genuinely empty list instead of
  // letting a future load fall back to seed data (this repository has none,
  // but the invariant is the same one resetAllData.js documents).
  async replaceAll(newEntries) {
    entries = Array.isArray(newEntries) ? newEntries : [];
    nextNumber = computeNextNumber(entries);
    await persist();
  },
};
