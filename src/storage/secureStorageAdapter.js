// secureStorageAdapter.js
//
// Wraps @aparajita/capacitor-secure-storage for use by cryptoService.
// On native (Android/iOS), data is stored in the hardware-backed Keystore.
// On web, falls back to localStorage (same as before).
//
// The API is async. Callers that need synchronous access should cache
// the value in memory and refresh from secure storage on startup.

import { SecureStorage } from "@aparajita/capacitor-secure-storage";

const PREFIX = "shos_";

let _cache = null;

export async function secureGet(key) {
  try {
    const val = await SecureStorage.get(PREFIX + key);
    return val ?? null;
  } catch {
    // Fallback to localStorage on web or if plugin unavailable
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

export async function secureSet(key, value) {
  try {
    await SecureStorage.set(PREFIX + key, value);
  } catch {
    // Fallback to localStorage
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Silently no-op
    }
  }
}

export async function secureRemove(key) {
  try {
    await SecureStorage.remove(PREFIX + key);
  } catch {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      // Silently no-op
    }
  }
}

// Synchronous cache for readVaultMeta (used by many sync callers).
// Call initSecureCache() at startup to populate.
export function getCachedVaultMeta() {
  return _cache;
}

export function setCachedVaultMeta(meta) {
  _cache = meta;
}

export async function initSecureCache() {
  _cache = await secureGet("vault_key_slots");
  // Migrate from localStorage if needed
  if (!_cache) {
    try {
      const raw = localStorage.getItem("shos_vault_key_slots");
      if (raw) {
        const parsed = JSON.parse(raw);
        _cache = parsed;
        await secureSet("vault_key_slots", parsed);
        localStorage.removeItem("shos_vault_key_slots");
      }
    } catch {
      // Silently no-op
    }
  }
  return _cache;
}
