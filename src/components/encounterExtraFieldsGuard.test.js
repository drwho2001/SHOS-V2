// 19 Nov — contraceptive failure + aftercare/mood fields. Guard that they
// exist as facts, use their own option sets, and don't re-ask derived fields.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const REPO = read("src/repositories/encounterRepository.js");
const UI = read("src/modules/SHOS_Encounters_Prototype.jsx");

describe("encounter extra fields", () => {
  it("stores both as facts on the record", () => {
    expect(REPO).toMatch(/protectionFailure: \[\]/);
    expect(REPO).toMatch(/aftercare: \[\]/);
  });

  it("has distinct option sets that cover the owner's examples", () => {
    const pf = REPO.slice(REPO.indexOf("PROTECTION_FAILURE_OPTIONS = ["), REPO.indexOf("];", REPO.indexOf("PROTECTION_FAILURE_OPTIONS = [")));
    expect(pf).toMatch(/Condom broke/);
    expect(pf).toMatch(/Condom slipped/);
    expect(pf).toMatch(/Vomited after dose/);
    const ac = REPO.slice(REPO.indexOf("AFTERCARE_OPTIONS = ["), REPO.indexOf("];", REPO.indexOf("AFTERCARE_OPTIONS = [")));
    for (const label of ["Cleaning / shower", "Food / drink", "Sleep", "Reassurance"]) {
      expect(ac).toContain(label);
    }
  });

  it("renders both in the form and the detail read view", () => {
    expect(UI).toMatch(/label=\{tr\("encounters.protectionFailure"/);
    expect(UI).toMatch(/label=\{tr\("encounters.aftercare"/);
    const reads = UI.match(/ReadRow label=\{tr\("encounters.(protectionFailure|aftercare)"/g) || [];
    expect(reads.length).toBe(2);
  });

  it("does not re-ask derived fields", () => {
    // DoxyPEP and "No barrier method" are derived, not asked — ensure the new
    // failure field didn't reintroduce them as editable inputs.
    expect(UI).not.toMatch(/onChange=\{set\("myDoxyPepStatus"\)\}/);
    expect(UI).not.toMatch(/onChange=\{set\("noBarrierMethod"\)\}/);
  });
});
