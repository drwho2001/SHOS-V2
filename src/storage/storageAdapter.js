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
import { encryptForStorage, decryptFromStorage, isEncryptedShape, isVaultUnlocked } from "./cryptoService.js";

// FIXED 30 Sep 2026 (audit) — the one data-DESTRUCTION bug in this app, and
// it was here the whole time.
//
// WHAT WAS WRONG. load()'s catch block returned `fallback` for every kind of
// failure. For 16 of the 34 real call sites that fallback is the SEED array —
// the fabricated demo contacts, encounters, tests. So:
//
//   wrong Data Key / cleared IndexedDB / corrupted ciphertext
//     -> load() returns the demo data
//     -> the repository's in-memory array IS the demo data
//     -> the user (or a poll) changes anything at all
//     -> persist() re-encrypts demo+new and OVERWRITES the real ciphertext
//
// Every real record, gone, with a console.error nobody sees. And the three
// causes are indistinguishable from a genuine fresh install, so there was no
// way for a user to notice before it was done.
//
// THE FIX HAS TWO HALVES, and the second is the one that actually prevents
// the loss:
//
//   1. Never fabricate over real data. When ciphertext exists but will not
//      decrypt, return an EMPTY container of the same shape instead of the
//      fallback, so there is no fabricated record to write.
//   2. Refuse to overwrite a key we could not read. Half one is not enough:
//      an empty array saved over real ciphertext still destroys it. So the
//      key is quarantined and save() refuses it, which leaves the real
//      ciphertext on disk untouched and recoverable if the cause was
//      transient.
//
// NOT QUARANTINED WHEN THE VAULT IS SIMPLY LOCKED. decryptFromStorage throws
// a distinct "Vault is not unlocked" message for that case, and it is NOT a
// corruption — the app genuinely reads storage during boot and while the lock
// screen is up (App.jsx's own checkDueMeds comment records this). Quarantining
// on that would block every save in the app for the whole session, which is a
// far worse failure than the one being fixed. That distinction is the whole
// subtlety here, and it is why this checks the error's own message rather
// than guessing.
//
// SELF-HEALING. A successful read clears the key's quarantine, so a genuinely
// transient failure recovers on the next load. clearAllAppData() clears it too,
// so "Reset all app data" can never leave the app permanently unable to save.
const unreadableKeys = new Set();

// cryptoService throws this exact message when there is simply no Data Key
// loaded yet — a boot-order condition, not data loss.
function isVaultLockedError(err) {
  return /not unlocked/i.test(String(err?.message || ""));
}

// An empty value of the same SHAPE as the caller's fallback, so repositories
// get a usable container. Never the fallback itself when real data exists.
function emptyLike(fallback) {
  if (Array.isArray(fallback)) return [];
  if (fallback && typeof fallback === "object") return {};
  return fallback;
}

export const localStorageAdapter = {
  // Reads a value back out of storage. Returns `fallback` if nothing's
  // been saved yet (first run) or if reading/parsing fails for any
  // reason — a corrupted or missing entry should never crash the app,
  // it should just behave like a fresh start.
  //
  // CHANGED 30 Sep 2026 — that comment described the old behaviour and the
  // old behaviour was the bug. "Behave like a fresh start" is only safe when
  // there IS no stored value; when real ciphertext exists and will not
  // decrypt, behaving like a fresh start is how the demo data ended up on top
  // of the user's records. See the block comment above for the full account.
  async load(key, fallback) {
    let raw = null;
    try {
      raw = localStorage.getItem(key);
      if (!raw) {
        // Genuine first run — the one case where `fallback` is correct.
        unreadableKeys.delete(key);
        return fallback;
      }
      const parsed = JSON.parse(raw);
      if (isEncryptedShape(parsed)) {
        const value = JSON.parse(await decryptFromStorage(parsed));
        // Read succeeded, so whatever was quarantined is readable again.
        unreadableKeys.delete(key);
        return value;
      }
      // Legacy plaintext, not yet migrated — legitimate, not a failure.
      unreadableKeys.delete(key);
      return parsed;
    } catch (err) {
      console.error(`Storage load failed for "${key}":`, err);
      if (isVaultLockedError(err)) {
        // Expected during boot and behind the lock screen. Not corruption.
        // Deliberately leaves the quarantine alone for a key we can't yet
        // judge, but never sets one.
        return fallback;
      }
      if (raw && isVaultUnlocked()) {
        // Real stored data that will not decrypt while the vault IS unlocked.
        unreadableKeys.add(key);
        const message = `Saved data for "${key}" could not be read, so it has been left untouched rather than replaced.`;
        console.error(message);
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new CustomEvent("shos:storage-read-failed", { detail: { key, message } }));
        }
        return emptyLike(fallback);
      }
      // Unparseable non-ciphertext, or no stored value at all. Old behaviour.
      return fallback;
    }
  },

  // Saves a value. Returns true/false so a repository can notice if a
  // save silently failed (e.g. storage quota exceeded) rather than
  // assuming data is safe when it isn't.
  //
  // FIXED 10 Sep 2026 — real gap found via a total-app audit: this
  // return value had existed since the file's own header comment was
  // written, but a full grep across every one of the ~31 real call
  // sites in the app (every repository/registry's own persist()) found
  // NOT ONE that actually checked it — every save is fire-and-forget.
  // A genuine localStorage.setItem() failure (quota exceeded is the
  // real, plausible one — this app's own data-volume stress test
  // already proved real installs can reach tens of thousands of
  // records) would silently vanish into a caught catch block with only
  // a console.error nobody watches, while the user's own in-memory
  // React state carries on as if the save succeeded — the exact
  // "assuming data is safe when it isn't" scenario this comment always
  // warned about, just never actually wired up. Retrofitting a check
  // at all 31 fire-and-forget call sites would be a much bigger,
  // riskier change than this app's own data actually needs — instead,
  // this ONE real chokepoint now dispatches a plain DOM CustomEvent on
  // failure; App.jsx's own top-level listener is the single place that
  // turns it into a real, persistent, unmissable banner (see its own
  // comment) and a durable local error-log entry, without every
  // repository needing its own UI-surfacing logic.
  async save(key, value) {
    // FIXED 30 Sep 2026 (audit) — the half of the data-destruction fix that
    // actually prevents the loss. load() already stopped returning fabricated
    // demo data, but an EMPTY array saved over real ciphertext destroys it
    // just as permanently. The user's real records are still on disk and
    // perfectly decryptable if the cause was transient (a vault that wasn't
    // ready, a partially-written value), so overwriting them to "fix" the
    // problem is the one outcome worth refusing outright.
    if (unreadableKeys.has(key)) {
      const message = `"${key}" holds data this app could not read, so nothing was saved over it.`;
      console.error(message);
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("shos:storage-read-failed", { detail: { key, message } }));
      }
      return false;
    }
    try {
      const encrypted = await encryptForStorage(JSON.stringify(value));
      localStorage.setItem(key, JSON.stringify(encrypted));
      return true;
    } catch (err) {
      console.error(`Storage save failed for "${key}":`, err);
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("shos:storage-save-failed", { detail: { key, message: err?.message || String(err) } }));
      }
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
    // CHANGED 30 Sep 2026 — MUST clear the read-failure quarantine alongside
    // the data itself. Without this, a reset after a read failure would leave
    // every key permanently unwritable and the user could never save anything
    // again, with no way out short of clearing site data. This is the one
    // supported escape hatch from the refusal above, so it has to actually
    // work.
    unreadableKeys.clear();
    return keysToRemove;
  },

  // Test-only hook, matching the existing `ContactRepository.__testOnlyReset()`
  // convention in this repo. The quarantine set is deliberately module-level so
  // it survives across the many separate load()/save() calls a real app session
  // makes, which also means it survives between test cases and would make every
  // test after a quarantining one fail for the wrong reason. That is a real
  // trap this file invites rather than one a reader would anticipate.
  __testOnlyReset() {
    unreadableKeys.clear();
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
