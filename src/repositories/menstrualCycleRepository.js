// menstrualCycleRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// A dated log of periods — start date, optional end date (a cycle can
// be logged as still ongoing), flow, and any symptoms specifically
// tied to that period. Gated behind Settings' own
// menstrualTrackingEnabled toggle (see appPreferencesRepository.js),
// decoupled from gender — the toggle is opt-in for anyone, gender only
// suggests it, never forces it (a trans-masc user on T may not want
// this tab regardless of biology; a cis woman may choose not to track
// either).
//
// `symptomIds` links the real Symptoms Registry, same fix already
// proven in Vaccinations — this is specifically for symptoms
// experienced DURING a logged period, not a replacement for Symptom
// Log, which already handles arbitrary dated symptoms on its own.
//
// PREGNANCY INTERACTION, resolved at the UI layer not here: while
// pregnancyRepository.js reports an active pregnancy, the screen that
// renders this repository's data shows cycle logging as paused rather
// than hiding it — nothing in this file itself changes.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_menstrual_cycles";

export const DEFAULT_CYCLE = {
  startDate: null,
  endDate: null,
  flow: "",
  symptomIds: [],
  notes: "",
  isArchived: false,
};

// ADDED — real example data, same "one real seed thread, not blank
// screens" convention as every other repository in this app. Three
// entries so getAverageCycleLengthDays() has something real to
// compute from on a fresh install, not just an empty state.
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
const seedStart1 = daysAgo(58);
const seedStart2 = addDays(seedStart1, 28);
const seedStart3 = addDays(seedStart2, 29);
let seedCycles = [
  { ...DEFAULT_CYCLE, id: "cycle_001", startDate: seedStart1, endDate: addDays(seedStart1, 5), flow: "Medium", symptomIds: [], notes: "" },
  { ...DEFAULT_CYCLE, id: "cycle_002", startDate: seedStart2, endDate: addDays(seedStart2, 4), flow: "Heavy", symptomIds: [], notes: "" },
  { ...DEFAULT_CYCLE, id: "cycle_003", startDate: seedStart3, endDate: null, flow: "Light", symptomIds: [], notes: "Ongoing." },
];

let cycles = storage.load(STORAGE_KEY, seedCycles);
let nextNumber = computeNextNumber(cycles);

function computeNextNumber(existing) {
  const numbers = existing.map((c) => {
    const match = /^cycle_(\d+)$/.exec(c.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateId() {
  const id = `cycle_${String(nextNumber).padStart(3, "0")}`;
  nextNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, cycles);
}

export const MenstrualCycleRepository = {
  getAll() {
    return structuredClone(cycles.map((c) => ({ ...DEFAULT_CYCLE, ...c })));
  },

  getById(id) {
    const found = cycles.find((c) => c.id === id);
    return found ? structuredClone({ ...DEFAULT_CYCLE, ...found }) : null;
  },

  // Real, honest scope limit stated plainly: an FYI average, computed
  // on read like Vaccinations' own "Overdue" stat — not fertility
  // prediction, not ovulation tracking, just "here's roughly your
  // pattern" from whatever's actually been logged.
  getAverageCycleLengthDays() {
    const sorted = this.getAll().filter((c) => !c.isArchived && c.startDate).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    if (sorted.length < 2) return null;
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = Math.round((new Date(sorted[i].startDate) - new Date(sorted[i - 1].startDate)) / 86400000);
      if (days > 0) gaps.push(days);
    }
    if (!gaps.length) return null;
    return Math.round(gaps.reduce((sum, d) => sum + d, 0) / gaps.length);
  },

  create(data) {
    const newCycle = { ...DEFAULT_CYCLE, ...data, id: generateId(), createdAt: new Date().toISOString(), isArchived: false };
    cycles = [...cycles, newCycle];
    persist();
    return newCycle;
  },

  update(id, changes) {
    let updated = null;
    cycles = cycles.map((c) => {
      if (c.id !== id) return c;
      updated = { ...c, ...changes, updatedAt: new Date().toISOString() };
      return updated;
    });
    persist();
    return updated ? structuredClone({ ...DEFAULT_CYCLE, ...updated }) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  delete(id) {
    cycles = cycles.filter((c) => c.id !== id);
    persist();
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  bulkArchive(ids) {
    ids.forEach((id) => this.archive(id));
  },

  bulkDelete(ids) {
    cycles = cycles.filter((c) => !ids.includes(c.id));
    persist();
  },

  restore(record) {
    if (cycles.some((c) => c.id === record.id)) return;
    cycles = [...cycles, record];
    persist();
  },

  replaceAll(newCycles) {
    cycles = newCycles;
    nextNumber = computeNextNumber(cycles);
    persist();
  },
};
