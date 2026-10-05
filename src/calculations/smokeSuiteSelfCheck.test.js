// Guards the smoke SUITE ITSELF, rather than the app.
//
// ADDED 29 Sep 2026 after the 22nd flow shipped green and the summary still
// said "21 flows". The flow had no `console.log("\n[NN/NN] ...")` header, and
// verify-changes.mjs derives the reported flow count by counting output lines
// matching /^\[\d+\/\d+\]/. So all 14 of its assertions ran, CI went green, and
// the number was simply wrong.
//
// That is this project's most repeated failure mode wearing a new hat - a gate
// that measures nothing and looks like it measured something. It matters here
// for a specific reason: if the flow had been deleted outright, the reported
// count would not have moved either. A suite can therefore be silently losing
// coverage and reporting a healthy number, and nothing downstream would notice
// because the number looks plausible.
//
// The three checks below are deliberately structural rather than clever. A
// regex that tries to understand JSX or a call expression is exactly the kind
// of broad mechanical parse this project has been burned by more than once.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (...p) => readFileSync(path.join(ROOT, ...p), "utf8");
const SMOKE = read("scripts", "smoke-test.cjs");

/**
 * Blank out JS comments, preserving every offset.
 *
 * A state machine, not regexes: an apostrophe inside a comment ("the suite's")
 * would open a string literal that never closes, and a `'(?:[^'\\]|\\.)*'` regex
 * would then delete real code for the rest of the file.
 */
function stripJsComments(src) {
  const out = src.split("");
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "//") {
      while (i < src.length && src[i] !== "\n") { out[i] = " "; i++; }
      continue;
    }
    if (two === "/*") {
      const e = src.indexOf("*/", i + 2);
      const stop = e < 0 ? src.length : e + 2;
      for (let k = i; k < stop; k++) if (src[k] !== "\n") out[k] = " ";
      i = stop;
      continue;
    }
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === "\\") j++; j++; }
      i = j < src.length ? j + 1 : src.length;
      continue;
    }
    i++;
  }
  return out.join("");
}

describe("the smoke suite reports what it actually runs", () => {
  it("every registered flow announces itself with a [N/M] title", () => {
    // The registration call sites. `run("name", ...)` is the only way a flow is
    // invoked, so this is the complete list of flows that execute.
    const registrations = SMOKE.match(/await run\("([^"]+)"/g) || [];
    expect(registrations.length).toBeGreaterThan(0);

    // The headers the count is derived from. These are the JS string literals
    // in the source, so the "\\n[" is a literal backslash-n inside a string -
    // not a real newline, which is why a plain ^ anchor does not work here.
    const headers = SMOKE.match(/\\n\[\d+\/\d+\] /g) || [];

    expect(
      headers.length,
      `the suite registers ${registrations.length} flows but only declares ${headers.length} [N/M] titles. ` +
        "A flow without one still runs and still passes, while the reported count stays wrong - and deleting " +
        "the flow entirely would not move the number either.",
    ).toBe(registrations.length);
  });

  it("the flow titles are contiguous from 1, with no gaps or duplicates", () => {
    // A duplicate title means two flows report as the same number and a gap
    // means one never announced itself - the same defect as above, but subtler.
    const nums = (SMOKE.match(/\\n\[(\d+)\/\d+\] /g) || []).map((m) => Number(m.match(/\[(\d+)/)[1]));
    const sorted = [...nums].sort((a, b) => a - b);
    expect(sorted[0]).toBe(1);
    expect(sorted.length).toBe(new Set(sorted).size);
    sorted.forEach((n, i) => expect(n).toBe(i + 1));
  });

  it("the declared total in every title matches the number of flows", () => {
    // "[21/21]" alongside a 22-flow suite reads as a bug in the suite, and it
    // is how a renumbering slip would be noticed at all - so it is asserted
    // rather than left to a human noticing.
    // COMMENTS ARE STRIPPED FIRST, and this is a real fix rather than hygiene.
    //
    // The pattern below matches a literal `\n[` inside a JS string, and a COMMENT
    // can contain that too. It already did: a 24 Sep comment quoting the historical
    // CI flake (`real CI flake ([3/15] timed out...)`) was counted as a flow title,
    // so the suite appeared to declare two different totals and this guard failed on
    // a file that was entirely correct.
    //
    // It sat green for weeks because the stale literal was always there and only
    // another session adding flows - which moved the real total from /15 to /25 -
    // made the two disagree. A guard that fails on someone else's unrelated change
    // reads as "their change broke it", which is how a stale-guard bug gets blamed
    // on whoever touched the file last.
    const code = stripJsComments(SMOKE);
    // The trailing space matters: it is what distinguishes a title from a bare
    // `[3/15]` sitting mid-comment.
    const total = (code.match(/\\n\[\d+\/(\d+)\] /g) || []).map((m) => Number(m.match(/\/(\d+)\]/)[1]));
    const unique = [...new Set(total)];
    // Asserting only `length === 1` is what let a 25-versus-26 slip through for
    // as long as it existed: it asks "is there one total", not "is it the right
    // one". Both matter, and the second is the one that catches a flow being
    // added without the other 25 titles being renumbered.
    expect(unique.length, `smoke-test.cjs declares more than one total: ${unique.join(", ")}`).toBe(1);
    const flowCount = (code.match(/await run\("([^"]+)"/g) || []).length;
    expect(unique[0]).toBe(flowCount);
    // ...and the sequence must be 1..N with no gaps, so a renumbering slip is
    // caught even if every literal happens to agree on the total.
    const nums = (code.match(/\\n\[(\d+)\/\d+\] /g) || []).map((m) => Number(m.match(/\[(\d+)/)[1]));
    expect([...nums].sort((a, b) => a - b), `flow titles are not 1..${flowCount}`).toEqual(
      Array.from({ length: flowCount }, (_, i) => i + 1),
    );
  });

  it("SMOKE_ONLY refuses to report success when its filter matches nothing", () => {
    // The other half of the same honesty problem: a typo in SMOKE_ONLY running
    // zero flows must be an error, not a green line. This is the behaviour
    // that makes a single-flow run trustworthy at all.
    expect(SMOKE).toMatch(/SMOKE_ONLY && !ranAny/);
    expect(SMOKE).toMatch(/matched no flow/);
  });
});
