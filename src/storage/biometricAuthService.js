// biometricAuthService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Optional biometric unlock (fingerprint/face) for App Lock — a
// convenience layered ON TOP of the existing PIN, never a replacement
// for it. The PIN field on the lock screen always still works, even
// when biometrics are enabled, unavailable, or cancelled — this
// service never leaves App Lock as the only way in.
//
// Same lazy-dynamic-import + try/catch fallback pattern as every
// other native-only integration in this app (see notificationService.js,
// fileExportHelper.js) — in a browser preview (no native plugin), every
// function here just reports "not available" rather than crashing, no
// special-casing needed by callers.
let BiometricAuth = null, AndroidBiometryStrength = null;
let pluginLoadAttempted = false;

async function getPlugin() {
  if (pluginLoadAttempted) return { BiometricAuth, AndroidBiometryStrength };
  pluginLoadAttempted = true;
  try {
    const mod = await import("@aparajita/capacitor-biometric-auth");
    BiometricAuth = mod.BiometricAuth;
    AndroidBiometryStrength = mod.AndroidBiometryStrength;
  } catch {
    console.warn("[biometricAuthService] @aparajita/capacitor-biometric-auth not available — falling back to PIN-only in this environment.");
  }
  return { BiometricAuth, AndroidBiometryStrength };
}

// Real check, not assumed — the device may have no biometric hardware,
// hardware but nothing enrolled, or be running in a plain browser
// preview where the native plugin never loaded. Settings uses this
// before letting someone turn the toggle on; the lock screen uses it
// to decide whether to even show the biometric option.
export async function checkBiometryAvailable() {
  const { BiometricAuth } = await getPlugin();
  if (!BiometricAuth) {
    return { available: false, reason: "Biometrics need the installed app, not this preview." };
  }
  try {
    const result = await BiometricAuth.checkBiometry();
    return {
      available: result.isAvailable,
      reason: result.isAvailable ? "" : (result.reason || "No biometrics enrolled on this device."),
    };
  } catch (err) {
    return { available: false, reason: err.message || "Couldn't check biometrics on this device." };
  }
}

// Prompts for biometric authentication. Resolves `true` on success,
// resolves `false` — never throws — on cancel, failure, lockout, or
// unavailability. Deliberately allowDeviceCredential: false: this
// app already has its own in-app PIN as the fallback path (right there
// on the same lock screen), so falling through to the PHONE's own
// lock-screen credential too would just be a second, confusing
// fallback layered on the first for no real benefit.
// FIXED — real device bug: "unlock shos unlock shos appears twice".
// `reason` (Android's own subtitle/description text below the dialog
// title) and `androidTitle` were both hardcoded to the exact same
// string, so Android's biometric prompt showed it twice — once as the
// title, once as the subtitle. Kept the title as the short app-level
// label callers already pass as `reason` (unchanged default and call
// sites), moved the actual descriptive text to its own distinct string.
export async function authenticateWithBiometrics(reason = "Unlock SHOS") {
  const { BiometricAuth, AndroidBiometryStrength } = await getPlugin();
  if (!BiometricAuth) return false;
  try {
    await BiometricAuth.authenticate({
      reason: "Confirm your fingerprint or face to continue.",
      cancelTitle: "Use PIN instead",
      androidTitle: reason,
      allowDeviceCredential: false,
      androidBiometryStrength: AndroidBiometryStrength.weak,
    });
    return true;
  } catch {
    return false;
  }
}
