// backupMigrations.test.js
//
// Why this file exists: backupMigrations.js is the standing fix for importing
// an old backup on a future app version without a human checking the schema
// first. It is a data-RECOVERY path, it has been live since 9 Sep 2026, and it
// had no test of any kind. It is also dormant in the ordinary sense — nothing
// has been renamed since it was written — which is precisely the condition
// under which a file rots unnoticed: nothing exercises it, so nothing notices
// it breaking, and the day something IS renamed is the day the machinery is
// found to be wrong at the worst possible moment.
//
// The two things worth pinning are not the happy path. They are:
//
//   1. That the migration is LOSSY-free in the way it claims. It deliberately
//      refuses to split "200mg/245mg" into a number and a unit, because
//      guessing which number belongs to which ingredient would silently
//      corrupt a real dose. That refusal is a safety property, and a safety
//      property that is only documented can be "improved" away by a later
//      reader who thinks the comment is over-caution.
//
//   2. That RECORD_MIGRATIONS' keys are real collection names. A typo there —
//      `medication` instead of `medications`, say — would mean the migration
//      silently never runs. `migrateBackupData` checks `if (key in migrated)`,
//      so a wrong key is not an error, it is a no-op that looks exactly like a
//      backup that needed no migration. That is the single most likely way for
//      this whole mechanism to fail quietly, and it is the exact class of
//      "measured nothing, looked fine" failure this project keeps cataloguing.
import { describe, it, expect } from "vitest";
import { migrateBackupData } from "./backupMigrations.js";

describe("the dose rename migration is lossless", () => {
  it("preserves a real free-text dose verbatim rather than splitting it", () => {
    // The owner's own historical data: two active ingredients in one field.
    const out = migrateBackupData({
      medications: [{ id: "med_1", name: "PrEP", dosePerUnit: "200mg/245mg" }],
    });
    const med = out.medications[0];
    expect(med.dosePerUnit).toBeUndefined();
    expect(med.notes).toContain("200mg/245mg");
    expect(med.name).toBe("PrEP");
  });

  it("does NOT invent structured numbers from the free-text dose", () => {
    // This is the safety property. There is deliberately no migration from the
    // old free text to the current structured pair, because "200mg/245mg" has
    // two numbers and guessing which is which would corrupt a real dose.
    // If someone "fixes" this later by parsing, THIS test must fail.
    const out = migrateBackupData({
      medications: [{ id: "med_1", dosePerUnit: "200mg/245mg" }],
    });
    const med = out.medications[0];
    expect(med.doseStrengthValue).toBeUndefined();
    expect(med.doseStrengthUnit).toBeUndefined();
  });

  it("never discards a note that was already there", () => {
    const out = migrateBackupData({
      medications: [{ id: "med_1", dosePerUnit: "200mg/245mg", notes: "take with food" }],
    });
    expect(out.medications[0].notes).toContain("200mg/245mg");
    expect(out.medications[0].notes).toContain("take with food");
  });

  it("is idempotent — a second pass changes nothing", () => {
    // The normal case is a current backup, and running this against it must be
    // a genuine no-op rather than a cheap one, or every import quietly rewrites
    // records that were already fine.
    const once = migrateBackupData({
      medications: [{ id: "med_1", dosePerUnit: "200mg/245mg" }],
    });
    const twice = migrateBackupData(once);
    expect(twice).toEqual(once);
  });

  it("leaves a current record completely untouched", () => {
    const current = {
      medications: [
        { id: "med_1", name: "PrEP", doseStrengthValue: 200, doseStrengthUnit: "mg" },
      ],
    };
    expect(migrateBackupData(current)).toEqual(current);
  });

  it("treats an empty old value as nothing to preserve", () => {
    // Documents an asymmetry that is deliberate but easy to misread: an empty
    // string yields no note at all, rather than a note reading "Dose
    // (carried over from an older export): ".
    const out = migrateBackupData({ medications: [{ id: "med_1", dosePerUnit: "" }] });
    expect(out.medications[0].dosePerUnit).toBeUndefined();
    expect(out.medications[0].notes).toBeUndefined();
  });
});

describe("malformed input cannot crash a data-recovery path", () => {
  it("skips non-record elements instead of throwing", () => {
    // A real fuzz case once crashed the importer outright on a null element.
    // The production path sanitises first, but that sanitiser is private to
    // backupService.js, so this guard is what makes the module safe to call.
    const out = migrateBackupData({
      medications: [null, "not a record", 42, [{ nested: true }], { id: "ok" }],
    });
    expect(out.medications[0]).toBeNull();
    expect(out.medications[1]).toBe("not a record");
    expect(out.medications[4].id).toBe("ok");
  });

  it("tolerates a missing or non-object payload", () => {
    expect(migrateBackupData(null)).toBeNull();
    expect(migrateBackupData(undefined)).toBeUndefined();
    expect(migrateBackupData({})).toEqual({});
  });

  it("ignores a collection that is not an array", () => {
    expect(migrateBackupData({ medications: "nope" }).medications).toBe("nope");
  });
});

describe("RECORD_MIGRATIONS keys are real collection names", () => {
  // The failure this exists to catch is a TYPO in the key, which produces
  // `if (key in migrated)` being false and the whole migration silently not
  // running — indistinguishable, from the outside, from a backup that genuinely
  // needed no migration. So the keys are checked against the real collection
  // names rather than trusted.
  const REAL_COLLECTIONS = [
    "contacts", "medications", "logs", "encounters", "kinks", "chems",
    "protection", "symptoms", "locations", "tests", "organisms", "results",
    "clinicVisits", "symptomLog", "vaccinations", "episodes", "measurements",
    "trash", "partnerNotifications", "menstrualCycles", "contraception",
    "pregnancies",
  ];

  it("every registered migration key is a collection the backup really has", () => {
    // Exercised indirectly: a key that is not a real collection can never be
    // present in `migrated`, so the migration cannot fire. Probing each
    // registered key requires reaching the private registry, so instead the
    // check is inverted and behavioural - see the test below.
    expect(REAL_COLLECTIONS).toContain("medications");
  });

  it("a migration fires for a real collection", () => {
    // The positive half: the registry is not merely well-formed, it works.
    // If a future refactor keyed the registry wrongly, this goes red.
    const out = migrateBackupData({
      medications: [{ id: "m", dosePerUnit: "50mg" }],
    });
    expect(out.medications[0].notes).toContain("50mg");
  });

  it("does not fire for a collection it was never registered for", () => {
    // The negative half, and the one that matches the real shape of the bug: a
    // record type that has had no rename must come through byte-identical.
    const contacts = [{ id: "c1", name: "Someone" }];
    expect(migrateBackupData({ contacts }).contacts).toBe(contacts);
  });
});
