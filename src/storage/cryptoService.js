// cryptoService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Phase 4 of the encryption-at-rest effort (see CLAUDE.md's Known
// Issues for the full multi-session history) — this is the module
// that actually encrypts/decrypts app data, wired into
// storageAdapter.js's own `load()`/`save()`. Everything here is real
// Web Crypto (`crypto.subtle`), the exact same API backupService.js's
// own encrypted-export feature already uses successfully — no new
// library anywhere in this app.
//
// THE REAL SHAPE, stated plainly before the code:
// - One "Data Key" (DK) — a real, random 256-bit AES-GCM key — is what
//   actually encrypts/decrypts every real record. It's generated ONCE,
//   ever, the first time this app runs under Phase 4, and never
//   changes again (there's no user-facing "rotate my key" feature —
//   not needed for a personal, single-device app).
// - The DK itself is never stored in the clear. It's protected by
//   exactly one of two "slots" at any given time, matching the app's
//   own existing rule ("appLockEnabled defaults false... a device-bound
//   key is the real baseline... always active regardless of App Lock.
//   When App Lock IS enabled, an additional PIN-derived wrapping layer
//   goes on top — envelope encryption, not a replacement"):
//     - `device` slot: DK encrypted by a non-extractable, device-bound
//       AES-GCM key. No human secret needed — this is the always-works
//       baseline for the common case (most users never set a PIN).
//     - `pin` slot: DK encrypted by a key derived from the user's real
//       App Lock PIN via PBKDF2 (same primitive, same iteration-count
//       reasoning as backupService.js's own encrypted-export feature —
//       see PIN_KDF_ITERATIONS below for why the count differs).
//   Exactly one of these is active at a time — `device` when App Lock
//   is off, `pin` when it's on — enforced by DELETING the other slot
//   on every real toggle, not just leaving it unused. This is what
//   makes "pulled-from-device data always needs the PIN once App Lock
//   is on" a real guarantee, not just a UI door — the owner's own
//   explicit ask.
// - A third, TEMPORARY slot — `tempGrace` — exists only while App
//   Lock's own "skip re-verification briefly" grace period is both
//   turned on AND currently active. See its own section far below for
//   the real reasoning (the existing grace-period feature needs real
//   teeth once a PIN gates real decryption, not just a UI skip) and
//   the honest trade-off it accepts, confirmed with the owner
//   directly rather than assumed.
// - A fourth slot — `biometric` — exists only while biometric unlock
//   is turned on, structurally identical to `device` (DEK wrapped by
//   the same non-extractable device key). See its own section far
//   below for why biometric unlock needs its own real slot at all.
//
// A REAL CIRCULAR DEPENDENCY, found and resolved before any of this
// was wired into App.jsx: the App Lock screen used to ask
// PrivacySettingsRepository.classifyAppLockPin() whether a typed PIN
// was the real one, the duress one, or wrong — but that repository's
// own data (including the duress PIN itself) is encrypted by the very
// Data Key this file exists to protect, so it CANNOT be read before a
// real unlock succeeds. Resolved by making unlockWithPin() below the
// real check (a wrong PIN fails AES-GCM's own authentication, not a
// separate string comparison), and by mirroring the two small, genuinely
// necessary pre-unlock facts (the duress PIN itself, and the grace-period
// length in minutes) into this file's own unencrypted vault metadata —
// see their own getters/setters far below for the full reasoning.
// classifyAppLockPin()/checkAppLockPin() were removed from
// privacySettingsRepository.js entirely once nothing called them anymore.
//
// WHY NOT `SubtleCrypto.wrapKey()`/`unwrapKey()` — the "obvious" API
// for this exact job: checked directly (not assumed) before writing
// any of this — `wrapKey()` requires the key being wrapped to have
// `extractable: true`, which would mean the Data Key itself could be
// exported to plain bytes by any in-page JS at any time, a real
// regression from "always non-extractable." Sidestepped entirely: the
// Data Key is generated as its own raw random bytes (never a permanent
// CryptoKey object), and each slot simply AES-GCM-*encrypts those raw
// bytes as ordinary data using its own protector key — the exact same
// primitive, same authenticated-encryption guarantee, without ever
// needing an extractable key anywhere in this file. The raw DK bytes
// exist in memory only transiently, right after a successful unlock,
// immediately re-imported as a non-extractable CryptoKey (`activeDataKey`
// below) for all real, everyday encrypt/decrypt work.
//
// WHY `shos_vault_key_slots` is its OWN, separate, NEVER-encrypted
// localStorage key — the one deliberate exception in this whole
// design: the app has to know HOW to get the Data Key before it can
// decrypt anything else, including `PrivacySettingsRepository`'s own
// stored `appLockEnabled`/`appLockGraceMinutes` — a real bootstrap
// circularity if this metadata lived inside the encrypted zone itself.
// This file's own functions read/write it directly via
// `localStorage`— genuinely equivalent in spirit to
// `main.jsx`'s `ErrorBoundary`/`moduleColorRepository.js`'s own
// documented raw-storage exceptions elsewhere in this app, for the
// same underlying reason: this one specific piece of data structurally
// cannot go through the normal encrypted path.

const VAULT_KEY = "shos_vault_key_slots";
const IDB_NAME = "shos_crypto";
const IDB_VERSION = 1;
const IDB_STORE = "keys";
const DEVICE_PROTECTOR_RECORD_ID = "deviceProtector";

// PBKDF2 iteration count for the PIN-derived protector — deliberately
// LOWER than backupService.js's own 250,000 (used for a real
// password, entered rarely, where slower is purely a security upside
// with no real UX cost). A numeric PIN is entered far more often (this
// screen, per the owner's own habits, potentially dozens of times a
// day) and starts from much lower entropy than a real password — very
// high iteration counts buy comparatively little real protection here
// while adding real, felt unlock latency. 100,000 rounds still raises
// the bar meaningfully against a casual, unsophisticated attempt
// (which is this app's own already-stated real threat model for the
// PIN elsewhere — see privacySettingsRepository.js's own header
// comment) while staying fast enough not to feel broken on unlock.
const PIN_KDF_ITERATIONS = 100000;

// ADDED 9 Sep 2026 — the "recovery" slot: real, honest alternate access
// for "I forgot my PIN," per the owner's own explicit spec (CLAUDE.md's
// own PIN-recovery scoping entry). A custom, user-CHOSEN string, typed
// on a normal keyboard (not the numeric PIN pad) — closer to a real
// remembered passphrase than an auto-generated code the owner would
// have to write down and could lose just as easily as the PIN itself.
// Structurally the SAME envelope shape as the `pin` slot (its own
// salt/iterations, wraps the SAME permanent Data Key), stored in this
// file's own already-unencrypted vault metadata — no new mechanism.
// Deliberately entered far less often than a PIN (only when the PIN is
// genuinely forgotten, or when first set/changed) and, unlike a 4-6
// digit numeric PIN, can carry real entropy of its own — closer to
// backupService.js's own export-password KDF cost than the PIN's
// unlock-tuned lower one, since there's no "typed dozens of times a
// day" latency budget to protect here.
const RECOVERY_KDF_ITERATIONS = 250000;

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// --- Vault slot metadata (plain, unencrypted — see file header) ---

function readVaultMeta() {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("[cryptoService] Couldn't read vault metadata:", err);
    return null;
  }
}
function writeVaultMeta(meta) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(meta));
}

// --- IndexedDB: the one non-extractable device-bound protector key ---
// A real, if honest, trade-off documented in CLAUDE.md's own Phase 4
// scoping entry: this is weaker than true hardware-backed Android
// Keystore (its bytes ultimately still live in the WebView's own
// storage), chosen because no such native plugin exists in this app
// today and this app's own established pattern is real scrutiny
// before adding a new native dependency. Works identically on the
// web/PWA build and the installed Android app — Capacitor's own
// WebView is genuinely just Chromium, no platform-specific code here.

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(id) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(id, value) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Gets the existing device protector key, or generates + persists a
// new one on first-ever run. `navigator.storage.persist()` is a
// best-effort request that this origin's storage not be evicted under
// pressure — the same durability guarantee `localStorage` has always
// implicitly had for this app; wrapped in try/catch since it's not
// universally supported and a rejection here shouldn't be fatal.
let deviceProtectorPromise = null;
async function getDeviceProtectorKey() {
  if (!deviceProtectorPromise) {
    deviceProtectorPromise = (async () => {
      try {
        if (navigator.storage?.persist) await navigator.storage.persist();
      } catch { /* best-effort only */ }
      const existing = await idbGet(DEVICE_PROTECTOR_RECORD_ID);
      if (existing) return existing;
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await idbSet(DEVICE_PROTECTOR_RECORD_ID, key);
      return key;
    })();
  }
  return deviceProtectorPromise;
}

// --- Generic "protect a small raw byte blob with a key" helper ---
// Used for every slot the same way: encrypt the Data Key's own raw
// bytes as plain data with whatever protector key applies.

async function protectBytes(protectorKey, rawBytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, protectorKey, rawBytes);
  return { iv: bytesToBase64(iv), wrapped: bytesToBase64(new Uint8Array(wrappedBuf)) };
}
async function unprotectBytes(protectorKey, { iv, wrapped }) {
  const rawBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, protectorKey, base64ToBytes(wrapped));
  return new Uint8Array(rawBuf);
}

async function derivePinProtectorKey(pin, saltBytes, iterations) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// --- The active, in-memory Data Key (the one actually used for every
// real encrypt/decrypt call) — lives only for this running session,
// gone on a real reload/close, exactly the right lifetime for
// something this sensitive. ---
let activeDataKey = null;

async function importDataKey(rawDekBytes) {
  return crypto.subtle.importKey("raw", rawDekBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function isUnlocked() {
  return activeDataKey !== null;
}

// --- No vault metadata exists yet. Two real, different cases hit
// this exact same branch, and they matter a great deal — caught and
// fixed before shipping, not assumed away: a genuinely fresh install
// (nothing to migrate, ever) looks IDENTICAL from `vaultExists()`'s
// own point of view to an EXISTING install upgrading to Phase 4 for
// the very first time, sitting on real plaintext data that still
// needs migrating. Distinguished here by actually checking for any
// other real `shos_`-prefixed key already in storage (the vault key
// itself doesn't exist yet at this point either way, so it's excluded
// from its own check). Generates a brand-new Data Key and a `device`
// slot either way (App Lock always starts off for a fresh profile —
// see appPreferencesRepository.js's own DEFAULT_APP_PREFERENCES) and
// caches it as the active key — the real difference is only whether
// `migrated` starts true (nothing real to encrypt) or false (App.jsx's
// own boot sequence will call runMigrationIfNeeded() right after this
// resolves, per the owner's own eager-migration choice). ---
async function initializeFreshVault() {
  let hasExistingData = false;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("shos_") && key !== VAULT_KEY) { hasExistingData = true; break; }
  }
  const dek = crypto.getRandomValues(new Uint8Array(32));
  const deviceKey = await getDeviceProtectorKey();
  const deviceSlot = await protectBytes(deviceKey, dek);
  writeVaultMeta({ device: deviceSlot, pin: null, tempGrace: null, migrated: !hasExistingData });
  activeDataKey = await importDataKey(dek);
}

// --- Cold-boot unlock, called once from App.jsx's own bootReady gate.
// Returns "device" | "pin-needed" | "temp-grace" so the caller knows
// whether a PIN prompt is actually required. Never touches
// PrivacySettingsRepository — can't yet, see file header. ---
export async function bootUnlock() {
  const meta = readVaultMeta();
  if (!meta) {
    await initializeFreshVault();
    return "device";
  }
  if (!meta.pin) {
    // App Lock off — the device slot alone is always enough, no PIN.
    const deviceKey = await getDeviceProtectorKey();
    const dek = await unprotectBytes(deviceKey, meta.device);
    activeDataKey = await importDataKey(dek);
    return "device";
  }
  // App Lock on. Try the temporary grace-window slot first — see this
  // file's own grace-period section below for why this exists at all.
  if (meta.tempGrace && meta.tempGrace.expiresAt > Date.now()) {
    try {
      const deviceKey = await getDeviceProtectorKey();
      const dek = await unprotectBytes(deviceKey, meta.tempGrace.slot);
      activeDataKey = await importDataKey(dek);
      // Sliding window, matching shouldRelock()'s own original
      // "reopening within X minutes" intent — refreshed on every real
      // use within the window, not just its own first creation.
      await refreshGraceWindow(dek, meta.tempGrace.graceMinutes);
      return "temp-grace";
    } catch (err) {
      // A corrupted/invalid temp slot should never block a real PIN
      // unlock — fall through to asking for the PIN normally.
      console.warn("[cryptoService] Grace-window auto-unlock failed, falling back to PIN prompt:", err);
    }
  }
  return "pin-needed";
}

// --- Real PIN entry, called from AppLockScreen's own attempt(). A
// wrong PIN throws here (AES-GCM's own authentication tag fails to
// verify against the wrong derived key) — this IS the real check now,
// not a pre-check by some other function. See this file's own header
// for why classification used to live in PrivacySettingsRepository and
// can't anymore: that repository's data is encrypted BY the very key
// this function exists to recover, so nothing there can run before
// this succeeds. Reads its own grace-period preference from vault
// metadata (`graceMinutesPref`, mirrored here by
// PrivacySettingsRepository.update()/enablePinProtection()/
// changePin() whenever the real setting changes) rather than taking it
// as a parameter — the real `appLockGraceMinutes` value lives in
// encrypted storage, unreadable at exactly the moment this function
// needs it. ---
export async function unlockWithPin(pin) {
  const meta = readVaultMeta();
  if (!meta?.pin) throw new Error("No PIN-protected vault exists.");
  const pinKey = await derivePinProtectorKey(pin, base64ToBytes(meta.pin.salt), meta.pin.iterations);
  const dek = await unprotectBytes(pinKey, meta.pin.slot);
  activeDataKey = await importDataKey(dek);
  const graceMinutes = meta.graceMinutesPref || 0;
  if (graceMinutes > 0) await refreshGraceWindow(dek, graceMinutes);
  else if (meta.tempGrace) {
    const cleared = readVaultMeta();
    cleared.tempGrace = null;
    writeVaultMeta(cleared);
  }
}

// --- Duress PIN + grace-minutes preference: two small, deliberately
// UNENCRYPTED mirrors of facts that otherwise live inside
// PrivacySettingsRepository's own encrypted storage. Both need to be
// readable BEFORE the vault unlocks — the duress PIN, so AppLockScreen
// can route to the decoy session without ever attempting (and failing)
// a real vault unlock with it; the grace-minutes preference, so a
// fresh PIN unlock can establish its own temp-grace slot immediately
// (see unlockWithPin() above) rather than waiting on encrypted
// settings that don't exist yet at that point. Same category of
// necessary exception as `shos_vault_key_slots` itself — see this
// file's own header. Real, honest trade-off, same shape as this file's
// other accepted ones: a determined attacker with raw storage access
// could read the duress PIN (already true before this change — see
// privacySettingsRepository.js's own header on why that PIN was never
// meant to resist that threat model) and could see the grace-period
// duration in minutes (not sensitive on its own).
// PrivacySettingsRepository.getSettings() self-heals these mirrors
// from its own (now-decrypted) stored values the first time it's read
// after this code ships, for a profile that had already set either
// value before this mirror existed — see that file's own comment.
export function getDuressPin() {
  return readVaultMeta()?.duressPin || "";
}
export function setDuressPinMirror(pin) {
  const meta = readVaultMeta();
  if (!meta) return;
  meta.duressPin = pin || "";
  writeVaultMeta(meta);
}
export function getGraceMinutesPref() {
  return readVaultMeta()?.graceMinutesPref || 0;
}
export function setGraceMinutesPref(minutes) {
  const meta = readVaultMeta();
  if (!meta) return;
  meta.graceMinutesPref = minutes || 0;
  writeVaultMeta(meta);
}

// Re-wraps the given raw Data Key bytes under the device protector as
// a fresh, renewed-expiry temporary slot. Takes the raw bytes as a
// real parameter (never a remembered/implicit module-level value,
// which would be exactly the kind of ordering bug this session has
// caught repeatedly elsewhere) — every real caller already has them
// in scope at the moment it calls this. Matches the original
// shouldRelock()'s own sliding-window behavior exactly — "reopening
// within X minutes" was never a one-shot allowance, so this refreshes
// on every real use within the window, not just its own first
// creation.
async function refreshGraceWindow(rawDek, graceMinutes) {
  const deviceKey = await getDeviceProtectorKey();
  const slot = await protectBytes(deviceKey, rawDek);
  const meta = readVaultMeta();
  meta.tempGrace = { slot, graceMinutes, expiresAt: Date.now() + graceMinutes * 60000 };
  writeVaultMeta(meta);
}

export function clearGraceWindow() {
  const meta = readVaultMeta();
  if (meta?.tempGrace) {
    meta.tempGrace = null;
    writeVaultMeta(meta);
  }
}

export function isVaultUnlocked() {
  return isUnlocked();
}

export function hasPinProtection() {
  return !!readVaultMeta()?.pin;
}

// --- Enabling/disabling/changing PIN protection — every path here
// follows the same real safety rule the owner confirmed directly:
// unwrap with the OLD protector, wrap with the NEW one, immediately
// verify the NEW wrapping actually unwraps correctly, and only THEN
// commit it (deleting the old slot). Any failure at any step leaves
// the vault in its previous, still-working state and throws — never
// a partial, inconsistent commit. ---

export async function enablePinProtection(pin, graceMinutes = 0) {
  if (!activeDataKey) throw new Error("Vault must be unlocked before changing PIN protection.");
  const meta = readVaultMeta();
  const deviceKey = await getDeviceProtectorKey();
  const dek = await unprotectBytes(deviceKey, meta.device);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pinKey = await derivePinProtectorKey(pin, salt, PIN_KDF_ITERATIONS);
  const pinSlot = await protectBytes(pinKey, dek);
  // Verify before committing.
  const verifyKey = await derivePinProtectorKey(pin, salt, PIN_KDF_ITERATIONS);
  const verifyDek = await unprotectBytes(verifyKey, pinSlot);
  if (!bytesEqual(verifyDek, dek)) throw new Error("PIN protection verification failed — nothing was changed.");
  writeVaultMeta({ ...meta, device: null, pin: { slot: pinSlot, salt: bytesToBase64(salt), iterations: PIN_KDF_ITERATIONS }, tempGrace: null, graceMinutesPref: graceMinutes });
  if (graceMinutes > 0) await refreshGraceWindow(dek, graceMinutes);
}

// The current PIN is always required to turn App Lock off, the same
// way turning it ON requires the device slot to already be genuinely
// unlocked. Confirms the CURRENT pin slot still unwraps correctly
// before replacing it with a device slot — the same unwrap-new-then-
// commit safety rule as every other slot change here. Also clears the
// `biometric` slot (see far below) — biometric unlock only ever makes
// sense as a convenience layered on top of PIN protection being on;
// Settings' own toggle already turns `biometricUnlockEnabled` off
// alongside App Lock, this is that same real fact enforced at the
// vault layer too, not just the UI flag.
export async function disablePinProtectionWithPin(currentPin) {
  if (!activeDataKey) throw new Error("Vault must be unlocked before changing PIN protection.");
  const meta = readVaultMeta();
  if (!meta.pin) return;
  const pinKey = await derivePinProtectorKey(currentPin, base64ToBytes(meta.pin.salt), meta.pin.iterations);
  const dek = await unprotectBytes(pinKey, meta.pin.slot);
  const deviceKey = await getDeviceProtectorKey();
  const deviceSlot = await protectBytes(deviceKey, dek);
  const verifyDek = await unprotectBytes(deviceKey, deviceSlot);
  if (!bytesEqual(verifyDek, dek)) throw new Error("Device-slot verification failed — App Lock was not disabled.");
  writeVaultMeta({ ...meta, device: deviceSlot, pin: null, tempGrace: null, biometric: null });
}

export async function changePin(oldPin, newPin, graceMinutes = 0) {
  if (!activeDataKey) throw new Error("Vault must be unlocked before changing PIN protection.");
  const meta = readVaultMeta();
  if (!meta.pin) throw new Error("No existing PIN protection to change.");
  const oldPinKey = await derivePinProtectorKey(oldPin, base64ToBytes(meta.pin.salt), meta.pin.iterations);
  const dek = await unprotectBytes(oldPinKey, meta.pin.slot);
  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  const newPinKey = await derivePinProtectorKey(newPin, newSalt, PIN_KDF_ITERATIONS);
  const newSlot = await protectBytes(newPinKey, dek);
  const verifyKey = await derivePinProtectorKey(newPin, newSalt, PIN_KDF_ITERATIONS);
  const verifyDek = await unprotectBytes(verifyKey, newSlot);
  if (!bytesEqual(verifyDek, dek)) throw new Error("New PIN verification failed — the old PIN is still active.");
  writeVaultMeta({ ...meta, device: null, pin: { slot: newSlot, salt: bytesToBase64(newSalt), iterations: PIN_KDF_ITERATIONS }, tempGrace: null, graceMinutesPref: graceMinutes });
  if (graceMinutes > 0) await refreshGraceWindow(dek, graceMinutes);
}

// --- Biometric unlock: a real, honest extension of the same envelope
// design, not a bolt-on. biometricAuthService.js's own header is
// explicit that biometrics are "a convenience layered ON TOP of the
// existing PIN, never a replacement" — but that convenience still has
// to actually recover the Data Key somehow once App Lock is on, and
// the native biometric prompt itself produces no secret material at
// all (just a yes/no "this device's owner is present" gate). The
// `biometric` slot below is structurally identical to the always-on
// `device` slot (the DEK, encrypted by the same non-extractable
// device-bound key) — set up once, right after the user re-confirms
// their real PIN to turn the Settings toggle on, and consulted by
// AppLockScreen's own tryBiometric() whenever the native prompt
// succeeds, entirely independent of the numeric grace-period slot.
// HONEST TRADE-OFF, same category already accepted for the grace
// window (confirmed with the owner directly, see this file's own
// header and CLAUDE.md's Phase 4 scoping entry): once biometric
// unlock is turned on, a device-protected copy of the DEK exists
// alongside the PIN-protected one — someone with the ability to
// extract the non-extractable device key directly (root/physical
// access to the WebView's own storage) could recover data without
// ever knowing the PIN, for as long as biometric unlock stays on. The
// PIN slot itself is untouched either way — turning biometric off
// removes this slot and the guarantee is exactly as strong as before.
export async function enableBiometricSlot(currentPin) {
  if (!activeDataKey) throw new Error("Vault must be unlocked before enabling biometric unlock.");
  const meta = readVaultMeta();
  if (!meta.pin) throw new Error("PIN protection must be enabled before biometric unlock.");
  const pinKey = await derivePinProtectorKey(currentPin, base64ToBytes(meta.pin.salt), meta.pin.iterations);
  const dek = await unprotectBytes(pinKey, meta.pin.slot);
  const deviceKey = await getDeviceProtectorKey();
  const biometricSlot = await protectBytes(deviceKey, dek);
  const verifyDek = await unprotectBytes(deviceKey, biometricSlot);
  if (!bytesEqual(verifyDek, dek)) throw new Error("Biometric-slot verification failed — biometric unlock was not enabled.");
  writeVaultMeta({ ...meta, biometric: biometricSlot });
}

// --- Recovery string: set/change/clear, and the real "forgot my PIN"
// unlock path. Same verify-before-commit safety rule as every other
// slot change in this file — see enablePinProtection()'s own comment. ---

// Gated behind the CURRENT PIN, same trust model as turning App Lock
// off (disablePinProtectionWithPin above) — you're already inside the
// unlocked app at this point, this just re-confirms you actually know
// the PIN before letting you set the one thing that can bypass it
// later. Also the real reason this can't be called until App Lock is
// already on: there's no `pin` slot to unwrap the Data Key from
// otherwise (the `device` slot exists instead, and needs no recovery
// path — losing that key just falls back to the PIN, or there IS no
// PIN yet). Overwrites any existing recovery string outright — this
// doubles as "change recovery string," per the owner's own spec; the
// old string simply stops working the moment this succeeds.
export async function setRecoveryString(currentPin, recoveryString) {
  if (!activeDataKey) throw new Error("Vault must be unlocked before setting a recovery string.");
  const meta = readVaultMeta();
  if (!meta.pin) throw new Error("App Lock must be turned on before setting a recovery string.");
  const pinKey = await derivePinProtectorKey(currentPin, base64ToBytes(meta.pin.salt), meta.pin.iterations);
  const dek = await unprotectBytes(pinKey, meta.pin.slot);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const recoveryKey = await derivePinProtectorKey(recoveryString, salt, RECOVERY_KDF_ITERATIONS);
  const recoverySlot = await protectBytes(recoveryKey, dek);
  const verifyKey = await derivePinProtectorKey(recoveryString, salt, RECOVERY_KDF_ITERATIONS);
  const verifyDek = await unprotectBytes(verifyKey, recoverySlot);
  if (!bytesEqual(verifyDek, dek)) throw new Error("Recovery string verification failed — nothing was changed.");
  writeVaultMeta({ ...meta, recovery: { slot: recoverySlot, salt: bytesToBase64(salt), iterations: RECOVERY_KDF_ITERATIONS } });
}

export function hasRecoveryString() {
  return !!readVaultMeta()?.recovery;
}

// No PIN re-confirmation needed to CLEAR (as opposed to set/change) —
// same precedent as disableBiometricSlot() below: this only ever runs
// from a button already gated behind being inside the unlocked, PIN-
// protected app, not a new attack surface of its own.
export function clearRecoveryString() {
  const meta = readVaultMeta();
  if (meta?.recovery) {
    meta.recovery = null;
    writeVaultMeta(meta);
  }
}

// --- The real "forgot my PIN" path, called from AppLockScreen's own
// "Forgot PIN?" link. Deliberately ONE combined call, not "unlock, then
// separately reset the PIN" as two steps — activeDataKey is a
// non-extractable CryptoKey by design (see file header), so once a
// plain unlock imports the raw Data Key bytes into it, there is no way
// to get those raw bytes back out again to wrap a new PIN slot with.
// Collecting the new PIN in the SAME step as the recovery string (both
// entered before this is ever called) means the real raw DEK bytes,
// briefly held in this function's own `dek` variable, get used for
// both the unlock AND the new PIN slot in one atomic pass — the same
// verify-before-commit rule as every other slot change here, just
// combined with the unlock itself rather than requiring the DEK to be
// extracted and re-supplied a second time. A wrong recovery string
// fails at the very first line (AES-GCM's own authentication tag),
// before anything about the new PIN is ever touched. The OLD pin slot
// (the one whose PIN was forgotten) is simply overwritten — there's no
// real reason to keep it once a real recovery unlock has proven the
// owner doesn't have it anymore, per the owner's own explicit design.
// The existing recovery slot itself is left untouched — it keeps
// working for a FUTURE forgotten PIN too, since it wraps the same
// permanent Data Key regardless of how many times the PIN itself
// changes.
export async function unlockAndResetPinWithRecoveryCode(recoveryString, newPin) {
  const meta = readVaultMeta();
  if (!meta?.recovery) throw new Error("No recovery string has been set.");
  const recoveryKey = await derivePinProtectorKey(recoveryString, base64ToBytes(meta.recovery.salt), meta.recovery.iterations);
  const dek = await unprotectBytes(recoveryKey, meta.recovery.slot);
  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  const newPinKey = await derivePinProtectorKey(newPin, newSalt, PIN_KDF_ITERATIONS);
  const newPinSlot = await protectBytes(newPinKey, dek);
  const verifyKey = await derivePinProtectorKey(newPin, newSalt, PIN_KDF_ITERATIONS);
  const verifyDek = await unprotectBytes(verifyKey, newPinSlot);
  if (!bytesEqual(verifyDek, dek)) throw new Error("New PIN verification failed — the recovery string was correct, but nothing else was changed. Try again.");
  // biometric (if set) is deliberately left untouched — it wraps the
  // Data Key via the device key, not the PIN, so it's independent of
  // which PIN is active and keeps working exactly as before.
  const graceMinutes = meta.graceMinutesPref || 0;
  writeVaultMeta({ ...meta, device: null, pin: { slot: newPinSlot, salt: bytesToBase64(newSalt), iterations: PIN_KDF_ITERATIONS }, tempGrace: null });
  activeDataKey = await importDataKey(dek);
  if (graceMinutes > 0) await refreshGraceWindow(dek, graceMinutes);
}

export function disableBiometricSlot() {
  const meta = readVaultMeta();
  if (meta?.biometric) {
    meta.biometric = null;
    writeVaultMeta(meta);
  }
}

// Sync — AppLockScreen's own mount effect uses this directly (not
// PrivacySettingsRepository's `biometricUnlockEnabled` flag) to decide
// whether to auto-prompt, precisely because that flag lives in
// encrypted storage this screen can't read yet. The slot's own
// presence IS the real fact; no separate mirrored boolean needed.
export function hasBiometricSlot() {
  return !!readVaultMeta()?.biometric;
}

export async function unlockWithBiometric() {
  const meta = readVaultMeta();
  if (!meta?.biometric) throw new Error("Biometric unlock is not set up.");
  const deviceKey = await getDeviceProtectorKey();
  const dek = await unprotectBytes(deviceKey, meta.biometric);
  activeDataKey = await importDataKey(dek);
  const graceMinutes = meta.graceMinutesPref || 0;
  if (graceMinutes > 0) await refreshGraceWindow(dek, graceMinutes);
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// --- Real data encrypt/decrypt — what storageAdapter.js actually
// calls on every load()/save(). ---

export async function encryptForStorage(plainString) {
  if (!activeDataKey) throw new Error("Vault is not unlocked — cannot encrypt.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, activeDataKey, new TextEncoder().encode(plainString));
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertextBuf)) };
}

export async function decryptFromStorage(shape) {
  if (!activeDataKey) throw new Error("Vault is not unlocked — cannot decrypt.");
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(shape.iv) }, activeDataKey, base64ToBytes(shape.ciphertext));
  return new TextDecoder().decode(plainBuf);
}

// Shape-detector for storageAdapter.js's own migration logic — a
// plain object with exactly these two string keys and nothing else
// recognizable as real app data (a real record is virtually never
// shaped this way, since `iv`/`ciphertext` aren't real field names
// used anywhere else in this app's own schemas — confirmed by grep
// before relying on it).
export function isEncryptedShape(value) {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && typeof value.iv === "string" && typeof value.ciphertext === "string"
    && Object.keys(value).length === 2;
}

export function vaultExists() {
  return !!readVaultMeta();
}

// --- Eager, verified one-time migration — the owner's own explicit
// choice over the lazy/organic alternative (see CLAUDE.md's Phase 4
// scoping entry for the full trade-off writeup). Walks every real
// `shos_`-prefixed key still in plain JSON and encrypts it, one at a
// time, verifying each one by reading it straight back and decrypting
// it BEFORE moving on — if that verification ever fails, the original
// plaintext bytes (still held in `originalRaw`, never discarded until
// this point) are written straight back, and the whole pass aborts
// without setting the completion flag, so a future boot retries
// cleanly rather than resuming into unknown state. Idempotent by
// construction: an already-encrypted key is a silent no-op skip, so
// a migration interrupted partway through (a real crash, the tab
// closing) just finishes the remaining keys next time, never redoing
// or double-encrypting ones already done. Vault must already be
// unlocked (App.jsx's own boot sequence guarantees this — migration
// only ever runs after bootUnlock()/unlockWithPin() succeeds). ---

export function isMigrationNeeded() {
  const meta = readVaultMeta();
  return !!meta && !meta.migrated;
}

export async function runMigrationIfNeeded() {
  const meta = readVaultMeta();
  if (!meta || meta.migrated) return { ran: false, migratedCount: 0 };
  if (!activeDataKey) throw new Error("Vault must be unlocked before migration can run.");

  // Real, previously-missing safety net — the original Phase 4 design
  // explicitly promised this ("automatically export a real full backup
  // first, reusing the existing exportBackup()") but it never actually
  // got wired in; caught before recommending this branch for merge,
  // given the real stakes (this runs against the owner's own actual
  // device data, and once a key here re-encrypts under the new device-
  // bound key, the ORIGINAL plaintext bytes are gone for good). The
  // per-key verify-and-restore below only protects against a corrupted
  // WRITE during this exact operation — it does nothing for a real
  // decrypt bug discovered later, or for the device-bound key itself
  // becoming unrecoverable (IndexedDB cleared/reset/a new device) —
  // both of those need a real, external copy of the plaintext to
  // recover from, which only a genuine backup FILE provides. Dynamic
  // import, not a static one: backupService.js imports storageAdapter.js,
  // which imports this file — a static import here would be a real
  // circular dependency. Deliberately non-blocking: a failed backup
  // (permission denied, no user gesture context, anything else) is
  // logged clearly but doesn't stop the migration itself — refusing to
  // ever encrypt the owner's data over a failed CONVENIENCE backup
  // would be a worse outcome than proceeding with the per-key safety
  // net that already exists below.
  try {
    const { exportBackup } = await import("./backupService.js");
    await exportBackup();
  } catch (err) {
    console.error("[cryptoService] Pre-migration safety backup failed — proceeding with migration anyway (the per-key verify-and-restore below still applies). Consider exporting a manual backup from Settings if this keeps happening:", err);
  }

  const candidateKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("shos_") && key !== VAULT_KEY) candidateKeys.push(key);
  }

  let migratedCount = 0;
  for (const key of candidateKeys) {
    const originalRaw = localStorage.getItem(key);
    if (originalRaw === null) continue;
    let parsed;
    try {
      parsed = JSON.parse(originalRaw);
    } catch {
      // Not real JSON — not a shape this app's own storage.save() ever
      // produces, so not ours to migrate. Left untouched.
      continue;
    }
    if (isEncryptedShape(parsed)) continue; // already migrated — no-op skip

    const plainString = JSON.stringify(parsed);
    const encrypted = await encryptForStorage(plainString);
    localStorage.setItem(key, JSON.stringify(encrypted));

    try {
      const verifyRaw = localStorage.getItem(key);
      const verifyParsed = JSON.parse(verifyRaw);
      const verifyPlain = await decryptFromStorage(verifyParsed);
      if (verifyPlain !== plainString) throw new Error("decrypted value did not match the original");
    } catch (err) {
      // Real safety net: restore the exact original bytes and abort
      // the whole pass rather than continuing past a key that didn't
      // verify. `meta.migrated` is never set here, so the next real
      // boot retries this same key (and any not yet reached) cleanly.
      localStorage.setItem(key, originalRaw);
      throw new Error(`Migration failed verifying "${key}" — restored the original value, nothing else was changed. (${err.message})`);
    }
    migratedCount++;
  }

  const freshMeta = readVaultMeta();
  freshMeta.migrated = true;
  writeVaultMeta(freshMeta);
  return { ran: true, migratedCount };
}
