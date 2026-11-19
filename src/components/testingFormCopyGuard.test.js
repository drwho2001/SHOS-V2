// 19 Nov 2026 — the new-test form: no hand-typed "most recent" flag, and a
// symptom-reporting section above Result that works on a new (unsaved) test.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const UI = read("src/modules/SHOS_Testing_Prototype.jsx");
const REPO = read("src/repositories/testingRepository.js");

describe("new-test form: most recent is derived, not hand-typed", () => {
  it("the form has no Most recent toggle writing the flag", () => {
    expect(UI).not.toMatch(/onChange=\{set\("mostRecent"\)\}/);
    expect(UI).not.toMatch(/<ToggleSwitch[^>]*value=\{form\.mostRecent\}/);
    // Row + detail derive it from the shared helper instead.
    expect(UI).toMatch(/import \{ isMostRecentTest \}/);
    expect(UI).toMatch(/isMostRecentTest\(t, tests\)/);
    expect(UI).toMatch(/isMostRecentTest\(test, allTests\)/);
  });

  it("the repository never writes the flag on create or update", () => {
    expect(REPO).not.toMatch(/mostRecent:\s*isFuture/);
    expect(REPO).not.toMatch(/_supersedeOlderMostRecent/);
  });
});

describe("new-test form: symptom reporting above Result", () => {
  it("surfaces the reason chips and free-text symptom field", () => {
    expect(UI).toMatch(/TEST_REASON_OPTIONS\.map/);
    expect(UI).toMatch(/set\("symptomsReported"\)/);
    expect(REPO).toMatch(/symptomsReported:/);
  });

  it("the Why tested card sits before the Result card", () => {
    const why = UI.indexOf('title={tr("testing.whyTested"');
    const result = UI.indexOf('title={tr("testing.result", "Result")}');
    expect(why).toBeGreaterThan(-1);
    expect(result).toBeGreaterThan(why);
  });

  it("symptom linking works on a new test via pending ids applied on save", () => {
    expect(UI).toMatch(/newSymptomIds/);
    expect(UI).toMatch(/if \(isNew\) \{ setNewSymptomIds/);
    expect(UI).toMatch(/for \(const symptomId of newSymptomIds\)/);
  });

  it("carries no clinical advice or 'not recommended' wording in the new card", () => {
    const why = UI.indexOf('title={tr("testing.whyTested"');
    const result = UI.indexOf('title={tr("testing.result", "Result")}');
    // Strip JSX comments — the ban is about USER-FACING copy, not the comment
    // explaining why the card was added (which itself names the banned phrase).
    const card = UI.slice(why, result).replace(/\{\/\*[\s\S]*?\*\/\}/g, "").toLowerCase();
    for (const banned of ["not recommended", "you should", "see a doctor", "urgent"]) {
      expect(card, `card copy contains banned phrase: ${banned}`).not.toContain(banned);
    }
  });
});
