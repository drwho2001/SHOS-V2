// The scheduled-retest prompt is the only place the app asks the user a question
// about a plan they deliberately created, and its wording used to assert a fact
// that is false for half the cases it now handles: it said the saved test covers
// the planned retest "for this date", which is only true once the plan's day has
// passed. An early test against a future plan is reported too now, so the copy
// has to state each plan's own situation instead.
//
// This is a SOURCE-level guard on purpose. The copy is JSX inside a large module
// that no unit test renders, and the alternative - asserting on rendered text -
// would need a browser to answer a question about a sentence.
//
// The comment-stripper is not incidental. The comment explaining this fix QUOTES
// the old wording verbatim, so a naive substring check for its absence matches
// that comment and passes for the wrong reason. That is the ninth-or-tenth
// recorded instance of that class in this repo.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(process.cwd(), "src", "modules", "SHOS_Testing_Prototype.jsx"),
  "utf8",
);

/**
 * Remove block and line comments, keeping STRING LITERALS.
 *
 * Comments only. An earlier version blanked strings as well, and that was wrong:
 * the prompt's copy IS JSX string literals, so the guard could never find it. The
 * only thing that must not be able to satisfy a negative assertion is the comment
 * documenting the fix, and stripping comments removes exactly that.
 *
 * NOTE: this doc comment deliberately avoids writing a block-comment terminator
 * inside itself. Writing one terminates the comment early and the remainder of
 * the prose parses as code - the exact twin of the XML-comment bug recorded in
 * CLAUDE.md, committed by me in the very file whose purpose is to survive a
 * comment.
 */
function stripComments(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
      out += " ";
      continue;
    }
    if (text.startsWith("//", i)) {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end + 1;
      out += "\n";
      continue;
    }
    // Do not treat a "//" or "/*" inside a string as a comment, which would cut
    // the real copy in half on a source line that quotes one.
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "\\") { j += 2; continue; }
        if (text[j] === quote) { j += 1; break; }
        j += 1;
      }
      out += text.slice(i, j);
      i = j;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

const code = stripComments(source);

describe("the stripper this guard depends on", () => {
  // A stripper that removed nothing would make every negative assertion below
  // pass vacuously, which is the whole failure mode it exists to prevent.
  it("removes a block comment that quotes the very string being asserted absent", () => {
    const fixture = `const a = 1; /* the old copy was "for this date" */ const b = 2;`;
    const stripped = stripComments(fixture);
    expect(stripped).not.toContain("for this date");
    expect(stripped).toContain("const a = 1;");
    expect(stripped).toContain("const b = 2;");
  });

  it("removes a line comment too", () => {
    expect(stripComments(`// for this date\nconst a = 1;`)).not.toContain("for this date");
  });

  it("leaves real code, including string literals, intact", () => {
    const kept = stripComments(`const a = "you tested before this date";`);
    expect(kept).toContain("you tested before this date");
  });

  it("does not treat a comment marker inside a string as a comment", () => {
    // Otherwise a source line quoting a URL or a path would be truncated at the
    // "//" and everything after it would look absent from the file.
    const kept = stripComments(`const u = "https://example.test/x"; const b = 2;`);
    expect(kept).toContain("const b = 2;");
  });
});

describe("the scheduled-retest prompt's copy", () => {
  it("no longer claims the saved test covers the plan 'for this date'", () => {
    // The exact mutation that must turn this red: putting the old sentence back.
    expect(code).not.toContain("planned retest for this date");
    expect(code).not.toContain("planned retests for this date");
  });

  it("states each plan's own date, so the situation is per-plan rather than assumed", () => {
    // The whole fix: a plan still in the future cannot be described by a
    // sentence that assumes its day has passed.
    expect(code).toMatch(/formatDate\(plannedDay\)/);
  });

  it("distinguishes an early test from a plan whose day has arrived", () => {
    expect(code).toContain("wasEarly");
    expect(code).toContain("you tested before this date");
    expect(code).toContain("this date has now passed");
  });

  it("still offers all three answers, because both buckets use them", () => {
    // Keep / update / archive are unchanged handlers; the guard exists so that
    // reporting the early case did not quietly reduce the choices offered.
    expect(code).toContain("Update to the next suggested date");
    expect(code).toContain("Keep it as planned");
    expect(code).toContain("Archive ");
  });

  it("passes the union of both buckets to the prompt, not just the on-time half", () => {
    // The change that makes the early case reach the UI at all.
    expect(code).toMatch(/findAffectedRoutineRetestPlans\(all, saved\)/);
    expect(code).toMatch(/\[\.\.\.onTime, \.\.\.early\]/);
  });
});