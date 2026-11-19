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
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

const BANNERS = [
  ["src/modules/SHOS_Healthcare_Prototype.jsx", 1],
  ["src/modules/SHOS_Contacts_Prototype.jsx", 1],
  ["src/modules/SHOS_Encounters_Prototype.jsx", 2],
  ["src/modules/SHOS_Medication_Dashboard_Prototype.jsx", 1],
];

describe("sticky module banners give back the safe-area margin", () => {
  for (const [file, expected] of BANNERS) {
    it(`${file}: every negative-top-margin banner has a matching bottom margin`, () => {
      const src = read(file);
      const negatives = src.match(/marginTop: "calc\(-1 \* env\(safe-area-inset-top\)\)"/g) || [];
      const bottoms = src.match(/marginBottom: "env\(safe-area-inset-top\)"/g) || [];
      expect(negatives.length, `${file}: banner count changed`).toBe(expected);
      expect(bottoms.length).toBe(negatives.length);
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
