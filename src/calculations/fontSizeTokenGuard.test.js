// fontSizeTokenGuard.test.js — 13px is the standard control/button/field
// size; TYPE.control.fontSize is its single owner. Before 18 Nov there were
// 137 raw `fontSize: 13` / `"13px"` sites scattered across 23 files, so any
// change to the scale would have to be made in 137 places. This guard keeps
// the tokenisation from drifting back.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs|cjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const RAW_13 = /fontSize:\s*(?:13|'13px'|"13px")/;

describe("13px font-size tokenisation", () => {
  it("the detector fires on a known-bad sample", () => {
    expect(RAW_13.test("style={{ fontSize: 13 }}")).toBe(true);
    expect(RAW_13.test('style={{ fontSize: "13px" }}')).toBe(true);
    expect(RAW_13.test("fontSize: TYPE.control.fontSize")).toBe(false);
  });

  it("no screen or module hardcodes 13px instead of using TYPE.control", () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file).replace(/\\/g, "/");
      // designTokens.js OWNS the literal — it is the source of truth.
      if (rel === "calculations/designTokens.js") continue;
      const src = fs.readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        if (RAW_13.test(line)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(offenders, "use TYPE.control.fontSize, not a raw 13").toEqual([]);
  });

  it("the canonical token really is 13px", () => {
    const tokens = fs.readFileSync(path.join(SRC, "calculations/designTokens.js"), "utf8");
    expect(tokens).toMatch(/control:\s*\{\s*fontSize: 13/);
  });
});
