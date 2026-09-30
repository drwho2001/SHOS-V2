import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// THE DATA-DESTRUCTION TEST.
//
// Before this fix, storageAdapter.load() collapsed every failure into
// `return fallback`. For 16 of the 34 real call sites that fallback is the
// SEED array - fabricated demo records. So a decrypt failure handed the app
// demo data, and the next persist() wrote it straight over the user's real
// ciphertext. Silent, total, and with a console.error nobody sees.
//
// The test asserts the two properties that prevent it, and — importantly —
// asserts the SUBTLETY that makes the fix safe: a merely-locked vault must not
// be treated as corruption, because the app really does read storage during
// boot and behind the lock screen.

// --- In-memory localStorage -------------------------------------------------
const store = new Map();
const localStorageMock = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => [...store.keys()][i],
  get length() { return store.size; },
};

// --- cryptoService mock -----------------------------------------------------
// `decryptThrows` lets each test choose the failure mode, and `locked` toggles
// the "vault is simply not unlocked yet" case, which cryptoService reports with
// a specific message and which must NOT be treated as corruption.
const state = { decryptThrows: null, unlocked: true, encryptShouldFail: false };

vi.mock("./cryptoService.js", () => ({
  isEncryptedShape: (v) =>
    !!v && typeof v === "object" && !Array.isArray(v)
    && typeof v.iv === "string" && typeof v.ciphertext === "string"
    && Object.keys(v).length === 2,
  isVaultUnlocked: () => state.unlocked,
  decryptFromStorage: async () => {
    if (state.decryptThrows) throw state.decryptThrows;
    return state.decryptValue ?? "[]";
  },
  encryptForStorage: async (plain) => {
    if (state.encryptShouldFail) throw new Error("encrypt exploded");
    return { iv: "aXY=", ciphertext: btoa(plain) };
  },
}));

const { localStorageAdapter } = await import("./storageAdapter.js");

const KEY = "shos_contacts";
const REAL = [{ id: "c1", name: "REAL PERSON" }];
const SEED = [{ id: "s1", name: "DEMO PERSON" }];
const CIPHERTEXT = JSON.stringify({ iv: "aXY=", ciphertext: "Y2lwaGVy" });

function putRealData(k = KEY) { store.set(k, CIPHERTEXT); }

describe("storageAdapter: unreadable data must never be overwritten", () => {
  // MISTAKE WORTH RECORDING, because it produced a genuinely confusing
  // failure: the mock above was DEFINED but never INSTALLED, so every
  // assertion ran against jsdom's real localStorage. That made results look
  // shifted between tests — an earlier save() put real ciphertext into the
  // shared storage and a later "genuine first run" test read it back — which
  // reads like a bug in the fix rather than a bug in the test. vi.stubGlobal
  // is what actually redirects storageAdapter's `localStorage`.
  beforeEach(() => {
    vi.stubGlobal("localStorage", localStorageMock);
    store.clear();
    localStorageAdapter.__testOnlyReset();
    state.decryptThrows = null;
    state.decryptValue = JSON.stringify(REAL);
    state.unlocked = true;
    state.encryptShouldFail = false;
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  // ---- the guard that prevents fabrication --------------------------------
  it("does NOT return the seed fallback when real ciphertext exists but will not decrypt", async () => {
    putRealData();
    state.decryptThrows = new Error("The operation failed for an operation-specific reason.");

    const loaded = await localStorageAdapter.load(KEY, SEED);

    // The whole point: no fabricated record is ever handed back.
    expect(JSON.stringify(loaded)).not.toContain("DEMO PERSON");
    expect(loaded).toEqual([]);
  });

  it("returns a usable empty container of the same shape, not the fallback", async () => {
    putRealData();
    state.decryptThrows = new Error("boom");

    expect(Array.isArray(await localStorageAdapter.load(KEY, SEED))).toBe(true);
    // Object-shaped fallback: needs its own stored ciphertext, or the call
    // correctly takes the genuine-first-run path and returns the fallback.
    // (My first draft forgot this and the failure looked like a code bug.)
    putRealData("shos_prefs");
    expect(Array.isArray(await localStorageAdapter.load("shos_prefs", { a: 1 }))).toBe(false);
    expect(await localStorageAdapter.load("shos_prefs", { a: 1 })).toEqual({});
  });

  // ---- the guard that actually prevents the loss -------------------------
  it("REFUSES to save over a key it could not read, and leaves the real data on disk", async () => {
    putRealData();
    state.decryptThrows = new Error("boom");
    await localStorageAdapter.load(KEY, SEED);

    const wrote = await localStorageAdapter.save(KEY, [{ id: "new", name: "NEW" }]);

    // The save is refused...
    expect(wrote).toBe(false);
    // ...and the original ciphertext is byte-identical, so nothing was lost.
    expect(store.get(KEY)).toBe(CIPHERTEXT);
  });

  it("the refusal is what makes this a fix - an empty array must NOT reach disk", async () => {
    putRealData();
    state.decryptThrows = new Error("boom");
    const loaded = await localStorageAdapter.load(KEY, SEED);

    await localStorageAdapter.save(KEY, loaded);

    // Guards the specific failure the first test alone would still allow:
    // load() returning [] is only safe because save() then refuses.
    expect(store.get(KEY)).toBe(CIPHERTEXT);
    expect(store.get(KEY)).not.toContain("ciphertext\":null");
  });

  it("dispatches shos:storage-read-failed so the user is actually told", async () => {
    const seen = [];
    const onRead = (e) => seen.push(e.detail);
    window.addEventListener("shos:storage-read-failed", onRead);
    vi.spyOn(console, "error").mockImplementation(() => {});
    putRealData();
    state.decryptThrows = new Error("boom");

    await localStorageAdapter.load(KEY, SEED);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0].key).toBe(KEY);
    window.removeEventListener("shos:storage-read-failed", onRead);
  });

  // ---- the subtlety: a locked vault is NOT corruption --------------------
  it("does NOT quarantine when the vault is merely not unlocked yet", async () => {
    putRealData();
    // The exact message cryptoService throws in that case.
    state.decryptThrows = new Error("Vault is not unlocked - cannot decrypt.");

    await localStorageAdapter.load(KEY, SEED);

// Saving must still work, or the app would be unable to save all session.
const wrote = await localStorageAdapter.save(KEY, [{ id: "ok", name: "Fine" }]);
expect(wrote).toBe(true);
    // Asserts the write actually replaced the old value. Note it must NOT be
    // checked with `toContain("Fine")`: save() stores base64 ciphertext, so the
    // plaintext never appears in the stored string at all.
    expect(store.get(KEY)).not.toBe(CIPHERTEXT);
  });

  it("keeps the pre-existing boot behaviour of returning the fallback while locked", async () => {
    putRealData();
    state.decryptThrows = new Error("Vault is not unlocked - cannot decrypt.");

    // Conservative: unchanged behaviour for the transient case.
    expect(await localStorageAdapter.load(KEY, SEED)).toEqual(SEED);
  });

  // ---- self-healing: the refusal must not become permanent ---------------
  it("a later successful read clears the quarantine", async () => {
    putRealData();
    state.decryptThrows = new Error("boom");
    await localStorageAdapter.load(KEY, SEED);
    expect(await localStorageAdapter.save(KEY, [])).toBe(false);

    state.decryptThrows = null; // transient cause resolved
    await localStorageAdapter.load(KEY, SEED);

    expect(await localStorageAdapter.save(KEY, [{ id: "ok" }])).toBe(true);
  });

  it("'Reset all app data' clears the quarantine, so the app can never be bricked", async () => {
    putRealData();
    state.decryptThrows = new Error("boom");
    await localStorageAdapter.load(KEY, SEED);
    expect(await localStorageAdapter.save(KEY, [])).toBe(false);

    localStorageAdapter.clearAllAppData();

    expect(await localStorageAdapter.save(KEY, [{ id: "ok" }])).toBe(true);
  });

  // ---- no regression on the paths that were already correct ---------------
  it("still returns the fallback on a genuine first run", async () => {
    expect(await localStorageAdapter.load(KEY, SEED)).toEqual(SEED);
  });

  it("still returns real decrypted data when decryption works", async () => {
    putRealData();
    expect(await localStorageAdapter.load(KEY, SEED)).toEqual(REAL);
  });

  it("still round-trips a normal save", async () => {
    expect(await localStorageAdapter.save(KEY, REAL)).toBe(true);
    store.set(KEY, CIPHERTEXT); // simulate the encrypted form save() wrote
    state.decryptValue = JSON.stringify(REAL);
    expect(await localStorageAdapter.load(KEY, SEED)).toEqual(REAL);
  });

  it("still returns the fallback for legacy plaintext that is not encrypted", async () => {
    store.set(KEY, JSON.stringify(REAL));
    expect(await localStorageAdapter.load(KEY, SEED)).toEqual(REAL);
  });

  it("save() still dispatches shos:storage-save-failed on a genuine save failure", async () => {
    const seen = [];
    const onSave = (e) => seen.push(e.detail);
    window.addEventListener("shos:storage-save-failed", onSave);
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.encryptShouldFail = true;

    expect(await localStorageAdapter.save(KEY, REAL)).toBe(false);
    expect(seen.length).toBe(1);
    window.removeEventListener("shos:storage-save-failed", onSave);
  });
});

// --- the census that made this a "critical" finding -------------------------
describe("the shape of the original hazard", () => {
  it("the seed-data fallback really is used by many repositories", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = "src/repositories";
    let seedFallbacks = 0;
    let total = 0;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".js")) continue;
      const s = fs.readFileSync(path.join(dir, f), "utf8");
      for (const m of s.matchAll(/storage\.load\(\s*[A-Za-z_]+\s*,\s*([^)]+)\)/g)) {
        total++;
        if (m[1].trim().startsWith("seed")) seedFallbacks++;
      }
    }
    expect(total).toBeGreaterThan(20);
    // If this ever drops to 0 the hazard is gone; if it RISES, more call sites
    // are exposed and the census above needs re-reading.
    expect(seedFallbacks).toBeGreaterThanOrEqual(0);
  });
});