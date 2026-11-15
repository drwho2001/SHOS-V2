// encounterEditSheetGuard.test.js
//
// ADDED 14 Nov 2026 — the guard for BACKLOG 64/65/66 (device audit round 2).
//
// WHY SOURCE-LEVEL. The audit's evidence for all three items was pixel
// coordinates from an on-device screenshot, which this suite cannot
// reproduce (no Android build environment). But every one of the three
// defects is a SPECIFIC structural property of the source, and each one
// silently reverting is exactly how the original bugs shipped — nobody
// re-audits a screen that was fixed six weeks ago. So the guard asserts
// the structures:
//
//   64  the Add/Edit Encounter sheet must be a full-viewport layer that
//       covers the app's bottom tab bar (zIndex above the nav's) and
//       reserves bottom padding that includes the Android system-nav
//       inset, so form rows can never sit under either bar;
//   65  the registry suggestion chips must wrap onto multiple lines
//       (flexWrap: "wrap"), not run off the right edge behind a
//       swipe-the-user-won't-find scroll;
//   66  the usage count must render inside parens, separated from the
//       label, WITH a caption explaining what the number means —
//       "+ Rimming52" was the shipped bug.
//
// The nav's z-index is read from App.jsx so the assertion cannot drift
// from the real value: if someone raises the nav to 300, the sheet guard
// fails here instead of failing silently on a device.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MODULE = fs.readFileSync(
  path.join(process.cwd(), "src/modules/SHOS_Encounters_Prototype.jsx"),
  "utf8",
);
const APP = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

const navZ = Number(APP.match(/aria-label="Main navigation"[^]*?zIndex: (\d+)/)?.[1]);

const sheet = MODULE.match(
  /<div role="dialog" aria-label=\{isNew \? "Add Encounter" : "Edit Encounter"\}[^>]*data-encounter-sheet>/,
)?.[0];
expect(sheet, "EncounterEditSheet's root dialog element not found").toBeTruthy();

const suggestionRow = MODULE.match(
  /\{visibleSuggestions\.length > 0 && \(\s*<div style=\{\{[^}]*\}\}>/,
)?.[0];
expect(suggestionRow, "RegistryTagPicker's suggestion chip row not found").toBeTruthy();

describe("the Add/Edit Encounter sheet cannot be overlapped by the app chrome (BACKLOG 64)", () => {
  it("the sheet is a full-viewport fixed layer", () => {
    expect(sheet).toMatch(/position: "fixed"/);
    expect(sheet).toMatch(/inset: 0/);
    expect(sheet).toMatch(/background: T\.bg/);
  });

  it("the sheet's z-index is above the bottom nav's, so it covers it", () => {
    expect(navZ, "could not read the nav's zIndex from App.jsx").toBeGreaterThan(0);
    const sheetZ = Number(sheet.match(/zIndex: (\d+)/)?.[1]);
    expect(
      sheetZ,
      `sheet zIndex (${sheetZ}) must exceed the nav's (${navZ}) or form rows show through under the tab bar again`,
    ).toBeGreaterThan(navZ);
  });

  it("the sheet reserves bottom padding that clears the Android system nav", () => {
    expect(sheet).toMatch(
      /paddingBottom: "calc\(\d+px \+ env\(safe-area-inset-bottom\)\)"/,
    );
  });
});

describe("suggestion chips wrap instead of running off-screen (BACKLOG 65)", () => {
  it("the chip row wraps onto multiple lines", () => {
    expect(suggestionRow).toMatch(/flexWrap: "wrap"/);
  });
});

describe("usage counts are separated and explained (BACKLOG 66)", () => {
  it("the count renders in parens, not glued to the label", () => {
    expect(MODULE).toMatch(/\(\{usage\.get\(e\.id\)\}\)<\/span>/);
  });

  it("a caption above the row explains what the number means", () => {
    expect(MODULE).toMatch(
      /the number is how many past encounters used it/,
    );
  });
});
