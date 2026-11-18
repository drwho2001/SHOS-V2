// M4.1/M4.2/M4.3 — smaller sub-tab pills with an overflow control, real
// per-tab stats, and the pregnancy link under the tab row. Source guard.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const hc = read("src/modules/SHOS_Healthcare_Prototype.jsx");
const mh = read("src/modules/SHOS_MenstrualHealth_Prototype.jsx");

describe("Healthcare tab row", () => {
  it("uses compact pills and caps the visible set", () => {
    expect(hc).toMatch(/padding: "4px 9px"/);
    expect(hc).toMatch(/minHeight: 34/);
    expect(hc).toMatch(/MAX_VISIBLE_TABS = 5/);
    expect(hc).toMatch(/const visibleTabs = orderedTabs\.slice/);
  });

  it("offers a More overflow control instead of a third row", () => {
    expect(hc).toMatch(/More ▾/);
    expect(hc).toMatch(/moreTabs\.map/);
    expect(hc).toMatch(/setShowMoreTabs/);
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
