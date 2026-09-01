// measurementRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// The single, standardised place any numeric health value lives — CD4
// count, viral load, hormone levels (testosterone, estradiol, LH,
// FSH), weight, blood pressure — regardless of whether it's sexual-
// health-specific or general, and regardless of whether it was taken
// at home or in clinic. Real gap found while designing menstrual/HRT
// tracking: Testing only holds categorical results (organism/result
// registry links), Clinic Visits only holds visit metadata — nowhere
// in the app had anywhere to put an actual number.
//
// "ONE ROOM, THREE DOORS" — the resolved design for avoiding the
// duplication risk flagged during design: a Measurement can be added
// standalone (a home reading), or inline from a Clinic Visit or Test
// form (which just creates a real linked Measurement under the hood,
// same shape, same repository). Testing and Clinic Visits never grow
// their own parallel numeric field — they only ever link to a real
// Measurement record here.
//
// DELETE BEHAVIOUR, decided explicitly during design: deleting a
// linked Clinic Visit or Test must NOT delete the Measurement it
// produced — Measurements is the trend source of truth, so a visit
// getting tidied up/merged shouldn't silently destroy trend history.
// It only clears the link. See unlinkClinicVisit()/unlinkTest() below,
// called by clinicVisitsRepository.js/testingRepository.js's own
// delete functions.
//
// BLOOD PRESSURE IS A GENUINE SPECIAL CASE, accepted deliberately
// during design rather than forced into the generic value/unit shape:
// it's naturally two numbers (systolic/diastolic), and mmHg is the
// near-universal way it's reported — no competing unit in real-world
// use the way there is for hormones/glucose — so it skips the unit
// conversion machinery below entirely. It's special-cased in three
// places, not one: the storage shape (systolic/diastolic instead of
// value/unit), the type list (protected — see
// customOptionListsRepository.js's PROTECTED_VALUES, since renaming or
// deleting "Blood pressure" there would silently break all of this),
// and the UI's own trend/quick-add rendering.
//
// UNIT CONVERSION — the real fix for the "different labs report the
// same analyte in different units" problem a wheel/picker alone can't
// solve: entries are converted to one canonical unit per type at save
// time, so a trend view is always comparing like with like, while the
// UI can still let someone pick whichever unit matches their actual
// lab report. The originally-entered value/unit is kept alongside the
// converted one (enteredValue/enteredUnit) so nothing is silently
// rewritten without the user being able to see what was actually
// typed. Deliberately NOT medical-grade precision — these are rounded
// conversion factors for keeping a trend shape sensible, not lab
// arithmetic, matching this app's whole "log it, see the trend, no
// clinical interpretation" ethos (no reference ranges, no
// normal/abnormal flagging anywhere in this file).
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_measurements";

export const BLOOD_PRESSURE_TYPE = "Blood pressure";
export const BLOOD_PRESSURE_UNIT = "mmHg";

// Canonical unit per type, plus conversion factors FROM each alternate
// unit TO that canonical unit. Types not listed here (Viral load, CD4
// count, LH, FSH, Weight, Other, and any custom type the user adds)
// have no conversion — value/unit are stored exactly as entered, and
// enteredValue/enteredUnit simply mirror value/unit.
const UNIT_CONFIG = {
  Testosterone: { canonical: "nmol/L", alternates: { "ng/dL": (v) => v * 0.0347 } },
  Estradiol: { canonical: "pmol/L", alternates: { "pg/mL": (v) => v * 3.671 } },
  Weight: { canonical: "kg", alternates: { lb: (v) => v * 0.453592 } },
};

export function getAvailableUnits(type) {
  const config = UNIT_CONFIG[type];
  if (!config) return [];
  return [config.canonical, ...Object.keys(config.alternates)];
}

function convertToCanonical(type, value, unit) {
  const config = UNIT_CONFIG[type];
  if (!config || value == null || value === "") return { value, unit };
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return { value, unit };
  // Defense in depth against a caller that never set a real unit
  // (e.g. a picker whose visual default was never actually written to
  // state) — a type with a canonical unit should never end up stored
  // with a blank one; assume canonical rather than silently drop it.
  if (!unit || unit === config.canonical) return { value: numeric, unit: config.canonical };
  const convert = config.alternates[unit];
  if (!convert) return { value: numeric, unit };
  // Rounded to a sensible number of decimal places for a trend chart,
  // not presented as lab-grade precision — see the file-level note.
  return { value: Math.round(convert(numeric) * 100) / 100, unit: config.canonical };
}

export const DEFAULT_MEASUREMENT = {
  type: "",
  date: null,
  value: null,
  unit: "",
  enteredValue: null,
  enteredUnit: "",
  systolic: null,
  diastolic: null,
  note: "",
  linkedClinicVisitId: null,
  linkedTestId: null,
  isArchived: false,
};

function daysAgo(n, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let seedMeasurements = [
  {
    ...DEFAULT_MEASUREMENT,
    id: "measurement_001",
    type: "CD4 count",
    date: daysAgo(30),
    value: 620,
    unit: "cells/µL",
    enteredValue: 620,
    enteredUnit: "cells/µL",
    note: "Routine bloods.",
    isArchived: false,
  },
];

let measurements = storage.load(STORAGE_KEY, seedMeasurements);
let nextNumber = computeNextNumber(measurements);

function computeNextNumber(existing) {
  const numbers = existing.map((m) => {
    const match = /^measurement_(\d+)$/.exec(m.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateId() {
  const id = `measurement_${String(nextNumber).padStart(3, "0")}`;
  nextNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, measurements);
}

function shapeForCreate(data) {
  if (data.type === BLOOD_PRESSURE_TYPE) {
    return {
      ...DEFAULT_MEASUREMENT,
      ...data,
      unit: BLOOD_PRESSURE_UNIT,
      value: null,
      enteredValue: null,
      enteredUnit: "",
    };
  }
  const { value: canonicalValue, unit: canonicalUnit } = convertToCanonical(data.type, data.value, data.unit);
  return {
    ...DEFAULT_MEASUREMENT,
    ...data,
    value: canonicalValue,
    unit: canonicalUnit,
    enteredValue: data.value,
    enteredUnit: data.unit,
    systolic: null,
    diastolic: null,
  };
}

export const MeasurementRepository = {
  getAll() {
    return structuredClone(measurements.map((m) => ({ ...DEFAULT_MEASUREMENT, ...m })));
  },

  getById(id) {
    const found = measurements.find((m) => m.id === id);
    return found ? structuredClone({ ...DEFAULT_MEASUREMENT, ...found }) : null;
  },

  getByType(type) {
    return this.getAll().filter((m) => !m.isArchived && m.type === type).sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  // Real convenience for the "memory" — a new entry's type/unit is
  // prefilled from whichever entry of that type was logged last, never
  // its value (a stale reading silently carried forward would be an
  // actual logging bug, not a convenience).
  getLastEntry(type) {
    const matches = this.getByType(type);
    return matches.length ? matches[0] : null;
  },

  create(data) {
    const newMeasurement = {
      ...shapeForCreate(data),
      id: generateId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    measurements = [...measurements, newMeasurement];
    persist();
    return newMeasurement;
  },

  update(id, changes) {
    let updated = null;
    measurements = measurements.map((m) => {
      if (m.id !== id) return m;
      const merged = { ...DEFAULT_MEASUREMENT, ...m, ...changes };
      updated = { ...shapeForCreate(merged), id: m.id, createdAt: m.createdAt, isArchived: m.isArchived, updatedAt: new Date().toISOString() };
      return updated;
    });
    persist();
    return updated ? structuredClone(updated) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  delete(id) {
    measurements = measurements.filter((m) => m.id !== id);
    persist();
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  bulkArchive(ids) {
    ids.forEach((id) => this.archive(id));
  },

  bulkDelete(ids) {
    measurements = measurements.filter((m) => !ids.includes(m.id));
    persist();
  },

  restore(record) {
    if (measurements.some((m) => m.id === record.id)) return;
    measurements = [...measurements, record];
    persist();
  },

  // Called by clinicVisitsRepository.js's own delete — clears the link
  // rather than removing the Measurement, per the explicit "deleting a
  // visit shouldn't destroy trend history" decision above.
  unlinkClinicVisit(visitId) {
    measurements = measurements.map((m) => (m.linkedClinicVisitId === visitId ? { ...m, linkedClinicVisitId: null } : m));
    persist();
  },

  // Called by testingRepository.js's own delete — same reasoning.
  unlinkTest(testId) {
    measurements = measurements.map((m) => (m.linkedTestId === testId ? { ...m, linkedTestId: null } : m));
    persist();
  },

  replaceAll(newMeasurements) {
    measurements = newMeasurements;
    nextNumber = computeNextNumber(measurements);
    persist();
  },
};
