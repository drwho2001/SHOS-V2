// F1 (18 Nov) — recorded owner decision: ONE Healthcare sub-tab renamed
// "Reproductive health", with Cycle / Contraception / Pregnancy sections
// inside it. No 6th bottom tab, no new top-level pill.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const healthcare = read("src/modules/SHOS_Healthcare_Prototype.jsx");
const module = read("src/modules/SHOS_MenstrualHealth_Prototype.jsx");
const app = read("src/App.jsx");

describe("Reproductive health cluster", () => {
  it("Healthcare shows one renamed sub-tab gated by the existing toggle", () => {
    expect(healthcare).toMatch(/key: "menstrualHealth", label: tr\("healthcare\.menstrual", "Reproductive health"\)/);
    expect(healthcare).toMatch(/menstrualTrackingEnabled \? \[\{ key: "menstrualHealth"/);
    expect(healthcare).not.toMatch(/label: tr\("healthcare\.menstrual", "Menstrual & Contraception"\)/);
  });

  it("the module header carries the new name and the three inner sections", () => {
    expect(module).toMatch(/>Reproductive health<\/span>/);
    for (const label of ["menstrual.cycle", "menstrual.contraception", "menstrual.pregnancy"]) {
      expect(module, label).toContain(label);
    }
    expect(module).not.toMatch(/>Menstrual & Contraception<\/span>/);
  });

  it("does not add a 6th bottom tab", () => {
    // The bottom nav stays the fixed set; Reproductive health lives inside
    // Healthcare as a sub-tab only.
    const tabs = app.match(/const TABS = \[[\s\S]*?\n\];/)?.[0] || "";
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs).not.toMatch(/Reproductive health/);
    expect(tabs).not.toMatch(/menstrualHealth/);
  });

  it("both locale files use the new label", () => {
    for (const f of ["src/i18n/en.json", "src/i18n/en-US.json"]) {
      expect(read(f)).toMatch(/"menstrual": "Reproductive health"/);
    }
  });
});
