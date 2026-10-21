import { describe, it, expect, beforeEach, vi } from "vitest";

// Coverage for the App Lock / duress PIN paths (t126).
//
// WHY THIS FILE EXISTS AT ALL. A sweep of all 150 test files for
// "deactivate", "anonymisePin", "duressPin" and "unlockWithPin" found NO
// test that imported or exercised privacySettingsRepository.js. The PIN
// storage, the PIN comparison and the duress mirror were entirely uncovered
// - which is how the duress PIN ended up sitting in PLAINTEXT in the vault's
// unencrypted metadata, and how the settings object ended up handing the raw
// App Lock PIN to every screen that read it.
//
// The two properties worth proving:
//
//   1. the settings object does not carry the raw secrets, and
//   2. the duress PIN is a VERIFIER in the vault metadata, not a string -
//      including for a profile that set one before this change, which is
//      converted on first read.
import { webcrypto } from "node:crypto";

// jsdom's crypto has no subtle implementation, and PBKDF2 needs one.
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, writable: true, configurable: true });
}

// Mock the storage adapter so the repository can read without an unlocked
// encryption vault - the real adapter refuses to decrypt in a test.
const mockStore = new Map();
vi.mock("../storage/storageAdapter.js", () => ({
  localStorageAdapter: {
    load: vi.fn((key, fallback) => (mockStore.has(key) ? mockStore.get(key) : fallback)),
    save: vi.fn((key, value) => {
      mockStore.set(key, JSON.parse(JSON.stringify(value)));
      return true;
    }),
  },
}));

const VAULT_KEY = "shos_vault_key_slots";

/**
 * A realistic vault metadata blob.
 *
 * WHY THE TEST HAS TO SEED THIS. The duress mirror lives in the vault's own
 * metadata, and that metadata is only written once the vault exists - which
 * is true of every real profile, because initializeFreshVault() runs on the
 * first boot. The mirror deliberately does NOT create a bare metadata blob
 * when there is none: bootUnlock() reads that blob to decide how to unlock,
 * and a metadata entry with no device slot and no PIN slot would take its
 * "App Lock off" branch and try to unwrap an undefined device key. So the
 * mirror writes only into a vault that is already there, and the test
 * reproduces that state rather than pretending otherwise.
 */
function seedVaultMeta(extra = {}) {
  localStorage.setItem(
    VAULT_KEY,
    JSON.stringify({ device: { slot: "test-device-slot", salt: "test-device-salt" }, ...extra })
  );
}

async function fresh() {
  vi.resetModules();
  const [repo, crypto] = await Promise.all([
    import("./privacySettingsRepository"),
    import("../storage/cryptoService"),
  ]);
  return { repo, crypto };
}

beforeEach(() => {
  mockStore.clear();
  localStorage.clear();
  seedVaultMeta();
  vi.clearAllMocks();
});

describe("the settings object does not carry the raw secrets", () => {
  it("reports WHETHER a PIN is set, and never hands back the PIN itself", async () => {
    const { repo } = await fresh();
    await repo.PrivacySettingsRepository.update({ anonymisePin: "2468", duressPin: "1357" });

    const settings = await repo.PrivacySettingsRepository.getSettings();
    expect(settings.anonymisePin, "the raw App Lock PIN must not be in the settings object").toBeUndefined();
    expect(settings.duressPin, "the raw duress PIN must not be in the settings object").toBeUndefined();
    expect(settings.hasAppLockPin).toBe(true);
    expect(settings.hasDuressPin).toBe(true);
  });

  it("update() returns the same redacted shape", async () => {
    const { repo } = await fresh();
    const updated = await repo.PrivacySettingsRepository.update({ anonymisePin: "2468" });
    expect(updated.anonymisePin).toBeUndefined();
    expect(updated.hasAppLockPin).toBe(true);
  });

  it("the raw PIN is still reachable, but only through the one call that needs it", async () => {
    const { repo } = await fresh();
    await repo.PrivacySettingsRepository.update({ anonymisePin: "2468" });
    expect(await repo.PrivacySettingsRepository.getAppLockPin()).toBe("2468");
  });

  it("no PIN set reads as false, not as an empty secret", async () => {
    const { repo } = await fresh();
    const settings = await repo.PrivacySettingsRepository.getSettings();
    expect(settings.hasAppLockPin).toBe(false);
    expect(settings.hasDuressPin).toBe(false);
  });
});

describe("the duress PIN is a verifier in the vault metadata, not a string", () => {
  it("the metadata holds no plaintext duress PIN", async () => {
    const { repo, crypto } = await fresh();
    await repo.PrivacySettingsRepository.update({ duressPin: "1357" });

    const meta = JSON.parse(localStorage.getItem(VAULT_KEY) || "{}");
    expect(meta.duressPin, "the duress PIN must not be stored in plaintext").toBeUndefined();
    expect(meta.duressPinVerifier, "a verifier must be stored instead").toBeTruthy();
    expect(meta.duressPinVerifier.hash).toBeTruthy();
    expect(meta.duressPinVerifier.salt).toBeTruthy();
    // And the stored verifier must not contain the PIN in any form.
    expect(JSON.stringify(meta)).not.toContain("1357");
  });

  it("the right PIN matches and the wrong one does not", async () => {
    const { repo, crypto } = await fresh();
    await repo.PrivacySettingsRepository.update({ duressPin: "1357" });
    expect(await crypto.isDuressPin("1357")).toBe(true);
    expect(await crypto.isDuressPin("1358")).toBe(false);
    expect(await crypto.isDuressPin("")).toBe(false);
  });

  it("a profile that set a duress PIN BEFORE this change is converted on first read", async () => {
    const { crypto } = await fresh();
    // The legacy shape: the plaintext, in the unencrypted metadata.
    localStorage.setItem(VAULT_KEY, JSON.stringify({ duressPin: "1357" }));
    expect(await crypto.isDuressPin("1357"), "the legacy PIN must still work").toBe(true);

    const meta = JSON.parse(localStorage.getItem(VAULT_KEY) || "{}");
    expect(meta.duressPin, "the legacy plaintext must be gone after the conversion").toBeUndefined();
    expect(meta.duressPinVerifier).toBeTruthy();
    // And the converted verifier still recognises it.
    expect(await crypto.isDuressPin("1357")).toBe(true);
    expect(await crypto.isDuressPin("1358")).toBe(false);
  });

  it("clearing the duress PIN removes the verifier too", async () => {
    const { repo, crypto } = await fresh();
    await repo.PrivacySettingsRepository.update({ duressPin: "1357" });
    await repo.PrivacySettingsRepository.clearDuressPin();
    expect(await crypto.isDuressPin("1357")).toBe(false);
    const meta = JSON.parse(localStorage.getItem(VAULT_KEY) || "{}");
    expect(meta.duressPinVerifier).toBeUndefined();
  });
});

describe("the PIN checks still behave", () => {
  it("deactivate() refuses the wrong PIN and accepts the right one", async () => {
    const { repo } = await fresh();
    await repo.PrivacySettingsRepository.update({ anonymisePin: "2468", anonymiseModeActive: true });

    const wrong = await repo.PrivacySettingsRepository.deactivate("0000");
    expect(wrong.ok).toBe(false);
    expect(wrong.error).toBeTruthy();

    const right = await repo.PrivacySettingsRepository.deactivate("2468");
    expect(right.ok).toBe(true);
    const settings = await repo.PrivacySettingsRepository.getSettings();
    expect(settings.anonymiseModeActive).toBe(false);
  });

  it("deactivate() with no PIN set does not demand one", async () => {
    const { repo } = await fresh();
    await repo.PrivacySettingsRepository.update({ anonymiseModeActive: true });
    const result = await repo.PrivacySettingsRepository.deactivate("");
    expect(result.ok).toBe(true);
  });

  it("a duress PIN identical to the real one is rejected", async () => {
    const { repo } = await fresh();
    await repo.PrivacySettingsRepository.update({ anonymisePin: "2468" });
    const same = await repo.PrivacySettingsRepository.setDuressPin("2468");
    expect(same.ok).toBe(false);
    expect(same.error).toMatch(/different/i);

    const different = await repo.PrivacySettingsRepository.setDuressPin("1357");
    expect(different.ok).toBe(true);
  });

  it("a duress PIN cannot be set before a real PIN exists", async () => {
    const { repo } = await fresh();
    const result = await repo.PrivacySettingsRepository.setDuressPin("1357");
    expect(result.ok).toBe(false);
  });
});
