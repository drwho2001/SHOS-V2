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
  // ADDED — real follow-up ask: "I still want to have the option to
  // share with a calendar" — null/empty means the private SHOS
  // calendar (the safe default); a real value is the exact name of an
  // existing device calendar to sync into instead, picked from
  // calendarSyncService.js's own listAvailableCalendars(). Settings'
  // own UI shows a real warning before this can be set to anything
  // but the default — see that screen's own comment for why.
  calendarSyncTargetName: null,
  // ADDED — real ask: "scheduled auto-export" as a genuine backlog item
  // alongside the manual export/backup already built — the existing
  // reminder (BACKUP_REMINDER_DAYS, backupService.js) only ever nags
  // you to export by hand; this actually does it, unattended. Off by
  // default, same as every other opt-in feature in this app — see
  // backupService.js's runAutoExportIfDue() for the real mechanism
  // (writes straight to the public Documents folder, no share sheet,
  // no dialog).
  autoExportEnabled: false,
  autoExportIntervalDays: 30,
  // ADDED — real ask: "opening back to last page" instead of always
  // landing on Home. NOT a user-facing setting shown anywhere in
  // Settings — automatically maintained navigation state, same
  // "internal timestamp, not a preference" role as PrivacySettings-
  // Repository's own lastUnlockedAt. App.jsx keeps this in sync on
  // every tab change and refreshes lastActiveAt again on backgrounding,
  // then reads both back on next launch — see App.jsx's own
  // RESUME_GRACE_MINUTES comment for the actual grace-window mechanism
  // (deliberately the same shouldRelock()-style pattern App Lock's own
  // grace period already uses, not a new concept).
  lastActiveTab: null,
  lastActiveAt: null,
  // ADDED — real ask: Menstrual/Contraception/Pregnancy tracking,
  // gated behind this toggle rather than gender — gender only
  // suggests turning it on (see SHOS_MyProfile_Prototype.jsx), never
  // forces it, since menopause HRT/TRT tracking already established
  // that gender-based assumptions don't hold for who needs what here.
  // Off by default, same as every other opt-in feature area in this
  // app (App Lock, calendar sync, encrypted export).
  menstrualTrackingEnabled: false,
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
