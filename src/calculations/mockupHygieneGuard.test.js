// P3 hygiene — CI guard for the static design mockups (the "23 files" note in
// BACKLOG.md). Two recorded divergences, now fixed and locked here:
//  1. card radius 12 -> RADIUS.md 13;
//  2. frosted-glass cards (design manual #7: solid surfaces only).
// Live public/ pages are excluded — their radii are deliberate UI choices.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const mocks = fs.readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .map((f) => ({ name: f, src: fs.readFileSync(path.join(ROOT, f), "utf8") }));

describe("mockup hygiene", () => {
  it("finds the mockup set", () => {
    expect(mocks.length).toBeGreaterThan(15);
  });

  it("no mockup card uses the old 12px radius", () => {
    const offenders = mocks.filter((m) => /border-radius:\s*12px/.test(m.src)).map((m) => m.name);
    expect(offenders).toEqual([]);
  });

  it("no mockup uses frosted-glass cards (solid surfaces only)", () => {
    // blur(4px) on a modal overlay is a normal scrim; blur(8px) on a card is
    // glassmorphism, which the design manual explicitly rejects.
    const offenders = mocks.filter((m) => /backdrop-filter:\s*blur\(8px\)/.test(m.src)).map((m) => m.name);
    expect(offenders).toEqual([]);
  });

  it("the live public pages keep their own deliberate radii", () => {
    for (const f of ["public/landing.html", "public/share.html"]) {
      expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
    }
  });
});
