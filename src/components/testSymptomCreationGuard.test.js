// testSymptomCreationGuard.test.js — 19 Nov 2026 owner finding: typing a
// symptom into the test form's "Symptoms reported" box and pressing Enter
// did NOT create a Symptom Log entry — the text was only a string on the
// test. The form now has an explicit "Add" control (and Enter) that creates
// a real Symptom Log stub and links it both ways via the symptom's own
// relatedTestIds, same owner as the existing link/unlink path.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("create a symptom entry from the test form", () => {
  const src = read("src/modules/SHOS_Testing_Prototype.jsx");

  it("creates a real Symptom Log stub with the symptom registry default shape", () => {
    expect(src).toMatch(/SymptomLogRepository, DEFAULT_SYMPTOM_ENTRY/);
    expect(src).toMatch(/const createSymptomFromTest = async \(\) => \{/);
    expect(src).toMatch(/SymptomLogRepository\.create\(\{\s*\.\.\.DEFAULT_SYMPTOM_ENTRY/);
    expect(src).toMatch(/title,/);
  });

  it("links both ways for new and existing tests (relatedTestIds is the owner)", () => {
    expect(src).toMatch(/if \(isNew\) setNewSymptomIds\(\(ids\) => \[\.\.\.ids, created\.id\]\)/);
    expect(src).toMatch(/relatedTestIds: \[\.\.\.\(fresh\?\.relatedTestIds \|\| \[\]\), testId\]/);
    // The save handler turns the staged ids into real links on the created test.
    expect(src).toMatch(/for \(const symptomId of newSymptomIds\)/);
    expect(src).toMatch(/created\.id\] \}\)/);
  });

  it("the form renders an Enter-capable input and an Add control", () => {
    expect(src).toMatch(/onKeyDown=\{\(e\) => \{ if \(e\.key === "Enter"\) \{ e\.preventDefault\(\); createSymptomFromTest\(\); \} \}\}/);
    expect(src).toMatch(/aria-label=\{tr\("testing\.addSymptom", "Add symptom entry"\)\}/);
    expect(src).toMatch(/onClick=\{createSymptomFromTest\}/);
  });
});
