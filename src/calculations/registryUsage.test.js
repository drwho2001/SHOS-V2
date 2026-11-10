// registryUsage.test.js
//
// Guards the "most used first" ordering and, more importantly, the field
// names it reads. The previous version of this module called React hooks at
// module scope (an immediate Invalid hook call on import) and read
// MyProfileRepository.get(), which does not exist. A test that only checked
// sortByUsage would have passed over both, so the buildRegistryUsage tests
// below assert the actual counts produced from each real repository shape.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/encounterRepository.js", () => ({
  EncounterRepository: { getAll: vi.fn() },
}));
vi.mock("../repositories/contactRepository.js", () => ({
  ContactRepository: { getAll: vi.fn() },
}));
vi.mock("../repositories/myProfileRepository.js", () => ({
  MyProfileRepository: { getProfile: vi.fn() },
}));
vi.mock("../repositories/symptomLogRepository.js", () => ({
  SymptomLogRepository: { getAll: vi.fn() },
}));
vi.mock("../repositories/testingRepository.js", () => ({
  TestingRepository: { getAll: vi.fn() },
}));
vi.mock("../repositories/clinicVisitsRepository.js", () => ({
  ClinicVisitsRepository: { getAll: vi.fn() },
}));

import { buildRegistryUsage, sortByUsage, USAGE_KEYS } from "./registryUsage.js";
import { EncounterRepository } from "../repositories/encounterRepository.js";
import { ContactRepository } from "../repositories/contactRepository.js";
import { MyProfileRepository } from "../repositories/myProfileRepository.js";
import { SymptomLogRepository } from "../repositories/symptomLogRepository.js";
import { TestingRepository } from "../repositories/testingRepository.js";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository.js";

function setRepositories({ encounters = [], contacts = [], profile = null, symptoms = [], tests = [], visits = [] }) {
  EncounterRepository.getAll.mockResolvedValue(encounters);
  ContactRepository.getAll.mockResolvedValue(contacts);
  MyProfileRepository.getProfile.mockResolvedValue(profile);
  SymptomLogRepository.getAll.mockResolvedValue(symptoms);
  TestingRepository.getAll.mockResolvedValue(tests);
  ClinicVisitsRepository.getAll.mockResolvedValue(visits);
}

beforeEach(() => {
  vi.clearAllMocks();
  setRepositories({});
});

describe("buildRegistryUsage", () => {
  it("counts every record type that can reference a registry", async () => {
    setRepositories({
      encounters: [
        {
          kinksInvolved: [{ kinkId: "kink_1", role: "Top" }, "kink_2"],
          chemsAlcoholUsed: ["chem_1"],
          protectionUsed: ["protection_1"],
          symptomsNoted: ["symptom_1"],
          locationId: "location_1",
        },
      ],
      contacts: [
        {
          statedKinks: [{ kinkId: "kink_1", role: "Vers" }],
          limits: ["kink_2"],
          knownChems: ["chem_1", "chem_2"],
        },
      ],
      profile: {
        statedKinks: [{ kinkId: "kink_1" }],
        limits: [],
        knownChems: ["chem_2"],
      },
      symptoms: [
        // symptomIds is the canonical field; symptomId is the legacy one.
        { symptomIds: ["symptom_1", "symptom_2"], symptomId: "symptom_3" },
      ],
      tests: [
        {
          date: "2020-01-01",
          organismIds: ["organism_1"],
          resultIds: ["result_1"],
        },
      ],
      visits: [
        {
          symptomTypeIds: ["symptom_2"],
          resultIds: ["result_1"],
          locationId: "location_2",
        },
      ],
    });

    const usage = await buildRegistryUsage();

    expect(usage.get(USAGE_KEYS.kink).get("kink_1")).toBe(3);
    expect(usage.get(USAGE_KEYS.kink).get("kink_2")).toBe(2);
    expect(usage.get(USAGE_KEYS.chem).get("chem_1")).toBe(2);
    expect(usage.get(USAGE_KEYS.chem).get("chem_2")).toBe(2);
    expect(usage.get(USAGE_KEYS.protection).get("protection_1")).toBe(1);
    expect(usage.get(USAGE_KEYS.symptom).get("symptom_1")).toBe(2);
    expect(usage.get(USAGE_KEYS.symptom).get("symptom_2")).toBe(2);
    expect(usage.get(USAGE_KEYS.symptom).get("symptom_3")).toBe(1);
    expect(usage.get(USAGE_KEYS.organism).get("organism_1")).toBe(1);
    expect(usage.get(USAGE_KEYS.result).get("result_1")).toBe(2);
    expect(usage.get(USAGE_KEYS.location).get("location_1")).toBe(1);
    expect(usage.get(USAGE_KEYS.location).get("location_2")).toBe(1);
  });

  it("does not count planned or archived tests as organism/result uses", async () => {
    setRepositories({
      tests: [
        { isRoutineRetestPlan: true, organismIds: ["organism_planned"], resultIds: ["result_planned"] },
        { date: "2999-01-01", organismIds: ["organism_future"], resultIds: ["result_future"] },
        { isArchived: true, date: "2020-01-01", organismIds: ["organism_archived"], resultIds: ["result_archived"] },
        { date: "2020-01-01", organismIds: ["organism_done"], resultIds: ["result_done"] },
      ],
    });

    const usage = await buildRegistryUsage();
    const organisms = usage.get(USAGE_KEYS.organism);
    const results = usage.get(USAGE_KEYS.result);

    expect(organisms.get("organism_done")).toBe(1);
    expect(organisms.has("organism_planned")).toBe(false);
    expect(organisms.has("organism_future")).toBe(false);
    expect(organisms.has("organism_archived")).toBe(false);
    expect(results.get("result_done")).toBe(1);
    expect(results.has("result_planned")).toBe(false);
    expect(results.has("result_future")).toBe(false);
    expect(results.has("result_archived")).toBe(false);
  });

  it("returns an empty map for every registry when there are no records", async () => {
    const usage = await buildRegistryUsage();
    for (const key of Object.values(USAGE_KEYS)) {
      expect(usage.get(key)).toBeInstanceOf(Map);
      expect(usage.get(key).size).toBe(0);
    }
  });
});

describe("sortByUsage", () => {
  it("orders by use count, then alphabetically for ties", () => {
    const counts = new Map([
      ["a", 1],
      ["b", 3],
      ["c", 3],
    ]);
    const sorted = sortByUsage(
      [
        { id: "a", name: "Alpha" },
        { id: "b", name: "Bravo" },
        { id: "c", name: "Charlie" },
        { id: "d", name: "Delta" },
      ],
      counts
    );
    expect(sorted.map((entry) => entry.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("does not mutate the input list", () => {
    const entries = [{ id: "a", name: "Alpha" }, { id: "b", name: "Bravo" }];
    const counts = new Map([["a", 5]]);
    const before = entries.map((entry) => entry.id);
    sortByUsage(entries, counts);
    expect(entries.map((entry) => entry.id)).toEqual(before);
  });
});
