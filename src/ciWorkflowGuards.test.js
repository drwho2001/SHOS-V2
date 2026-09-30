import { describe, it, expect } from "vitest";
import fs from "node:fs";
import yaml from "js-yaml";

// CI GUARDS.
//
// These assert properties of the GitHub Actions workflows themselves. They
// exist because of a 30 Sep 2026 audit finding that is easy to state and easy
// to regress: build-apk.yml and web-alpha.yml published a PUBLIC APK and the
// public web build on every push to main having run no test, no lint and no
// build verification of any kind. The gate that exists (smoke-test.yml) is a
// SEPARATE workflow, and `needs:` only works between jobs inside one workflow -
// so the natural assumption that the two were connected was simply false, and
// nothing in the repo would have said so.
//
// The fix was to put the gate inside each publishing workflow. This file is
// what stops that being quietly undone by the next workflow edit, and it also
// pins the two supply-chain properties found in the same audit.
//
// Source-text guards rather than a YAML-AST walk for most of it, because the
// property that matters is "does this step exist and is it conditional", which
// reads far more clearly as text than as a tree traversal.

const WF = ".github/workflows";
const read = (f) => fs.readFileSync(`${WF}/${f}`, "utf8");

// Every workflow must PARSE. A malformed workflow file is not reported as an
// error by GitHub at push time - it is silently skipped, which turns a typo
// into "the gate quietly stopped existing" with a green run.
describe("every workflow file is valid YAML", () => {
  it("parses, and names at least one job", () => {
    for (const f of fs.readdirSync(WF)) {
      const doc = yaml.load(read(f));
      expect(doc, `${f} failed to parse`).toBeTruthy();
      expect(Object.keys(doc.jobs || {}).length, `${f} has no jobs`).toBeGreaterThan(0);
    }
  });

  it("uses no tab characters, which YAML forbids for indentation", () => {
    for (const f of fs.readdirSync(WF)) {
      expect(read(f).includes("\t"), `${f} contains a tab`).toBe(false);
    }
  });

  it("no `#` comment sits inside an `if: |` block scalar", () => {
    // ADDED 30 Sep 2026 after shipping exactly this bug. Inside a YAML block
    // scalar, `#` is LITERAL TEXT, not a comment - so an explanatory comment
    // written inside `if: |` becomes part of the expression, and GitHub
    // rejects the whole workflow. It failed to load on a real push.
    //
    // The important part: the "parses as YAML" test above PASSED while the
    // workflow was broken. The file genuinely is valid YAML. YAML validity and
    // GitHub Actions expression validity are different properties, and only the
    // second one matters - so "it parses" is not sufficient evidence that a
    // workflow works, which is worth stating because it looked like it was.
    for (const f of fs.readdirSync(WF)) {
      const lines = read(f).split(/\r?\n/);
      let inBlock = false;
      lines.forEach((line, i) => {
        if (/^\s*if:\s*\|\s*$/.test(line)) inBlock = true;
        else if (inBlock && /^\s*#/.test(line)) {
          throw new Error(`${f}:${i + 1} has a comment inside an "if: |" block scalar, where # is literal text`);
        }
        // The block ends at the next key at lower-or-equal indentation.
        else if (inBlock && /^\s{0,4}\S+:\s/.test(line) && !/^\s{6,}/.test(line)) inBlock = false;
      });
    }
  });
});

describe("a red gate must actually block a published artefact", () => {
  // The load-bearing property. Named explicitly so that deleting or renaming
  // the gate step is an immediately visible test failure rather than a
  // workflow that still parses and still publishes.
  for (const f of ["build-apk.yml", "web-alpha.yml"]) {
    it(`${f} runs the verification gate`, () => {
      expect(read(f)).toMatch(/run: npm run verify/);
    });

    it(`${f} gate is push-only, so a manual bisect build is not blocked`, () => {
      const src = read(f);
      const gateIdx = src.indexOf("npm run verify:fast");
      expect(gateIdx, `${f} has no gate step`).toBeGreaterThan(-1);
      // The `if:` must belong to this step, not to an earlier one.
      const before = src.slice(0, gateIdx);
      const lastIf = before.lastIndexOf("if: github.event_name == 'push'");
      const lastName = before.lastIndexOf("- name:");
      expect(lastIf, `${f} gate is not push-conditional`).toBeGreaterThan(lastName);
    });

    it(`${f} installs from the lockfile, not npm install`, () => {
      // npm install re-resolves within semver ranges, so the published
      // artefact could differ from the dependency tree anything tested.
      const src = read(f);
      expect(src).toMatch(/run: npm ci/);
      expect(src).not.toMatch(/^\s*run: npm install\s*$/m);
    });
  }

  // Cross-workflow gating is IMPOSSIBLE in Actions, which is precisely why
  // each publishing workflow needs its own gate. Recorded as a test because the
  // natural fix ("add needs: to smoke-test.yml") is a no-op that reads like
  // it worked.
  it("the gate cannot live in a different workflow, so each publisher has its own", () => {
    const smoke = read("smoke-test.yml");
    const apk = read("build-apk.yml");
    // smoke-test.yml must not reference the other workflows (it cannot depend
    // on them), and apk must not claim to.
    expect(apk).not.toMatch(/needs:.*smoke-test/);
    expect(smoke).toMatch(/run: npm run verify$/m);
  });
});

describe("workflow token scope", () => {
  it("every job has an explicit permissions scope, at job or workflow level", () => {
    // smoke-test.yml was the real omission: it read the repo and nothing else,
    // so inheriting whatever the repository default grants was unnecessary
    // exposure. NOTE the workflow-level block counts — build-apk.yml declares
    // `contents: write` once at the top, which is the correct place for a
    // single-job workflow and applies to every job in it. An earlier version of
    // this guard demanded a job-level block and failed a file that was already
    // correctly scoped, which is the guard being wrong rather than the code.
    for (const f of fs.readdirSync(WF)) {
      const doc = yaml.load(read(f));
      for (const [name, job] of Object.entries(doc.jobs || {})) {
        const scope = job.permissions ?? doc.permissions;
        expect(scope, `${f} job ${name} has no permissions at job or workflow level`).toBeTruthy();
      }
    }
  });

  it("smoke-test is read-only", () => {
    const doc = yaml.load(read("smoke-test.yml"));
    expect(doc.jobs["smoke-test"].permissions).toEqual({ contents: "read" });
  });
});

describe("the secret-bearing workflow", () => {
  // SCOPE, stated rather than left looking comprehensive: this pins the ONE
  // action that is both third-party AND holds a live secret. The `actions/*`
  // steps across all four workflows are still on mutable major-version tags
  // (`@v5`, `@v6`). GitHub owns those and they are a far smaller risk than a
  // third-party action holding the owner's API key, but they are NOT pinned and
  // this file deliberately does not pretend otherwise. A guard that failed
  // forever on an unfixed item would simply get deleted, so the unenforced part
  // is named here instead.
  it("pins the third-party secret-bearing action to an immutable SHA", () => {
    const src = read("opencode.yml");
    const uses = src.split("\n").filter((l) => l.trim().startsWith("uses:"));
    const thirdParty = uses.filter((l) => !/\bactions\//.test(l));
    expect(thirdParty.length, "expected the anomalyco action to be found").toBeGreaterThan(0);
    for (const line of thirdParty) {
      expect(line, `unpinned third-party action: ${line.trim()}`).toMatch(/@[0-9a-f]{40}/);
      expect(line, `mutable ref in use: ${line.trim()}`).not.toContain("@latest");
    }
  });

  it("only the repository owner can trigger it", () => {
    // The repo is public, so "anybody who can comment" is anybody at all,
    // and the job holds a live API key.
    expect(read("opencode.yml")).toMatch(/github\.event\.comment\.user\.login == 'drwho2001'/);
  });
});

describe("no workflow input is interpolated into a shell body", () => {
  it("release_tag reaches the shell as data via env, not as expanded text", () => {
    const src = read("build-apk.yml");
    // `${{ }}` is expanded BEFORE the shell parses the line, so a value
    // containing quotes or $(...) reaches a `contents: write` job.
    const interpolated = src.split("\n").filter(
      (l) => l.includes("${{") && /\brun:/.test(l)
    );
    expect(interpolated).toEqual([]);
    expect(src).toMatch(/RELEASE_TAG: \$\{\{/);
  });
});