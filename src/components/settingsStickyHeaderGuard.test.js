// t075: the Settings sub-screen headers stick at `top: 0`, which leaves them
// under the system status bar once the screen scrolls - the same defect class
// CLAUDE.md records fixing on the four screen-title banners on 16 Sep 2026.
//
// This is a guard over ALL settings sub-screens rather than the one that was
// reported, because the existing header checks in this repo enumerate filenames
// by hand and a screen added later is never inspected by any of them.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "src", "modules", "settings");
const files = readdirSync(dir).filter((f) => f.endsWith(".jsx"));

// The window after `position: "sticky"` in which a `top:` belongs to that sticky.
// Catches both the single-line ("sticky", top: 0) and the multi-line
// ("sticky",\n  top: 0,) spellings without depending on either one.
const topWithinSticky = /top:\s*([-\w"'.()]+)/;

describe("Settings sub-screen sticky headers", () => {
  it("found the sub-screens to check (a sweep that found nothing would pass vacuously)", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  const stickyFiles = files
    .map((name) => {
      const src = readFileSync(path.join(dir, name), "utf8");
      const at = src.indexOf('position: "sticky"');
      if (at === -1) return null;
      const m = topWithinSticky.exec(src.slice(at, at + 200));
      return { name, value: m ? m[1] : null };
    })
    .filter(Boolean);

  it("every sticky header declares a top, so none can be silently unfixed", () => {
    expect(stickyFiles.length).toBeGreaterThan(0);
    expect(stickyFiles.filter((f) => f.value === null)).toEqual([]);
  });

  it("none sticks at top: 0 - that is the gap the task describes", () => {
    expect(stickyFiles.filter((f) => f.value === "0").map((f) => f.name)).toEqual([]);
  });

  it("all of them use the shared constant, not a per-file literal", () => {
    expect(
      stickyFiles.filter((f) => f.value !== "STICKY_SCREEN_HEADER_TOP").map((f) => f.name),
    ).toEqual([]);
  });

  // A missing import is a render-time ReferenceError in exactly the class of code
  // that unit tests import without ever rendering, so the name is checked at the
  // file that uses it rather than trusted from the edit.
  it("every screen using the constant imports it", () => {
    const missing = files.filter((name) => {
      const src = readFileSync(path.join(dir, name), "utf8");
      if (!src.includes("STICKY_SCREEN_HEADER_TOP")) return false;
      return !/^import \{[^}]*\bSTICKY_SCREEN_HEADER_TOP\b[^}]*\}/m.test(src);
    });
    expect(missing).toEqual([]);
  });

  it("does not borrow the Healthcare banner's own offset, which is a different header's height", () => {
    // STICKY_SUBHEADING_TOP is 58px - the screen-title banner's height, correct
    // only for bars sitting directly beneath that banner. A Settings header has
    // nothing above it, so reusing it would open a 58px band of dead space. This
    // is the same mistake as borrowing a sourced clinical constant out of the
    // context that sourced it: right number, wrong place.
    const tokens = readFileSync(
      path.join(process.cwd(), "src", "calculations", "designTokens.js"), "utf8");
    const banner = /export const STICKY_SUBHEADING_TOP = "calc\(env\(safe-area-inset-top\) \+ 58px\)";/;
    const header = /export const STICKY_SCREEN_HEADER_TOP = "calc\(env\(safe-area-inset-top\) \+ 8px\)";/;
    expect(tokens, "banner offset must still exist and stay 58px").toMatch(banner);
    expect(tokens, "header offset is a separate, smaller value").toMatch(header);
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), "utf8");
      if (src.includes("STICKY_SCREEN_HEADER_TOP")) {
        expect(src.includes("top: STICKY_SUBHEADING_TOP")).toBe(false);
      }
    }
  });
});