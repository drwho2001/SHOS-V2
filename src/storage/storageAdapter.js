// storageAdapter.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// This is the one place that knows HOW data actually gets saved. Every
// repository (ContactRepository, and later MedicationRepository /
// LogRepository) is written against this same small shape — load(key,
// fallback) and save(key, value) — never against localStorage directly.
// That's what makes it an "adapter": if the real storage mechanism
// changes later (IndexedDB, an encrypted cloud backend), only THIS file
// needs to change. No repository code has to be touched.
//
// Kept deliberately synchronous for now, matching localStorage's own
// nature — see the note in contactRepository.js on why this doesn't need
// to be async yet.

export const localStorageAdapter = {
  // Reads a value back out of storage. Returns `fallback` if nothing's
  // been saved yet (first run) or if reading/parsing fails for any
  // reason — a corrupted or missing entry should never crash the app,
  // it should just behave like a fresh start.
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error(`Storage load failed for "${key}":`, err);
      return fallback;
    }
  },

  // Saves a value. Returns true/false so a repository can notice if a
  // save silently failed (e.g. storage quota exceeded) rather than
  // assuming data is safe when it isn't.
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Storage save failed for "${key}":`, err);
      return false;
    }
  },

  // ADDED 19 Aug 2026 — Settings' Developer Tools "Reset all data"
  // needs a real way to wipe everything, which nothing in this file
  // offered before now (only load/save existed). Every repository/
  // registry in this app uses a "shos_" prefixed key (shos_contacts,
  // shos_kink_registry, etc.) and every draft autosave key is
  // "shos_draft_"-prefixed (see draftStorage.js) — both already fall
  // under the same "shos_" prefix, so a single prefix-scan finds
  // everything this app has ever written without needing a hardcoded
  // key list that would silently go stale every time a new module is
  // added. Deliberately does NOT touch any non-"shos_" key that might
  // exist in the same browser storage for an unrelated site/app.
  clearAllAppData() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("shos_")) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    return keysToRemove;
  },
};
