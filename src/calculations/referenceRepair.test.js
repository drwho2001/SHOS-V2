// Tests for referenceRepair.js - the write side of the dangling-reference
// report, and the only code in this repo that can WRITE to a record from
// Developer Tools rather than from that record's own edit sheet.
//
// The emphasis here is the list surgery, because that is where a repair
// could quietly destroy real data: a record pointing at three contacts
// where one was hard-deleted still has two perfectly good ones. Clearing
// the whole field instead of removing the one bad id would silently discard
// two real references to fix a problem one entry caused - which is the exact
// shape of harm this app cannot afford, since the owner finds out at a
// clinic appointment rather than in a stack trace.
//
// Repositories are mocked rather than exercised for real: they need the
// encryption vault unlocked, and a test that quietly asserts against module
// memory while the real write never happened is worse than no test. Each
// mock records what it was asked to write so the assertion is on the WRITE,
// not on the helper's return value.
import { describe, it, expect, beforeEach, vi } from "vitest";

const writes = [];
const contact = { id: "contact_1", name: "Alex", nickname: "" };

vi.mock("../repositories/contactRepository.js", async (importOriginal) => ({
  ...(await importOriginal()),
  ContactRepository: { getById: async () => contact, getAll: async () => [contact], update: async (...a) => { writes.push(a); return true; } },
}));
// Every repository referenceRepair imports must keep its real exported
// DEFAULT_* literal, because DECLARED_DEFAULTS reads those literals AT
// IMPORT TIME to decide each field's shape. Mocking a repository without
// spreading the original fails the whole suite on a missing export - which
// is itself the proof that the module derives shapes from the repositories
// rather than hardcoding them.
//
// Written out one call per module rather than looped or wrapped in a helper:
// vi.mock is hoisted by a static scan, so a call it cannot see at the top
// level is not hoisted at all, and the mock silently never applies.
//
// (Two harness bugs of mine while building this file, both caught because
// the suite failed to parse rather than because a test caught them: a
// duplicated `const EMPTY`, and a capitalisation regex written as
// `/(^./` with no closing paren. Neither reached a commit.)
const EMPTY = { getAll: async () => [], getById: async () => null, getProfile: async () => ({}), update: async () => true };
const track = (extra) => ({ ...EMPTY, ...extra, update: async (...a) => { writes.push(a); return true; } });

vi.mock("../repositories/contactRepository.js", async (o) => ({ ...(await o()), ContactRepository: track({ getById: async () => contact, getAll: async () => [contact] }) }));
vi.mock("../repositories/encounterRepository.js", async (o) => ({ ...(await o()), EncounterRepository: track({ getById: async () => ({ id: "encounter_1", attendeeIds: ["contact_1", "contact_gone", "contact_2"] }) }) }));
vi.mock("../repositories/testingRepository.js", async (o) => ({ ...(await o()), TestingRepository: track({ getById: async () => ({ id: "test_1", routineRetestSourceTestId: "test_gone" }) }) }));
vi.mock("../repositories/clinicVisitsRepository.js", async (o) => ({ ...(await o()), ClinicVisitsRepository: track({ getById: async () => ({ id: "visit_1", takeHomeMedications: [{ medicationId: "med_gone", unit: "units", quantity: null }, { medicationId: "med_2", unit: "units", quantity: 28 }] }) }) }));
vi.mock("../repositories/myProfileRepository.js", async (o) => ({ ...(await o()), MyProfileRepository: track({ getProfile: async () => ({ relationshipContactIds: ["contact_1", "contact_gone"] }) }) }));
vi.mock("../repositories/medicationRepository.js", async (o) => ({ ...(await o()), MedicationRepository: EMPTY }));
vi.mock("../repositories/symptomLogRepository.js", async (o) => ({ ...(await o()), SymptomLogRepository: EMPTY }));
vi.mock("../repositories/vaccinationRepository.js", async (o) => ({ ...(await o()), VaccinationRepository: EMPTY }));
vi.mock("../repositories/episodeRepository.js", async (o) => ({ ...(await o()), EpisodeRepository: EMPTY }));
vi.mock("../repositories/locationsRepository.js", async (o) => ({ ...(await o()), LocationsRepository: EMPTY }));
vi.mock("../repositories/logRepository.js", async (o) => ({ ...(await o()), LogRepository: EMPTY }));
vi.mock("../repositories/partnerNotificationRepository.js", async (o) => ({ ...(await o()), PartnerNotificationRepository: EMPTY }));
vi.mock("../repositories/measurementRepository.js", async (o) => ({ ...(await o()), MeasurementRepository: EMPTY }));
vi.mock("../repositories/contraceptionRepository.js", async (o) => ({ ...(await o()), ContraceptionRepository: EMPTY }));
vi.mock("../repositories/menstrualCycleRepository.js", async (o) => ({ ...(await o()), MenstrualCycleRepository: EMPTY }));
vi.mock("../registries/kinkRegistry.js", async (o) => ({ ...(await o()), KinkRegistry: EMPTY }));
vi.mock("../registries/chemsRegistry.js", async (o) => ({ ...(await o()), ChemsRegistry: EMPTY }));
vi.mock("../registries/protectionRegistry.js", async (o) => ({ ...(await o()), ProtectionRegistry: EMPTY }));
vi.mock("../registries/symptomsRegistry.js", async (o) => ({ ...(await o()), SymptomsRegistry: EMPTY }));
vi.mock("../registries/organismRegistry.js", async (o) => ({ ...(await o()), OrganismRegistry: EMPTY }));
vi.mock("../registries/resultsRegistry.js", async (o) => ({ ...(await o()), ResultsRegistry: EMPTY }));

const {
  describeRepair, clearDanglingReference, repointDanglingReference, undoRepair, ENTRY_ID_KEYS,
} = await import("./referenceRepair.js");

beforeEach(() => { writes.length = 0; });

describe("referenceRepair", () => {
  it("removes ONLY the dangling id from a list, keeping the real ones", async () => {
    const orphan = { recordType: "Encounter", recordId: "encounter_1", recordLabel: "Sauna", field: "attendeeIds", danglingId: "contact_gone", targetType: "Contact" };
    const { previous } = await clearDanglingReference(orphan);
    expect(writes).toHaveLength(1);
    const [, patch] = writes[0];
    expect(patch.attendeeIds).toEqual(["contact_1", "contact_2"]);
    // And the prior value is handed back intact, so undo restores the exact
    // field rather than a reconstruction of it.
    expect(previous).toEqual(["contact_1", "contact_gone", "contact_2"]);
  });

  it("clears a scalar reference to null rather than to an empty list", async () => {
    const orphan = { recordType: "Test", recordId: "test_1", field: "routineRetestSourceTestId", danglingId: "test_gone", targetType: "Test" };
    await clearDanglingReference(orphan);
    expect(writes[0][1]).toEqual({ routineRetestSourceTestId: null });
  });

  it("removes the whole entry for an object-list field, not the key", async () => {
    const orphan = { recordType: "Clinic Visit", recordId: "visit_1", field: "takeHomeMedications", danglingId: "med_gone", targetType: "Medication" };
    await clearDanglingReference(orphan);
    // The dangling entry is deliberately NOT the first one. An earlier
    // version of this fixture put it first, and a mutation that simply
    // "keeps the first entry" then produced the same answer as correct code
    // and passed - a fixture where the wrong implementation and the right
    // one agree is not a test. Here the survivor is the second entry.
    expect(writes[0][1].takeHomeMedications).toEqual([{ medicationId: "med_2", unit: "units", quantity: 28 }]);
  });

  it("writes a singleton with no id, because My Profile has none", async () => {
    const orphan = { recordType: "My Profile", recordId: "profile", field: "relationshipContactIds", danglingId: "contact_gone", targetType: "Contact" };
    await clearDanglingReference(orphan);
    // One argument only - passing an id here would be silently ignored by
    // the repository and the field would never change.
    expect(writes[0]).toHaveLength(1);
    expect(writes[0][0].relationshipContactIds).toEqual(["contact_1"]);
  });

  it("re-points one id in a list without touching the others", async () => {
    const orphan = { recordType: "Encounter", recordId: "encounter_1", field: "attendeeIds", danglingId: "contact_gone", targetType: "Contact" };
    await repointDanglingReference(orphan, "contact_2");
    expect(writes[0][1].attendeeIds).toEqual(["contact_1", "contact_2", "contact_2"]);
  });

  it("re-points an object-list entry by replacing only its key", async () => {
    const orphan = { recordType: "Clinic Visit", recordId: "visit_1", field: "takeHomeMedications", danglingId: "med_gone", targetType: "Medication" };
    await repointDanglingReference(orphan, "med_2");
    expect(writes[0][1].takeHomeMedications).toEqual([
      { medicationId: "med_2", unit: "units", quantity: null },
      { medicationId: "med_2", unit: "units", quantity: 28 },
    ]);
  });

  it("re-points a list without collapsing it to the single new id", async () => {
    const orphan = { recordType: "Encounter", recordId: "encounter_1", field: "attendeeIds", danglingId: "contact_gone", targetType: "Contact" };
    await repointDanglingReference(orphan, "contact_2");
    // Same length as the input, and the other two ids untouched. Written as
    // an explicit equality rather than a length check so that "collapsed
    // to one element" cannot pass.
    expect(writes[0][1].attendeeIds).toEqual(["contact_1", "contact_2", "contact_2"]);
  });

  it("refuses to re-point with no target chosen", async () => {
    const orphan = { recordType: "Encounter", recordId: "encounter_1", field: "attendeeIds", danglingId: "contact_gone", targetType: "Contact" };
    await expect(repointDanglingReference(orphan, null)).rejects.toThrow(/Pick which record/);
    expect(writes).toHaveLength(0);
  });

  it("restores the exact prior value on undo", async () => {
    const orphan = { recordType: "Encounter", recordId: "encounter_1", field: "attendeeIds", danglingId: "contact_gone", targetType: "Contact" };
    const { previous } = await clearDanglingReference(orphan);
    writes.length = 0;
    await undoRepair(orphan, previous);
    expect(writes[0][1].attendeeIds).toEqual(["contact_1", "contact_gone", "contact_2"]);
  });

  it("classifies each shape from the repository's own declared default", async () => {
    const kindOf = async (o) => (await describeRepair(o)).kind;
    expect(await kindOf({ recordType: "Encounter", field: "attendeeIds", targetType: "Contact" })).toBe("list");
    expect(await kindOf({ recordType: "Encounter", field: "locationId", targetType: "Location" })).toBe("scalar");
    expect(await kindOf({ recordType: "Contact", field: "statedKinks", targetType: "Kink Registry" })).toBe("entries");
    expect(await kindOf({ recordType: "Partner Notification", field: "items[0].contactId", targetType: "Contact" })).toBe("nested");
  });

  it("says why a field it cannot repair cannot be repaired", async () => {
    const shape = await describeRepair({ recordType: "Partner Notification", field: "items[0].contactId", targetType: "Contact" });
    expect(shape.canRepair).toBe(false);
    expect(shape.reason).toMatch(/checklist item/);
  });

  it("refuses to touch a field whose shape it cannot resolve", async () => {
    // "Medication log entry" has a three-field DEFAULT_LOG_ENTRY that does
    // not declare medicationId at all. Guessing either way here would lose
    // data: guessing "scalar" writes null, guessing "list" writes []. The
    // answer is neither - it refuses, which is the only direction that
    // cannot destroy a real reference.
    const shape = await describeRepair({ recordType: "Medication log entry", field: "medicationId", targetType: "Medication" });
    expect(shape.kind).toBeNull();
    expect(shape.canRepair).toBe(false);
    expect(shape.reason).toMatch(/willing to guess/);
    await expect(clearDanglingReference({ recordType: "Medication log entry", recordId: "log_1", field: "medicationId", danglingId: "med_gone", targetType: "Medication" })).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  it("reads My Profile's own declared default, since it is a singleton with no id", async () => {
    // The case that caught the backwards fallback reasoning: My Profile has
    // no record id and its shape lives in DEFAULT_PROFILE, so treating the
    // field as a scalar would have cleared every remaining relationship
    // contact rather than removing the one broken id.
    const shape = await describeRepair({ recordType: "My Profile", field: "relationshipContactIds", targetType: "Contact" });
    expect(shape.kind).toBe("list");
    expect(shape.canRepair).toBe(true);
  });

  it("states an entry key for exactly the object-list fields", () => {
    expect(ENTRY_ID_KEYS).toEqual({
      statedKinks: "kinkId",
      limits: "kinkId",
      kinksInvolved: "kinkId",
      takeHomeMedications: "medicationId",
    });
  });
});
