// notificationPreferencesRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "unified notifications management in settings" — one place
// to turn each real reminder type on/off, rather than each one being
// buried in its own module with no visibility from anywhere else.
//
// SCOPE: this is the on/off + custom-offset switchboard only. It does
// NOT duplicate any actual scheduling logic — every sync file
// (doxyPepSync.js, testingReminderSync.js, refillReminderSync.js,
// clinicVisitReminderSync.js) still owns its own real data reads and
// notification scheduling; this repository is just the settings each
// of those checks before deciding whether to actually schedule
// anything. Medication dose reminders are the one exception: that
// toggle already existed in medicationPreferencesRepository.js before
// this file did, so it stays there rather than being duplicated here
// — the new Notifications screen just reads/writes both repositories
// in one place, same as it does for every other toggle.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_notification_preferences";

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  doxyPepAlertEnabled: true,
  testingReminderEnabled: true,
  refillReminderEnabled: true,
  // ADDED — real ask: reminders for an actual booked clinic
  // appointment (Clinic Visit with isFutureAppointment on), "24 & 2h
  // in advance (or custom)". Two independently toggleable/editable
  // reminders rather than an arbitrary list — covers the user's own
  // named example exactly, and two fixed slots is enough to always
  // know which notification id maps to which without needing to
  // schedule a variable number of native notifications per visit.
  clinicVisitReminderAEnabled: true,
  clinicVisitReminderAHours: 24,
  clinicVisitReminderBEnabled: true,
  clinicVisitReminderBHours: 2,
  // ADDED 3 Sep 2026 — real ask: "not requested again" dismissal for
  // Home's own permission-explainer nudge (see SHOS_Home_Prototype.jsx's
  // NotificationPermissionNudge) — a real user preference, not a
  // session-only flag, so choosing "Not now" once doesn't re-show the
  // same card on every single app open.
  permissionNudgeDismissed: false,
  // ADDED 3 Sep 2026 — real ask: a single master switch, distinct from
  // the 5 independent per-type toggles below it — every sync file
  // checks this FIRST, before its own type-specific toggle, so turning
  // it off suppresses everything at once without losing any
  // individual toggle's own state for when it's turned back on.
  masterEnabled: true,
  // ADDED 3 Sep 2026 — real ask: quiet hours. Stored as "HH:mm" 24h
  // local-time strings — deliberately NOT run through this app's own
  // fake-UTC stored-date convention (dateInputHelpers.js): this is a
  // recurring daily wall-clock window, not a specific dated moment, so
  // that whole convention doesn't apply here. A window that wraps
  // past midnight (e.g. 22:00-07:00) is valid and handled by the
  // isWithinQuietHours() check below.
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  // ADDED 3 Sep 2026 — real ask: a global temporary pause ("vacation
  // mode"), distinct from masterEnabled above — this is a DATED,
  // self-expiring pause (real ISO timestamp it lifts at) rather than a
  // permanent preference, and distinct from a single medication's own
  // "skip until tomorrow" (medicationPreferencesRepository.js), which
  // only ever covers one medication, one day. null = not paused.
  pausedUntil: null,
};

// ADDED 3 Sep 2026 — real ask: quiet hours. Real, correct handling of
// a window that wraps past midnight (e.g. 22:00-07:00) — a naive
// `start <= now <= end` string/number comparison breaks the moment the
// window crosses midnight, which is exactly the common case for quiet
// hours (overnight, not a same-day span). `at` is a real Date (the
// moment a notification would actually fire); compared against
// wall-clock HH:mm derived from ITS OWN local time (not "now") so this
// works correctly for a notification being scheduled in advance, not
// just an immediate one.
export function isWithinQuietHours(prefs, at) {
  if (!prefs.quietHoursEnabled) return false;
  const [startH, startM] = prefs.quietHoursStart.split(":").map(Number);
  const [endH, endM] = prefs.quietHoursEnd.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const atMinutes = at.getHours() * 60 + at.getMinutes();
  if (startMinutes === endMinutes) return false; // zero-length window — treat as "off" rather than "always on"
  if (startMinutes < endMinutes) {
    // Same-day window (e.g. 13:00-15:00).
    return atMinutes >= startMinutes && atMinutes < endMinutes;
  }
  // Wraps past midnight (e.g. 22:00-07:00).
  return atMinutes >= startMinutes || atMinutes < endMinutes;
}

// Given a moment that falls inside quiet hours, returns the real Date
// the window actually ends — the moment a deferred notification should
// fire instead, so nothing scheduled during quiet hours is silently
// dropped, only pushed to when it's actually allowed to show.
export function quietHoursEndAfter(prefs, at) {
  const [endH, endM] = prefs.quietHoursEnd.split(":").map(Number);
  const end = new Date(at);
  end.setHours(endH, endM, 0, 0);
  if (end <= at) end.setDate(end.getDate() + 1);
  return end;
}

// ADDED 3 Sep 2026 — real ask: "pause all reminders" vacation mode.
export function isPaused(prefs) {
  return !!prefs.pausedUntil && new Date() < new Date(prefs.pausedUntil);
}

// ADDED 3 Sep 2026 — real ask: master switch checked before any
// per-type toggle, plus the pause — the one place every sync file
// should ask "is ANY reminder allowed to fire right now at all".
export function notificationsGloballyEnabled(prefs) {
  return prefs.masterEnabled && !isPaused(prefs);
}

export const NotificationPreferencesRepository = {
  getPreferences() {
    const stored = storage.load(STORAGE_KEY, DEFAULT_NOTIFICATION_PREFERENCES);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...stored };
  },

  update(changes) {
    const updated = { ...this.getPreferences(), ...changes };
    storage.save(STORAGE_KEY, updated);
    return updated;
  },
};
