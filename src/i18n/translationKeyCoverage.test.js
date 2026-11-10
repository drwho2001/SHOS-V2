// translationKeyCoverage.test.js
//
// Guard: every key a screen passes to t()/tr() must resolve to a real string —
// either a key that exists in src/i18n/en.json, or a fallback literal passed as
// the second argument (t(key, "fallback")). A key missing from both would render
// the raw "dot.key" dotted string to the user, silently, on the screen that uses it.
//
// This repo discovered its i18n debt by having to ask "which screens actually work
// without en.json?" and finding 38 such keys (all with fallbacks, so none rendered
// raw keys, and all are now added to en.json). This test pins the rule that debt
// can never reaccumulate silently.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");
const en = JSON.parse(readFileSync(join(process.cwd(), "src", "i18n", "en.json"), "utf8"));

function hasKey(root, dotted) {
  let cur = root;
  for (const p of dotted.split(".")) {
    if (cur && typeof cur === "object" && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
    else return false;
  }
  return typeof cur === "string";
}

/** Every file under src/ whose contents we check for t()/tr() calls. */
function sourceFiles() {
  const out = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== "node_modules") walk(p);
        continue;
      }
      if (!/\.(js|jsx|ts|tsx)$/.test(name)) continue;
      out.push(p);
    }
  }
  walk(ROOT);
  return out;
}

/**
 * Extract t()/tr() calls. The capture is deliberately shallow: the key as a
 * string literal first argument, then whatever follows up to the closing paren
 * at depth 0. If the only argument is the key, there is no fallback.
 */
const CALL = /\b(?:t|tr)\(\s*"([a-z][\w.-]+)"([^)]*)\)/g;

describe("i18n key coverage", () => {
  it("every t()/tr() key resolves in en.json, or has a fallback literal", () => {
    const unresolved = [];
    for (const file of sourceFiles()) {
      const src = readFileSync(file, "utf8");
      let m;
      while ((m = CALL.exec(src))) {
        const key = m[1];
        const rest = m[2];
        if (hasKey(en, key)) continue;
        // A fallback means any string literal after the key: t(key, "fallback")
        // or t(key, { vars }, "fallback") handled by the vars-aware useTranslation.
        // (Without a fallback, hasKey() is the only thing saving this call.)
        const hasFallbackString = /,\s*("|'|`)/.test(rest);
        if (!hasFallbackString) {
          unresolved.push({ file: relative(process.cwd(), file), key });
        }
      }
    }
    expect(unresolved, unresolved.map((u) => `${u.key}  (${u.file})`).join("\n")).toEqual([]);
  });
});
