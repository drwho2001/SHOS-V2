// a11yAriaGuard.test.js — 19 Nov 2026: the first axe run found three critical
// ARIA issues (tabs with no tablist parent, an unlabelled select). Fixed here;
// the rest of the axe findings are baselined in a11y-baseline.json and the
// a11y-gate.cjs ratchet fails only on NEW violations.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("critical ARIA fixes", () => {
  it("Medication's tab pills sit in a labelled tablist", () => {
    const src = read("src/modules/SHOS_Medication_Dashboard_Prototype.jsx");
    expect(src).toMatch(/<div role="tablist" aria-label=\{tr\("medication\.tabs"/);
  });

  it("Healthcare's tablist contains only tabs — More sits outside it", () => {
    const src = read("src/modules/SHOS_Healthcare_Prototype.jsx");
    const start = src.indexOf('<div role="tablist" aria-label={tr("healthcare.tabsLabel"');
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("</div>", src.indexOf("))}", start));
    const block = src.slice(start, end);
    expect(block).toMatch(/role="tab"/);
    expect(block).not.toMatch(/More Healthcare sections/);
    expect(src.indexOf("More Healthcare sections", start)).toBeGreaterThan(end);
  });

  it("the Testing date filter select has an accessible name", () => {
    const src = read("src/modules/SHOS_Testing_Prototype.jsx");
    expect(src).toMatch(/<select value=\{dateFilter\}/);
    expect(src).toMatch(/aria-label=\{tr\("testing\.dateFilter", "Filter tests by date"\)\}/);
  });
});

describe("a11y gate ratchet", () => {
  it("wired into the shared verify gate, skipped by --fast", () => {
    const v = read("scripts/verify-changes.mjs");
    expect(v).toMatch(/if \(!FAST && !DOCS_ONLY\) \{\s*gate\("a11y ratchet"/);
    expect(v).toMatch(/scripts\/a11y-gate\.cjs/);
  });

  it("baseline records every accepted rule with a reason", () => {
    const b = JSON.parse(read("a11y-baseline.json"));
    const rules = Object.keys(b);
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(b[r]).toMatchObject({ count: expect.any(Number), reason: expect.any(String) });
  });
});
