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

describe("Reproductive health tab row", () => {
  it("keeps the pregnancy link under the tabs, not over the empty state", () => {
    const row = mh.slice(mh.indexOf("Reproductive health</span>"), mh.indexOf("Reproductive health</span>") + 1600);
    expect(row).toMatch(/Show pregnancy tracking anyway/);
    expect(mh).not.toMatch(/margin: "10px 16px 0", textAlign: "right"[^]*?Show pregnancy tracking anyway/);
  });
});
