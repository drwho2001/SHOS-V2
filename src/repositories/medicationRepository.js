// medicationRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// This file is the ONLY place in the app that knows how a Medication
// (a Medicines Registry entry — e.g. "PrEP", "Vitamin D3") is stored.
// Every screen that needs medication data asks THIS file for it, instead
// of reading/writing some shared array directly. That's what makes it a
// "repository" — it's the filing cabinet; everything else just asks it
// for what it needs and hands back what it wants filed.
//
// This file does NOT know about dose/refill/waste history — that's
// logRepository.js's job. A Medication here is just the registry card
// itself: name, dosing pattern, thresholds, supplier. See Doc 5 §2 for
// why these stay separate ("Registries" vs "Records" in the SHOS model).
//
// This is an in-memory store (a plain JavaScript array) — nothing is
// saved to disk yet. That's intentional: this step is about getting the
// SHAPE of the storage right. A real database swaps in underneath this
// same interface later, without any screen needing to change.
//
// PERSISTENCE, added 17 Aug 2026: medications now survive closing and
// reopening the app, via localStorageAdapter (see storageAdapter.js) —
// the same pattern already proven on ContactRepository. This repository
// still doesn't know or care that it's specifically localStorage
// underneath — it only knows the load(key, fallback) / save(key, value)
// shape. Kept synchronous on purpose, same reasoning as Contacts: no
// async conversion until a genuinely async backend is real, not
// hypothetical.

import { localStorageAdapter as storage } from "../storage/storageAdapter.js";
// ADDED — real gap found via the new orphan-reference checker
// (orphanReferenceCheck.js): delete-time cleanup for Clinic Visit's
// own medicationsGivenIds (a link to clear) and the medication's own
// dose/refill/waste log history (a real delete — a log entry is
// meaningless without its Medication, see logRepository.js's own
// deleteForMedication() comment).
import { ClinicVisitsRepository } from "./clinicVisitsRepository.js";
import { LogRepository } from "./logRepository.js";

const STORAGE_KEY = "shos_medications";


// ---------------------------------------------------------------------
// Seed data — the same five medications from the existing prototype's
// `initialMeds`, but with the `logs` array removed (that history now
// lives in logRepository.js instead, linked by medicationId).
// ---------------------------------------------------------------------

let seedMedications = [
  {
    id: "med_001",
    name: "PrEP (Descovy)",
    unit: "tablet",
    usagePattern: "daily",
    dosesPerDay: 1,
    unitsPerDose: 1,
    inventoryTracked: true,
    unitsPerContainer: 30,
    refillThreshold: 7,
    defaultRefillQuantity: 30,
    usualSupplier: "Sexual Health Clinic",
    refillRequestedAt: null,
    isArchived: false,
    sortOrder: 0,
  },
  {
    id: "med_002",
    name: "DoxyPEP (Doxycycline)",
    unit: "capsule",
    usagePattern: "prn",
    dosesPerDay: null,
    unitsPerDose: 2,
    inventoryTracked: true,
    unitsPerContainer: 8,
    refillThreshold: 8,
    defaultRefillQuantity: 8,
    usualSupplier: "Sexual Health Clinic",
    refillRequestedAt: null,
    isArchived: false,
    sortOrder: 1,
  },
  {
    id: "med_003",
    name: "Vitamin D3",
    unit: "tablet",
    usagePattern: "daily",
    dosesPerDay: 1,
    unitsPerDose: 1,
    inventoryTracked: true,
    unitsPerContainer: 90,
    refillThreshold: 10,
    defaultRefillQuantity: 90,
    usualSupplier: "Boots Pharmacy",
    refillRequestedAt: null,
    isArchived: false,
    sortOrder: 2,
  },
  {
    id: "med_004",
    name: "Antihistamine (PRN)",
    unit: "tablet",
    usagePattern: "prn",
    dosesPerDay: null,
    unitsPerDose: 1,
    inventoryTracked: false,
    unitsPerContainer: 20,
    refillThreshold: 5,
    defaultRefillQuantity: 20,
    usualSupplier: "Boots Pharmacy",
    refillRequestedAt: null,
    isArchived: false,
    sortOrder: 3,
  },
  {
    id: "med_005",
    name: "Amoxicillin (course, finished)",
    unit: "capsule",
    usagePattern: "custom",
    dosesPerDay: 3,
    unitsPerDose: 1,
    inventoryTracked: false,
    unitsPerContainer: 21,
    refillThreshold: 0,
    defaultRefillQuantity: 21,
    usualSupplier: "GP Surgery",
    refillRequestedAt: null,
    isArchived: true,
    sortOrder: 4,
  },
];

// Real startup: load whatever's actually been saved before. On a
// genuinely first run (nothing in storage yet), fall back to the seed
// data above so the app isn't empty on day one.
let medications = storage.load(STORAGE_KEY, seedMedications);

// Every mutating method below calls this after changing `medications` —
// same explicit "change, then persist" pattern as ContactRepository.
function persist() {
  storage.save(STORAGE_KEY, medications);
}

// Derived from the actual IDs present, not from medications.length — a
// mixed-up array (e.g. after a manual edit or future import) can't
// produce a duplicate ID. Same fix already applied to ContactRepository.
function computeNextMedicationNumber(existingMedications) {
  const numbers = existingMedications.map((m) => {
    const match = /^med_(\d+)$/.exec(m.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}
let nextMedicationNumber = computeNextMedicationNumber(medications);

function generateMedicationId() {
  const id = `med_${String(nextMedicationNumber).padStart(3, "0")}`;
  nextMedicationNumber += 1;
  return id;
}

// ---------------------------------------------------------------------
// The repository itself — this is what the rest of the app talks to.
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Read-side default shape — added 18 Aug 2026, same fix applied across
// every repository this session (see contactRepository.js for the full
// reasoning). This file never had a formal "spread a DEFAULT object"
// pattern the way Contacts did — create() lists each field explicitly
// with its own `??` fallback instead — so this is added purely for the
// read side (getAll/getById), without touching create()'s existing,
// already-verified behavior at all. Same effect either way: a
// medication saved before some future field existed will read back
// with that field defaulted, not missing.
// ADDED 19 Aug 2026 — real gaps found in the Notion-vs-app audit, the user
// confirmed both wanted: `route` (administration route — matters for
// injectables specifically, e.g. IM-Gluteal vs SubQ) and `dosePerUnit`
// (the strength of a single unit, e.g. "245mg" — distinct from
// unitsPerDose, which is how many units make up one dose, not how
// strong each unit is).
// CHANGED 19 Aug 2026 — added "Injection" as a generic catch-all after
// the specific IM/SubQ routes, per the user's ask — covers "yes it's
// injected" without committing to a specific site when that's not
// meaningful to record.
// CHANGED 19 Aug 2026 — ROUTE_OPTIONS and MEDICATION_TYPE_OPTIONS moved
// into customOptionListsRepository.js (real, in-app editable, per
// The user's "idiot-proof editor" ask). These two static exports removed
// to avoid two sources of truth drifting apart — the module now reads
// live from CustomOptionListsRepository.get() instead.
// ADDED 19 Aug 2026 — real gap from the user's testing: dose strength
// (e.g. "245mg") was one free-text field, easy to typo the unit and
// impossible to display the correct µ symbol consistently. Split into
// a number + a real dropdown.
export const DOSE_UNIT_OPTIONS = ["ng", "µg", "mg", "g"];
// ADDED 19 Aug 2026 — the user's ask: a medication TYPE (pill/injection/
// cream/etc) — deliberately distinct from `unit`, which is the
// counting unit used in the actual stock/dose math (tablet, capsule,
// mL...). medicationType is a broader user-facing category, mainly for
// display/icon purposes, and doesn't drive any calculation the way
// `unit` does — kept separate rather than overloading one field with
// two different jobs.
// (MEDICATION_TYPE_OPTIONS also moved — see comment above ROUTE_OPTIONS' old location.)

const DEFAULT_MEDICATION = {
  name: "", unit: "", usagePattern: "daily",
  dosesPerDay: null, unitsPerDose: 1,
  // ADDED 19 Aug 2026 — real custom-scheduling support: "every N days".
  // Only meaningful when usagePattern === "custom" — see
  // medicationCalculations.js's effectiveDoseIntervalHours() for how
  // this actually drives lockout/next-dose/adherence math. Deliberately
  // scoped to interval-only (not day-of-week) — that's what was asked
  // for and what the app's real usage needs, not a speculative bigger
  // scheduler.
  scheduleIntervalDays: null,
  inventoryTracked: true, unitsPerContainer: 0,
  refillThreshold: 0, defaultRefillQuantity: 0,
  usualSupplier: "", refillRequestedAt: null,
  isArchived: false, sortOrder: 0,
  route: "", medicationType: "",
  // CHANGED 19 Aug 2026 — dosePerUnit (one free-text string) replaced
  // with doseStrengthValue (number) + doseStrengthUnit (real dropdown,
  // see DOSE_UNIT_OPTIONS) — this field only existed for a few hours
  // before the user's own testing flagged the free-text version as worth
  // restructuring, so replacing it outright rather than keeping the
  // old shape around for compatibility it never really needed.
  doseStrengthValue: "", doseStrengthUnit: "",
  // ADDED 19 Aug 2026 — real gap: Medicines Registry's own Category
  // field, fetched live from Notion this session, never ported until
  // now. Multi-select, matching Notion (a medication can genuinely be
  // more than one category — e.g. an antidepressant used off-label for
  // IBS). Real options live in customOptionListsRepository.js
  // ("medicationCategory"), not hardcoded here — same pattern as every
  // other simple categorical field converted this session.
  category: [],
  // ADDED 26 Aug 2026 — real ask: dose changes (e.g. sertraline
  // 150mg→300mg) shouldn't lose or split the medication's history —
  // "same med/course, different dose." Confirmed with the user: one
  // record, embedded dose-history list, not two linked records. Each
  // entry captures a PAST dose configuration and exactly when it was
  // superseded — the current dose stays in the normal
  // doseStrengthValue/doseStrengthUnit/unitsPerDose fields above,
  // unchanged in shape. See MedicationRepository.updateDose() for how
  // entries actually get added — never write to this array directly.
  doseHistory: [],
};

export const MedicationRepository = {
  // Every medication, active and archived alike. Screens that only want
  // active ones (e.g. the Registry tab) filter on isArchived themselves —
  // the repository just hands back the facts, it doesn't decide what a
  // screen should show.
  getAll() {
    return structuredClone(medications.map((m) => ({ ...DEFAULT_MEDICATION, ...m })));
  },

  // A single medication by its id, or null if it doesn't exist. Returns
  // a copy, not the live stored object — same reasoning as getAll().
  getById(id) {
    const found = medications.find((m) => m.id === id);
    return found ? structuredClone({ ...DEFAULT_MEDICATION, ...found }) : null;
  },

  // Creates a new medication. Fills in the id, isArchived, and sortOrder
  // automatically — the caller only supplies the fields a person actually
  // types in on the Add Medication screen.
  // CHANGED 19 Aug 2026 — real bug found and fixed: this listed every
  // field explicitly instead of spreading DEFAULT_MEDICATION, which
  // meant `category` (just added) AND `scheduleIntervalDays` (added
  // earlier this session, for custom scheduling) were BOTH being
  // silently dropped on every new medication — a real, live data-loss
  // bug, not caught until a real functional test against the actual
  // create() call surfaced it. Converted to the same
  // `{...DEFAULT_MEDICATION, ...data}` spread pattern every other
  // repository already uses, which also means any FUTURE field added
  // to DEFAULT_MEDICATION is automatically included here — this exact
  // bug class can't recur.
  create(data) {
    const newMedication = {
      ...DEFAULT_MEDICATION,
      ...data,
      id: generateMedicationId(),
      refillRequestedAt: null,
      isArchived: false,
      sortOrder: medications.length,
    };
    medications = [...medications, newMedication];
    persist();
    return newMedication;
  },

  // Updates any subset of a medication's own fields (registry metadata —
  // name, dosing pattern, thresholds, etc.). Does NOT touch log history;
  // that's a different repository entirely.
  update(id, changes) {
    let updatedMedication = null;
    medications = medications.map((m) => {
      if (m.id !== id) return m;
      // ADDED 26 Aug 2026 — real ask: last-updated indicator, rolled
      // out consistently across every module.
      updatedMedication = { ...m, ...changes, updatedAt: new Date().toISOString() };
      return updatedMedication;
    });
    persist();
    return updatedMedication;
  },

  // ADDED 26 Aug 2026 — real ask: dose change (e.g. sertraline
  // 150mg→300mg) as its own real action, not a silent field edit.
  // Confirmed with the user: one record, embedded history — the OLD dose
  // config gets pushed into doseHistory with the date it was
  // superseded, then the current fields update to the new dose.
  // Stock/adherence/log history all stay attached to this same
  // record's id throughout, genuinely continuous.
  updateDose(id, { doseStrengthValue, doseStrengthUnit, unitsPerDose, note }) {
    let updatedMedication = null;
    medications = medications.map((m) => {
      if (m.id !== id) return m;
      const historyEntry = {
        doseStrengthValue: m.doseStrengthValue,
        doseStrengthUnit: m.doseStrengthUnit,
        unitsPerDose: m.unitsPerDose,
        supersededAt: new Date().toISOString(),
        note: note || "",
      };
      updatedMedication = {
        ...m,
        doseStrengthValue, doseStrengthUnit, unitsPerDose,
        doseHistory: [...(m.doseHistory || []), historyEntry],
        updatedAt: new Date().toISOString(),
      };
      return updatedMedication;
    });
    persist();
    return updatedMedication;
  },

  // Archiving/unarchiving never deletes anything — matches the project's
  // standing "stage, don't auto-delete" rule. Archived medications drop
  // out of Registry/Inventory views but their log history stays intact.
  archive(id) {
    return this.update(id, { isArchived: true });
  },

  // ADDED — real ask: real delete, with a confirmation step, same
  // pattern already proven across every other module this session.
  delete(id) {
    medications = medications.filter((m) => m.id !== id);
    persist();
    // ADDED — real gap found via the new orphan-reference checker
    // (orphanReferenceCheck.js): Clinic Visit's own medicationsGivenIds
    // references a Medication by id — only clears the link. The dose/
    // refill/waste log history is different: it's meaningless without
    // its Medication, so that's a real delete, not a link clear (same
    // reasoning as testingRepository.js's own Partner Notification
    // handling above).
    ClinicVisitsRepository.unlinkMedication(id);
    LogRepository.deleteForMedication(id);
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
    medications = medications.filter((m) => !ids.includes(m.id));
    persist();
    ids.forEach((id) => { ClinicVisitsRepository.unlinkMedication(id); LogRepository.deleteForMedication(id); });
  },

  // ADDED 26 Aug 2026 — real ask: undo for delete, not just archive.
  restore(record) {
    if (medications.some((m) => m.id === record.id)) return;
    medications = [...medications, record];
    persist();
  },

  // Moves a medication up or down among ACTIVE medications only —
  // archived ones don't count towards position, matching the existing
  // prototype behavior. direction is the string "up" or "down".
  reorder(id, direction) {
    const step = direction === "up" ? -1 : 1;
    const active = medications
      .filter((m) => !m.isArchived)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const currentIndex = active.findIndex((m) => m.id === id);
    const neighborIndex = currentIndex + step;

    // Nothing to do if the medication isn't found, or it's already at
    // the top/bottom of the active list.
    if (currentIndex === -1 || neighborIndex < 0 || neighborIndex >= active.length) {
      return;
    }

    const current = active[currentIndex];
    const neighbor = active[neighborIndex];
    const currentOrder = current.sortOrder;
    const neighborOrder = neighbor.sortOrder;

    medications = medications.map((m) => {
      if (m.id === current.id) return { ...m, sortOrder: neighborOrder };
      if (m.id === neighbor.id) return { ...m, sortOrder: currentOrder };
      return m;
    });
    persist();
  },

  // Wholesale replace — used only by backup restore. See ContactRepository
  // for the same pattern and reasoning.
  replaceAll(newMedications) {
    medications = newMedications;
    nextMedicationNumber = computeNextMedicationNumber(medications);
    persist();
  },
};
