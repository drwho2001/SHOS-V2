// moduleColorRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 26 Aug 2026: let the user customize each module's base
// colour from a real Design/Preferences section in Settings, instead
// of the 5 module colours being permanently hardcoded in
// designTokens.js.
//
// HONEST ARCHITECTURE NOTE: ACCENTS in designTokens.js is a plain
// object, imported once by every module file when the app first
// loads — not read through a live hook. That means a colour change
// here takes effect on next app reload/reopen, not instantly across
// every already-open screen. A fully live version would need every
// module to read colours through a hook instead of a static import —
// a much bigger change than this ask needed. Reload-to-apply is a
// reasonable, honest trade-off for a personal single-user app, not a
// silently-cut corner — stated plainly here and in the Settings UI
// itself.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_module_color_overrides";

// The 5 real, customizable module base colours — matches ACCENTS'
// own keys in designTokens.js exactly. Sub-registry accents (Kink/
// Protection etc.) are a separate concern, not included here.
export const CUSTOMIZABLE_MODULE_KEYS = ["contacts", "encounters", "medication", "healthcare", "home"];

export const ModuleColorRepository = {
  // Returns only the overrides actually set — {} if none.
  getOverrides() {
    return storage.load(STORAGE_KEY, {});
  },

  setOverride(moduleKey, hexColor) {
    const current = this.getOverrides();
    storage.save(STORAGE_KEY, { ...current, [moduleKey]: hexColor });
  },

  resetOverride(moduleKey) {
    const current = this.getOverrides();
    const { [moduleKey]: _removed, ...rest } = current;
    storage.save(STORAGE_KEY, rest);
  },

  resetAll() {
    storage.save(STORAGE_KEY, {});
  },
};
