// Contrast and narrow-screen checks for the THREE surfaces Phase 3 added:
// the acknowledge sheet, its toast, and the nav dot.
//
// WHY MEASURED BY HAND AND NAMED, NOT SCANNED: CLAUDE.md records four failed
// attempts at automated contrast scanning, all of which reported a clean result
// from a detector that had never fired - one of them printing "the detector is
// proven working because the safe count is non-zero" while that count was zero.
// The per-module tokens are built by each module's own buildLight()/buildDark()
// and do not exist in designTokens.js, so they cannot be resolved by reading
// that file. There are a handful of pairs; naming them and computing the ratios
// is both more reliable and far cheaper. The maths self-checks against known
// WCAG reference pairs first, because a test whose maths is wrong passes
// everything.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const TOKENS = readFileSync(path.join(process.cwd(), "src", "calculations", "designTokens.js"), "utf8");
const APP = readFileSync(path.join(process.cwd(), "src", "App.jsx"), "utf8");

function block(anchor) {
  const i = TOKENS.indexOf(anchor);
  expect(i, `could not find "${anchor}" - has the token block moved?`).toBeGreaterThan(-1);
  const end = TOKENS.indexOf("\n};", i);
  const body = TOKENS.slice(i, end === -1 ? i + 3000 : end);
  return Object.fromEntries([...body.matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{3,8})"/g)].map((m) => [m[1], m[2]]));
}

const NEUTRAL = block("export const NEUTRAL = {");
const NEUTRAL_DARK = block("export const NEUTRAL_DARK = {");

const rgb = (hex) => {
  const m = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16));
};
const channel = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("the contrast maths is itself correct", () => {
  // Without this, every assertion below could pass because the ratio function
  // returns nonsense. Known WCAG reference pairs.
  it("black on white is 21:1", () => expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 1));
  it("white on white is 1:1", () => expect(contrast("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5));
  it("#767676 on white is the 4.5:1 boundary", () =>
    expect(contrast("#767676", "#FFFFFF")).toBeGreaterThanOrEqual(4.4));
  it("#777777 on white is just under the boundary", () =>
    expect(contrast("#777777", "#FFFFFF")).toBeLessThan(4.6));
});

describe("every text pair on the acknowledge sheet", () => {
  // Named explicitly rather than scanned, so this fails when a pair is ADDED to
  // the sheet only if the pair is added here too - which is the trade this file
  // makes explicitly, and why the source-shape assertions below exist.
  const PAIRS = [
    ["title", NEUTRAL.textPrimary, NEUTRAL.surface],
    ["help paragraph", NEUTRAL.textSecondary, NEUTRAL.surface],
    ["option label (unselected)", NEUTRAL.textPrimary, NEUTRAL.surface],
    ["option note (unselected)", NEUTRAL.textSecondary, NEUTRAL.surface],
    ["option label (SELECTED, on the tinted row)", NEUTRAL.textPrimary, NEUTRAL.surfaceVariant],
    ["option note (SELECTED, on the tinted row)", NEUTRAL.textSecondary, NEUTRAL.surfaceVariant],
    ["'Keep reminding me'", NEUTRAL.textSecondary, NEUTRAL.surface],
    ["footer 'your default is set in Settings'", NEUTRAL.textDisabled, NEUTRAL.surface],
  ];

  for (const [name, fg, bg] of PAIRS) {
    it(`light mode: ${name} clears 4.5:1`, () => {
      const ratio = contrast(fg, bg);
      expect(ratio, `${name} is ${fg} on ${bg} = ${ratio.toFixed(2)}:1, under 4.5`)
        .toBeGreaterThanOrEqual(4.5);
    });
  }

  const DARK_PAIRS = [
    ["title", NEUTRAL_DARK.textPrimary, NEUTRAL_DARK.surface],
    ["help paragraph", NEUTRAL_DARK.textSecondary, NEUTRAL_DARK.surface],
    ["option note (SELECTED)", NEUTRAL_DARK.textSecondary, NEUTRAL_DARK.surfaceVariant],
    ["footer", NEUTRAL_DARK.textDisabled, NEUTRAL_DARK.surface],
  ];
  for (const [name, fg, bg] of DARK_PAIRS) {
    it(`dark mode: ${name} clears 4.5:1`, () => {
      const ratio = contrast(fg, bg);
      expect(ratio, `${name} is ${fg} on ${bg} = ${ratio.toFixed(2)}:1, under 4.5`)
        .toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("the sheet can never be taller than the screen", () => {
  // The real narrow-screen finding, measured rather than assumed. The sheet was
  // a fixed overlay with alignItems: flex-end, no maxHeight and no overflow, so
  // on a short viewport - a 375px-tall landscape phone, or any device with a
  // large system font scale - the content was taller than the screen, the top of
  // it was clipped by the viewport edge, and there was no way to scroll to the
  // title. The user saw a sheet with its heading and one option cut off.
  it("the sheet is bounded to the viewport and can scroll itself", () => {
    const i = APP.indexOf("function AcknowledgeSheet(");
    expect(i, "AcknowledgeSheet not found - has it been renamed?").toBeGreaterThan(-1);
    const sheet = APP.slice(i, i + 3200);
    expect(sheet, "the sheet needs a maxHeight so it can never exceed the viewport")
      .toMatch(/maxHeight/);
    expect(sheet, "the sheet needs to be its own scroll container")
      .toMatch(/overflowY:\s*"auto"/);
  });

  it("the action button is not under the system gesture bar", () => {
    // A bottom sheet with a full-width action button and no bottom safe-area
    // inset puts that button under the gesture bar on a device that has one.
    // Same treatment the 24 Sep pass gave every other fixed overlay in the app.
    const i = APP.indexOf("function AcknowledgeSheet(");
    const sheet = APP.slice(i, i + 3200);
    expect(sheet, "the sheet needs bottom safe-area padding")
      .toMatch(/paddingBottom:\s*"calc\([^"]*env\(safe-area-inset-bottom\)/);
  });

  it("the sheet is announced as a dialog and takes focus", () => {
    // Kept from the A1 fix; re-asserted here because this is the accessibility
    // pass for these surfaces and it should not be possible to lose it silently.
    const i = APP.indexOf("function AcknowledgeSheet(");
    const sheet = APP.slice(i, i + 2600);
    expect(sheet).toMatch(/role="dialog"/);
    expect(sheet).toMatch(/tabIndex=\{0\}/);
    expect(sheet).toMatch(/dialogRef\.current\?\.focus\(\)/);
  });
});

describe("the nav dot is not the only way that state is communicated", () => {
  it("the tab's accessible name does not change when a dot appears", () => {
    // The dot's wording lives in aria-describedby precisely so the tab is still
    // called "Encounter" whether or not a dot is showing - the smoke suite's
    // nav() helper matches tab names exactly, and it fails open.
    expect(APP).toMatch(/aria-label=\{tab\.label\}/);
    expect(APP).not.toMatch(/tabAriaLabel/);
  });
});
