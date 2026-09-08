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
// CHANGED — Phase 3 (Sep 2026): load()/save() are genuinely `async`
// now, the actual point of this whole multi-session encryption
// groundwork effort — every one of the ~34 repository/registry files
// already `await`s these calls (a no-op until now, since this file was
// still 100% synchronous underneath), so this conversion needed zero
// changes at any of those call sites. The two real remaining exceptions
// (`ModuleColorRepository`'s old `getOverridesSync()` bypass and
// `main.jsx`'s `ErrorBoundary`) are handled separately — see their own
// files. STILL BACKED BY THE SAME SYNCHRONOUS localStorage CALLS
// internally — this is a type-level/API-shape change, not a new
// storage mechanism, so there's no new latency or behavior change
// today. What this actually unlocks: `crypto.subtle` (Phase 4's real
// encryption) is async-only, so `load`/`save` had to already be
// async-shaped before any real encrypt/decrypt call could be dropped
// into their bodies — that's the next, and last, real step.
export const localStorageAdapter = {
  // Reads a value back out of storage. Returns `fallback` if nothing's
  // been saved yet (first run) or if reading/parsing fails for any
  // reason — a corrupted or missing entry should never crash the app,
  // it should just behave like a fresh start.
  async load(key, fallback) {
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
  async save(key, value) {
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

  // ADDED — real ask: a storage-usage indicator for Developer Tools.
  // No backend to overflow into and no encryption-at-rest yet means
  // this one device's localStorage quota (~5-10MB depending on
  // browser/WebView) is the only ceiling this app has, and Attachments
  // (base64 file data) is the one thing that could actually push
  // toward it over a long enough time. Same "shos_"-prefix scan as
  // clearAllAppData() above, so this never touches or reports on an
  // unrelated site's storage sharing the same origin's storage APIs.
  // Byte counts use Blob (real UTF-8 byte size), not raw .length
  // (UTF-16 code units) — a closer match to how a human reads "KB/MB"
  // and to how most browsers actually count a string against quota.
  getStorageUsage() {
    const byKey = [];
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("shos_")) continue;
      const raw = localStorage.getItem(key) || "";
      const bytes = new Blob([raw]).size;
      totalBytes += bytes;
      byKey.push({ key, bytes });
    }
    byKey.sort((a, b) => b.bytes - a.bytes);
    return { totalBytes, byKey };
  },
};
