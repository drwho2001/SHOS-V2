// R8 (18 Nov) — Developer tools showed all-zero counts for the few frames
// before the async repository reads resolved, which reads as "no data".
// Counts now start as null and render a loading mark until loaded.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(
  path.join(process.cwd(), "src/modules/settings/DeveloperToolsScreen.jsx"),
  "utf8"
);

describe("Developer tools counts loading state", () => {
  it("is reading the real Developer tools screen", () => {
    expect(src.length).toBeGreaterThan(20_000);
    expect(src).toContain("const counts = [");
  });

  it("no count defaults to 0 before its async read completes", () => {
    expect(src).not.toMatch(/\.then\(\(l\) => l\.length\), \[\], 0\)/);
    const nullFallbacks = src.match(/\.then\(\(l\) => l\.length\), \[\], null\)/g) || [];
    expect(nullFallbacks.length).toBeGreaterThanOrEqual(15);
  });

  it("renders a loading mark instead of a raw null/0 while loading", () => {
    expect(src).toMatch(/c\.value === null \? "…" : c\.value/);
    expect(src).toMatch(/errorCount === null \? "…" : errorCount === 0 \? "None" : errorCount/);
  });
});
