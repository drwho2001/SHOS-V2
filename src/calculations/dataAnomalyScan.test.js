// Tests for dataAnomalyScan.js.
//
// READ-ONLY BY CONSTRUCTION, and that is asserted rather than assumed: the scan
// takes no write path at all, so there is nothing here to assert about a repair
// it must not perform. What IS asserted is the opposite risk - that it stays
// SILENT rather than wrong. A detector that flags a booked future appointment,
// or two separate meetings at the same venue, is worse than one that misses a
// duplicate, because the owner learns to ignore the whole tool.
//
// Repositories are mocked rather than exercised for real: they need the
// encryption vault unlocked, and a test that quietly asserts against module
// memory while the real read never happened is worse than no test.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

let encounters = [];
let tests = [];
let visits = [];
let symptoms = [];
let episodes = [];
let vaccinations = [];
let measurements = [];
let logs = [];
let cycles = [];

vi.mock("../repositories/encounterRepository.js", () => ({
  EncounterRepository: { getAll: async () => encounters, getById: async (id) => encounters.find((e) => e.id === id) },
}));
vi.mock("../repositories/testingRepository.js", () => ({
  TestingRepository: { getAll: async () => tests },
}));
vi.mock("../repositories/clinicVisitsRepository.js", () => ({
  ClinicVisitsRepository: { getAll: async () => visits, getById: async (id) => visits.find((v) => v.id === id) },
}));
vi.mock("../repositories/symptomLogRepository.js", () => ({
  SymptomLogRepository: { getAll: async () => symptoms },
}));
vi.mock("../repositories/episodeRepository.js", () => ({
  EpisodeRepository: { getAll: async () => episodes },
}));
vi.mock("../repositories/vaccinationRepository.js", () => ({
  VaccinationRepository: { getAll: async () => vaccinations },
}));
vi.mock("../repositories/measurementRepository.js", () => ({
  MeasurementRepository: { getAll: async () => measurements },
}));
vi.mock("../repositories/logRepository.js", () => ({
  LogRepository: { getAll: async () => logs },
}));
vi.mock("../repositories/menstrualCycleRepository.js", () => ({
  MenstrualCycleRepository: { getAll: async () => cycles },
}));

const { findDataAnomalies, DOUBLE_LOG_WINDOW_HOURS } = await import("./dataAnomalyScan.js");

// Pinned rather than relative, for the reason this file's whole subject is: a
// date-dependent assertion that tracks the wall clock is the bug class itself.
const TODAY = "2026-10-07";
const run = () => findDataAnomalies({ todayKey: TODAY });
  const pair = (hours) => {
    const base = new Date("2026-09-20T20:00:00.000Z").getTime();
    encounters = [
      { id: "enc_1", title: "Sauna trip", date: new Date(base).toISOString(), attendeeIds: ["c1", "c2"], locationId: "loc_1" },
      { id: "enc_2", title: "Sauna trip", date: new Date(base + hours * 3600000).toISOString(), attendeeIds: ["c2", "c1"], locationId: "loc_1" },
    ];
  };
const ofKind = (r, kind) => r.findings.filter((f) => f.kind === kind);


beforeEach(() => {
  encounters = []; tests = []; visits = []; symptoms = []; episodes = [];
  vaccinations = []; measurements = []; logs = []; cycles = [];
});

describe("records that cannot be in the future", () => {
  it("flags a test dated after today", async () => {
    tests = [{ id: "test_1", title: "Screen", date: "2026-11-01T09:00:00.000Z", resultDate: null }];
    const found = ofKind(await run(), "futureDate");
    expect(found).toHaveLength(1);
    expect(found[0].recordType).toBe("Test");
    expect(found[0].why).toMatch(/25 days in the future/);
  });

  it("says tomorrow rather than saying 1 day", async () => {
    tests = [{ id: "test_1", title: "Screen", date: "2026-10-08T09:00:00.000Z", resultDate: null }];
    expect(ofKind(await run(), "futureDate")[0].why).toMatch(/tomorrow/);
  });

  it("leaves a booked future clinic visit alone, because that is a real thing", async () => {
    // The single most important exclusion in the file. A future clinic visit is
    // a scheduled appointment, and CLAUDE.md already records that future
    // appointments must not be treated as stale.
    visits = [{ id: "visit_1", title: "Review", date: "2026-12-01T09:00:00.000Z", linkedTestIds: [] }];
    expect(ofKind(await run(), "futureDate")).toHaveLength(0);
  });

  it("leaves a future encounter alone too", async () => {
    encounters = [{ id: "enc_1", title: "Sauna", date: "2026-11-20T22:00:00.000Z", attendeeIds: ["c1"], locationId: "" }];
    expect(ofKind(await run(), "futureDate")).toHaveLength(0);
  });

  it("flags a dose logged for a day that has not happened", async () => {
    logs = [{ id: "log_1", type: "dose", date: "2026-10-20T08:00:00.000Z", delta: -1 }];
    const found = ofKind(await run(), "futureDate");
    expect(found).toHaveLength(1);
    expect(found[0].recordType).toBe("Medication log entry");
  });

  it("does not flag today, which is not in the future", async () => {
    tests = [{ id: "test_1", title: "Screen", date: "2026-10-07T09:00:00.000Z", resultDate: null }];
    expect(ofKind(await run(), "futureDate")).toHaveLength(0);
  });

  it("ignores an unreadable date rather than guessing", async () => {
    tests = [{ id: "test_1", title: "Screen", date: "not a date", resultDate: "" }];
    expect(ofKind(await run(), "futureDate")).toHaveLength(0);
  });
});

describe("dates that contradict each other", () => {
  it("flags a result dated well before its own specimen", async () => {
    tests = [{ id: "test_1", title: "Screen", date: "2026-09-20T09:00:00.000Z", resultDate: "2026-09-15T09:00:00.000Z" }];
    const found = ofKind(await run(), "ordering");
    expect(found).toHaveLength(1);
    expect(found[0].why).toMatch(/5 days BEFORE its sample date/);
  });

  it("allows a result the next morning, because that is normal", async () => {
    tests = [{ id: "test_1", title: "Screen", date: "2026-09-20T23:30:00.000Z", resultDate: "2026-09-21T08:00:00.000Z" }];
    expect(ofKind(await run(), "ordering")).toHaveLength(0);
  });

  it("allows a result dated exactly one day before its specimen", async () => {
    // The tolerance boundary, asserted EXACTLY. A result reported the previous
    // afternoon for a next-morning sample is ordinary, so gap === -1 must be
    // permitted - and this is the single case that distinguishes "at least one
    // day of slack" from "no slack at all". Without it the tolerance rule could
    // be deleted outright and every suite would still pass.
    tests = [{ id: "test_1", title: "Screen", date: "2026-09-20T09:00:00.000Z", resultDate: "2026-09-19T09:00:00.000Z" }];
    expect(ofKind(await run(), "ordering")).toHaveLength(0);
  });

  it("still flags two days before, so the tolerance is a day and not a blank cheque", async () => {
    tests = [{ id: "test_1", title: "Screen", date: "2026-09-20T09:00:00.000Z", resultDate: "2026-09-18T09:00:00.000Z" }];
    expect(ofKind(await run(), "ordering")).toHaveLength(1);
  });

  it("flags a sample taken long after the visit it is filed under", async () => {
    visits = [{ id: "visit_1", title: "Review", date: "2026-09-01T09:00:00.000Z", linkedTestIds: [] }];
    tests = [{ id: "test_1", title: "Screen", date: "2026-09-20T09:00:00.000Z", resultDate: null, clinicVisitIds: ["visit_1"] }];
    const found = ofKind(await run(), "ordering");
    expect(found).toHaveLength(1);
    expect(found[0].why).toMatch(/19 days AFTER the clinic visit/);
  });

  it("flags a symptom that started before the encounter it is linked to", async () => {
    encounters = [{ id: "enc_1", title: "Sauna", date: "2026-09-10T22:00:00.000Z", attendeeIds: [], locationId: "" }];
    symptoms = [{ id: "sym_1", title: "Discharge", dateStarted: "2026-09-01", relatedEncounterIds: ["enc_1"] }];
    const found = ofKind(await run(), "ordering");
    expect(found).toHaveLength(1);
    expect(found[0].why).toMatch(/9 days BEFORE the encounter/);
  });

  it("allows a symptom that starts after the encounter, which is ordinary", async () => {
    encounters = [{ id: "enc_1", title: "Sauna", date: "2026-09-01T22:00:00.000Z", attendeeIds: [], locationId: "" }];
    symptoms = [{ id: "sym_1", title: "Discharge", dateStarted: "2026-09-10", relatedEncounterIds: ["enc_1"] }];
    expect(ofKind(await run(), "ordering")).toHaveLength(0);
  });

  it("allows a symptom that starts on the day of the encounter", async () => {
    encounters = [{ id: "enc_1", title: "Sauna", date: "2026-09-10T22:00:00.000Z", attendeeIds: [], locationId: "" }];
    symptoms = [{ id: "sym_1", title: "Discharge", dateStarted: "2026-09-10", relatedEncounterIds: ["enc_1"] }];
    expect(ofKind(await run(), "ordering")).toHaveLength(0);
  });

  it("counts days exactly across a daylight-saving boundary", async () => {
    // Guards the DAY ARITHMETIC, asserted through the scan so the number in the
    // message is the one the user would read. Measured on this machine: a
    // 20 Mar -> 5 Apr 2026 span is 16 days at UTC midnight and 15.958 days at
    // local midnight, so a local parse would round to the same 16 and this test
    // would still pass - which is why the mutation pass could not catch that
    // mutation here, and why `daysBetween` is now a thin alias over the shared
    // `calendarDaysBetween` rather than a second implementation of the rule.
    encounters = [{ id: "enc_1", title: "Sauna", date: "2026-04-05T22:00:00.000Z", attendeeIds: [], locationId: "" }];
    symptoms = [{ id: "sym_1", title: "Discharge", dateStarted: "2026-03-20", relatedEncounterIds: ["enc_1"] }];
    const found = ofKind(await run(), "ordering");
    expect(found).toHaveLength(1);
    expect(found[0].why).toMatch(/16 days BEFORE/);
  });

  it("delegates its day arithmetic to the shared calendar helper", async () => {
    // Structural, and the assertion that actually pins the previous test's
    // claim: this module must not carry its own UTC-vs-local parse, because
    // that one is unobservable through any day count.
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "dataAnomalyScan.js"), "utf8");
    const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(withoutComments).toContain("calendarDaysBetween");
    // And it must not re-derive the same rule by hand.
    expect(withoutComments).not.toMatch(/T00:00:00Z/);
  });

  it("flags an episode resolved before the encounter that started it", async () => {
    encounters = [{ id: "enc_1", title: "Sauna", date: "2026-09-10T22:00:00.000Z", attendeeIds: [], locationId: "" }];
    episodes = [{ id: "ep_1", title: "Episode", startEncounterId: "enc_1", clinicVisitIds: [], resolvedDate: "2026-09-01T10:00:00.000Z" }];
    expect(ofKind(await run(), "ordering")).toHaveLength(1);
  });
});

describe("encounters that look logged twice", () => {
  const pair = (hours) => {
    const base = new Date("2026-09-20T20:00:00.000Z").getTime();
    encounters = [
      { id: "enc_1", title: "Sauna trip", date: new Date(base).toISOString(), attendeeIds: ["c1", "c2"], locationId: "loc_1" },
      { id: "enc_2", title: "Sauna trip", date: new Date(base + hours * 3600000).toISOString(), attendeeIds: ["c2", "c1"], locationId: "loc_1" },
    ];
  };

  it("flags the same contacts at the same place 8 hours apart", async () => {
    pair(8);
    const found = ofKind(await run(), "doubleLogged");
    expect(found).toHaveLength(1);
    expect(found[0].why).toMatch(/same 2 contacts, same location, 8 hours apart/);
  });

  it("treats a different set of contacts at the same venue as NOT a duplicate", async () => {
    // This is the false positive that matters: the same sauna is not a duplicate.
    encounters = [
      { id: "enc_1", title: "A", date: "2026-09-20T20:00:00.000Z", attendeeIds: ["c1"], locationId: "loc_1" },
      { id: "enc_2", title: "B", date: "2026-09-20T23:00:00.000Z", attendeeIds: ["c9"], locationId: "loc_1" },
    ];
    expect(ofKind(await run(), "doubleLogged")).toHaveLength(0);
  });

  it("does not flag two records with no contacts, because that is no evidence", async () => {
    encounters = [
      { id: "enc_1", title: "A", date: "2026-09-20T20:00:00.000Z", attendeeIds: [], locationId: "loc_1" },
      { id: "enc_2", title: "B", date: "2026-09-20T23:00:00.000Z", attendeeIds: [], locationId: "loc_1" },
    ];
    expect(ofKind(await run(), "doubleLogged")).toHaveLength(0);
  });

  it("does not flag a pair where only ONE record has no contacts", async () => {
    // The asymmetric case, and the one a single-sided guard would miss. The
    // empty-set key is "", so if only the non-empty check existed this pair
    // would sail through on "" versus "c1" being unequal by luck - the failure
    // mode is a pair that differs on ONE side, which needs its own fixture
    // rather than being assumed to follow from the symmetric one.
    encounters = [
      { id: "enc_1", title: "A", date: "2026-09-20T20:00:00.000Z", attendeeIds: [], locationId: "loc_1" },
      { id: "enc_2", title: "B", date: "2026-09-20T23:00:00.000Z", attendeeIds: [], locationId: "loc_1" },
    ];
    encounters[1].attendeeIds = ["c1"];
    encounters[1].locationId = "loc_1";
    expect(ofKind(await run(), "doubleLogged")).toHaveLength(0);
  });

  it("does not flag the same people at different places", async () => {
    encounters = [
      { id: "enc_1", title: "A", date: "2026-09-20T20:00:00.000Z", attendeeIds: ["c1"], locationId: "loc_1" },
      { id: "enc_2", title: "B", date: "2026-09-20T23:00:00.000Z", attendeeIds: ["c1"], locationId: "loc_2" },
    ];
    expect(ofKind(await run(), "doubleLogged")).toHaveLength(0);
  });

  it("does not flag a genuine second meeting the following day", async () => {
    encounters = [
      { id: "enc_1", title: "A", date: "2026-09-20T23:00:00.000Z", attendeeIds: ["c1"], locationId: "loc_1" },
      { id: "enc_2", title: "B", date: "2026-09-21T20:00:00.000Z", attendeeIds: ["c1"], locationId: "loc_1" },
    ];
    expect(ofKind(await run(), "doubleLogged")).toHaveLength(0);
  });

  it("says it is a pair rather than a verdict", async () => {
    pair(8);
    const found = ofKind(await run(), "doubleLogged")[0];
    expect(found.pairedWithId).toBe("enc_2");
    expect(found.pairedWithLabel).toBe("Sauna trip");
    expect(found.confidence).toBe("worth a look");
    expect(found.fixableByEditingTheRecord).toBe(false);
  });

  it("uses a window wider than a same-morning double log", async () => {
    expect(DOUBLE_LOG_WINDOW_HOURS).toBeGreaterThanOrEqual(12);
  });
});

describe("the scan as a whole", () => {
  it("reports counts per kind and a total", async () => {
    tests = [{ id: "test_1", title: "Screen", date: "2026-11-01T09:00:00.000Z", resultDate: null }];
    const r = await run();
    expect(r.total).toBe(r.findings.length);
    expect(r.byKind.futureDate).toBe(1);
    expect(r.todayKey).toBe(TODAY);
  });

  it("is silent on clean data", async () => {
    tests = [{ id: "test_1", title: "Screen", date: "2026-09-01T09:00:00.000Z", resultDate: "2026-09-02T09:00:00.000Z", clinicVisitIds: [] }];
    encounters = [{ id: "enc_1", title: "Sauna", date: "2026-09-20T20:00:00.000Z", attendeeIds: ["c1"], locationId: "loc_1" }];
    expect((await run()).total).toBe(0);
  });

  it("exports no repair function at all, so nothing can write by accident", async () => {
    // The strongest form of read-only: there is no repair entry point to call.
    // Asserting "it does not repair X" would be weaker - it would still pass if
    // a repair function existed and simply was not exercised by these tests.
    const mod = await import("./dataAnomalyScan.js");
    const exported = Object.keys(mod);
    expect(exported.filter((n) => /repair|fix|clear|write|update|apply|delete/i.test(n))).toEqual([]);
  });

  it("marks a wrong date as the user's to correct, never the app's to auto-fix", async () => {
    // `fixableByEditingTheRecord` means a human edits the record's own date. It
    // is the opposite of an automatic action, which is why the field is named
    // for WHO fixes it rather than being a bare boolean.
    tests = [{ id: "test_1", title: "Screen", date: "2026-11-01T09:00:00.000Z", resultDate: null }];
    const f = ofKind(await run(), "futureDate")[0];
    expect(f.fixableByEditingTheRecord).toBe(true);
  });

  it("offers no repair at all on a possible duplicate, because the record is not wrong", async () => {
    // A double log is not a bad field value. Deciding which one to remove is a
    // judgement about the user's own memory, so there is nothing to auto-fix.
    pair(8);
    expect(ofKind(await run(), "doubleLogged")[0].fixableByEditingTheRecord).toBe(false);
  });

});
