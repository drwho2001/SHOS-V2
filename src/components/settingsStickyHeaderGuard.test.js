// The Settings sub-screen headers: a sticky header that sits flush under the
// status bar, with no band of scrolling content above it.
//
// REWRITTEN 21 Oct 2026. The previous version of this file asserted the
// opposite - that a sub-screen header must NOT stick at `top: 0` - and it was
// RIGHT at the time (t075): the headers used `top: 0`, and they were reported
// as sitting under the system status bar.
//
// MEASURED on the device, 21 Oct 2026, the fix that followed it was wrong in
// the opposite direction, and this file had pinned it:
//
//   - the Settings screen's OWN header - which uses the literal `top: 0` -
//     measured at 35px from the top of the screen: flush under the status
//     bar, which is CORRECT;
//   - every sub-screen header used
//     `top: calc(env(safe-area-inset-top) + 8px)` and measured at 78px:
//     43px lower, with the content scrolling through the band above it, under
//     the status bar. The owner reported exactly that: "the header needs
//     sticky at top, has gap".
//
// WHY: THE INSET WAS COUNTED TWICE. Every sub-screen root already carries
// `paddingTop: env(safe-area-inset-top)`, so the sticky header's offset
// resolves against the app's own drawing edge - and adding the inset to the
// offset as well pushed the header down by a second inset's worth.
//
// So the rule is no longer an OFFSET, it is a PAIRING, and that is what this
// file asserts: a root with the safe-area padding AND a header that sticks at
// zero. Either half alone is wrong - a header at 0 with no root padding goes
// under the status bar, and root padding with a header offset from the token
// opens the gap.
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

  it("every one of them sticks at 0, like the Settings screen's own header", () => {
    // The Settings screen's own header is the reference implementation, and it
    // uses the literal `top: 0` - which measures flush under the status bar,
    // because the root's own safe-area padding is what keeps it there.
    expect(
      stickyFiles.filter((f) => f.value !== "0").map((f) => `${f.name} (${f.value})`),
      "a sub-screen header that does not stick at 0 opens a band of scrolling content above it",
    ).toEqual([]);
  });

  it("every one of them has a root that carries the safe-area padding - the pairing is the invariant", () => {
    // EITHER half alone is wrong: a header at 0 with no root padding goes
    // under the status bar, and a root padding with an offset header opens
    // the gap. This is the check the old offset rule was trying to be.
    const missing = stickyFiles
      .map((f) => f.name)
      .filter((name) => {
        const src = readFileSync(path.join(dir, name), "utf8");
        return !/paddingTop:\s*"env\(safe-area-inset-top\)"/.test(src);
      });
    expect(
      missing,
      "these screens have no safe-area padding on their root, so their header would sit under the status bar",
    ).toEqual([]);
  });

  it("the removed offset token is no longer exported, and nothing still uses it", () => {
    const tokens = readFileSync(
      path.join(process.cwd(), "src", "calculations", "designTokens.js"), "utf8");
    // The EXPORT is what matters. The name still appears in the file's own
    // comment, which records why it was removed - and a comment that
    // explains a removal is worth more than a scrubbed file.
    expect(
      tokens,
      "STICKY_SCREEN_HEADER_TOP is still exported - it double-counted the safe-area inset",
    ).not.toMatch(/export const STICKY_SCREEN_HEADER_TOP/);
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), "utf8");
      expect(src, `${f.name} still references the removed token`).not.toMatch(/STICKY_SCREEN_HEADER_TOP/);
    }
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
    expect(tokens, "banner offset must still exist and stay 58px").toMatch(banner);
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), "utf8");
      expect(src.includes("top: STICKY_SUBHEADING_TOP"), `${f.name} borrows the banner's offset`).toBe(false);
    }
  });
});
