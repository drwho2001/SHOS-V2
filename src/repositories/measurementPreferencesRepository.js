// measurementPreferencesRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "could a user write 100lb and see it in kg? add settings
// for default unit preferences" — unit conversion already existed
// (measurementRepository.js's UNIT_CONFIG), this is the missing other
// half: which unit the picker defaults to for each convertible type
// (Weight, Testosterone, Estradiol), settable once in Measurements'
// own preferences sheet rather than re-picked on every single entry.
//
// Also holds `typeKinds` — the real ask "suggest appropriate unit
// options, ie volume for volume, weight for weight" for a CUSTOM type
// the user adds (one of the 3 built-ins already has real conversion;
// a brand new user-invented type can't — there's no safe way to guess
// a conversion factor for an analyte this app has never heard of), so
// a custom type can still be tagged with a general "kind" (mass/
// volume/concentration/count) to get a sensible starting unit list —
// suggestion only, not conversion. See measurementRepository.js's own
// getAvailableUnits() for how this and UNIT_CONFIG combine.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_measurement_preferences";

export const DEFAULT_MEASUREMENT_PREFERENCES = {
  // { [type]: preferredUnitString } — only meaningful for types with
  // real UNIT_CONFIG conversion (Weight/Testosterone/Estradiol); any
  // other key is simply never read.
  preferredUnitByType: {},
  // { [customTypeName]: "mass" | "volume" | "concentration" | "count" }
  typeKinds: {},
};

export const MeasurementPreferencesRepository = {
  getPreferences() {
    return { ...DEFAULT_MEASUREMENT_PREFERENCES, ...storage.load(STORAGE_KEY, {}) };
  },
  updatePreferences(changes) {
    const updated = { ...this.getPreferences(), ...changes };
    storage.save(STORAGE_KEY, updated);
    return updated;
  },
  setPreferredUnit(type, unit) {
    const prefs = this.getPreferences();
    return this.updatePreferences({ preferredUnitByType: { ...prefs.preferredUnitByType, [type]: unit } });
  },
  setTypeKind(type, kind) {
    const prefs = this.getPreferences();
    return this.updatePreferences({ typeKinds: { ...prefs.typeKinds, [type]: kind } });
  },
  getTypeKind(type) {
    return this.getPreferences().typeKinds[type] || null;
  },
};
