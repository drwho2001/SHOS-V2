// ADDED 5 Nov 2026 - A4 guard: raw colour reads in JSX style values.
//
// WHY THIS EXISTS. docs/DESIGN-AUDIT.md §8 "Tests worth adding" asked for two
// static guards after the dark-mode pass: "no raw accent reads in JSX style
// values" and "no hex literals in JSX colour positions outside designTokens.js".
// The audit's own note says the second "would have caught B5 and B6 mechanically".
// B1–B4 are the same shape: an accent or literal colour used directly in a
// style object instead of the module's resolved `T.*` token.
//
// WHY A BASELINE AND NOT A BLANKET BAN. The first scan found 390 sites across 37
// files (301 raw hex/rgba, 89 raw ACCENTS/ACTION). A large share are legitimate:
// white text on coloured fills, the near-black toast/surface literals, the
// hand-picked dark companions. A blanket ban would fail the suite on day one and
// would have to be disabled to keep shipping, which is the failure mode this
// repo has already learned to avoid. The baseline is a ratchet: it records the
// debt as it stands and fails only when a count rises or a new file appears.
// That catches the regression the audit cared about (a new raw colour added in a
// module render body) without demanding a 390-site cleanup in the same change.
//
// HOW TO UPDATE. When a legitimate new raw colour is genuinely required, raise
// that file's number in styleColourBaseline.json in the same commit and say why
// in the commit message. Do not lower a number without also removing the site.
//
// Parsed with @babel/parser rather than grepped, per the convention this repo
// settled on after several regex scans produced false results. The "detector
// works" test below is deliberate: four earlier scan attempts in this repo
// reported zero problems from detectors that had never fired once.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const SRC = path.resolve("src");
const BASELINE = JSON.parse(fs.readFileSync(path.join(SRC, "calculations", "styleColourBaseline.json"), "utf8"));

const COLOUR_KEY = /^(color|background|backgroundColor|border|borderColor|borderTop|borderBottom|borderLeft|borderRight|fill|stroke|outline|outlineColor|boxShadow|textDecorationColor)$/;
const HEX = /^#([0-9a-fA-F]{3,8})$/;
const RGBA = /^rgba?\(/;

function jsxFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) jsxFiles(p, out);
    else if (/\.jsx$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const c of node) walk(c, visit); return; }
  if (typeof node.type !== "string") return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
    walk(node[key], visit);
  }
}

function keyName(prop) {
  if (!prop.key) return null;
  if (prop.key.type === "Identifier") return prop.key.name;
  if (prop.key.type === "StringLiteral") return prop.key.value;
  return null;
}

// The detector, split out so the "detector works" test can call it on a sample
// without touching the filesystem.
function countStyleColours(code) {
  let ast;
  try {
    ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  } catch {
    return null;
  }
  const counts = { hex: 0, accent: 0 };
  walk(ast, (node) => {
    if (node.type !== "JSXAttribute" || node.name?.name !== "style") return;
    const expr = node.value?.expression;
    if (!expr || expr.type !== "ObjectExpression") return;
    for (const prop of expr.properties) {
      if (prop.type !== "ObjectProperty") continue;
      const k = keyName(prop);
      if (!k || !COLOUR_KEY.test(k)) continue;
      const v = prop.value;
      if (v.type === "StringLiteral" && (HEX.test(v.value) || RGBA.test(v.value))) {
        counts.hex += 1;
      } else if (v.type === "TemplateLiteral") {
        const raw = v.quasis.map((q) => q.value.raw).join("");
        if (HEX.test(raw) || RGBA.test(raw)) counts.hex += 1;
      } else if (v.type === "MemberExpression" && v.object?.type === "Identifier" && (v.object.name === "ACCENTS" || v.object.name === "ACTION")) {
        counts.accent += 1;
      }
    }
  });
  return counts;
}

describe("raw colour reads in JSX style values", () => {
  it("the detector works on known-good and known-bad samples", () => {
    // Guards the measurement itself. If this fails, every number below is
    // meaningless: a detector that never fires would pass a clean repo.
    const sample = `
      const a = <div style={{ color: "#FF0000" }} />;
      const b = <div style={{ background: ACCENTS.home }} />;
      const c = <div style={{ border: "1px solid ACTION.red" }} />;
      const d = <div style={{ color: T.textPrimary }} />;
      const e = <div style={{ padding: 12 }} />;
      const f = <div style={{ background: "rgba(0,0,0,.4)" }} />;
    `;
    const counts = countStyleColours(sample);
    expect(counts).not.toBeNull();
    expect(counts.hex, "hex detector missed the raw literals").toBeGreaterThanOrEqual(2);
    expect(counts.accent, "accent detector missed ACCENTS.home").toBeGreaterThanOrEqual(1);
  });

  it("the baseline totals are internally consistent", () => {
    const summed = Object.values(BASELINE.files).reduce(
      (a, b) => ({ hex: a.hex + b.hex, accent: a.accent + b.accent }),
      { hex: 0, accent: 0 }
    );
    expect(summed.hex, "baseline totals.hex does not match its files").toBe(BASELINE.totals.hex);
    expect(summed.accent, "baseline totals.accent does not match its files").toBe(BASELINE.totals.accent);
  });

  it("no file exceeds its baseline, and no new file introduces a raw colour", () => {
    const regressions = [];
    const newFiles = [];
    for (const file of jsxFiles(SRC)) {
      const rel = path.relative(SRC, file).replace(/\\/g, "/");
      const counts = countStyleColours(fs.readFileSync(file, "utf8"));
      if (!counts) continue;
      const base = BASELINE.files[rel];
      if (!base) {
        if (counts.hex || counts.accent) {
          newFiles.push(`${rel} (hex ${counts.hex}, accent ${counts.accent})`);
        }
        continue;
      }
      if (counts.hex > base.hex) {
        regressions.push(`${rel}: hex ${base.hex} -> ${counts.hex}`);
      }
      if (counts.accent > base.accent) {
        regressions.push(`${rel}: accent ${base.accent} -> ${counts.accent}`);
      }
    }
    expect(
      regressions,
      `raw colour reads increased. Use a resolved T.* token instead, or raise the baseline with a reason:\n${regressions.join("\n")}`
    ).toEqual([]);
    expect(
      newFiles,
      `new files with raw colour reads are not in the baseline. Use a token, or add the file to styleColourBaseline.json with a reason:\n${newFiles.join("\n")}`
    ).toEqual([]);
  }, 30000);
});
