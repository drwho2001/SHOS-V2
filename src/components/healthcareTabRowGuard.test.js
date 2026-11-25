// M4.1/M4.2/M4.3 — smaller sub-tab pills with an overflow control, real
// per-tab stats, and the pregnancy link under the tab row. Source guard.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const hc = read("src/modules/SHOS_Healthcare_Prototype.jsx");
const mh = read("src/modules/SHOS_MenstrualHealth_Prototype.jsx");

describe("Healthcare tab row", () => {
  it("uses compact pills and resolves the visible set from the user preference", () => {
    expect(hc).toMatch(/padding: "4px 9px"/);
    expect(hc).toMatch(/minHeight: 34/);
    expect(hc).toMatch(/resolveVisibleTabs\(visibleTabsPref, availableKeys\)/);
    expect(hc).toMatch(/healthcareVisibleTabs/);
  });

  it("offers a More overflow control instead of a third row", () => {
    expect(hc).toMatch(/More ▾/);
    expect(hc).toMatch(/moreTabs\.map/);
    expect(hc).toMatch(/setShowMoreTabs/);
  });

  it("keeps the tab row to ONE line whatever the user picks", () => {
    // The cap lives in the shared helper, enforced both when resolving the
    // stored preference and when the Preferences card disables extra toggles.
    // Three pills + More fit one 1080px line; four did not (row 2 overlapped
    // the shortcut strip y561-684 on device).
    const helper = read("src/calculations/healthcareTabs.js");
    expect(helper).toMatch(/HEALTHCARE_VISIBLE_MAX = 3/);
    expect(helper).toMatch(/ordered\.slice\(0, HEALTHCARE_VISIBLE_MAX\)/);
    // 19 Nov: the cap moved out of general Preferences into Healthcare's own
    // settings screen (gear on the Healthcare banner).
    const prefs = read("src/modules/settings/HealthcareSettingsScreen.jsx");
    expect(prefs).toMatch(/HealthcareTabsCard/);
    expect(prefs).toMatch(/atCap/);
    const generalPrefs = read("src/modules/settings/PreferencesScreen.jsx");
    expect(generalPrefs).not.toMatch(/HealthcareTabsCard/);
  });

  it("large text wraps the shortcut row instead of clipping the last entry", () => {
    // AX3 25 Nov: at font_scale 1.3 "Attachments" was cut off at the right
    // edge. Wrapping is the only fix that keeps every shortcut reachable
    // without hiding the More dropdown behind an overflow container.
    expect(hc).toMatch(/flexWrap: "wrap", rowGap: 6, paddingBottom: 10/);
  });

  it("renders stats only for tabs that have them", () => {
    expect(hc).toMatch(/summaryStatsForTab\(subTab, summary\)\.length > 0/);
  });
});

describe("Embedded sub-module sticky detail headers clear the Healthcare header", () => {
  // Found on device: opening a Test detail then scrolling left its sticky
  // title bar pinned at the SAME top as Healthcare's own sticky header, so it
  // covered the Episodes/Calendar/Clinic Card/Attachments shortcut row. Every
  // embedded detail header must offset by the measured Healthcare header height.
  const EMBEDDED = [
    "SHOS_Testing_Prototype.jsx",
    "SHOS_ClinicVisits_Prototype.jsx",
    "SHOS_Vaccinations_Prototype.jsx",
    "SHOS_Measurements_Prototype.jsx",
    "SHOS_SymptomLog_Prototype.jsx",
    "SHOS_MenstrualHealth_Prototype.jsx",
  ];
  const OFFSET = 'top: "calc(var(--shos-top-banner-h, 0px) + var(--shos-sticky-header-h, 0px))"';

  it("every embedded module offsets its sticky header past the Healthcare stack", () => {
    for (const f of EMBEDDED) {
      const src = read(`src/modules/${f}`);
      expect(src.includes(OFFSET), `${f} sticky header must offset by --shos-sticky-header-h`).toBe(true);
    }
  });

  it("no embedded module's detail header sticks at the bare banner height", () => {
    // The edit SHEET's own banner legitimately sticks at top: 0 (it is a
    // full-screen dialog). Only the in-flow detail header must be offset.
    const t = read("src/modules/SHOS_Testing_Prototype.jsx");
    const start = t.indexOf("function TestDetail(");
    const nextFn = t.indexOf("\nfunction ", start + 10);
    const detail = t.slice(start, nextFn === -1 ? t.length : nextFn);
    expect(detail).not.toMatch(/top: "var\(--shos-top-banner-h, 0px\)"/);
    expect(detail).toMatch(OFFSET);
  });

  it("the sticky bar is a compact single line, not a padded top-level banner", () => {
    // Embedded under Healthcare the notch is already handled by the outer
    // header, so the detail bar must NOT re-apply safe-area padding/negative
    // margin (that produced a thick black block above Edit/Delete on device).
    const COMPACT = 'padding: "10px 16px 4px"';
    for (const f of EMBEDDED) {
      const src = read(`src/modules/${f}`);
      expect(src.includes(COMPACT), `${f} detail bar should use compact padding`).toBe(true);
    }
    const t = read("src/modules/SHOS_Testing_Prototype.jsx");
    const start = t.indexOf("function TestDetail(");
    const nextFn = t.indexOf("\nfunction ", start + 10);
    const detail = t.slice(start, nextFn === -1 ? t.length : nextFn);
    expect(detail).not.toMatch(/calc\(16px \+ env\(safe-area-inset-top\)\)/);
    expect(detail).not.toMatch(/marginTop: "calc\(-1 \* env\(safe-area-inset-top\)\)"/);
  });
});

describe("Reproductive health tab row", () => {
  it("keeps the pregnancy link under the tabs, not over the empty state", () => {
    const row = mh.slice(mh.indexOf("Reproductive health</span>"), mh.indexOf("Reproductive health</span>") + 1600);
    expect(row).toMatch(/Show pregnancy tracking anyway/);
    expect(mh).not.toMatch(/margin: "10px 16px 0", textAlign: "right"[^]*?Show pregnancy tracking anyway/);
  });
});
