// jsxIdentifierBindingGuard.test.js
//
// NEW GUARD, 12 Nov 2026. Born from three real render-time crashes found by
// hand in one audit, all the same shape and all invisible to the build, the
// unit suite and CI:
//
//   - Testing's detail screen referenced `linkedEpisodes` / `isNew` /
//     `setEpisodeVersion`, which are bound in the EDIT sheet, not in that
//     component. Every saved test crashed on open.
//   - Partner Notification's picker and checklist steps both referenced
//     `testId`, which is bound on the parent sheet — so the whole partner
//     notification workflow crashed on render.
//   - Timeline referenced `onClose` in a component that only receives
//     `onBack`.
//
// Its sibling, jsxComponentBindingGuard.test.js, covers the same failure for
// COMPONENT names (`<Foo/>`). This one covers ordinary identifiers used in
// JSX: expression containers, attributes and style objects. It is the piece
// that would have caught all three above.
//
// WHY ESLINT IS NOT ENOUGH, stated plainly because "lint covers it" is the
// comment that gets these deleted. `no-undef` DOES catch these — but `npm
// test` does not run eslint, so the suite stayed green while three screens
// were dead. A bug class that only the lint step can see is a bug class the
// test suite does not have. This runs in the suite, on the same AST the
// module graph uses, using Babel's real scope analysis (not a regex), and it
// knows the browser globals from the same `globals` package eslint uses, so
// it cannot drift into crying wolf about `window` or `localStorage`.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import globals from "globals";

const traverse = traverseModule.default || traverseModule;

const ROOTS = ["src/modules", "src/components", "src/App.jsx", "src/main.jsx"];

const ALLOWED_GLOBALS = new Set([
  ...Object.keys(globals.browser || {}),
  ...Object.keys(globals.builtin || {}),
  ...Object.keys(globals.es2021 || {}),
  ...Object.keys(globals.node || {}),
  // Compile-time defines injected by Vite (see vite.config.js `define`).
  "__APP_VERSION__",
  "__BUILD_SHA__",
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (/\.jsx?$/.test(dir) && !/\.test\.[jt]sx?$/.test(dir)) out.push(dir);
    return out;
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    walk(path.join(dir, e.name), out);
  }
  return out;
}

function offsets(code) {
  const lineStarts = [0];
  for (let i = 0; i < code.length; i += 1) if (code[i] === "\n") lineStarts.push(i + 1);
  return (index) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

// Returns a list of "file:line name" for every identifier referenced in a JSX
// context that has no binding in scope. Split out so the "detector works" test
// below can prove it fires — a detector that has never fired once has told
// this repo nothing for weeks (see styleColourGuard.test.js's own note).
export function findUnboundJsxIdentifiers(code, file = "sample.jsx") {
  const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  const lineOf = offsets(code);
  const offenders = [];
  const seen = new Set();

  traverse(ast, {
    Identifier(p) {
      const node = p.node;
      // Only real value references: not property keys, not object keys, not
      // JSX element names (the sibling guard owns those).
      if (!p.isReferencedIdentifier()) return;
      const parent = p.parent;
      if (parent && (parent.type === "JSXOpeningElement" || parent.type === "JSXClosingElement")) return;
      if (ALLOWED_GLOBALS.has(node.name)) return;
      if (p.scope.hasBinding(node.name, true)) return;
      // Template-literal / JSX-namespace false positives are not possible
      // here, but dedupe anyway so one bad line reports once.
      const key = `${lineOf(node.start)}:${node.name}`;
      if (seen.has(key)) return;
      seen.add(key);
      offenders.push(`${file}:${lineOf(node.start)} ${node.name}`);
    },
  });

  return offenders;
}

const files = ROOTS.flatMap((r) => walk(r));

describe("every identifier used in a screen's JSX is actually bound", () => {
  it("the detector fires on a known-bad sample and stays quiet on a good one", () => {
    const bad = `
      function Sheet({ testId }) {
        return <div style={{ color: T.textPrimary }}>{linkedEpisodes.length}</div>;
      }
    `;
    const found = findUnboundJsxIdentifiers(bad, "bad.jsx");
    expect(found.some((f) => f.includes("linkedEpisodes")), `detector missed linkedEpisodes: ${found.join(", ")}`).toBe(true);
    expect(found.some((f) => f.includes(" textPrimary")), "detector reported a property key").toBe(false);

    const good = `
      import React from "react";
      function Sheet({ testId, T }) {
        const linkedEpisodes = [];
        return <div style={{ color: T.textPrimary }} onClick={() => localStorage.getItem(testId)}>{linkedEpisodes.length}</div>;
      }
    `;
    expect(findUnboundJsxIdentifiers(good, "good.jsx")).toEqual([]);
  });

  it("found the screens to check - otherwise this whole file is vacuous", () => {
    expect(files.length, "no .jsx files discovered - the guard is scanning nothing").toBeGreaterThan(30);
  });

  it("no screen references an identifier that is not in scope", () => {
    const offenders = [];
    for (const file of files) {
      const code = fs.readFileSync(file, "utf8");
      try {
        offenders.push(...findUnboundJsxIdentifiers(code, file.replace(/\\/g, "/")));
      } catch {
        // A parse failure is a different guard's problem.
      }
    }
    expect(
      offenders,
      "these reference identifiers with no binding in scope - each is a render-time ReferenceError:\n" + offenders.join("\n"),
    ).toEqual([]);
  }, 60_000);
});
