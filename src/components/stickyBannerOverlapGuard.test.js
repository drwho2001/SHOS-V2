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

// CHANGED 24 Nov: Encounters' list banner moved to ModuleBanner; its
// detail header is still an inline sticky header and keeps the literal
// pair (one, down from two).
const DIRECT_BANNERS = [
  ["src/modules/SHOS_Encounters_Prototype.jsx", 1],
];
const SHARED_BANNERS = [
  ["src/modules/SHOS_Contacts_Prototype.jsx", 0],
  ["src/modules/SHOS_Medication_Dashboard_Prototype.jsx", 0],
  ["src/modules/SHOS_Encounters_Prototype.jsx", 1], // detail header
  ["src/modules/SHOS_Healthcare_Prototype.jsx", 0],
];
const negatives = (src) => src.match(/marginTop: "calc\(-1 \* env\(safe-area-inset-top\)\)"/g) || [];
const bottoms = (src) => src.match(/marginBottom: "env\(safe-area-inset-top\)"/g) || [];

describe("sticky module banners give back the safe-area margin", () => {
  it("the shared ModuleBanner owns the sticky offset and the matching pair", () => {
    const src = read("src/components/ModuleBanner.jsx");
    expect(src).toMatch(/top: "var\(--shos-top-banner-h, 0px\)"/);
    // 26 Nov: the margin pair and top padding are root-owned variables. When
    // a due/refill banner is up they drop the safe-area inset so the module
    // title does not sit a second inset below it.
    expect(src).toMatch(/marginTop: "var\(--shos-banner-top-margin, calc\(-1 \* env\(safe-area-inset-top\)\)\)"/);
    expect(src).toMatch(/marginBottom: "var\(--shos-banner-bottom-margin, env\(safe-area-inset-top\)\)"/);
    expect(src).toMatch(/padding: "var\(--shos-banner-pad-top, calc\(16px \+ env\(safe-area-inset-top\)\)\) 16px 14px"/);
  });

  it("the app root drops the banner inset only while a banner is present", () => {
    const src = read("src/App.jsx");
    expect(src).toMatch(/"--shos-top-banner-h": `\$\{topBannerTotal\}px`/);
    expect(src).toMatch(/"--shos-banner-top-margin": topBannerTotal > 0 \? "0px" : "calc\(-1 \* env\(safe-area-inset-top\)\)"/);
    expect(src).toMatch(/"--shos-banner-bottom-margin": topBannerTotal > 0 \? "0px" : "env\(safe-area-inset-top\)"/);
    expect(src).toMatch(/"--shos-banner-pad-top": topBannerTotal > 0 \? "16px" : "calc\(16px \+ env\(safe-area-inset-top\)\)"/);
  });

  for (const [file, expected] of DIRECT_BANNERS) {
    it(`${file}: every inline banner has a matching bottom margin`, () => {
      const src = read(file);
      expect(negatives(src).length, `${file}: inline banner count changed`).toBe(expected);
      expect(bottoms(src).length).toBe(negatives(src).length);
    });
  }

  for (const [file, inlineCount] of SHARED_BANNERS) {
    it(`${file}: uses the shared ModuleBanner and keeps only its declared inline headers`, () => {
      const src = read(file);
      expect(src).toMatch(/import ModuleBanner/);
      expect(src.match(/<ModuleBanner\b/g) || []).toHaveLength(1);
      expect(negatives(src)).toHaveLength(inlineCount);
      expect(bottoms(src)).toHaveLength(inlineCount);
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
