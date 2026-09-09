// backupMigrations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask (9 Sep 2026): reviewing the owner's own real backup file
// against the current app schema was done by hand, once, in a session
// — and it came back clean (every field in his real data still matches
// what the current app expects). But the owner won't always have a
// session like this to check for him before importing an old export on
// a future version of the app. This file is the standing fix: a small,
// append-only registry of "old field → new field" migrations, run
// automatically on every real import (both Replace All and Merge), so
// restoring a genuinely old backup keeps working without needing a
// human to spot-check it first.
//
// Why this exists SEPARATELY from "defensive-default merge on every
// read" (every repository's own `{...DEFAULTS, ...stored}, CLAUDE.md's
// own standing architecture rule): that pattern already covers one
// direction for free — a field the CURRENT app added that an OLD
// backup doesn't have just gets its default value, no code needed
// here. What it can't cover is the other direction: a field that got
// RENAMED, not just added. The old backup's value under the old name
// is real, meaningful data — a default-merge has no way to know it
// should move into the new field, so it just sits there, orphaned and
// invisible to every current UI, exactly as inert as it would be if it
// had been silently deleted. That gap is what this file closes.
//
// Real precedent this design is modeled on: `medicationRepository.js`'s
// own `dosePerUnit` → `doseStrengthValue`/`doseStrengthUnit` split (19
// Aug 2026, baked into this repo's very first commit) is a genuine
// historical rename of exactly this shape. It never caused a visible
// problem because every real medication had already been re-saved
// through the new UI before anyone took a backup — luck, not a
// guarantee. See MEDICATION_MIGRATIONS below for the real migration
// step that makes the NEXT occurrence of this safe by construction
// instead of by luck.
//
// Idempotent by construction: every migration step checks whether its
// own OLD field is actually present before touching anything, so
// running this against an already-current backup (the normal case,
// including every real backup checked so far) is a genuine no-op, not
// just a cheap one — confirmed live, see the smoke-test flow that
// exercises this file.

// A real free-text dose description (e.g. "200mg/245mg", as seen in
// the owner's own real historical data) can't be safely split into a
// single structured number + unit without guessing — and guessing
// wrong would silently corrupt a real dose, worse than leaving it
// alone. The honest, non-lossy choice: preserve it verbatim inside
// `notes` (prepended, never discarded, never overwriting a real note
// already there) rather than force it into a shape it may not fit.
function migrateMedicationDosePerUnit(med) {
  if (med.dosePerUnit === undefined) return med;
  const { dosePerUnit, ...rest } = med;
  if (!dosePerUnit) return rest;
  const preserved = `Dose (carried over from an older export): ${dosePerUnit}`;
  return { ...rest, notes: rest.notes ? `${preserved}\n${rest.notes}` : preserved };
}

const MEDICATION_MIGRATIONS = [migrateMedicationDosePerUnit];

// Keyed by the exact top-level key backupService.js's own export/import
// uses for that collection (see restoreBackup()'s own destructuring) —
// add a new array here, keyed the same way, the next time a field on
// any record type is genuinely renamed. Every array is empty except
// medications' today; that's the honest current state, not a stub —
// nothing else has been renamed since this app's own history began.
const RECORD_MIGRATIONS = {
  medications: MEDICATION_MIGRATIONS,
};

function migrateCollection(items, migrations) {
  if (!Array.isArray(items) || migrations.length === 0) return items;
  return items.map((item) => migrations.reduce((record, migrate) => migrate(record), item));
}

// Applied once, at the very top of restoreFromParsedBackup() — the one
// real shared entry point for every import path (plain, encrypted,
// Replace All, Merge alike) — before any repository ever sees the
// data. Returns a new object; never mutates the parsed backup in place.
export function migrateBackupData(data) {
  if (!data || typeof data !== "object") return data;
  const migrated = { ...data };
  for (const [key, migrations] of Object.entries(RECORD_MIGRATIONS)) {
    if (key in migrated) migrated[key] = migrateCollection(migrated[key], migrations);
  }
  return migrated;
}
