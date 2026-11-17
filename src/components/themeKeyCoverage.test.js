import fs from "node:fs";
import path from "node:path";
import { it, expect } from "vitest";

// A shared component receives `T` (the active theme) from many call sites. Some
// callers pass a module theme (which has actionRed/healthcare/etc.), others pass a
// bare NEUTRAL/NEUTRAL_DARK (which do NOT). This guard catches the 17 Nov 2026 bug
// where ConfirmDeleteCard read T.actionRed on a bare theme => white-on-white button.
// Any T.<key> a shared component reads must EITHER exist on the bare themes OR be
// read with a fallback (e.g. `T.actionRed || ACTION.red`).

const COMP_DIR = "src/components";
const TOKENS = "src/calculations/designTokens.js";

function bareThemeKeys(name) {
  const src = fs.readFileSync(TOKENS, "utf8");
  const start = src.indexOf(`export const ${name} = {`);
  if (start < 0) throw new Error(`${name} not found in designTokens.js`);
  const block = src.slice(start, src.indexOf("\n};", start));
  return new Set([...block.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)].map((m) => m[1]));
}

it("every bare-theme-missing T.key in a shared component is read with a fallback", () => {
  const neutral = bareThemeKeys("NEUTRAL");
  const dark = bareThemeKeys("NEUTRAL_DARK");
  const offenders = [];
  for (const file of fs.readdirSync(COMP_DIR).filter((f) => f.endsWith(".jsx"))) {
    const src = fs.readFileSync(path.join(COMP_DIR, file), "utf8");
    const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of code.matchAll(/\bT\.([A-Za-z][A-Za-z0-9]*)/g)) {
      const key = m[1];
      if (neutral.has(key) && dark.has(key)) continue; // safe on all themes
      // Missing on a bare theme: the line must contain a fallback (`||`).
      const line = code.slice(code.lastIndexOf("\n", m.index) + 1, code.indexOf("\n", m.index));
      if (!/\|\|/.test(line)) offenders.push(`${file}: T.${key} on "${line.trim().slice(0, 90)}"`);
    }
  }
  expect(offenders, "shared components read a theme key some callers don't have, with no fallback").toEqual([]);
});
