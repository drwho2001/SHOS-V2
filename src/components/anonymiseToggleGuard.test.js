// anonymiseToggleGuard.test.js
//
// ADDED 14 Nov 2026 — the guard for BACKLOG 83/84's fix.
//
// THE DEFECT. The Anonymise activation control EXISTED — the big card has
// carried onClick=activate since it was built — but nothing about it read
// as tappable, so the audit found "an informational card with no toggle":
// Anonymise mode was effectively unreachable, and the "Also hide kinks"
// toggle below it (which is deliberately gated on the base mode being
// active — there'd be nothing for it to add on top of an inactive tier)
// was unreachable with it, which the audit logged as its own item (84).
//
// The fix is a visible affordance on the card itself: a "Turn on" pill
// when off, a solid ON badge when active. This guard asserts that
// affordance cannot silently disappear again — and that the 84 gating
// stays HONEST (the disabled subtext must still say why, not just grey
// the control out).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(
  path.join(process.cwd(), "src/modules/settings/PrivacyScreen.jsx"),
  "utf8",
);

describe("BACKLOG 83/84 — Anonymise mode's activation is visible and its gating honest", () => {
  it("the card still IS the activation control", () => {
    expect(SRC).toMatch(/onClick=\{settings\.anonymiseModeActive \? undefined : activate\}/);
  });

  it("the affordance is explicit: a Turn-on pill when off, an ON badge when active", () => {
    expect(SRC).toMatch(/"Turn on<\/span>"/.source ? /fontWeight: 700 \}\}>Turn on<\/span>/ : /Turn on<\/span>/);
    expect(SRC).toMatch(/fontWeight: 700 \}\}>ON<\/span>/);
  });

  it("the gated kinks toggle says WHY it is unavailable, rather than just looking disabled", () => {
    expect(SRC).toMatch(/Turn on Anonymise mode above first/);
  });

  it("the kinks toggle stays genuinely inert while the base mode is off", () => {
    // The gating is deliberate (toggling 'further' hiding with nothing to
    // add on top of never made sense) — assert it survives the 83 fix.
    expect(SRC).toMatch(/settings\.anonymiseModeActive \? async \(\) => \{ await PrivacySettingsRepository\.update\(\{ hideFurtherEnabled/);
  });
});
