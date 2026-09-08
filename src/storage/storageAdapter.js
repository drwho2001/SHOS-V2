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
// now — every one of the ~34 repository/registry files already
// `await`s these calls (a no-op until now, since this file was still
// 100% synchronous underneath), so that conversion needed zero
// changes at any of those call sites.
//
// CHANGED — Phase 4 (Sep 2026): load()/save() now do real encryption,
// the actual point of this entire multi-session effort — see
// cryptoService.js for the real Data Key / envelope design and
// CLAUDE.md's own Known Issues entry for the full scoping writeup.
// `save()` always encrypts going forward; `load()` checks the stored
// shape and only decrypts real `{iv, ciphertext}` values, returning
// anything else (legacy plaintext not yet migrated) as-is — a lazy
// fallback safety net that costs nothing, kept alongside the real
// eager migration `App.jsx`'s own boot sequence runs once, in case a
// key is ever somehow missed by that pass. The two real remaining
// exceptions (`main.jsx`'s `ErrorBoundary`, and `cryptoService.js`'s
// own `shos_vault_key_slots` metadata key, which structurally can't
// be encrypted by the very key it exists to protect) are handled
// separately — see their own files.
import { encryptForStorage, decryptFromStorage, isEncryptedShape } from "./cryptoService.js";

export const localStorageAdapter = {
  // Reads a value back out of storage. Returns `fallback` if nothing's
  // been saved yet (first run) or if reading/parsing fails for any
  // reason — a corrupted or missing entry should never crash the app,
  // it should just behave like a fresh start.
  async load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (isEncryptedShape(parsed)) return JSON.parse(await decryptFromStorage(parsed));
      return parsed;
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
      const encrypted = await encryptForStorage(JSON.stringify(value));
      localStorage.setItem(key, JSON.stringify(encrypted));
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
