// notificationHistoryRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 3 Sep 2026: "any missing or unconsidered notification
// settings or management or UI" — a real gap found in that audit:
// nothing anywhere recorded a real notification actually delivering.
// This is that record — a plain, capped log of real deliveries, fed
// by App.jsx's own addNotificationReceivedListener() (the same
// real event that already drives the in-app due-meds banner's live
// refresh — see notificationService.js's own comment on that
// listener). Purely a log: it doesn't drive any scheduling decision
// anywhere, just gives a real answer to "did anything fire recently,
// and what".
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_notification_history";
// Capped, not unbounded — this is a recent-activity log for a human to
// glance at, not a permanent audit trail; 50 real entries is comfortably
// more than anyone would scroll through, without the storage blob
// growing forever on a device that's been installed for a year.
const MAX_ENTRIES = 50;

let entries = storage.load(STORAGE_KEY, []);
function persist() {
  storage.save(STORAGE_KEY, entries);
}

export const NotificationHistoryRepository = {
  getAll() {
    return [...entries];
  },

  // `firedAt` is a real Date.now()-based timestamp (when the app's own
  // JS actually observed the delivery) — deliberately NOT run through
  // this app's fake-UTC stored-date convention (dateInputHelpers.js):
  // that convention exists for values a human TYPED into a date field,
  // not a real instant the code itself is recording, so ordinary
  // real-UTC .toISOString() is the correct, honest choice here, same
  // reasoning as notificationPreferencesRepository.js's own pausedUntil.
  record({ id, title, body }) {
    entries = [{ id, title, body, firedAt: new Date().toISOString() }, ...entries].slice(0, MAX_ENTRIES);
    persist();
    return entries;
  },

  clear() {
    entries = [];
    persist();
  },
};
