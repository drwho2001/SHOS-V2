// vaginalHealthMigration.js
//
// R7 / D1=B (18 Nov 2026) — the Vaginal health sub-tab is removed from the UI.
// These records are REAL clinical history (the repository deliberately has no
// seed data), so nothing is deleted and nothing is silently rewritten.
//
// WHAT THIS DOES, ONCE, AT BOOT:
//   Copies each vaginal-health record into a Symptom Log entry — the plain
//   observation home — preserving the condition as the title, the date, and
//   EVERY original field (notes, treatment, outcome) in the notes. The
//   diagnosis-led urgency badges/tiers are gone with the old module.
//
// WHAT IT DELIBERATELY DOES NOT DO:
//   - It does not fabricate a Testing record, Medication, or Clinic Visit from
//     free text. "Metronidazole" typed into a treatment box is not a real
//     medication record with a dose and supply; inventing one would be worse
//     than keeping the fact as text. The owner's mapping (condition→Testing/
//     Episodes, treatment→Medication/Clinic Visits) is left to the person who
//     knows what they actually had, with the facts preserved verbatim here.
//   - It does not delete or clear the source records. The repository stays as
//     a READ-ONLY backup shim for this release: old backups still import, and
//     an export still carries the originals. The one-time flag stops a restore
//     from creating duplicates on the next boot.
//
// Idempotent: the flag is the single owner of "has this been done". A failure
// part-way through leaves the flag unset, so the next boot retries; a already-
// migrated record is detected by its marker in the Symptom Log notes so a
// retry cannot double-create.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";
import { VaginalHealthRepository } from "./vaginalHealthRepository.js";
import { SymptomLogRepository } from "./symptomLogRepository.js";

export const VAGINAL_HEALTH_MIGRATED_FLAG = "shos_vaginal_health_migrated_v1";
const MARKER = "[migrated from vaginal health]";

function buildNotes(record) {
  const lines = [];
  if (record.notes) lines.push(record.notes);
  if (record.treatment) lines.push(`Treatment: ${record.treatment}`);
  if (record.outcome) lines.push(`Outcome: ${record.outcome}`);
  lines.push(MARKER, `Original record: ${record.id || "unknown"}`);
  return lines.join("\n");
}

export async function runVaginalHealthMigration() {
  if (await storage.load(VAGINAL_HEALTH_MIGRATED_FLAG, false)) return { migrated: 0 };

  const records = await VaginalHealthRepository.getAll();
  if (records.length > 0) {
    const existing = await SymptomLogRepository.getAll();
    const alreadyMigrated = new Set(
      existing.filter((s) => (s.notes || "").includes(MARKER)).map((s) => {
        const m = (s.notes || "").match(/Original record: ([^\n]+)/);
        return m ? m[1] : null;
      })
    );
    for (const record of records) {
      if (record.id && alreadyMigrated.has(record.id)) continue;
      await SymptomLogRepository.create({
        title: record.condition || "Vaginal health observation",
        dateStarted: record.date || null,
        notes: buildNotes(record),
      });
    }
  }

  await storage.save(VAGINAL_HEALTH_MIGRATED_FLAG, true);
  return { migrated: records.length };
}
