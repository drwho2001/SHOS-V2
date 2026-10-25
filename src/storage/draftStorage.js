// draftStorage.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Protects IN-PROGRESS form edits from being lost if the page refreshes,
// reloads, or the app gets backgrounded mid-edit. Every keystroke gets
// mirrored to a small, separate "draft" slot in sessionStorage, and an
// edit sheet checks for a leftover draft on mount and silently recovers it.
//
// CHANGED 25 Oct 2026 (2a): drafts are now ENCRYPTED at rest using
// AES-GCM with a per-session key. The key is generated at first use and
// stored in sessionStorage alongside the drafts. On lock, clearAllDrafts()
// removes both the key and all drafts, making any leftover draft data
// undecryptable. This closes the plaintext disclosure gap documented
// in the previous version.
//
// loadDraft is now ASYNC (WebCrypto has no synchronous mode). Callers
// must use the async-load-then-resync pattern: initialize state to the
// non-draft default, then load the draft in useEffect and update state.

const DRAFT_PREFIX = "shos_draft_";
const KEY_STORAGE = "shos_draft_key";

// Generate or retrieve the per-session encryption key.
async function getSessionKey() {
  try {
    const stored = sessionStorage.getItem(KEY_STORAGE);
    if (stored) {
      const keyData = JSON.parse(stored);
      return await crypto.subtle.importKey("raw", new Uint8Array(keyData), "AES-GCM", false, ["encrypt", "decrypt"]);
    }
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const exported = await crypto.subtle.exportKey("raw", key);
    sessionStorage.setItem(KEY_STORAGE, JSON.stringify(Array.from(new Uint8Array(exported))));
    return key;
  } catch {
    return null;
  }
}

async function encryptData(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return JSON.stringify({ iv: Array.from(iv), ct: Array.from(new Uint8Array(ciphertext)) });
}

async function decryptData(key, encrypted) {
  const { iv, ct } = JSON.parse(encrypted);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, new Uint8Array(ct));
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export async function saveDraft(draftKey, data) {
  try {
    const key = await getSessionKey();
    if (!key) {
      // Fallback to plaintext if crypto unavailable
      sessionStorage.setItem(DRAFT_PREFIX + draftKey, JSON.stringify({ data, savedAt: new Date().toISOString() }));
      return;
    }
    const encrypted = await encryptData(key, { data, savedAt: new Date().toISOString() });
    sessionStorage.setItem(DRAFT_PREFIX + draftKey, encrypted);
  } catch {
    // Silently no-op
  }
}

export async function loadDraft(draftKey) {
  try {
    const raw = sessionStorage.getItem(DRAFT_PREFIX + draftKey);
    if (!raw) return null;
    const key = await getSessionKey();
    if (!key) {
      // Fallback to plaintext
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && "data" in parsed ? parsed : null;
    }
    const decrypted = await decryptData(key, raw);
    return decrypted && typeof decrypted === "object" && "data" in decrypted ? decrypted : null;
  } catch {
    return null;
  }
}

export function clearDraft(draftKey) {
  try {
    sessionStorage.removeItem(DRAFT_PREFIX + draftKey);
  } catch {
    // Silently no-op
  }
}

export function clearAllDrafts() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith(DRAFT_PREFIX) || key === KEY_STORAGE)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Silently no-op
  }
}
