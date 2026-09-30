import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// STATIC SHAPE GUARD: dynamic imports must destructure what the target exports.
//
// WHY THIS EXISTS. `medicationReminderSync.js` did this:
//
//   const { getRefillDueMedications } = await import("./medicationCalculations");
//   const refillDue = getRefillDueMedications(meds, prefs);
//
// medicationCalculations.js does not export that symbol at all — it lives in
// ./refillReminderSync, which is where every other caller already imported it
// from. The resulting TypeError was swallowed by a `catch` whose comment said
// "Widget bridge not available (web)", so the next-dose widget update below it
// never ran. CLAUDE.md then recorded that widget as "wired, masked by default"
// because the code existed.
//
// So three failures stacked into one invisible one: a wrong module, a missing
// await, and wrong arity, all hidden by a catch-all, all reported as done.
//
// This is the class this repo keeps shipping - a value computed in one file with
// no copy in the consumer - in a new form: the CONSUMER imports a producer that
// does not exist. It is statically checkable, so it is checked statically
// rather than left to a human reading the diff.
//
// Deliberately a SOURCE-TEXT guard rather than an import-graph walk, because
// these are `await import()` calls the bundler resolves lazily, and a
// resolved-graph approach would not see them at all.

// Comments MUST be stripped before any of this runs.
//
// Sixth recorded instance of the comment-matching class, and mine: the first
// version of this scanner matched `{ ... } = await import(...)` sequences
// inside PROSE, so it reported nonsense like
//
//   notificationService.js: imports { // ADDED 29 Sep 2026 ... } which does
//   not export it
//
// for every long explanatory comment in the file. Comments in this repo
// routinely quote code, which is exactly what makes them valuable and exactly
// what makes a raw regex useless here.
//
// The stripper is proven non-vacuous by its own test below, because a stripper
// that silently removes too much would make every scan pass by finding nothing.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Files whose dynamic imports are relative and therefore resolvable from disk.
const ROOTS = ["src/calculations", "src/repositories", "src/storage"];

function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) out.push(full);
  }
  return out;
}

// Every name a module exports, via its `export function|const|let|class NAME`.
function exportedNames(file) {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const names = new Set();
  for (const m of src.matchAll(
    /export\s+(?:async\s+)?(?:function\s*\*?\s*|const\s+|let\s+|var\s+|class\s+)([A-Za-z_$][\w$]*)/g
  )) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(",")) {
      const bits = part.trim().split(/\s+as\s+/);
      const name = (bits[1] || bits[0] || "").trim();
      if (name) names.add(name);
    }
  }
  return names;
}

// Every relative dynamic import site in a file, with the names it destructures.
function dynamicImportSites(file) {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const sites = [];
  // import("./x") assigned to a destructuring pattern, with or without const.
  const re = /(?:const|let|var)?\s*\{\s*([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\s*\}\s*=\s*await\s+import\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of src.matchAll(re)) {
    const names = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    sites.push({ spec: m[2], names, index: m.index });
  }
  return sites;
}

describe("the comment stripper this scan depends on is not vacuous", () => {
  it("removes a comment that quotes the very pattern being scanned", () => {
    const prose = `// The old line was:
    //   const { getRefillDueMedications } = await import("./medicationCalculations");
    const real = 1;`;
    expect(dynamicImportSitesFromString(prose)).toEqual([]);
  });

  it("still finds the pattern in real code", () => {
    const code = `const { realThing } = await import("./somewhere");`;
    const sites = dynamicImportSitesFromString(code);
    expect(sites.length).toBe(1);
    expect(sites[0].names).toEqual(["realThing"]);
    expect(sites[0].spec).toBe("./somewhere");
  });
});

// Helper so the stripper's own test can scan a string rather than a file.
function dynamicImportSitesFromString(src) {
  const re = /(?:const|let|var)?\s*\{\s*([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\s*\}\s*=\s*await\s+import\(\s*["']([^"']+)["']\s*\)/g;
  const out = [];
  for (const m of stripComments(src).matchAll(re)) {
    out.push({ names: m[1].split(",").map((s) => s.trim()), spec: m[2] });
  }
  return out;
}

describe("every relative dynamic import destructures a real export", () => {
  const files = ROOTS.flatMap(listJsFiles);

  it("found the source files to check", () => {
    // Guards against the guard silently checking nothing, which has happened in
    // this repo more than once and always looked green.
    expect(files.length).toBeGreaterThan(30);
  });

  it("no import names a symbol its target module does not export", () => {
    const problems = [];
    let checked = 0;
    for (const file of files) {
      for (const site of dynamicImportSites(file)) {
        if (!site.spec.startsWith(".")) continue; // bare specifier: not resolvable from disk
        const target = path.resolve(path.dirname(file), site.spec);
        const resolved = [target, `${target}.js`, path.join(target, "index.js")]
          .find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
        if (!resolved) { problems.push(`${file}: cannot resolve ${site.spec}`); continue; }
        const available = exportedNames(resolved);
        for (const name of site.names) {
          checked++;
          if (!available.has(name)) {
            problems.push(
              `${file}: imports { ${name} } from "${site.spec}", which does not export it`
            );
          }
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
    expect(checked, "expected to check a meaningful number of imported names").toBeGreaterThan(10);
  });

  it("the known-broken call site is genuinely fixed, not just absent", () => {
    // Named explicitly so this test fails if the bug is ever reintroduced,
    // rather than passing because the pattern stopped matching.
    //
    // SCANNED AGAINST COMMENT-STRIPPED SOURCE, which is the whole point of
    // having a stripper. The fix's own comment explains the bug by naming both
    // the function and the module it was wrongly imported from — so a raw
    // substring test for exactly that pairing matches the COMMENT, which is the
    // seventh recorded instance of this class in this repo and the first one
    // authored while explicitly writing a guard about it. It went red on the
    // commit that fixed the bug, which is the worst version of the mistake:
    // the guard was wrong at the exact moment it was supposed to be right.
    const src = stripComments(fs.readFileSync("src/calculations/medicationReminderSync.js", "utf8"));
    expect(src).not.toMatch(/getRefillDueMedications.*medicationCalculations/);
    expect(src).toMatch(/getRefillDueMedications\s*\}\s*=\s*await\s+import\("\.\/refillReminderSync"\)/);
  });

  it("the refill call is awaited and takes no arguments", () => {
    // The other two of the three stacked defects: a real async function called
    // without await yields a Promise, and `[0].name` on one is undefined.
    const src = stripComments(fs.readFileSync("src/calculations/medicationReminderSync.js", "utf8"));
    expect(src).toMatch(/await\s+getRefillDueMedications\(\)/);
    expect(src).not.toMatch(/getRefillDueMedications\([^)]/);
  });

  it("getRefillDueMedications is genuinely exported by refillReminderSync", () => {
    // The mirror of the guard above: proving the fix points at something real,
    // rather than at another module that happens to parse.
    expect(exportedNames("src/calculations/refillReminderSync.js").has("getRefillDueMedications")).toBe(true);
    expect(exportedNames("src/calculations/medicationCalculations.js").has("getRefillDueMedications")).toBe(false);
  });
});

describe("a catch-all must not be the only thing standing between a bug and silence", () => {
  it("the widget update's catch does not log at a level nobody sees", () => {
    // The catch is legitimate - the bridge genuinely does not exist on web.
    // What it must not do is make a wrong-module TypeError indistinguishable
    // from "web has no bridge".
    //
    // SCOPED TO THE FUNCTION, and that scoping was itself a fix. The first
    // version sliced from `async function updateRefillWidget` to END OF FILE,
    // so it matched a console.warn further down the same module and passed
    // even when the catch had been demoted back to console.debug. Mutation
    // testing caught it going green when it should have gone red - the exact
    // "a gate that measures nothing and looks green" failure this repo has
    // recorded seven times, this time in the guard written to catch a bug that
    // had itself been hidden by an over-broad scope.
    const src = stripComments(fs.readFileSync("src/calculations/medicationReminderSync.js", "utf8"));
    const start = src.indexOf("async function updateRefillWidget");
    expect(start, "updateRefillWidget not found").toBeGreaterThan(-1);
    // The function ends at the first line that is exactly "}" at column 0.
    const end = src.indexOf("\n}", start);
    const fn = src.slice(start, end === -1 ? undefined : end);

    // Assert positively on the fix, and negatively on the specific regression.
    expect(fn, "the catch should warn, not debug").toMatch(/console\.warn\(/);
    expect(fn, "a debug-level log here is what hid the bug").not.toMatch(/console\.debug\(/);
  });
});