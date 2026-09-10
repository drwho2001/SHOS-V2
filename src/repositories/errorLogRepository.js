// errorLogRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 10 Sep 2026: "allow error reporting." This app has no
// backend and no telemetry by design (the actual privacy guarantee —
// see CLAUDE.md's own opening line) — a real crash-reporting SERVICE
// (Sentry or similar) would mean silently sending diagnostic data,
// which can include real personal data fragments (a stack trace can
// reference record titles/values), to a third party. That's a genuine
// architecture line this app doesn't cross elsewhere, and shouldn't
// cross quietly here either.
// This is the on-device alternative: a plain, capped local log of real
// uncaught errors/rejections, viewable and exportable by the owner
// himself in Settings > Developer Tools — the same "record what
// actually happened, let the user look at it" shape already proven by
// notificationHistoryRepository.js. Nothing here ever leaves the
// device on its own; the only way this data goes anywhere is the
// user's own explicit Export tap, same as every other export in this
// app.
// Deliberately NOT wired into backupService.js — this is a diagnostic
// log, not real user data, matching notificationHistoryRepository.js's
// own precedent of being excluded from backup/restore/merge.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_error_log";
// Capped for the same reason notificationHistoryRepository.js caps at
// 50 — a recent-diagnostics log for a human to glance at or export,
// not an unbounded audit trail that grows forever on a long-installed
// device.
const MAX_ENTRIES = 50;

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

export const ErrorLogRepository = {
  async getAll() {
    await ensureLoaded();
    return [...entries];
  },

  // `source` distinguishes where this was caught (window.onerror,
  // unhandledrejection, or the React ErrorBoundary) — real, useful
  // context for telling a genuine app bug apart from, say, a
  // browser-extension script error also caught by a global listener.
  // occurredAt is a real observed-instant timestamp (real-UTC
  // .toISOString(), NOT this app's fake-UTC stored-date convention —
  // same reasoning as notificationHistoryRepository.js's firedAt,
  // since this records when the code itself noticed the error, not a
  // value a human typed into a date field).
  async record({ source, message, stack }) {
    await ensureLoaded();
    entries = [{ source, message: String(message || "").slice(0, 500), stack: String(stack || "").slice(0, 4000), occurredAt: new Date().toISOString() }, ...entries].slice(0, MAX_ENTRIES);
    await persist();
    return entries;
  },

  async clear() {
    await ensureLoaded();
    entries = [];
    await persist();
  },
};
