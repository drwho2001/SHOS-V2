// appLockEnforcementGuard.test.js
//
// ADDED 14 Nov 2026 — the guard for BACKLOG 112's fix ("App Lock toggle ON
// but no PIN prompt on relaunch").
//
// THE DEFECT. `appLockEnabled: true` in settings is only honest if the
// vault actually has a PIN slot behind it. Two paths could desync the two:
// an ENCRYPTED backup restore (the flag travels; the PIN material cannot —
// a verifier proves a PIN, it unwraps nothing on the restoring device), and
// older builds that flipped the flag without creating the slot. In that
// state bootUnlock() takes its no-slot branch and opens the app with no
// prompt while Settings shows App Lock ON — protection advertised but not
// enforced, the exact state the owner's audit captured.
//
// The fix has two layers, and this guard asserts both:
//   1. the restore path demotes a restored appLockEnabled/biometricUnlock
//      flag whose slot doesn't exist on this device (fail-safe: never
//      advertise protection that isn't enforced);
//   2. the boot path reconciles any ALREADY-corrupted stored state, so a
//      device that got into this state before the fix is corrected on its
//      next launch rather than staying unlocked for ever.
//
// Source-level, like the other wiring guards: the real restore needs a
// populated vault plus every repository in the app, and the boot path is
// inside App.jsx's one-shot boot effect. What must not silently regress is
// the DEMOTE RULE — that the flag is checked against the slot, not trusted.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const CRYPTO = fs.readFileSync(path.join(process.cwd(), "src/storage/cryptoService.js"), "utf8");
const BACKUP = fs.readFileSync(path.join(process.cwd(), "src/storage/backupService.js"), "utf8");
const APP = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

describe("BACKLOG 112 — App Lock can never be ON without a PIN slot behind it", () => {
  it("cryptoService exposes the vault's PIN-slot existence for callers that cannot ask it themselves", () => {
    expect(CRYPTO).toMatch(/export function hasPinSlot\(\)/);
    expect(CRYPTO).toMatch(/return !!readVaultMeta\(\)\?\.pin;/);
  });

  it("the restore path demotes a restored App Lock flag with no slot on this device", () => {
    const branch = BACKUP.match(
      /if \(privacySettings && typeof privacySettings === "object" && !Array\.isArray\(privacySettings\)\) \{[\s\S]*?await PrivacySettingsRepository\.update\(restoredPrivacy\);\s*\}/,
    )?.[0];
    expect(branch, "the privacySettings restore branch not found").toBeTruthy();
    expect(branch).toMatch(/restoredPrivacy\.appLockEnabled && !hasPinSlot\(\)/);
    expect(branch).toMatch(/appLockEnabled: false, biometricUnlockEnabled: false/);
  });

  it("the biometric flag is demoted when its own slot is missing", () => {
    expect(BACKUP).toMatch(/restoredPrivacy\.biometricUnlockEnabled && !hasBiometricSlot\(\)/);
  });

  it("boot reconciles already-corrupted stored state, and persists the demotion", () => {
    const reconcile = APP.match(
      /let effectiveAppLockEnabled = settings\.appLockEnabled;[\s\S]*?setAppLockEnabled\(effectiveAppLockEnabled\);/,
    )?.[0];
    expect(reconcile, "the boot-time App Lock reconciliation not found").toBeTruthy();
    expect(reconcile).toMatch(/effectiveAppLockEnabled && !hasPinSlot\(\)/);
    // Persisting matters: without it, every boot would re-derive the same
    // demotion from the same stale stored value, and Privacy would keep
    // showing the toggle ON between sessions while the app never enforced.
    expect(reconcile).toMatch(/await PrivacySettingsRepository\.update\(\{ appLockEnabled: false, biometricUnlockEnabled: false \}\)/);
  });

  it("the demoted state also suppresses the setup prompt's 'already on' assumption", () => {
    // showAppLockPrompt must consult the EFFECTIVE value, not the raw
    // stored one — a demoted session should get the setup prompt back,
    // which is the app telling the truth about its protection state.
    expect(APP).toMatch(/setShowAppLockPrompt\(!effectiveAppLockEnabled && !settings\.appLockPromptDismissed\)/);
  });
});
