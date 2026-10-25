import { describe, it, expect } from "vitest";
import { MenstrualCycleRepository } from "../repositories/menstrualCycleRepository.js";
import { isDemoData, legacyDefinitionFor, demoComparable } from "./seedDivergence.js";

describe("debug", () => {
  it("checks menstrual cycle", async () => {
    const all = await MenstrualCycleRepository.getAll();
    const rec = all.find((r) => r.id === "seed_cycle_9001");
    console.log("rec.isDemo:", rec.isDemo);
    console.log("rec.isSeed:", rec.isSeed);
    const def = legacyDefinitionFor(rec);
    console.log("def exists:", !!def);
    console.log("isDemoData:", isDemoData(rec));
  });
});
