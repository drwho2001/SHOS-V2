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
// cryptographic sense at the anonymise-toggle layer — the App Lock PIN is
// now a PBKDF2 verifier (t131), not a plain string, but the anonymise
// mode PIN comparison at this layer is still a string compare scoped to
// "someone briefly holding my unlocked phone." A determined attacker with
// storage access could still read the (encrypted) settings blob; that is
// an accepted, correctly-scoped limitation given what this feature is
// actually for, not an oversight. This app has no
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
import {
  getDuressVerifier,
  setDuressPinMirror,
  getGraceMinutesPref,
  setGraceMinutesPref,
  createPinVerifier,
  verifyPinVerifier,
} from "../storage/cryptoService.js";

const STORAGE_KEY = "shos_privacy_settings";

export const DEFAULT_PRIVACY_SETTINGS = {
    anonymiseModeActive: false,
    // CHANGED 21 Oct 2026 (t131) - the App Lock PIN is now stored as a
    // PBKDF2 VERIFIER, in `anonymisePinVerifier` below, and this field no
    // longer holds a PIN. It is kept ONLY as the legacy field a migration
    // reads once: a profile written before t131 has the raw PIN here, and
    // the first read converts it to a verifier and clears it (see
    // getSettings()). Keeping the key means an old record still loads; the
    // value it holds is not written back.
    anonymisePin: "",
    // CHANGED 21 Oct 2026 (t131) - THE APP LOCK PIN IS A VERIFIER NOW, NOT
    // A STRING. Two things were fixed by it, and one thing was given up.
    //
    // FIXED: the string comparison it fed. deactivate() compared the typed
    // PIN to the stored one with `enteredPin !== storedPin`, which is a
    // FREE ORACLE for a four-digit PIN to anything that can call it in
    // the page - ten thousand attempts, each a comparison, no PBKDF2 in
    // the way. setDuressPin() had the same comparison, so it was a second
    // oracle on the same secret.
    //
    // FIXED: the PIN AT REST. The settings blob is encrypted, so the raw
    // PIN was not plaintext - but a PIN that is stored at all is a PIN
    // that can be read out of a backup, a sync, a shared storage
    // directory, or a decrypted settings object. A verifier proves a PIN
    // without keeping it.
    //
    // GIVEN UP: the raw PIN no longer exists to hand to the vault, so the
    // five privileged actions - turning App Lock off, changing the PIN,
    // setting the recovery string, enabling biometrics - now ask for the
    // PIN to be RE-TYPED. That is not only a cost. Those actions re-wrap
    // the vault's Data Key, and the App Lock grace window means the app
    // can be open without anyone having typed the PIN for a while; asking
    // again is the confirmation that the person at the keyboard is the
    // person who knows the PIN, and not just the person who was holding
    // the phone earlier.
    anonymisePinVerifier: null,
    hideFurtherEnabled: false,
    // ADDED 29 Sep 2026 - the owner's own ask, and deliberately NOT a
    // boolean: "levels of disclosure/sensitivity" on the surfaces OUTSIDE
    // the app (lock-screen notifications, home-screen widgets).
    //
    // THIS IS NOT ANOTHER ANONYMISE MODE. Anonymise mode is a temporary
    // "someone is making me unlock my phone" state, switched on and off
    // around one situation, and it masks fields INSIDE the app. This is a
    // PERSISTENT statement of how much this app is allowed to show when you
    // are not looking at it, and it governs content the app hands to the OS.
    // They are different axes and both are needed - the two existing fields
    // above stay exactly as they are.
    //
    // Default is the most restrictive value, which is a decision rather than
    // a shrug: a lock screen and a home screen are the two places someone
    // else can see your phone without unlocking it, and encryption at rest
    // protects neither. Masked-by-default also matches what the widgets were
    // built to do, so the setting confirms the existing behaviour instead of
    // quietly changing it on first run.
    disclosureLevel: "masked",
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
  // ADDED — real ask: an "allow screenshots" toggle, default OFF
  // (screenshots/screen-recording blocked) — matches this app's own
  // existing always-on FLAG_SECURE default (see MainActivity.java's own
  // comment on why that's the baseline). Turning this ON is a genuine,
  // deliberate opt-out of that protection, same "off by default, real
  // choice to turn on" framing as every other privacy-relaxing toggle
  // in this app. Native (Android) only — there's no equivalent
  // screenshot-blocking mechanism to toggle on the web/PWA build in the
  // first place, so this stays inert there; see
  // screenSecurityService.js for the real native bridge.
  allowScreenshots: false,
};

/**
 * The shape the settings object is handed out in.
 *
 * ADDED 20 Oct 2026 (t126). getSettings() and update() both return this
 * instead of the stored object, and the difference is the two raw secrets:
 * the App Lock PIN and the duress PIN. A screen that only needs to know
 * WHETHER a PIN is set now gets a boolean.
 *
 * CHANGED 21 Oct 2026 (t131): there is no longer a "raw values are fetched
 * through getAppLockPin() by the one place that needs them" - the App Lock
 * PIN is a VERIFIER now, so there is no raw value left to fetch, and the
 * verifier is stripped here too (a verifier is a credential equivalent).
 * The duress PIN is still fetched as a raw value, by cryptoService's own
 * mirror, which is the pre-unlock path the duress feature needs.
 *
 * This is not a cosmetic change to a return type. The settings object is
 * read all over the app - the Privacy screen, the App Lock prompt, the boot
 * check, the backup exporter - and every one of those reads was a read of
 * the PIN in cleartext, whether or not that reader had any use for it.
 */
function redactPins(settings) {
  if (!settings || typeof settings !== "object") return settings;
  const { anonymisePin, anonymisePinVerifier, duressPin, ...rest } = settings;
  return {
    ...rest,
    // CHANGED 21 Oct 2026 (t131): the VERIFIER is stripped too, and it has
    // to be - a verifier is a credential equivalent (it proves a PIN to
    // whoever holds it), so handing it to every screen that reads the
    // settings would be handing the PIN itself back out, just in a form
    // that takes a few minutes to brute-force instead of no time at all.
    hasAppLockPin: Boolean(anonymisePin || anonymisePinVerifier),
    hasDuressPin: Boolean(duressPin),
  };
}

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
    // CHANGED 20 Oct 2026 (t126): the mirror now holds a VERIFIER rather
    // than the PIN itself, and writing it is asynchronous (it derives).
    if (!getDuressVerifier() && merged.duressPin) await setDuressPinMirror(merged.duressPin);
    if (!getGraceMinutesPref() && merged.appLockGraceMinutes) setGraceMinutesPref(merged.appLockGraceMinutes);
    // CHANGED 21 Oct 2026 (t131) - THE APP LOCK PIN'S ONE-TIME MIGRATION.
    // A profile written before t131 has the raw PIN in `anonymisePin`. It
    // is converted to a verifier here and the raw value is CLEARED, so the
    // PIN stops being readable at rest the first time the app runs after
    // the update. Idempotent: once the verifier exists and the raw field
    // is empty, this does nothing - and it never runs again, because
    // update() below writes the verifier and an empty raw field together.
    if (merged.anonymisePin && !merged.anonymisePinVerifier) {
      const verifier = await createPinVerifier(merged.anonymisePin);
      const migrated = { ...merged, anonymisePinVerifier: verifier, anonymisePin: "" };
      await storage.save(STORAGE_KEY, migrated);
      return redactPins(migrated);
    }
    return redactPins(merged);
  },

  /**
   * Is this the App Lock PIN?
   *
   * CHANGED 21 Oct 2026 (t131) - this replaces the raw-PIN getter, and it
   * exists because of the ORACLE. The old comparison was
   * `enteredPin !== storedPin`, which tells an in-page caller whether a
   * guess was right in the time it takes to compare two strings - ten
   * thousand candidates is nothing. A verifier comparison does a PBKDF2
   * derivation per attempt, and the stored value never reveals the PIN.
   *
   * @param {string} pin
   * @returns {Promise<boolean>}
   */
  async verifyAppLockPin(pin) {
    if (!pin) return false;
    // getSettings() is called first on purpose: it runs the one-time
    // migration, so by the time the stored value is read there is a
    // verifier and no raw PIN - including on a profile that has not been
    // opened since the update.
    const settings = await this.getSettings();
    if (!settings.hasAppLockPin) return false;
    const stored = await storage.load(STORAGE_KEY, DEFAULT_PRIVACY_SETTINGS);
    return verifyPinVerifier(pin, stored?.anonymisePinVerifier);
  },

  /**
   * The raw App Lock PIN.
   *
   * REMOVED 21 Oct 2026 (t131). It existed so that the one place that
   * genuinely needed the PIN as key material - the vault's re-wrapping -
   * could fetch it, and it was a getter that handed a secret to whoever
   * asked. The PIN is now a verifier, so there is nothing to hand over:
   * the vault's actions take the PIN the USER types, and the check that
   * the typed PIN is right is verifyAppLockPin()'s.
   *
   * The old method's own comment explained why it was a separate call
   * rather than a field on the settings object, and that reasoning still
   * holds - it is just that the value it returned no longer exists.
   */

  async update(changes) {
    if (changes.duressPin !== undefined) await setDuressPinMirror(changes.duressPin);
    if (changes.appLockGraceMinutes !== undefined) setGraceMinutesPref(changes.appLockGraceMinutes);
    const stored = await storage.load(STORAGE_KEY, DEFAULT_PRIVACY_SETTINGS);
    let next = { ...DEFAULT_PRIVACY_SETTINGS, ...stored, ...changes };
    // CHANGED 21 Oct 2026 (t131) - A CALLER CANNOT STORE A RAW PIN ANY
    // MORE. The PIN is written as `anonymisePin` by exactly one caller
    // (the Settings screen's "set PIN" flow), and this turns it into a
    // verifier before it reaches storage - so the raw value never lands on
    // disk even for a moment, and a future caller passing a raw PIN by
    // mistake cannot put one there either. The legacy field is emptied
    // rather than deleted, so the record's shape does not change under the
    // defensive-default merge.
    if (changes.anonymisePin !== undefined) {
      next = {
        ...next,
        anonymisePinVerifier: changes.anonymisePin
          ? await createPinVerifier(changes.anonymisePin)
          : next.anonymisePinVerifier,
        anonymisePin: "",
      };
    }
    await storage.save(STORAGE_KEY, next);
    return redactPins(next);
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
    if (settings.hasAppLockPin) {
      // CHANGED 21 Oct 2026 (t131) - this used to be
      // `enteredPin !== storedPin`, a STRING COMPARISON against the stored
      // PIN. That made this method a free oracle: anything able to call it
      // in the page could try all ten thousand four-digit PINs, each one a
      // comparison, and be told which was right. It now verifies against
      // the PBKDF2 verifier instead - each attempt costs a derivation, and
      // the stored value never reveals the PIN.
      const ok = await this.verifyAppLockPin(enteredPin);
      if (!ok) {
        return { ok: false, error: "Incorrect PIN." };
      }
    }
    await this.update({ anonymiseModeActive: false });
    return { ok: true };
  },

  // REMOVED — Phase 4 (Sep 2026): checkAppLockPin()/classifyAppLockPin()
  // used to be App Lock's own real/duress/wrong PIN check. Both are
  // gone now that nothing can call them before the vault is unlocked
  // (they read this repository's own encrypted data) — App.jsx's
  // AppLockScreen now checks the duress PIN via
  // cryptoService.isDuressPin() directly (pre-unlock-safe, see that
  // file's header) and treats a successful cryptoService.unlockWithPin()
  // call itself as "the real PIN" — a wrong PIN fails AES-GCM's own
  // authentication rather than a separate string comparison. See
  // cryptoService.js's own header for the full reasoning.

  // Real validation, not just "non-empty": a duress PIN identical to
  // the real one would make the whole feature a no-op (every unlock
  // would be treated as the real PIN), and an empty string would mean
  // cryptoService.isDuressPin()'s own `if (!pin)` guard never matches it
  // at all — effectively silently not-set even if this were allowed to
  // save. Returns { ok, error } rather than throwing, matching
  // deactivate()'s own pattern above, so the Settings UI can show
  // exactly why a save was rejected.
  async setDuressPin(newPin) {
    const settings = await this.getSettings();
    if (!settings.hasAppLockPin) return { ok: false, error: "Set your real PIN first." };
    if (!newPin || !newPin.trim()) return { ok: false, error: "Enter a PIN." };
    // CHANGED 21 Oct 2026 (t131) - this used to compare the new PIN with
    // the stored one as STRINGS, which was the same oracle as deactivate()'s
    // - a second door to the same secret. It now asks the verifier whether
    // the new PIN IS the real PIN.
    if (await this.verifyAppLockPin(newPin)) return { ok: false, error: "Must be different from your real PIN." };
    await this.update({ duressPin: newPin });
    return { ok: true };
  },

  async clearDuressPin() {
    await this.update({ duressPin: "" });
  },
};
