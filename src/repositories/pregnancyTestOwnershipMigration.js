// pregnancyTestOwnershipMigration.js
//
// F2 (18 Nov) — recorded owner decision: Testing is the single owner of
// pregnancy test records; Pregnancy keeps only pregnancy-specific state and
// points at the Test. This one-time migration creates the Test records from
// existing pregnancy entries and links them. It NEVER deletes the original
// testDate/testResult — they remain as read-only legacy facts on the record
// (backups and export still carry them), so no clinical history is lost.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";
import { PregnancyRepository } from "./pregnancyRepository.js";
import { TestingRepository } from "./testingRepository.js";
import { ResultsRegistry } from "../registries/resultsRegistry.js";

export const PREGNANCY_TEST_OWNERSHIP_FLAG = "shos_pregnancy_test_ownership_v1";

export async function runPregnancyTestOwnershipMigration() {
  if (await storage.load(PREGNANCY_TEST_OWNERSHIP_FLAG, false)) return { migrated: 0 };

  const pregnancies = await PregnancyRepository.getAll();
  const tests = await TestingRepository.getAll();
  // A test already logged in Testing for the same date counts as the owner —
  // don't create a duplicate.
  const existingByDate = new Map();
  for (const t of tests) {
    if ((t.testingFor || []).includes("Pregnancy") && t.date) existingByDate.set(t.date, t);
  }

  let migrated = 0;
  for (const p of pregnancies) {
    if (p.testId || !p.testDate || !p.testResult) continue;
    let test = existingByDate.get(p.testDate);
    if (!test) {
      let resultIds = [];
      try {
        const r = await ResultsRegistry.findOrCreate(p.testResult);
        resultIds = r ? [r.id] : [];
      } catch { resultIds = []; }
      test = await TestingRepository.create({
        title: "Pregnancy test",
        testingFor: ["Pregnancy"],
        date: p.testDate,
        sampleType: p.sampleType ? [p.sampleType] : ["Urine"],
        resultIds,
        notes: [p.brand ? `Brand: ${p.brand}` : "", p.hcgValue != null ? `Serum hCG ${p.hcgValue} mIU/mL` : ""].filter(Boolean).join("\n"),
      });
      existingByDate.set(p.testDate, test);
    }
    await PregnancyRepository.update(p.id, { testId: test.id });
    migrated++;
  }

  await storage.save(PREGNANCY_TEST_OWNERSHIP_FLAG, true);
  return { migrated };
}
