// The IMPORT half of the seed-id incident: a backup written before the 3a
// re-key, imported into a current install.
//
// The on-disk half (`seedIdMigration.js`, Session C) is a separate code path -
// it reads repositories, not a parsed file - so neither half covers the other.
// Before this, importing an old backup left demo records on `contact_001` while
// `SEED_*_IDS` held only `seed_contact_9001`: `countSampleData()` returned 0 and
// `clearSampleData()` removed nothing. Worse than un-clearable - un-identifiable
// from real records.
//
// The invariant worth protecting is the DANGEROUS direction: re-keying must never
// turn one of the owner's own records into sample data. A backup holding 74 real
// records under legacy ids is precisely the case that caused the incident, and a
// migration that re-keys those would make them clearable - i.e. deletable.
import { describe, it, expect, vi } from "vitest";

vi.mock("../repositories/contactRepository", () => ({ ContactRepository: {} }));
vi.mock("../repositories/encounterRepository", () => ({ EncounterRepository: {} }));
vi.mock("../repositories/clinicVisitsRepository", () => ({ ClinicVisitsRepository: {} }));
vi.mock("../repositories/testingRepository", () => ({ TestingRepository: {} }));
vi.mock("../repositories/medicationRepository", () => ({ MedicationRepository: {} }));
vi.mock("../repositories/vaccinationRepository", () => ({ VaccinationRepository: {} }));
vi.mock("../repositories/measurementRepository", () => ({ MeasurementRepository: {} }));
vi.mock("../repositories/symptomLogRepository", () => ({ SymptomLogRepository: {} }));
vi.mock("../repositories/locationsRepository", () => ({ LocationsRepository: {} }));
vi.mock("../repositories/episodeRepository", () => ({ EpisodeRepository: {} }));
vi.mock("../repositories/logRepository", () => ({ LogRepository: {} }));
vi.mock("../repositories/menstrualCycleRepository", () => ({ MenstrualCycleRepository: {} }));
vi.mock("../repositories/contraceptionRepository", () => ({ ContraceptionRepository: {} }));
vi.mock("../repositories/pregnancyRepository", () => ({ PregnancyRepository: {} }));

const { migrateBackupData } = await import("./backupMigrations.js");

/** A pre-3a backup: demo records on legacy ids, as an old export would carry. */
const legacyBackup = () => ({
  contacts: [
    { id: "contact_001", name: "Alex" },
    { id: "contact_002", name: "Jordan" },
    { id: "contact_017", name: "Sean Wilson" },
  ],
  encounters: [
    { id: "encounter_001", title: "Sauna trip", attendeeIds: ["contact_001", "contact_002"] },
    { id: "encounter_019", title: "Real thing", attendeeIds: ["contact_017"] },
  ],
  medications: [{ id: "med_001", name: "PrEP (Descovy)", notes: "" }],
});

describe("importing a backup written before the seed re-key", () => {
  it("re-keys demo records so they are visible again", () => {
    const out = migrateBackupData(legacyBackup());
    // The whole point: demo data must be identifiable, or countSampleData()
    // returns 0 and the banner/export warning never clears.
    expect(out.contacts.map((c) => c.id)).toContain("seed_contact_9001");
    expect(out.contacts.map((c) => c.id)).toContain("seed_contact_9002");
    expect(out.medications[0].id).toBe("seed_med_9001");
  });

  it("leaves a record the user created alone", () => {
    const out = migrateBackupData(legacyBackup());
    // contact_017 is NOT a seed id, so it is untouched by construction. Asserted
    // anyway because "untouched" is the property that matters, and a future
    // broader id range could otherwise swallow it silently.
    const real = out.contacts.find((c) => c.name === "Sean Wilson");
    expect(real.id).toBe("contact_017");
  });

  it("NEVER re-keys a record the user owns - the incident itself", () => {
    // THE dangerous direction. `isSeed: false` is the authoritative marker that a
    // record is real data; re-keying one of these would hand 74 genuine records
    // to clearSampleData() as sample data, which is the exact loss that started
    // all of this. A real record must keep its id AND every reference to it.
    const backup = {
      contacts: [
        { id: "contact_001", name: "Sean Wilson", isSeed: false },
        { id: "contact_002", name: "Daniel Philips", isSeed: false },
      ],
      encounters: [
        { id: "encounter_019", title: "Real", attendeeIds: ["contact_001"] },
      ],
    };
    const out = migrateBackupData(backup);
    expect(out.contacts[0].id, "a record with isSeed:false was re-keyed into sample data").toBe("contact_001");
    expect(out.contacts[1].id).toBe("contact_002");
    // And the reference to it must not be rewritten either, or the encounter
    // would end up pointing at a seed id that no longer exists.
    expect(out.encounters[0].attendeeIds).toEqual(["contact_001"]);
  });

  it("rewrites references to re-keyed demo records", () => {
    const out = migrateBackupData(legacyBackup());
    const demo = out.encounters.find((e) => e.title === "Sauna trip");
    // Both attendees were demo records, so both must now name their new ids - a
    // half-migrated encounter points at ids that exist in no collection.
    expect(demo.attendeeIds).toEqual(["seed_contact_9001", "seed_contact_9002"]);
    // The real encounter's attendee is untouched.
    const real = out.encounters.find((e) => e.title === "Real thing");
    expect(real.attendeeIds).toEqual(["contact_017"]);
  });

  it("leaves a backup that is already current completely alone", () => {
    // Idempotence, and the property that makes this safe to run on EVERY import
    // rather than needing to know the backup's age.
    const current = {
      contacts: [{ id: "seed_contact_9001", name: "Alex" }, { id: "contact_017", name: "Sean" }],
      encounters: [{ id: "encounter_019", attendeeIds: ["contact_017"] }],
    };
    const out = migrateBackupData(current);
    expect(out).toEqual(current);
  });

  it("does not mutate the input", () => {
    const input = legacyBackup();
    const snapshot = JSON.stringify(input);
    // A DEEP copy, not a reference: asserting on `input.contacts` after the call
    // only proves the caller still points at the same object, which a migration
    // that mutates in place would satisfy. What matters is that restoreBackup()
    // still holds un-migrated data, and only a snapshot can show that.
    const out = migrateBackupData(input);
    expect(JSON.stringify(input), "the input object was modified").toBe(snapshot);
    expect(out).not.toBe(input);
    // ...and the shared inner arrays must not have been rewritten either, or the
    // Merge path would read already-migrated records.
    expect(input.contacts[0].id).toBe("contact_001");
    expect(input.encounters[0].attendeeIds).toEqual(["contact_001", "contact_002"]);
  });

  it("survives a backup with no collections, or none of the seeded ones", () => {
    // A data-recovery path must not throw on an unfamiliar file. These are real
    // shapes an import can hand it.
    expect(migrateBackupData({})).toEqual({});
    expect(migrateBackupData({ somethingElse: [1, 2, 3] })).toEqual({ somethingElse: [1, 2, 3] });
    expect(migrateBackupData({ contacts: [] })).toEqual({ contacts: [] });
  });

  it("skips malformed elements without dropping them", () => {
    // backupService.js's own sanitiser removes these before we see them, so this
    // is not load-bearing in production - but migrateBackupData is exported and
    // a null element reaching the plan must not lose the record.
    const backup = { contacts: [null, { id: "contact_001" }, "junk"] };
    const out = migrateBackupData(backup);
    expect(out.contacts).toHaveLength(3);
  });

  it("does not shorten a collection - the defensive skip is real", () => {
    // `plan.rewritten` holds only CHANGED collections. If a key in it were not in
    // the input, spreading `undefined` would silently produce a shorter or
    // absent collection, and this is the one place that could quietly lose
    // records during a restore.
    const backup = legacyBackup();
    const out = migrateBackupData(backup);
    for (const key of Object.keys(backup)) {
      expect(Array.isArray(out[key]) ? out[key].length : 0, `${key} lost records`).toBe(backup[key].length);
    }
  });

  it("still runs the pre-existing field migrations, and in the right ORDER", () => {
    // The point of DATA_MIGRATIONS ordering: adding a whole-backup step must not
    // displace the rename migrations that were already here. The fixture
    // deliberately has a record that is BOTH a legacy seed id AND carries a
    // renamed field, because a record with only one of the two cannot tell the
    // two orderings apart - the first version of this test used such a record
    // and passed with the order reversed.
    const out = migrateBackupData({
      medications: [{ id: "med_001", name: "PrEP", dosePerUnit: "200mg/245mg" }],
    });
    expect(out.medications[0].id, "the id migration did not run").toBe("seed_med_9001");
    expect(out.medications[0].notes).toContain("200mg/245mg");
    expect(out.medications[0].dosePerUnit).toBeUndefined();
  });

  it("ignores non-array values when collecting collections", () => {
    // planSeedIdMigration iterates `records` directly, so a non-array reaching it
    // would throw from inside a data-recovery path. The filter is what prevents
    // that, and this test is what stops it being deleted as redundant.
    const out = migrateBackupData({
      myProfile: { name: "not a collection" },
      privacySettings: { anonymiseModeActive: false },
      contacts: [{ id: "contact_001", name: "Alex" }],
    });
    expect(out.myProfile).toEqual({ name: "not a collection" });
    expect(out.privacySettings).toEqual({ anonymiseModeActive: false });
    expect(out.contacts[0].id).toBe("seed_contact_9001");
  });
});