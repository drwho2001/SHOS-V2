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
};

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
