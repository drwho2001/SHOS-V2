// logRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// This file is the ONLY place in the app that knows how individual
// medication log entries (a single "took a dose," "refilled," or
// "wasted/lost" event) are stored. Every screen that needs log history
// — the Medication Card, the Log tab, the Inventory tab, adherence
// calculations — asks THIS file for it.
//
// This file does NOT know anything about a medication's name, dosing
// pattern, or threshold — it only knows a log entry belongs to ONE
// medication, via that medication's id (`medicationId`). That's the
// whole point of splitting this out from medicationRepository.js: this
// file can be searched, filtered, and totalled up without ever touching
// medication metadata, and medicationRepository.js never has to think
// about history at all.
//
// Like medicationRepository.js, this is in-memory only for now — the
// shape is what matters at this step, not where it's physically saved.
//
// PERSISTENCE, added 17 Aug 2026: log entries now survive closing and
// reopening the app, via localStorageAdapter — same pattern as
// ContactRepository and MedicationRepository. One side effect worth
// knowing: the seed data's dates are computed relative to "now" only on
// a genuine first run. Once persisted, they become fixed history like
// any other saved entry — which is correct: a demo dose from "6 days
// ago" shouldn't silently drift to a different date every time the app
// reloads once it's real, saved data.

import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_logs";

// ADDED 19 Aug 2026 — real gap found in the Notion-vs-app audit, the user
// confirmed both wanted: Notion's Medications Log tracked Reason
// (Routine/Prevention/Treatment/Waste) and Side effects per entry;
// the app's log entries had neither. Both optional/multi-select,
// matching Notion's real values exactly.
export const REASON_OPTIONS = ["Routine", "Prevention", "Treatment", "Waste"];
export const SIDE_EFFECT_OPTIONS = ["Malaise", "Fever", "Diarrhoea", "Vomiting", "Nausea"];
const DEFAULT_LOG_ENTRY = { reason: [], sideEffects: [], notes: "" };

// ---------------------------------------------------------------------
// Seed data — flattened from the existing prototype's nested
// `med.logs` arrays. Each entry now carries its own id and the id of
// the medication it belongs to.
//
// Dates are generated relative to "now" (same approach the prototype
// used with its own daysAgo helper) so the seed data always looks
// recent when this file is loaded, rather than hard-coding stale dates.
// ---------------------------------------------------------------------

function daysAgo(n, hour = 9, minute = 30) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let seedLogs = [
  // PrEP (med_001)
  { id: "seed_log_9001", medicationId: "seed_med_9001", type: "refill", delta: 30, date: daysAgo(8, 9), voided: false },
  { id: "seed_log_9002", medicationId: "seed_med_9001", type: "dose", delta: -1, date: daysAgo(1, 8), voided: false },
  { id: "seed_log_9003", medicationId: "seed_med_9001", type: "dose", delta: -1, date: daysAgo(2, 8), voided: false },
  { id: "seed_log_9004", medicationId: "seed_med_9001", type: "dose", delta: -1, date: daysAgo(3, 8), voided: false },
  { id: "seed_log_9005", medicationId: "seed_med_9001", type: "dose", delta: -1, date: daysAgo(4, 8), voided: false },
  { id: "seed_log_9006", medicationId: "seed_med_9001", type: "dose", delta: -1, date: daysAgo(5, 8), voided: false },
  { id: "seed_log_9007", medicationId: "seed_med_9001", type: "dose", delta: -1, date: daysAgo(6, 8), voided: false },

  // DoxyPEP (med_002)
  { id: "seed_log_9008", medicationId: "seed_med_9002", type: "refill", delta: 16, date: daysAgo(20, 9), voided: false },
  { id: "seed_log_9009", medicationId: "seed_med_9002", type: "dose", delta: -6, date: daysAgo(5, 22), voided: false },

  // Vitamin D3 (med_003)
  { id: "seed_log_9010", medicationId: "seed_med_9003", type: "refill", delta: 90, date: daysAgo(60, 9), voided: false },
  { id: "seed_log_9011", medicationId: "seed_med_9003", type: "dose", delta: -30, date: daysAgo(30, 8), voided: false },
  { id: "seed_log_9012", medicationId: "seed_med_9003", type: "dose", delta: -14, date: daysAgo(1, 20), voided: false },

  // Antihistamine (med_004)
  { id: "seed_log_9013", medicationId: "seed_med_9004", type: "dose", delta: -1, date: daysAgo(2, 14), voided: false },

  // Amoxicillin, finished course (med_005)
  { id: "seed_log_9014", medicationId: "seed_med_9005", type: "dose", delta: -21, date: daysAgo(45, 9), voided: false },
];

// CHANGED — Phase 2 encryption groundwork: ensureLoaded()/memoized-
// loadPromise pattern, same as every other module-load-cached
// repository converted this session (see CLAUDE.md).
let logs = null;
let nextLogNumber = null;
let loadPromise = null;
// ADDED 27 Sep 2026 - the ids of this repository's own sample data, derived
// from the seed array above rather than hardcoded, so it cannot drift when
// the sample data is edited.
//
// Why this exists: on a fresh install the seed is returned as the fallback
// for an absent storage key, so a brand-new user's first view is a stranger's
// medical history - including a positive STI result - with nothing in the UI
// saying so. `clearSampleData()` needs to remove exactly these and nothing
// else, because by the time a user has added a record of their own, the seed
// and the real data live in the same array and are indistinguishable except by
// id. "Delete everything" would take their data with it.
export const SEED_MEDICATION_LOG_IDS = new Set(seedLogs.map((r) => r.id));

async function ensureLoaded() {
  if (logs === null) {
    if (!loadPromise) loadPromise = storage.load(STORAGE_KEY, seedLogs);
    logs = await loadPromise;
    nextLogNumber = computeNextLogNumber(logs);
  }
  return logs;
}

async function persist() {
  await storage.save(STORAGE_KEY, logs);
}

// Derived from actual IDs present, not logs.length — same fix already
// applied to Medication and Contact IDs.
function computeNextLogNumber(existingLogs) {
  const numbers = existingLogs.map((l) => {
    const match = /^log_(\d+)$/.exec(l.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateLogId() {
  const id = `log_${String(nextLogNumber).padStart(3, "0")}`;
  nextLogNumber += 1;
  return id;
}

// ---------------------------------------------------------------------
// The repository itself.
// ---------------------------------------------------------------------

export const LogRepository = {
  // All log entries for one medication — this is what a Medication Card
  // or its stock/adherence calculations would ask for. Includes voided
  // entries; callers that want to exclude them (e.g. stock math) filter
  // on `voided` themselves, same principle as isArchived above.
  async getForMedication(medicationId) {
    await ensureLoaded();
    return structuredClone(logs.filter((l) => l.medicationId === medicationId).map((l) => ({ ...DEFAULT_LOG_ENTRY, ...l })));
  },

  // Every log entry across every medication — what the cross-medication
  // Log tab feed needs. Returns copies, not the live stored array/objects
  // — same reasoning as every other repository's getAll().
  async getAll() {
    await ensureLoaded();
    return structuredClone(logs.map((l) => ({ ...DEFAULT_LOG_ENTRY, ...l })));
  },

  // Creates a new log entry (a Dose Taken, Refill, or Waste/Lost event).
  // Fills in id and voided automatically. reason/sideEffects/notes are
  // optional — most dose entries won't set them, same as Notion's own
  // schema (Reason and Side effects were never required fields there
  // either).
  async create(data) {
    await ensureLoaded();
    const newEntry = {
      id: generateLogId(),
      medicationId: data.medicationId,
      type: data.type, // "dose" | "refill" | "waste"
      delta: data.delta, // signed: negative for dose/waste, positive for refill
      date: data.date,
      voided: false,
      reason: data.reason ?? [],
      sideEffects: data.sideEffects ?? [],
      notes: data.notes ?? "",
    };
    logs = [...logs, newEntry];
    await persist();
    return newEntry;
  },

  // Corrects an existing entry's amount, date, or type — this is the
  // "edit a mis-logged entry" path (Correction Sheet in the prototype).
  // There's deliberately no 4th "Correction" log type: this just changes
  // the fact that was recorded, and Current Stock re-derives itself
  // automatically next time it's calculated.
  async update(id, changes) {
    await ensureLoaded();
    let updatedEntry = null;
    logs = logs.map((l) => {
      if (l.id !== id) return l;
      // ADDED — real ask, from a build audit: this genuine "correct a
      // mis-logged entry" path had no updatedAt at all — exactly the
      // "edit an existing record's fields, no new record created" case
      // backupService.js's own hasUnbackedChanges() comment names as
      // its known blind spot. Real dose/refill/waste log corrections
      // now count toward the backup-staleness reminder like any other
      // real activity.
      updatedEntry = { ...l, ...changes, updatedAt: new Date().toISOString(), isSeed: false };
      return updatedEntry;
    });
    await persist();
    return updatedEntry;
  },

  // Marks an entry as voided rather than deleting it — the entry is kept
  // for history, but excluded from stock/adherence math going forward.
  async void(id) {
    return this.update(id, { voided: true });
  },

  // ADDED 19 Aug 2026 — real ask: Redo, the counterpart to Undo. The user's
  // explicit scope call: undo/redo should apply only within the module/
  // page it happened on, not as a cross-module action history — this
  // stays exactly that: reversing one specific void, nothing more.
  async unvoid(id) {
    return this.update(id, { voided: false });
  },

  // ADDED — real gap found via the new orphan-reference checker
  // (orphanReferenceCheck.js): a dose/refill/waste log entry is
  // meaningless without the Medication it belongs to (there's no
  // "unknown medication" concept anywhere this reads), so deleting a
  // Medication needs to delete its own log history too, not just leave
  // it dangling. Real delete, not a field clear — called by
  // medicationRepository.js's own delete().
  async deleteForMedication(medicationId) {
    await ensureLoaded();
    logs = logs.filter((l) => l.medicationId !== medicationId);
    await persist();
  },

  // Wholesale replace — used only by backup restore. See ContactRepository
  // for the same pattern and reasoning.
  async replaceAll(newLogs) {
    logs = newLogs;
    nextLogNumber = computeNextLogNumber(logs);
    await persist();
  },
};
