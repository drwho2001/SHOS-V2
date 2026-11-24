// stickyBannerOverlapGuard.test.js — 19 Nov 2026 device finding: Healthcare's
// title banner + tab row (and the same pattern in Contacts/Encounters/
// Medication) pulled its background up under the status bar with a negative
// top margin, but never gave that space back to the following row. On device
// the Episodes/Calendar/Card/Attachments quick links were clipped in half by
// the sticky tabs. Every sticky banner with the negative margin must now
// carry a matching `marginBottom: env(safe-area-inset-top)` so following
// content keeps its layout position. The Medication allergies card was also
// sticky at the SAME offset as the banner (lower zIndex) and got half-hidden
// on scroll — it is a plain summary and now scrolls normally.
//
// CHANGED 24 Nov 2026 — BACKLOG 0b: Contacts and Medication now render the
// shared ModuleBanner, so their margin pair lives in ONE component. The
// guard follows the ownership: it checks the component owns the pair, and
// that those two modules render it exactly once with no local copy. The
// modules still using an inline banner keep the original literal check.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

const DIRECT_BANNERS = [
  ["src/modules/SHOS_Healthcare_Prototype.jsx", 1],
  ["src/modules/SHOS_Encounters_Prototype.jsx", 2],
];
const SHARED_BANNERS = [
  "src/modules/SHOS_Contacts_Prototype.jsx",
  "src/modules/SHOS_Medication_Dashboard_Prototype.jsx",
];
const negatives = (src) => src.match(/marginTop: "calc\(-1 \* env\(safe-area-inset-top\)\)"/g) || [];
const bottoms = (src) => src.match(/marginBottom: "env\(safe-area-inset-top\)"/g) || [];

describe("sticky module banners give back the safe-area margin", () => {
  it("the shared ModuleBanner owns the sticky offset and the matching pair", () => {
    const src = read("src/components/ModuleBanner.jsx");
    expect(src).toMatch(/top: "var\(--shos-top-banner-h, 0px\)"/);
    expect(negatives(src).length).toBe(1);
    expect(bottoms(src).length).toBe(1);
  });

  for (const [file, expected] of DIRECT_BANNERS) {
    it(`${file}: every inline banner has a matching bottom margin`, () => {
      const src = read(file);
      expect(negatives(src).length, `${file}: inline banner count changed`).toBe(expected);
      expect(bottoms(src).length).toBe(negatives(src).length);
    });
  }

  for (const file of SHARED_BANNERS) {
    it(`${file}: uses the shared ModuleBanner and keeps no local banner copy`, () => {
      const src = read(file);
      expect(src).toMatch(/import ModuleBanner/);
      expect(src.match(/<ModuleBanner\b/g) || []).toHaveLength(1);
      expect(negatives(src)).toHaveLength(0);
      expect(bottoms(src)).toHaveLength(0);
    });
  }

  it("the Medication allergies summary no longer pins behind the banner", () => {
    const src = read("src/modules/SHOS_Medication_Dashboard_Prototype.jsx");
    const i = src.indexOf("Allergies remain sourced from My Profile");
    expect(i).toBeGreaterThan(-1);
    const block = src.slice(i, i + 1400);
    expect(block).not.toMatch(/position: "sticky"/);
    expect(block).not.toMatch(/top: "var\(--shos-top-banner-h/);
  });
});
