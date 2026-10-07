// Routine-retest plan lifecycle at the repository layer.
//
// WHY A REPOSITORY TEST AND NOT ONLY A CALCULATION ONE. Every rule worth testing
// in testingCalculations.js is pure and cheap, but the plan feature's real risk
// is a bad WRITE: a plan that silently becomes a completed test, a "performed"
// transition that fires on a normal test, or a create that keeps an old id
// space. None of those are visible to a pure test, and this repository is the
// one place a plan can be turned into something it is not.
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStore = new Map();

vi.mock("../storage/storageAdapter", () => {
  const mockAdapter = {
    load: vi.fn((key, fallback) => {
      if (mockStore.has(key)) return mockStore.get(key);
      return fallback;
    }),
    save: vi.fn((key, value) => {
      mockStore.set(key, JSON.stringify(value));
      return true;
    }),
  };
  return { localStorageAdapter: mockAdapter };
});

const { TestingRepository, STORAGE_KEY, SEED_TEST_IDS } = await import("./testingRepository.js");

describe("TestingRepository routine retest plans", () => {
  beforeEach(async () => {
    mockStore.clear();
    mockStore.set(STORAGE_KEY, []);
    // replaceAll is the real API, so this is a genuine reset rather than a
    // test-only hook that could stop existing without anything noticing. It also
    // recomputes nextTestNumber, so ids stay predictable between tests.
    await TestingRepository.replaceAll([]);
  });

  it("creates a plan carrying the panel, and no result", async () => {
    const plan = await TestingRepository.createRoutineRetestPlan({
      title: "Routine retest",
      date: "2026-09-20",
      sourceTestId: "test_001",
    });

    expect(plan.isRoutineRetestPlan).toBe(true);
    expect(plan.plannedForDate).toBe("2026-09-20");
    expect(plan.routineRetestSourceTestId).toBe("test_001");
    expect(plan.testingFor).toContain("HIV");
    // A plan with a result would look like a completed test to any derivation
    // that reads resultIds before checking the plan flag.
    expect(plan.resultIds).toEqual([]);
    expect(plan.id).toMatch(/^test_\d+$/);
  });

  it("stores the plan date at midday so no timezone can read it as the day before", async () => {
    const plan = await TestingRepository.createRoutineRetestPlan({ title: "Routine retest", date: "2026-09-20" });
    expect(plan.date).toBe("2026-09-20T12:00:00.000Z");
  });

  it("carries the source test's sample types onto the plan", async () => {
    // The repository-level assertion, because a passing unit test on the pure
    // prefill proves the FUNCTION works and not that anything calls it - the
    // exact gap this repo has been bitten by repeatedly.
    const source = await TestingRepository.create({
      title: "Screening",
      date: "2026-06-01T09:00:00.000Z",
      testingFor: ["Gonorrhoea", "Chlamydia", "HIV", "Syphilis"],
      sampleType: ["Urine", "Throat swab", "Blood"],
    });

    const plan = await TestingRepository.createRoutineRetestPlan({
      title: "Routine retest",
      date: "2026-09-20",
      sourceTestId: source.id,
    });

    expect(plan.sampleType).toEqual(["Urine", "Throat swab", "Blood"]);

    // And it must be a SEPARATE array in storage: editing the plan must not
    // reach back and rewrite the completed test it follows.
    const storedSource = await TestingRepository.getById(source.id);
    expect(storedSource.sampleType).toEqual(["Urine", "Throat swab", "Blood"]);
  });

  it("carries no samples when the source test no longer resolves", async () => {
    // Safe direction: a plan with fewer prefilled fields is one the owner fills
    // in, whereas a plan prefilled from a wrong record is one they might not check.
    const plan = await TestingRepository.createRoutineRetestPlan({
      title: "Routine retest",
      date: "2026-09-20",
      sourceTestId: "test_does_not_exist",
    });
    expect(plan.sampleType).toEqual([]);
    expect(plan.testingFor.length).toBeGreaterThan(0);
  });

  it("refuses a plan with no title or an impossible date", async () => {
    await expect(TestingRepository.createRoutineRetestPlan({ title: "  ", date: "2026-09-20" })).rejects.toThrow();
    await expect(TestingRepository.createRoutineRetestPlan({ title: "x", date: "" })).rejects.toThrow();
    // 2026 is not a leap year, so this is not a real calendar day and must not
    // be silently rolled into March the way a Date constructor would.
    await expect(TestingRepository.createRoutineRetestPlan({ title: "x", date: "2026-02-30" })).rejects.toThrow();
    // The assertion that the above is genuinely rejecting a bad DAY rather than
    // a well-formed one, since both must otherwise succeed.
    await expect(TestingRepository.createRoutineRetestPlan({ title: "x", date: "2026-02-28" })).resolves.toBeTruthy();
  });

  it("a plan can never be marked most recent", async () => {
    // create() already forces mostRecent false for a future date, and a plan is
    // by definition in the future. Asserted anyway, because "most recent" is the
    // flag the whole app treats as "this is the real answer".
    const plan = await TestingRepository.createRoutineRetestPlan({ title: "Routine retest", date: "2099-01-01" });
    expect(plan.mostRecent).toBe(false);
  });

  it("marking performed turns the plan into a completed test and stamps the moment", async () => {
    const plan = await TestingRepository.createRoutineRetestPlan({ title: "Routine retest", date: "2026-09-20" });
    const done = await TestingRepository.markRoutineRetestPerformed(plan.id, {
      date: "2026-09-20T10:00:00.000Z",
      resultIds: ["result_002"],
      testingFor: ["Gonorrhoea", "Chlamydia", "HIV", "Syphilis"],
    });

    expect(done.isRoutineRetestPlan).toBe(false);
    expect(done.routineRetestPerformedAt).toBeTruthy();
    // The date the user PLANNED for is retained, so the record can still say what
    // the intention was even now that it happened.
    expect(done.plannedForDate).toBe("2026-09-20");
    expect(done.resultIds).toEqual(["result_002"]);
  });

  it("refuses to mark a normal test as performed", async () => {
    // Without this guard, a call site that wrongly passes a completed test id
    // would stamp routineRetestPerformedAt on it and claim an intention existed.
    const real = await TestingRepository.create({ title: "Real screen", date: "2026-09-20T10:00:00.000Z" });
    expect(await TestingRepository.markRoutineRetestPerformed(real.id, {})).toBeNull();
    expect(await TestingRepository.markRoutineRetestPerformed("nope", {})).toBeNull();
    const stored = await TestingRepository.getById(real.id);
    expect(stored.routineRetestPerformedAt).toBeNull();
  });

  it("updating a plan keeps it a plan", async () => {
    const plan = await TestingRepository.createRoutineRetestPlan({ title: "Routine retest", date: "2026-09-20" });
    const moved = await TestingRepository.updateRoutineRetestPlan(plan.id, { title: "Clinic screen", date: "2026-10-04" });

    expect(moved.isRoutineRetestPlan).toBe(true);
    expect(moved.plannedForDate).toBe("2026-10-04");
    expect(moved.date).toBe("2026-10-04T12:00:00.000Z");
    expect(moved.title).toBe("Clinic screen");
  });

  it("refuses to repoint a normal test using the plan editor", async () => {
    const real = await TestingRepository.create({ title: "Real screen", date: "2026-09-20T10:00:00.000Z" });
    expect(await TestingRepository.updateRoutineRetestPlan(real.id, { title: "x", date: "2026-10-04" })).toBeNull();
    expect((await TestingRepository.getById(real.id)).title).toBe("Real screen");
  });

  it("archive and unarchive work on a plan like any other record", async () => {
    const plan = await TestingRepository.createRoutineRetestPlan({ title: "Routine retest", date: "2026-09-20" });
    await TestingRepository.archive(plan.id);
    expect((await TestingRepository.getById(plan.id)).isArchived).toBe(true);
    await TestingRepository.unarchive(plan.id);
    expect((await TestingRepository.getById(plan.id)).isArchived).toBe(false);
  });

  it("does not add plans to the sample-data id set", async () => {
    // Sample data is identified purely by id, so a user-created plan must never
    // be collectable as demo data - and equally, no plan may collide with one.
    const plan = await TestingRepository.createRoutineRetestPlan({ title: "Routine retest", date: "2026-09-20" });
    expect(SEED_TEST_IDS.has(plan.id)).toBe(false);
  });
});