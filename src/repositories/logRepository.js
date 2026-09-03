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
  { id: "log_001", medicationId: "med_001", type: "refill", delta: 30, date: daysAgo(8, 9), voided: false },
  { id: "log_002", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(1, 8), voided: false },
  { id: "log_003", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(2, 8), voided: false },
  { id: "log_004", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(3, 8), voided: false },
  { id: "log_005", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(4, 8), voided: false },
  { id: "log_006", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(5, 8), voided: false },
  { id: "log_007", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(6, 8), voided: false },

  // DoxyPEP (med_002)
  { id: "log_008", medicationId: "med_002", type: "refill", delta: 16, date: daysAgo(20, 9), voided: false },
  { id: "log_009", medicationId: "med_002", type: "dose", delta: -6, date: daysAgo(5, 22), voided: false },

  // Vitamin D3 (med_003)
  { id: "log_010", medicationId: "med_003", type: "refill", delta: 90, date: daysAgo(60, 9), voided: false },
  { id: "log_011", medicationId: "med_003", type: "dose", delta: -30, date: daysAgo(30, 8), voided: false },
  { id: "log_012", medicationId: "med_003", type: "dose", delta: -14, date: daysAgo(1, 20), voided: false },

  // Antihistamine (med_004)
  { id: "log_013", medicationId: "med_004", type: "dose", delta: -1, date: daysAgo(2, 14), voided: false },

  // Amoxicillin, finished course (med_005)
  { id: "log_014", medicationId: "med_005", type: "dose", delta: -21, date: daysAgo(45, 9), voided: false },
];

// Real startup: load whatever's actually been saved before. On a
// genuinely first run, fall back to the seed data above.
let logs = storage.load(STORAGE_KEY, seedLogs);

function persist() {
  storage.save(STORAGE_KEY, logs);
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
let nextLogNumber = computeNextLogNumber(logs);

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
  getForMedication(medicationId) {
    return structuredClone(logs.filter((l) => l.medicationId === medicationId).map((l) => ({ ...DEFAULT_LOG_ENTRY, ...l })));
  },

  // Every log entry across every medication — what the cross-medication
  // Log tab feed needs. Returns copies, not the live stored array/objects
  // — same reasoning as every other repository's getAll().
  getAll() {
    return structuredClone(logs.map((l) => ({ ...DEFAULT_LOG_ENTRY, ...l })));
  },

  // Creates a new log entry (a Dose Taken, Refill, or Waste/Lost event).
  // Fills in id and voided automatically. reason/sideEffects/notes are
  // optional — most dose entries won't set them, same as Notion's own
  // schema (Reason and Side effects were never required fields there
  // either).
  create(data) {
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
    persist();
    return newEntry;
  },

  // Corrects an existing entry's amount, date, or type — this is the
  // "edit a mis-logged entry" path (Correction Sheet in the prototype).
  // There's deliberately no 4th "Correction" log type: this just changes
  // the fact that was recorded, and Current Stock re-derives itself
  // automatically next time it's calculated.
  update(id, changes) {
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
      updatedEntry = { ...l, ...changes, updatedAt: new Date().toISOString() };
      return updatedEntry;
    });
    persist();
    return updatedEntry;
  },

  // Marks an entry as voided rather than deleting it — the entry is kept
  // for history, but excluded from stock/adherence math going forward.
  void(id) {
    return this.update(id, { voided: true });
  },

  // ADDED 19 Aug 2026 — real ask: Redo, the counterpart to Undo. The user's
  // explicit scope call: undo/redo should apply only within the module/
  // page it happened on, not as a cross-module action history — this
  // stays exactly that: reversing one specific void, nothing more.
  unvoid(id) {
    return this.update(id, { voided: false });
  },

  // Wholesale replace — used only by backup restore. See ContactRepository
  // for the same pattern and reasoning.
  replaceAll(newLogs) {
    logs = newLogs;
    nextLogNumber = computeNextLogNumber(logs);
    persist();
  },
};
