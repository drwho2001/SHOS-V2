// F2 (18 Nov) — Testing is the single owner of pregnancy test records;
// Pregnancy is a read-only projection + prefilled deep-link. Source guard.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const module = read("src/modules/SHOS_MenstrualHealth_Prototype.jsx");
const app = read("src/App.jsx");
const repo = read("src/repositories/pregnancyRepository.js");

describe("pregnancy test ownership (F2)", () => {
  it("the pregnancy record links to a Testing-owned record", () => {
    expect(repo).toMatch(/testId: null/);
    expect(module).toMatch(/projectPregnancyTest\(linked/);
    expect(module).toMatch(/linkedTestFor\(p\)/);
  });

  it("the pregnancy form no longer asks for test date/result/sample", () => {
    const sheet = module.slice(module.indexOf("function PregnancySheet("), module.indexOf("function PregnancyTab("));
    expect(sheet).not.toMatch(/label="Test date"/);
    expect(sheet).not.toMatch(/label="Result"/);
    expect(sheet).not.toMatch(/SAMPLE_TYPE_OPTIONS\.map/);
    expect(sheet).toMatch(/managed in Testing/);
  });

  it("the + button opens Testing prefilled with a pregnancy test", () => {
    expect(module).toMatch(/onQuickAddWithPrefill\("healthcare", "testing", \{ testingFor: \["Pregnancy"\] \}\)/);
  });

  it("the one-time migration is wired into boot", () => {
    expect(app).toMatch(/runPregnancyTestOwnershipMigration/);
  });

  it("Testing still offers Pregnancy as a test type", () => {
    const testing = read("src/repositories/testingRepository.js");
    expect(testing).toMatch(/"Pregnancy"/);
  });
});
