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
  // ADDED — real ask: a "normal/out-of-range, high/low" classification
  // on a measurement entry. Deliberately NOT a hardcoded clinical
  // threshold per type (e.g. a fixed "normal blood pressure" range) —
  // this app's own standing rule is no diagnosis engine/automated
  // clinical risk scoring, and different people (and their own
  // clinicians) genuinely disagree on what's "normal" for them for a
  // lot of these types. Instead: a real, user-SET low/high range per
  // type, exactly the same "you decide, the app just tracks" spirit as
  // every other preference in this app — the classification shown is
  // only ever comparing an entry against a bound this person chose
  // themselves (or left unset, in which case nothing is shown at all).
  // { [type]: { low: number, high: number } }, stored in the type's own
  // CANONICAL unit (same convention as measurementRepository.js's own
  // `value`/`unit` fields) so it stays correct regardless of which unit
  // an individual entry was displayed/entered in.
  normalRangeByType: {},
};

// CHANGED — real groundwork for encryption at rest (see CLAUDE.md's
// Known Issues / the Notion Development log for the full plan): every
// method below is now `async`, `await`ing storage.load()/save() even
// though storageAdapter itself is still 100% synchronous today — a
// no-op behaviorally, same real end-to-end proof as
// customGroupsRepository.js's/trashRepository.js's own conversions.
// Safe to do now specifically because measurementRepository.js's own
// getAvailableUnits()/getDefaultUnit() no longer call this repository
// internally (see that file's own comment) — every remaining caller
// of THIS repository already goes through a real UI action (a picker
// tap, a preferences sheet load) rather than a plain-calculation
// render-body call.
export const MeasurementPreferencesRepository = {
  async getPreferences() {
    return { ...DEFAULT_MEASUREMENT_PREFERENCES, ...(await storage.load(STORAGE_KEY, {})) };
  },
  async updatePreferences(changes) {
    const updated = { ...(await this.getPreferences()), ...changes };
    await storage.save(STORAGE_KEY, updated);
    return updated;
  },
  async setPreferredUnit(type, unit) {
    const prefs = await this.getPreferences();
    return this.updatePreferences({ preferredUnitByType: { ...prefs.preferredUnitByType, [type]: unit } });
  },
  async setTypeKind(type, kind) {
    const prefs = await this.getPreferences();
    return this.updatePreferences({ typeKinds: { ...prefs.typeKinds, [type]: kind } });
  },
  async getTypeKind(type) {
    return (await this.getPreferences()).typeKinds[type] || null;
  },
  async setNormalRange(type, range) {
    const prefs = await this.getPreferences();
    return this.updatePreferences({ normalRangeByType: { ...prefs.normalRangeByType, [type]: range } });
  },
  async clearNormalRange(type) {
    const prefs = await this.getPreferences();
    const { [type]: _removed, ...rest } = prefs.normalRangeByType;
    return this.updatePreferences({ normalRangeByType: rest });
  },
};
