// contraceptionRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real design decision, resolved across several rounds: this is the
// single owner of contraception data — My Profile no longer edits
// contraception directly, it just displays a derived, read-only
// summary read from here (getActive() below). Two independently
// editable copies of "what contraception am I on" would drift out of
// sync exactly the way "one room, three doors" was built to avoid for
// Measurements; the fix is the same here — one owner.
//
// A real history, not a single current-value field — each entry has
// its own startDate/endDate, so switching methods (or running two
// concurrently) is just multiple entries, no special-casing. Multiple
// ACTIVE entries (no endDate) means multiple concurrent methods, which
// is a real, already-established need ("Testosterone + Implant").
//
// intervalDays/nextDueDate reuses the exact interval-due-date shape
// already proven in medicationRepository.js's scheduleIntervalDays —
// same mechanism, so a depot shot (~84 days) and an IUD (5-10 years,
// varies by type) are just different interval values, not different
// code paths.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_contraception";

export const DEFAULT_CONTRACEPTION_ENTRY = {
  method: "",
  startDate: null,
  endDate: null,          // set = this method has stopped/switched
  intervalDays: null,     // e.g. 84 for a 12-week depot shot; null for a daily method with no "next due" concept
  nextDueDate: null,
  linkedClinicVisitId: null,
  notes: "",
  isArchived: false,
};

let entries = storage.load(STORAGE_KEY, []);
let nextNumber = computeNextNumber(entries);

function computeNextNumber(existing) {
  const numbers = existing.map((e) => {
    const match = /^contra_(\d+)$/.exec(e.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateId() {
  const id = `contra_${String(nextNumber).padStart(3, "0")}`;
  nextNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, entries);
}

export const ContraceptionRepository = {
  getAll() {
    return structuredClone(entries.map((e) => ({ ...DEFAULT_CONTRACEPTION_ENTRY, ...e })));
  },

  getById(id) {
    const found = entries.find((e) => e.id === id);
    return found ? structuredClone({ ...DEFAULT_CONTRACEPTION_ENTRY, ...found }) : null;
  },

  // The real "what am I currently on" read — My Profile's own display
  // pulls from this, not the other way round.
  getActive() {
    return this.getAll().filter((e) => !e.isArchived && !e.endDate);
  },

  create(data) {
    const newEntry = { ...DEFAULT_CONTRACEPTION_ENTRY, ...data, id: generateId(), createdAt: new Date().toISOString(), isArchived: false };
    entries = [...entries, newEntry];
    persist();
    return newEntry;
  },

  update(id, changes) {
    let updated = null;
    entries = entries.map((e) => {
      if (e.id !== id) return e;
      updated = { ...e, ...changes, updatedAt: new Date().toISOString() };
      return updated;
    });
    persist();
    return updated ? structuredClone({ ...DEFAULT_CONTRACEPTION_ENTRY, ...updated }) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  delete(id) {
    entries = entries.filter((e) => e.id !== id);
    persist();
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  bulkArchive(ids) {
    ids.forEach((id) => this.archive(id));
  },

  bulkDelete(ids) {
    entries = entries.filter((e) => !ids.includes(e.id));
    persist();
  },

  restore(record) {
    if (entries.some((e) => e.id === record.id)) return;
    entries = [...entries, record];
    persist();
  },

  // Called by clinicVisitsRepository.js's own delete — same "unlink,
  // never cascade-delete" reasoning as measurementRepository.js's own
  // unlinkClinicVisit().
  unlinkClinicVisit(visitId) {
    entries = entries.map((e) => (e.linkedClinicVisitId === visitId ? { ...e, linkedClinicVisitId: null } : e));
    persist();
  },

  replaceAll(newEntries) {
    entries = newEntries;
    nextNumber = computeNextNumber(entries);
    persist();
  },
};
