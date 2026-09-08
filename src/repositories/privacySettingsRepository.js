// privacySettingsRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Anonymise mode — the user's real, scoped ask: "no anonymous never as
// default - just allows if someone hands phone over. Anonymising
// button, maybe with pin to unlock/revert." A single deliberate
// toggle you tap right before handing your phone over, that masks
// specific identifying fields until you tap it back off — gated by an
// optional PIN so whoever you handed the phone to can't just tap it
// straight back off themselves.
//
// SCOPE, stated plainly: this is NOT a security feature in the
// cryptographic sense — the PIN is a plain stored string, not hashed,
// because the actual threat model here is "someone briefly holding my
// unlocked phone," not "someone with access to the device's storage."
// A determined attacker with storage access could read the PIN
// directly; that's an accepted, correctly-scoped limitation given what
// this feature is actually for, not an oversight. This app has no
// broader authentication system to hook into (Architecture Lock's own
// scope never included one), so building real cryptographic PIN
// verification here would be a disproportionate amount of new
// infrastructure for what's genuinely a "quick, opt-in, no-default"
// glance-shield, not an access-control system.
//
// TWO TIERS, per the user's exact wording:
// - Base tier (always masked when anonymiseModeActive): name, address/
//   city, profile picture, car registration.
// - "Hide further" tier (masked ADDITIONALLY when hideFurtherEnabled
//   is also on): kinks (Stated Kinks/Limits) and physical attributes
//   (Cummer stats, Length/Girth).
// Both tiers were originally scoped to Contacts only — those are the
// fields the user actually named, and they're all Contact-specific
// (this app's own Notion-confirmed schema has no address/car-
// registration field anywhere else).
//
// UPDATED 8 Sep 2026 — real report: Contacts masked, but Encounters
// still showed the same linked contact's real name on cards and in
// the detail view — the same identity this mode exists to hide, just
// reachable from a different module. Encounters now also reads
// anonymiseModeActive and masks resolved attendee names (see
// SHOS_Encounters_Prototype.jsx's EncounterCard/ActivityDetails) —
// narrowly, matching only what was reported (name), not location or
// kinks-involved. My Profile and other modules remain untouched — no
// real ask for those yet.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";
import { getDuressPin, setDuressPinMirror, getGraceMinutesPref, setGraceMinutesPref } from "../storage/cryptoService.js";

const STORAGE_KEY = "shos_privacy_settings";

export const DEFAULT_PRIVACY_SETTINGS = {
  anonymiseModeActive: false,
  anonymisePin: "",
  hideFurtherEnabled: false,
  // ADDED 19 Aug 2026 — App Lock, real ask: gate opening the app
  // itself behind a PIN, distinct from Anonymise mode (which masks
  // specific fields while the app IS open and handed over — App Lock
  // stops it being opened at all without you). Deliberately REUSES
  // `anonymisePin` rather than adding a second PIN field/flow — same
  // person, same device, no real reason to manage two separate codes
  // for two related privacy actions; keeps the cost of building this
  // low without losing anything real.
  // Both this and Anonymise mode stay fully optional, never on by
  // default, per the user's explicit instruction.
  appLockEnabled: false,
  // ADDED — real ask: biometric unlock (fingerprint/face), via
  // @aparajita/capacitor-biometric-auth — see biometricAuthService.js.
  // A convenience layered ON TOP of App Lock's own PIN, never a
  // replacement: can only be turned on once appLockEnabled is already
  // true, and the PIN field on the lock screen always still works
  // even when this is on. Real device/enrollment check happens at
  // toggle-on time (see PrivacyScreen) and again on every lock-screen
  // mount, not just assumed from this stored flag.
  biometricUnlockEnabled: false,
  // ADDED 19 Aug 2026 — real ask: prompt about App Lock during setup
  // if it isn't already on, keep prompting on future launches until
  // "don't show again" is explicitly tapped — NOT the same as just
  // dismissing the prompt once (see AppLockPrompt in App.jsx). Kept as
  // its own separate flag from appLockEnabled itself, since "I don't
  // want to be asked again" and "I don't want App Lock" are two
  // genuinely different facts — someone could permanently dismiss the
  // prompt while still deciding to turn App Lock on later via Settings
  // directly.
  appLockPromptDismissed: false,
  // ADDED — real ask: "lock again after close/screen timeout by
  // default, but allow toggle to increase timer — if unlocked/opened
  // again within X minutes, don't need to re-verify." 0 (the default)
  // means the existing behaviour is unchanged — always re-lock. Set to
  // a real number of minutes and re-opening within that window skips
  // the PIN/biometric screen. lastUnlockedAt is what that window is
  // measured from — recorded on every successful unlock (PIN or
  // biometric), read alongside this in App.jsx's own lock check.
  appLockGraceMinutes: 0,
  lastUnlockedAt: null,
  // ADDED 1 Sep 2026 — real ask: a duress/decoy PIN. Entering THIS pin
  // on the App Lock screen instead of the real one opens a convincing
  // but entirely fake empty app (see DecoyHome in App.jsx) rather than
  // any real data — for the "someone is making me unlock my phone"
  // scenario, distinct from Anonymise mode above (which still shows
  // real data, just masked, and needs the app already open). Kept as
  // its own separate PIN, NOT reusing anonymisePin the way App Lock
  // does — the whole mechanism only works if the real PIN and the
  // decoy PIN are two different codes.
  // CHANGED — Phase 4 (Sep 2026): the REAL value now lives in
  // cryptoService.js's own unencrypted vault metadata, not here — see
  // that file's own header for why (it has to be checkable before the
  // vault unlocks, and this repository's own data is what the vault
  // protects). This default stays purely for shape consistency;
  // getSettings()/update() below always resolve the real value through
  // cryptoService, never from whatever's actually stored under this key.
  duressPin: "",
};

export const PrivacySettingsRepository = {
  // CHANGED — Phase 2 encryption groundwork (Sep 2026): every method
  // below is now `async`, `await`ing storage.load()/save() even though
  // the underlying storageAdapter is still 100% synchronous today —
  // same "no-op await, proves the pattern ahead of Phase 3" approach
  // used for customGroupsRepository/trashRepository/etc. This
  // repository was missed from every earlier Phase 2 inventory (it
  // reads fresh per call, no module-load caching, so it never matched
  // any of the grep patterns used to find the original 22-file hard
  // bucket) — found only while scoping Phase 3 itself. Its own real
  // complication: `shouldRelock()` gates App.jsx's `locked` bootstrap
  // state, which was already deliberately kept synchronous (see
  // App.jsx's own comment) specifically to avoid a lock-screen flash —
  // converting this repository without a real app-loading gate would
  // have reopened that exact problem. See App.jsx's new `bootReady`
  // gate, built alongside this conversion, for the fix.
  // CHANGED — Phase 4 (Sep 2026): `duressPin` is now resolved from
  // cryptoService's own unencrypted vault metadata, never from this
  // repository's own (encrypted) storage — see cryptoService.js's own
  // header and DEFAULT_PRIVACY_SETTINGS' comment above for why. The
  // self-heal below handles a profile that had already set a real
  // duress PIN or grace period BEFORE this mirror existed: the very
  // first time this runs after unlock, if cryptoService's own mirror
  // is still empty but the (now-decrypted) stored value isn't, it
  // adopts it — a one-time, idempotent recovery, not an ongoing sync.
  // Safe against ever resurrecting a value the user deliberately
  // cleared afterward: update() below always writes both copies
  // together from that point on, so once cleared, `stored.duressPin`
  // is "" too and this condition never fires again for it.
  async getSettings() {
    const stored = await storage.load(STORAGE_KEY, DEFAULT_PRIVACY_SETTINGS);
    const merged = { ...DEFAULT_PRIVACY_SETTINGS, ...stored };
    if (!getDuressPin() && merged.duressPin) setDuressPinMirror(merged.duressPin);
    if (!getGraceMinutesPref() && merged.appLockGraceMinutes) setGraceMinutesPref(merged.appLockGraceMinutes);
    return { ...merged, duressPin: getDuressPin() };
  },

  async update(changes) {
    if (changes.duressPin !== undefined) setDuressPinMirror(changes.duressPin);
    if (changes.appLockGraceMinutes !== undefined) setGraceMinutesPref(changes.appLockGraceMinutes);
    const stored = await storage.load(STORAGE_KEY, DEFAULT_PRIVACY_SETTINGS);
    const updated = { ...DEFAULT_PRIVACY_SETTINGS, ...stored, ...changes };
    await storage.save(STORAGE_KEY, updated);
    return { ...updated, duressPin: getDuressPin() };
  },

  // Called the moment App Lock is actually passed (PIN or biometric) —
  // the one timestamp both the initial-mount check and the resume-
  // from-background check in App.jsx measure the grace window from.
  async recordUnlock() {
    return this.update({ lastUnlockedAt: new Date().toISOString() });
  },

  // Single source of truth for "should the lock screen show right
  // now" — used both on app mount and every time the app resumes from
  // the background, so the two checks can never quietly drift apart.
  async shouldRelock() {
    const settings = await this.getSettings();
    if (!settings.appLockEnabled) return false;
    if (!settings.appLockGraceMinutes || settings.appLockGraceMinutes <= 0) return true;
    if (!settings.lastUnlockedAt) return true;
    const elapsedMs = Date.now() - new Date(settings.lastUnlockedAt).getTime();
    return elapsedMs > settings.appLockGraceMinutes * 60000;
  },

  // Turning ON never needs a PIN — that's the whole point, it has to
  // be fast in the moment you're handing the phone over.
  async activate() {
    return this.update({ anonymiseModeActive: true });
  },

  // Turning OFF checks the PIN IF one has been set. No PIN set yet —
  // reverts directly (won't lock the user out of his own app for
  // forgetting to set one first) — the Privacy screen nudges him to
  // set one so this gate is actually meaningful going forward.
  async deactivate(enteredPin) {
    const settings = await this.getSettings();
    if (settings.anonymisePin && enteredPin !== settings.anonymisePin) {
      return { ok: false, error: "Incorrect PIN." };
    }
    await this.update({ anonymiseModeActive: false });
    return { ok: true };
  },

  // REMOVED — Phase 4 (Sep 2026): checkAppLockPin()/classifyAppLockPin()
  // used to be App Lock's own real/duress/wrong PIN check. Both are
  // gone now that nothing can call them before the vault is unlocked
  // (they read this repository's own encrypted data) — App.jsx's
  // AppLockScreen now checks the duress PIN via
  // cryptoService.getDuressPin() directly (pre-unlock-safe, see that
  // file's header) and treats a successful cryptoService.unlockWithPin()
  // call itself as "the real PIN" — a wrong PIN fails AES-GCM's own
  // authentication rather than a separate string comparison. See
  // cryptoService.js's own header for the full reasoning.

  // Real validation, not just "non-empty": a duress PIN identical to
  // the real one would make the whole feature a no-op (every unlock
  // would be treated as the real PIN), and an empty string would mean
  // cryptoService.getDuressPin()'s own `if (pin && ...)` guard (see
  // App.jsx's AppLockScreen) never matches it at all — effectively
  // silently not-set even if this were allowed to save. Returns
  // { ok, error } rather than throwing, matching
  // deactivate()'s own pattern above, so the Settings UI can show
  // exactly why a save was rejected.
  async setDuressPin(newPin) {
    const settings = await this.getSettings();
    if (!settings.anonymisePin) return { ok: false, error: "Set your real PIN first." };
    if (!newPin || !newPin.trim()) return { ok: false, error: "Enter a PIN." };
    if (newPin === settings.anonymisePin) return { ok: false, error: "Must be different from your real PIN." };
    await this.update({ duressPin: newPin });
    return { ok: true };
  },

  async clearDuressPin() {
    await this.update({ duressPin: "" });
  },
};
