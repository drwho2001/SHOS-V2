// demoRestore.js
//
// PLAIN-LANGUAGE PURPOSE
// ----------------------
// "Clear sample data" used to be one-way. This module makes it reversible,
// the way a "recently deleted" folder makes a file deletion reversible: just
// before clearSampleData() removes the fake records, we take a photograph of
// EXACTLY those records, keep that photograph safe, and "Restore sample data"
// puts them back.
//
// WHY A PHOTOGRAPH, NOT A RE-SEED
// -------------------------------
// Re-seeding would invent fresh records from today's seed arrays, which may
// differ from what was actually removed (a seed may have been edited, IDs
// changed, a release added or dropped a demo record). A snapshot restores the
// precise bytes that were there, so "restore" really means "undo", not
// "make some new example data".
//
// SAFETY RULES (non-negotiable — this repo has lost real data twice here)
// 1. Only records the clear ACTUALLY removes are photographed — the same
//    isRemovableSampleRecord predicate, the same referential guard. A seed
//    record that real data depends on is never removed, so never photographed.
// 2. Restore MERGES by id. It appends a photographed record only when no record
//    with that id exists now. It NEVER overwrites, never replaceAll()s a whole
//    collection with old data. A user record created after the clear survives.
// 3. The snapshot lives under its own encrypted key via storageAdapter, so it
//    travels through the same encryption boundary as everything else and is
//    invisible to backup exports (it is not a data domain).
// 4. After a successful restore the snapshot is cleared, so a second Restore
//    cannot duplicate anything. A failed restore keeps the snapshot for retry.

import { localStorageAdapter as storage } from "../storage/storageAdapter.js";
import { SAMPLE_REPOSITORIES, clearSampleData } from "./clearSampleData.js";

const SNAPSHOT_KEY = "shos_demo_restore_snapshot_v1";

/**
 * Pure merge rule: from the photographed records, return only those whose id
 * is not already present. Exported so the "never overwrite" contract is tested
 * directly, without a repository/storage mock graph.
 */
export function missingById(existing, photographed) {
  const ids = new Set((existing || []).map((r) => r?.id));
  return (photographed || []).filter((r) => r && r.id && !ids.has(r.id));
}

/** True when a reversible snapshot exists (cheap read for the UI). */
export async function hasDemoSnapshot() {
  try {
    const snap = await storage.load(SNAPSHOT_KEY, null);
    return !!(snap && Array.isArray(snap.collections) && snap.collections.length);
  } catch {
    return false;
  }
}

/** Snapshot metadata for the UI: how many records would come back. */
export async function describeDemoSnapshot() {
  try {
    const snap = await storage.load(SNAPSHOT_KEY, null);
    if (!snap || !Array.isArray(snap.collections)) return { total: 0, byCollection: [] };
    const byCollection = snap.collections.map((c) => ({ name: c.name, count: (c.records || []).length }));
    return { total: byCollection.reduce((n, c) => n + c.count, 0), byCollection };
  } catch {
    return { total: 0, byCollection: [] };
  }
}

/**
 * Capture the exact records that a clear is about to remove, then clear.
 * Calls the SAME clearSampleData() coordinator so the photograph and the
 * deletion can never disagree about what is sample data.
 * @returns {Promise<{removed:number, kept:number, failed:Array, snapshotted:boolean}>}
 */
export async function clearWithSnapshot() {
  // Capture first — once cleared, the records are gone from the repositories.
  const { collections } = await loadRemovableSnapshot();
  const result = await clearSampleData();
  if (result.failed && result.failed.length) {
    // A partial clear would make a full snapshot misleading (some photographed
    // records are still present). Do not store it — restore would then be a
    // no-op for those, which is safe, but the count shown to the user would be
    // wrong. Skip the snapshot entirely on a partial failure.
    return { ...result, snapshotted: false };
  }
  try {
    await storage.save(SNAPSHOT_KEY, {
      savedAt: new Date().toISOString(),
      collections: collections.filter((c) => c.records.length),
    });
    return { ...result, snapshotted: true };
  } catch {
    // Snapshot write failed — the clear still happened and is still correct.
    // Report it honestly rather than pretending the action is reversible.
    return { ...result, snapshotted: false };
  }
}

// Same selection logic as clearSampleData: load each collection, then keep only
// records the clear would remove. We import the predicate indirectly by asking
// the coordinator's own helpers through a tiny exported bridge below.
async function loadRemovableSnapshot() {
  const { getRemovableSampleCollections } = await import("./clearSampleData.js");
  const { collections } = await getRemovableSampleCollections();
  return { collections };
}

/**
 * Restore the photographed records by merging by id. Never overwrites.
 * @returns {Promise<{restored:number, skipped:number, failed:Array}>}
 */
export async function restoreDemoSnapshot() {
  let restored = 0, skipped = 0;
  const failed = [];
  let snap;
  try {
    snap = await storage.load(SNAPSHOT_KEY, null);
  } catch (e) {
    return { restored, skipped, failed: [{ name: "snapshot", error: e?.message || String(e) }] };
  }
  if (!snap || !Array.isArray(snap.collections)) return { restored, skipped, failed };

  const byName = new Map(SAMPLE_REPOSITORIES.map(([name, repo]) => [name, repo]));
  for (const group of snap.collections) {
    const repo = byName.get(group.name);
    if (!repo || !Array.isArray(group.records)) continue;
    try {
      const existing = await repo.getAll();
      // create() GENERATES a fresh id in every repository, which would break
      // referential links (a dose log points at med_001 by id). So restore the
      // exact photographed objects via replaceAll(existing + missing). The pure
      // missingById() rule means an existing record — real or a previously
      // restored sample — is never overwritten; only genuinely missing ids are
      // added, preserving the original id and every referential link.
      const toAdd = missingById(existing, group.records);
      skipped += group.records.length - toAdd.length;
      if (toAdd.length) {
        await repo.replaceAll([...existing, ...toAdd]);
        restored += toAdd.length;
      }
    } catch (e) {
      failed.push({ name: group.name, error: e?.message || String(e) });
    }
  }

  if (!failed.length) {
    try { await storage.save(SNAPSHOT_KEY, null); } catch { /* keep on failure; retry is safe (merge by id) */ }
  }
  return { restored, skipped, failed };
}
