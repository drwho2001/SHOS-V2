// appPreferencesRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Settings → Preferences had been sitting fully stubbed all session —
// nothing real to build until the user had a concrete ask. This is the
// first one: the Contacts "inactive" threshold (hardcoded at 90 days)
// made configurable. Deliberately its own small singleton repository
// (same pattern as myProfileRepository.js/privacySettingsRepository.js)
// rather than bolting this one setting onto an unrelated file — this
// is the real, extensible home for whatever Preferences items come
// next, not a one-off.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_app_preferences";

export const DEFAULT_APP_PREFERENCES = {
  // Days since last Encounter before a Contact shows as "inactive"
  // (the red dot). Was hardcoded at 90 — real ask to make this a
  // genuine preference.
  inactiveThresholdDays: 90,
  // ADDED 26 Aug 2026 — real ask: onboarding, deliberately built last
  // per the user's own ordering ("comes after all features made") — a
  // walkthrough is only worth building once there's something real to
  // walk through. false until the user actually completes or
  // explicitly skips it — never auto-set true by anything else.
  hasCompletedOnboarding: false,
  // ADDED — real ask: "calendar sync could be good, if ensured kept
  // separate/private and never accidentally shared." Off by default,
  // same as every other opt-in privacy-adjacent feature in this app
  // (App Lock, biometrics, encrypted export) — see
  // calendarSyncService.js for the real device/permission check that
  // happens at toggle-on time, and the honest local-only-calendar
  // guarantee behind "never accidentally shared".
  calendarSyncEnabled: false,
};

export const AppPreferencesRepository = {
  getPreferences() {
    const stored = storage.load(STORAGE_KEY, DEFAULT_APP_PREFERENCES);
    return { ...DEFAULT_APP_PREFERENCES, ...stored };
  },

  update(changes) {
    const updated = { ...this.getPreferences(), ...changes };
    storage.save(STORAGE_KEY, updated);
    return updated;
  },
};
