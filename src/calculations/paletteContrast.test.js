// Guards the colour-contrast of the module accents, so a later edit to one
// token cannot silently break every badge that uses it.
//
// WHY A TEST AND NOT A SCAN: four automated attempts at scanning the source for
// text-on-its-own-tint sites all failed, differently each time, and the failure
// mode was the dangerous one — reporting ZERO problems from a detector that had
// never once fired. The per-module `T.*` tokens are produced by each module's
// own buildLight()/buildDark() and do not exist in designTokens.js, so they
// cannot be resolved by reading that one file; and the real source form is
// `` background: `${T.actionRed}1A` `` — alpha hex followed by a BACKTICK, which
// one attempt's regex got wrong by demanding a closing brace.
//
// There are only four distinct accents to check, so naming them and computing
// the numbers directly is both more reliable and far cheaper than parsing. That
// is the same reason the 10 and 15 Sep audits measured these by hand.
//
// WHAT IS GUARDED: each accent, used as a TEXT colour on a background tinted
// with ITSELF, at every alpha actually used in the source. This is the exact
// pattern the 10/15 Sep accessibility work fixed, and the one most likely to
// regress when someone adds a new badge.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const TOKENS = readFileSync(path.join(process.cwd(), "src", "calculations", "designTokens.js"), "utf8");

function block(anchor) {
  const i = TOKENS.indexOf(anchor);
  expect(i, `could not find "${anchor}" in designTokens.js - has the token block moved?`).toBeGreaterThan(-1);
  const end = TOKENS.indexOf("\n};", i);
  const body = TOKENS.slice(i, end === -1 ? i + 3000 : end);
  return Object.fromEntries([...body.matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{3,8})"/g)].map((m) => [m[1], m[2]]));
}

// `export const ACTION` SPREADS from DEFAULT_ACTION_COLORS and only then
// overrides red/green with `overrides.x || DEFAULT…`, so the literal hexes are
// in DEFAULT_ACTION_COLORS — parsing the ACTION block finds `amber`/`gold` and
// nothing else, and `ACTION.red` comes back undefined. Read the real source.
const ACCENTS = { ...block("const DEFAULT_ACCENTS = {"), ...block("const DEFAULT_ACTION_COLORS = {") };
const SAFE = { ...block("export const ACCENT_TEXT_SAFE = {"), ...block("export const ACTION_TEXT_SAFE = {") };

const rgb = (hex) => {
  const m = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16));
};
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const over = (fg, bg, a) => fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));
const toHex = (rgbArr) => "#" + rgbArr.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

// Alphas observed in the source for self-tints.
const ALPHAS = [["10", 16], ["11", 17], ["12", 18], ["15", 21], ["1A", 26]];

describe("module accents used as text on their own self-tint", () => {
  // The four accents that the source actually uses in this pattern, and which
  // are expected to pass unaided.
  const PASSES_ON_ITS_OWN = [
    ["healthcare", "healthcareBlue badge/label text"],
    ["medication", "medsBlue badge/label text"],
    ["encounters", "encountersPink badge/label text"],
  ];

  for (const [key, what] of PASSES_ON_ITS_OWN) {
    it(`${key} clears 4.5:1 on its own tint (${what})`, () => {
      const hex = ACCENTS[key];
      expect(hex, `ACCENTS.${key} missing - did the token get renamed?`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      for (const [label, a] of ALPHAS) {
        const bg = toHex(over(rgb(hex), rgb("#FFFFFF"), a / 255));
        const r = ratio(hex, bg);
        expect(
          r,
          `${key} on its own ${label} tint ${bg} is ${r.toFixed(2)}:1 - below WCAG AA 4.5:1. Either darken ACCENTS.${key} or use a TextSafe variant here.`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  // The two that genuinely FAIL on their own tint, and therefore must only ever
  // appear as text via a TextSafe variant. This is the regression that the
  // 10/15 Sep work fixed at 14 sites; the assertion is the thing that stops it
  // coming back one badge at a time.
  for (const [rawKey, safeKey] of [["contacts", "contacts"], ["red", "red"]]) {
    it(`${rawKey} raw still fails on its own tint, so the TextSafe variant is genuinely required`, () => {
      const hex = ACCENTS[rawKey];
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      // If a future change makes the raw colour pass on its own, the sites
      // using the safe variant become needlessly dark and this assertion is
      // what tells whoever did it.
      const bg = toHex(over(rgb(hex), rgb("#FFFFFF"), 21 / 255));
      const raw = ratio(hex, bg);
      const safeHex = SAFE[safeKey];
      expect(safeHex, `no TextSafe variant for "${safeKey}" - if the raw colour now passes, delete the variant deliberately`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      const safeR = ratio(safeHex, bg);
      expect(safeR, `TextSafe ${safeKey} (${safeHex}) is only ${safeR.toFixed(2)}:1 on its own tint`).toBeGreaterThanOrEqual(4.5);
      // And record the relationship, so the reason the variant exists is
      // visible in a failing message rather than only in a comment.
      expect(
        raw,
        `raw ${rawKey} (${hex}) now reaches ${raw.toFixed(2)}:1 on its own tint — the TextSafe variant may no longer be needed here`
      ).toBeLessThan(4.5);
    });
  }

  it("the contrast maths itself is correct (guards the measurement, not just the values)", () => {
    // A test whose maths is wrong would pass everything. Known-good pairs from
    // the WCAG definition.
    expect(ratio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(ratio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(ratio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });
});
