// trashRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 26 Aug 2026: a genuine "recently deleted" holding area,
// distinct from the 8-second undo toast built earlier this session.
// That toast only ever covers the immediate moment of deletion — this
// is the safety net for "I deleted something three days ago and want
// it back," the way phone Photos apps train people to expect.
//
// Deliberately module-agnostic (stores a `moduleKey` alongside each
// record) rather than one trash table per module — a single Trash
// screen in Settings can show everything in one place, matching how
// "recently deleted" areas actually work in other apps (one place,
// not scattered per-section).
//
// RETENTION: 30 days, matching common "recently deleted" conventions
// (Photos apps, most email clients). Enforced on READ (getAll filters
// out anything past the window) rather than a destructive background
// sweep — nothing is ever silently, permanently deleted by a timer
// running invisibly; getAll() simply stops returning it once expired,
// and purgeExpired() is available to actually clear that space if the
// user wants it, called explicitly, not automatically.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_trash";
const RETENTION_DAYS = 30;

export const MODULE_LABELS = {
  contacts: "Contact",
  encounters: "Encounter",
  testing: "Test",
  clinicVisits: "Clinic visit",
  symptomLog: "Symptom entry",
  vaccinations: "Vaccination",
  medications: "Medication",
  measurements: "Measurement",
};

// CHANGED — real groundwork for encryption at rest (see CLAUDE.md's
// Known Issues / the Notion Development log for the full plan): every
// method below is now `async`, `await`ing storage.load()/save() even
// though storageAdapter itself is still 100% synchronous today — a
// no-op behaviorally, same real end-to-end proof as
// customGroupsRepository.js's own first conversion. Chosen next
// because every read/write here already happens fresh inside a
// function too — no module-load-time caching to redesign.
async function loadRaw() {
  return await storage.load(STORAGE_KEY, []);
}
async function saveRaw(items) {
  await storage.save(STORAGE_KEY, items);
}

export const TrashRepository = {
  // Called at the moment of deletion — records is an array (bulk
  // delete already captures an array; single delete passes [record]).
  async add(moduleKey, records) {
    const items = await loadRaw();
    const now = new Date().toISOString();
    const newEntries = records.map((record) => ({
      trashId: `trash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      moduleKey,
      record,
      deletedAt: now,
    }));
    await saveRaw([...items, ...newEntries]);
  },

  // Only returns entries still within the retention window — expired
  // ones are simply not shown, not actively purged by this call.
  async getAll() {
    const cutoff = Date.now() - RETENTION_DAYS * 86400000;
    return (await loadRaw())
      .filter((item) => new Date(item.deletedAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  },

  // Removes a single trash entry (after a successful restore, or a
  // manual "delete permanently" from the Trash screen). Does NOT call
  // the module repository's restore() itself — the Trash screen does
  // that explicitly, since it needs to know which repository to call.
  async removeEntry(trashId) {
    await saveRaw((await loadRaw()).filter((item) => item.trashId !== trashId));
  },

  // Real cleanup, explicit only — never called automatically. Clears
  // genuinely expired entries (past the retention window) that
  // getAll() already wasn't returning, freeing the storage space.
  async purgeExpired() {
    const cutoff = Date.now() - RETENTION_DAYS * 86400000;
    await saveRaw((await loadRaw()).filter((item) => new Date(item.deletedAt).getTime() >= cutoff));
  },

  // ADDED 26 Aug 2026 — real ask: manual "empty trash now" option,
  // distinct from purgeExpired() above — this clears EVERYTHING
  // regardless of age, not just what's already past the 30-day
  // window. Real, permanent, irreversible — the UI gates this behind
  // its own explicit confirmation, this function itself doesn't ask.
  async emptyAll() {
    await saveRaw([]);
  },
};
