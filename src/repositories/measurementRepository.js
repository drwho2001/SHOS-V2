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
// count, LH, FSH, Other, and any custom type the user adds) have no
// conversion — value/unit are stored exactly as entered, and
// enteredValue/enteredUnit simply mirror value/unit.
// ADDED — real bug: Height had no entry here at all, so a new "Height"
// type fell through to the generic kind-tagging flow, and picking the
// wrong kind there (reported: ended up "Count-like") locked its unit
// chips to "count" — not cm/in the way it should have. Same real
// UNIT_CONFIG treatment as Weight now, so Height just works without
// that extra kind-tagging step, with a genuine cm<->in conversion
// (1 in = 2.54cm, the standard exact factor). Feet specifically isn't
// its own unit here — decimal feet ("5.67 ft") isn't how anyone
// actually reads a height out loud, and a real feet+inches compound
// input (5'8") is a different field shape than every other
// measurement in this file; "in" already covers the same information
// a foot-and-inches reading does (68 in = 5'8"), and the unit field
// still accepts free-typed text if a different unit is ever needed.
const UNIT_CONFIG = {
  Testosterone: { canonical: "nmol/L", alternates: { "ng/dL": (v) => v * 0.0347 } },
  Estradiol: { canonical: "pmol/L", alternates: { "pg/mL": (v) => v * 3.671 } },
  Weight: { canonical: "kg", alternates: { lb: (v) => v * 0.453592 } },
  Height: { canonical: "cm", alternates: { in: (v) => v * 2.54 } },
  // ADDED — real ask: global default units settings covering "temp,
  // timezone, height, weight" — Temperature had no real measurement
  // type at all before this. °C is canonical (matches Height/Weight
  // both already being metric-canonical) with a real °F<->°C
  // conversion, same UNIT_CONFIG treatment as everything else here.
  Temperature: { canonical: "°C", alternates: { "°F": (v) => (v - 32) * 5 / 9 } },
};

// ADDED — real ask: "convert automatically... show 165cm" needs the
// REVERSE of the alternates above too — UNIT_CONFIG only ever
// converts an entered alternate-unit value INTO canonical at save
// time; nothing previously converted a canonical value back OUT to
// whatever unit the user currently prefers to see (e.g. a Weight
// logged in kg months ago, displayed in lb after switching Settings >
// Units to Imperial). Kept as its own explicit map rather than
// algebraically inverting `alternates` at runtime — Temperature's
// conversion is affine (v-32)*5/9, not a pure multiplier, so a
// generic "1/factor" inverse would silently be wrong for it.
const REVERSE_CONVERTERS = {
  Testosterone: { "ng/dL": (v) => v / 0.0347 },
  Estradiol: { "pg/mL": (v) => v / 3.671 },
  Weight: { lb: (v) => v / 0.453592 },
  Height: { in: (v) => v / 2.54 },
  Temperature: { "°F": (v) => (v * 9 / 5) + 32 },
};

// Converts a stored CANONICAL value into whatever unit the user
// currently prefers to see (from Settings > Units / Measurements'
// own preferences), for display only — never rewrites what's stored.
// Returns the canonical value unchanged if there's no real conversion
// for that type/unit (e.g. an unrecognised custom unit).
export function convertFromCanonical(type, canonicalValue, targetUnit) {
  const config = UNIT_CONFIG[type];
  if (!config || canonicalValue == null || canonicalValue === "") return canonicalValue;
  if (!targetUnit || targetUnit === config.canonical) return canonicalValue;
  const reverse = REVERSE_CONVERTERS[type]?.[targetUnit];
  if (!reverse) return canonicalValue;
  return Math.round(reverse(Number(canonicalValue)) * 100) / 100;
}

// "Suggest appropriate units — volume for volume, weight for weight"
// for a custom type the app has no real conversion for: a curated
// starting list per general kind, offered but NOT converted (there's
// no safe way to guess a conversion factor for an analyte this app
// has never heard of) — a nudge toward one consistent unit, not the
// unit-mismatch fix real UNIT_CONFIG conversion provides above.
// ADDED — real gap found in testing: "tried height, and annoying to
// just add cm" — none of the 4 original kinds fit a length-based
// measurement (Height, and anything else measured in cm/in), so
// picking any of them meant getting stuck with a locked list that
// never had the right unit in it.
export const KIND_UNITS = {
  mass: ["kg", "lb", "g", "mg"],
  volume: ["mL", "L"],
  concentration: ["mg/dL", "mmol/L", "ng/dL", "nmol/L", "pg/mL", "pmol/L", "IU/L", "cells/µL", "copies/mL"],
  count: ["count"],
  length: ["cm", "in", "m"],
};
export const KIND_LABELS = { mass: "Weight-like", volume: "Volume-like", concentration: "Concentration-like", count: "Count-like", length: "Length-like" };

// ADDED — real ask: "should be easy to override this option when
// blatantly wrong" — a type tagged with the wrong kind (e.g. "Height"
// picked as Count-like by mistake) should be easy to re-tag, not stuck
// forever after a one-time prompt. Only meaningful for kind-tagged
// types — one with real UNIT_CONFIG conversion (Weight, Height,
// Testosterone, Estradiol) has a genuine canonical unit, not a
// re-pickable "kind", so the UI hides the re-tag option there.
export function hasUnitConversion(type) {
  return !!UNIT_CONFIG[type];
}

// CHANGED — real groundwork for encryption at rest (see CLAUDE.md's
// Known Issues / the Notion Development log for the full plan): used
// to call MeasurementPreferencesRepository.getTypeKind() internally —
// already a real architecture smell (this file's own repository
// quietly depending on another repository for a plain calculation),
// and one that would have forced every one of this function's ~8 real
// call sites — several inline in render bodies, not behind any hook —
// to become async-aware the moment MeasurementPreferencesRepository's
// own methods go real async. Now a pure function: the caller (which
// already loads preferences for other reasons) passes the relevant
// type's kind in directly.
export function getAvailableUnits(type, typeKind) {
  const config = UNIT_CONFIG[type];
  if (config) return [config.canonical, ...Object.keys(config.alternates)];
  // No real conversion for this type — but if the user tagged it with
  // a kind (see measurementPreferencesRepository.js), still offer that
  // kind's usual units as suggestions, so "HRT dose in mL" gets a
  // sensible picker even though it's not one of the 3 built-ins.
  return typeKind ? (KIND_UNITS[typeKind] || []) : [];
}

// Real ask: a settable default per convertible type ("always default
// Weight to lb"), rather than the picker always defaulting to
// canonical. Only meaningful for a type with real UNIT_CONFIG
// conversion — a kind-only suggestion list has no single "canonical"
// unit to override, so this falls through to that list's first entry.
// CHANGED — same pure-function reasoning as getAvailableUnits() above:
// takes the already-loaded MeasurementPreferencesRepository.getPreferences()
// result instead of fetching it itself.
export function getDefaultUnit(type, prefs) {
  const preferred = prefs?.preferredUnitByType?.[type];
  const available = getAvailableUnits(type, prefs?.typeKinds?.[type]);
  if (preferred && available.includes(preferred)) return preferred;
  return available[0] || "";
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
  // ADDED — real ask: "add location (home/clinic [name])". Deliberately
  // a plain fixed Home/Clinic choice, not a new user-editable option
  // list — same reasoning as customOptionListsRepository.js's own
  // "Testing for?"/"Setting" fields staying fixed: this is a genuine
  // binary, not a real category prone to needing new values.
  // clinicName is free text with suggestions (same pattern as Clinic
  // Visits' own `location` field), only meaningful when locationType
  // is "Clinic".
  locationType: "",
  clinicName: "",
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

// ADDED — a couple more real example entries beyond the original one,
// so the group-by-type view and the trend/unit-conversion machinery
// both have something to actually show on a fresh install: a weight
// entered in lb (demonstrates real conversion, not just storage) and a
// blood pressure reading (demonstrates the special-cased shape).
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
  {
    ...DEFAULT_MEASUREMENT,
    id: "measurement_002",
    type: "Weight",
    date: daysAgo(14),
    value: 68.04,
    unit: "kg",
    enteredValue: 150,
    enteredUnit: "lb",
    note: "",
    isArchived: false,
  },
  {
    ...DEFAULT_MEASUREMENT,
    id: "measurement_003",
    type: BLOOD_PRESSURE_TYPE,
    date: daysAgo(14),
    systolic: 118,
    diastolic: 76,
    unit: BLOOD_PRESSURE_UNIT,
    note: "Routine COCP check.",
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

  // Real suggestion source for the clinic name field — derived from
  // what's already been typed rather than a separate persisted option
  // list, same "just look at existing data" reasoning already used for
  // Clinic Visits' own free-text `location` field.
  getKnownClinicNames() {
    return [...new Set(this.getAll().map((m) => m.clinicName).filter(Boolean))];
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
