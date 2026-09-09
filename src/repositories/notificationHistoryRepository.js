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

// CHANGED — real groundwork for encryption at rest (see CLAUDE.md's
// Known Issues / the Notion Development log for the full plan). This
// repository used to cache `entries` at module-load time
// (`let entries = storage.load(...)`, evaluated once at import) — the
// pattern ~22 of this app's repositories share, and the reason they
// couldn't get the same simple treatment as the 4 already converted
// (CustomGroups/Trash/MeasurementPreferences/MedicationPreferences):
// once storage.load() genuinely returns a Promise (Phase 3's real
// crypto work), a plain module-top-level `let x = storage.load(...)`
// can't `await` it without top-level await, which risks deadlocking
// against this app's real circular imports (Testing/ClinicVisits
// already import each other for delete-time cleanup).
//
// Real fix — the smallest, most isolated of the 22 (51 lines, called
// from just 2 files), chosen as the first real proof of this pattern
// the same way CustomGroupsRepository was for the simpler one: `entries`
// starts `null` (not yet loaded) instead of the real seed/stored value,
// and every exported method awaits `ensureLoaded()` first. The FIRST
// caller (whichever real method runs first) triggers the actual load;
// `loadPromise` is set BEFORE that load is awaited, so a second caller
// arriving before the first load resolves awaits the SAME promise
// instead of triggering a duplicate, possibly-racing read — same
// "memoize the in-flight promise" idea `useLoadedState` doesn't need
// (React state updates are always sequential) but a plain module-level
// variable does.
let entries = null;
let loadPromise = null;
async function ensureLoaded() {
  if (entries === null) {
    if (!loadPromise) loadPromise = storage.load(STORAGE_KEY, []);
    entries = await loadPromise;
  }
  return entries;
}
async function persist() {
  await storage.save(STORAGE_KEY, entries);
}

export const NotificationHistoryRepository = {
  async getAll() {
    await ensureLoaded();
    return [...entries];
  },

  // `firedAt` is a real Date.now()-based timestamp (when the app's own
  // JS actually observed the delivery) — deliberately NOT run through
  // this app's fake-UTC stored-date convention (dateInputHelpers.js):
  // that convention exists for values a human TYPED into a date field,
  // not a real instant the code itself is recording, so ordinary
  // real-UTC .toISOString() is the correct, honest choice here, same
  // reasoning as notificationPreferencesRepository.js's own pausedUntil.
  async record({ id, title, body }) {
    await ensureLoaded();
    entries = [{ id, title, body, firedAt: new Date().toISOString() }, ...entries].slice(0, MAX_ENTRIES);
    await persist();
    return entries;
  },

  async clear() {
    await ensureLoaded();
    entries = [];
    await persist();
  },
};
