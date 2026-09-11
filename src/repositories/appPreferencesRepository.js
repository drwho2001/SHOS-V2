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
  // ADDED 9 Sep 2026 — real ask: an interactive spotlight-overlay tour
  // (InteractiveTour.jsx), not just the static Guide screen. Same
  // "never auto-set true by anything else" rule as hasCompletedOnboarding
  // above — only the tour's own Skip/Done actions ever set this.
  // Replayable anytime from Settings > Guide regardless of this flag.
  hasCompletedTour: false,
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
  // ADDED — real ask from a security audit finding: a synced event's
  // title is normally the Clinic Visit's own free-text title (whatever
  // the user typed — could be explicit), and that title can surface on
  // a lock-screen notification or a synced calendar's own smart
  // features regardless of the target calendar's sharing settings
  // (which the warning above already covers) — a separate risk this
  // doesn't. Off by default (real titles, matching this feature's
  // existing behavior) — turning it on makes every synced event use a
  // generic "Clinic appointment" title instead, see
  // calendarSyncService.js's syncOneVisit().
  calendarSyncGenericTitle: false,
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
  // ADDED — real ask: "option/button to hide pregnancy tab if toggled
  // on" — the existing "Show pregnancy tracking anyway" link (see
  // SHOS_MenstrualHealth_Prototype.jsx) already covers the opposite
  // case (gender-based default hides it, show it anyway for THIS
  // session only). This is the persisted mirror for someone who wants
  // it gone for good regardless of gender default — e.g. assigned
  // female but pregnancy tracking genuinely doesn't apply. Never blocks
  // a direct deep-link to an already-existing record — same "never a
  // true hard block on your own real data" rule the gender default
  // already follows.
  pregnancyTrackingHidden: false,
  // ADDED — real ask, from a build audit: address lookup ("use current
  // location", address autocomplete) sends real, user-typed or GPS
  // location data to the public OpenStreetMap Nominatim server, and the
  // update-check pings GitHub's API — both real, previously undisclosed
  // network calls in an app whose whole framing is "on-device only,
  // privacy paramount". Both default ON (they're genuinely useful, and
  // Nominatim/GitHub are reasonable, minimal-data third parties, not a
  // hidden risk) — this is about disclosure and control, not distrust
  // by default. See locationService.js's own gating and Settings' own
  // disclosure copy for exactly what's sent where.
  addressLookupEnabled: true,
  updateCheckEnabled: true,
  // ADDED — real ask: "first day of week preference (Sunday/Monday)".
  // "monday" is the default (UK-first app, ISO 8601 convention) —
  // only the in-app Calendar grid (Settings > Calendar) reads this;
  // nothing else in the app renders a week-start-dependent grid.
  weekStartsOn: "monday",
  // ADDED — real ask: "DoxyPEP overdue banner needs a dismiss option
  // (temporary and/or permanent)". This is the "permanent" half —
  // NOT the same as doxyPepAlertEnabled (that's the global native-
  // notification switch, see notificationPreferencesRepository.js) and
  // NOT the same as logging/snoozing a dose (doxyPepSync.js already
  // covers that) — this is "stop showing me the in-app warning for
  // THIS specific overdue exposure window", scoped by keying off
  // getDoxyPepStatus()'s own windowStart (doxyPepCalculations.js):
  // the earliest qualifying encounter since the last logged dose,
  // which changes the moment a new window opens (next qualifying
  // encounter after a dose is logged) — so this naturally goes stale
  // and stops applying on its own once that happens, no cleanup
  // needed. null = nothing dismissed.
  doxyPepOverdueDismissedWindowStart: null,
  // ADDED 9 Sep 2026 — real ask (18 Aug 2026 — the "tab reorder"
  // part of the original "adjust per-module accent colors, font, and
  // (low priority) tab reorder" Settings/Management ask). null = the
  // app's own built-in default order. A real value is an array of the
  // 4 non-Home tab keys ("contacts"/"activity"/"medication"/
  // "healthcare") in the order the user wants them — Home is
  // deliberately never part of this array, since it always stays
  // fixed in the centre position with its own raised-circle treatment
  // (see App.jsx's own getOrderedTabs() for why reordering only ever
  // touches the other 4). App.jsx validates this is still a real
  // permutation of exactly those 4 keys before trusting it, the same
  // "don't trust a stale/corrupt stored value" rule already applied to
  // lastActiveTab.
  tabOrder: null,
  // ADDED 10 Sep 2026 — real ask: show Dom/sub (bdsmRole) and Top/
  // bottom (sexualPosition) on the Contacts LIST card, not just the
  // profile detail view (both fields already existed and were already
  // shown there). Off by default, deliberately opt-in — this is more
  // sensitive at-a-glance than the relationship-type chips already on
  // the card (visible the instant the list is scanned, not one tap
  // in), same "opt-in for anything more exposing" precedent as App
  // Lock/calendar sync/encrypted export elsewhere in this file.
  showRoleOnContactCards: false,
};

export const AppPreferencesRepository = {
  // CHANGED — Phase 2 encryption groundwork (Sep 2026): both methods
  // now `async`, `await`ing storage.load()/save() even though
  // storageAdapter itself is still 100% synchronous today — same
  // no-op-await approach as every other repository this session. This
  // repository was missed from every earlier Phase 2 inventory (reads
  // fresh per call, no module-load caching to grep for) — found only
  // while scoping Phase 3. Its `lastActiveTab`/`lastActiveAt` feed
  // App.jsx's `active` bootstrap state, already deliberately kept
  // synchronous after an earlier attempt to convert it corrupted real
  // stored data under StrictMode's double-invoke — see App.jsx's new
  // `bootReady` gate, built alongside this conversion, for the fix.
  async getPreferences() {
    const stored = await storage.load(STORAGE_KEY, DEFAULT_APP_PREFERENCES);
    return { ...DEFAULT_APP_PREFERENCES, ...stored };
  },

  async update(changes) {
    const updated = { ...(await this.getPreferences()), ...changes };
    await storage.save(STORAGE_KEY, updated);
    return updated;
  },
};
