// widgetTextFitMaxLinesGuard.test.js
//
// WidgetTextFit measures the FULL rendered string against the width of a single
// line. That is correct for a field whose layout says maxLines="1", and wrong
// for one that says maxLines="2": there, a string too long for one line is not
// a failure, it simply wraps. The fitter needs to know which case it is in,
// and it learns it from the argument a call site passes - 1 implicitly through
// the short overload, or explicitly as the seventh argument.
//
// That makes two things silently drift apart, and both produce a diagnostic
// that lies rather than a crash:
//
//   1. A layout is widened to maxLines="2" and the provider is left calling the
//      short overload. The fitter keeps insisting the string is too long, pins
//      it to the 12sp floor, and logs HITS_FLOOR for text that is in fact
//      wrapping and displaying perfectly. The log - which exists precisely so
//      nobody has to re-derive this from a screenshot - becomes the thing that
//      misleads.
//   2. The reverse: a call site passes 2 for a field whose layout still caps at
//      one line, so the fitter picks a size sized for a wrap the layout will
//      never allow, and the text ellipsizes at a size chosen to fit two lines.
//
// So this asserts, for EVERY fit() call site in the widget providers, that the
// maxLines it passes equals the maxLines its layout actually declares. Drift in
// either direction fails the build.
//
// WHY THIS IS A SOURCE GUARD AND NOT A BEHAVIOURAL TEST. The logic under test is
// Java, and Java cannot be compiled on the machine this suite runs on - only a
// green CI build-apk run confirms it compiles at all. Asserting on the source is
// the only coverage available for the ARGUMENT CONTRACT between the two layers,
// and it is the contract that can drift without any test failing. The wrapping
// arithmetic itself is still exercised on device, via the WRAPS / HITS_FLOOR
// decision line.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ANDROID = join(process.cwd(), "android", "app", "src", "main");
const WIDGET_JAVA = join(ANDROID, "java", "com", "shos", "app", "widget");
const LAYOUTS = join(ANDROID, "res", "layout");

// ---------------------------------------------------------------------------
// Call-site extraction. Added 16 Oct 2026 (t116).
//
// These three helpers exist because the regex this file used to scan with was
// too WIDE, not too narrow. It had a lazy [\s\S]*? between the view id and the
// width argument, which is unbounded across newlines and statements, so a match
// could start at one fit() call and swallow the next one - reporting the
// neighbour's arguments as if they were its own.
// ---------------------------------------------------------------------------

/**
 * Strip // and block comments before scanning.
 *
 * Load-bearing, not tidiness: the comments in these providers are dense with
 * parens, commas and prose that names fit() calls. Scanning raw source lets a
 * commented-out call satisfy the contract.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Every index at which `needle` occurs, non-overlapping. */
function occurrencesOf(src, needle) {
  const out = [];
  let i = src.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = src.indexOf(needle, i + needle.length);
  }
  return out;
}

/**
 * The argument list of a call whose arguments begin at `open` (i.e. just past
 * its opening paren), split on top-level commas.
 *
 * A nested call's own commas stay inside one argument, so
 * `fit(v, c, R.id.x, t, widthDp(a, b, i), 18f)` is six arguments - which is the
 * case the old regex could not express at all. String literals are copied
 * wholesale so a paren or comma in a user-facing message is not read as
 * structure.
 *
 * Returns null when the parens never balance, so a malformed call is a loud
 * failure rather than a silently shorter argument list.
 */
function splitCallArgs(src, open) {
  const args = [];
  // depth starts at 1, NOT 0: `open` is the index just PAST the call's opening
  // paren, so this scan begins one level inside it. Starting at 0 means the
  // closing paren drives depth to -1, the `=== 0` test is never met, and every
  // call site parses as null. The first version of this helper had exactly that
  // bug and the exact-count assertion caught it - which is the assertion doing
  // the job it exists for.
  let depth = 1;
  let current = "";
  let i = open;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      current += ch;
      i++;
      while (i < src.length) {
        const c = src[i];
        current += c;
        i++;
        if (c === "\\") {
          current += src[i];
          i++;
        } else if (c === '"') break;
      }
      continue;
    }
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) {
        args.push(current);
        return args;
      }
    } else if (ch === "," && depth === 1) {
      args.push(current);
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  return null;
}

describe("WidgetTextFit maxLines agrees with the layout it is fitting", () => {
  /** view id -> declared maxLines, across every widget layout. */
  const layoutMaxLines = new Map();
  /** view id -> declared textSize in sp. t119: maxSp was never checked. */
  const layoutTextSize = new Map();
  for (const file of readdirSync(LAYOUTS)) {
    if (!file.endsWith(".xml")) continue;
    const xml = readFileSync(join(LAYOUTS, file), "utf8");
    // Each TextView block carries both its id and its maxLines; capture the
    // block first so an id is never paired with a LATER view's maxLines.
    const blocks = xml.match(/<TextView[\s\S]*?\/>/g) || [];
    for (const block of blocks) {
      const id = block.match(/android:id="@\+id\/(\w+)"/);
      const max = block.match(/android:maxLines="(\d+)"/);
      if (id && max) layoutMaxLines.set(id[1], Number(max[1]));
      const size = block.match(/android:textSize="([\d.]+)sp"/);
      if (id && size) layoutTextSize.set(id[1], Number(size[1]));
    }
  }

  /**
   * Every fit() call site: view id -> maxLines the caller will pass.
   *
   * CHANGED 16 Oct 2026 (t116). The previous version was a single regex whose
   * lazy [\s\S]*? spanned statements, which had two compounding faults:
   *
   *   1. It required the width argument to be the literal token `wDp`. One call
   *      site - NextDoseWidgetProvider's Redacted branch - inlined
   *      WidgetTextFit.widthDp(...) instead, because `wDp` was declared AFTER
   *      that branch's early return and so was not in scope there.
   *   2. Because the lazy span is unbounded across newlines AND statements, the
   *      match anchoring on that call site ran on and absorbed the NEXT fit()
   *      call - a call for the SAME view id which did pass maxLines=2. The pair
   *      reported the neighbour's arguments and passed.
   *
   * So the guard reported 25 call sites when 26 exist, and the one it could not
   * see passed maxLines=1 against a layout declaring maxLines=2. That is a LIVE
   * defect: at the Redacted tier the medication name was forbidden from wrapping
   * while at the Full tier it could wrap, so the privacy tier rendered strictly
   * worse than the unrestricted one on the widget's largest field - and a full
   * green suite sat next to it.
   *
   * Arguments now come from a balanced-paren scan per call site, which cannot
   * cross a statement boundary and does not care how the width is spelled.
   */
  const callSites = [];
  const parseFailures = [];
  for (const file of readdirSync(WIDGET_JAVA)) {
    if (!file.endsWith(".java")) continue;
    const java = stripComments(readFileSync(join(WIDGET_JAVA, file), "utf8"));
    for (const at of occurrencesOf(java, "WidgetTextFit.fit(")) {
      const args = splitCallArgs(java, at + "WidgetTextFit.fit(".length);
      const where = `${file} (offset ${at})`;
      if (args === null) {
        parseFailures.push(`${where}: unbalanced parens in a fit() call`);
        continue;
      }
      const viewId = args[2]?.match(/R\.id\.(\w+)/)?.[1];
      if (!viewId) {
        parseFailures.push(
          `${where}: fit() argument 3 is "${args[2]}", which names no R.id`,
        );
        continue;
      }
      // The width comes from the launcher and carries no user data, so it does
      // not vary by privacy tier. Requiring it to be passed by name keeps every
      // call site's maxLines statically checkable - which is precisely the
      // property whose absence made this defect invisible.
      const widthArg = (args[4] ?? "").trim();
      if (widthArg !== "wDp") {
        parseFailures.push(
          `${file}: R.id.${viewId} passes "${widthArg}" as its width, not the ` +
            `wDp local. Hoist wDp above the Redacted early return and pass it by ` +
            `name, or this call site's maxLines argument is not checkable and a ` +
            `real drift passes the build.`,
        );
        continue;
      }
      callSites.push({
        file,
        viewId,
        // Absent seventh argument means the short overload, which passes 1.
        maxLines: args.length >= 7 ? Number(String(args[6]).trim()) : 1,
        // Sixth argument is the ceiling the fitter may step DOWN from. It must be
        // the layout's declared size, or the fitter is licensed to render text
        // LARGER than the design allows and no build step notices.
        maxSp: Number(String(args[5]).replace(/f$/, "")),
      });
    }
  }

  // Counted in the source, not guessed: `grep -c "WidgetTextFit\.fit\("` over
  // android/app/src/main/java/com/shos/app/widget/*.java, minus any occurrence
  // inside a comment (the scanner strips those). CLAUDE.md said 25 and was
  // wrong, which is how the 26th went unchecked. If a provider gains or loses a
  // fit() call, change this number in the SAME commit - never after.
  //
  // 26 -> 19 on 17 Oct 2026, and the drop is the point rather than a loss. Seven
  // sites went away because their layouts moved to autoSizeTextType:
  // NextDoseWidgetProvider lost three (both branches' medication name, plus the
  // wall-clock dose time, which is five characters and has nothing to measure) and
  // now has NO fit() call at all; DoxyPEPWidgetProvider lost four.
  //
  // A left-behind call would not have been harmless. TextView.setTextSize is
  // guarded by !isAutoSizeEnabled(), so once autosize is on a setTextViewTextSize
  // is a DETERMINISTIC NO-OP - and fit() logs the size it chose. This repo reads
  // that log to decide whether text fit, so a fitter quietly doing nothing would
  // manufacture evidence of a fit that never happened. Fewer, real sites.
  // CHANGED 21 Oct 2026 - 16 -> 17, for the Clinic Card's new "Planned" row.
  // The Clinic Card now fits six fields rather than five: the label, the
  // appointment's name, the date, the place, what it is for and the tests.
  const EXPECTED_FIT_CALL_SITES = 17;

  it("found both sides of the contract, and every call site parsed", () => {
    // Without this the whole file passes if either the layout parse or the
    // call-site scan stops matching - which is exactly what happened the first
    // time a provider passed wDp under a different name.
    expect(
      layoutMaxLines.size,
      "expected widget layouts declaring android:id + android:maxLines",
    ).toBeGreaterThanOrEqual(10);

    expect(
      parseFailures,
      "these fit() call sites could not be checked, so they are unchecked:",
    ).toEqual([]);

    // An EXACT count, not "at least". "At least N" over a set that currently
    // holds N items measures nothing (L-090), and the set that held the real
    // defect was one item larger than the number the file believed.
    expect(
      callSites.length,
      `expected exactly ${EXPECTED_FIT_CALL_SITES} WidgetTextFit.fit(...) call ` +
        `sites in the widget providers, parsed ${callSites.length}. Recount with: ` +
        `grep -c "WidgetTextFit\\.fit\\(" android/app/src/main/java/com/shos/app/widget/*.java`,
    ).toBe(EXPECTED_FIT_CALL_SITES);
  });

  it("every fit() call passes the maxLines its layout declares", () => {
    const mismatches = [];
    for (const call of callSites) {
      const declared = layoutMaxLines.get(call.viewId);
      if (declared === undefined) {
        mismatches.push(
          `${call.file}: fit() targets R.id.${call.viewId}, which no layout declares`,
        );
        continue;
      }
      if (declared !== call.maxLines) {
        mismatches.push(
          `${call.file}: R.id.${call.viewId} layout declares maxLines=${declared} but fit() is called with maxLines=${call.maxLines}`,
        );
      }
    }
    expect(
      mismatches,
      "a field's fit() maxLines must equal its layout's maxLines, or the " +
        "WRAPS/HITS_FLOOR decision line reports a truncation that is not happening",
    ).toEqual([]);
  });

  it("every fit() ceiling matches the textSize its layout declares", () => {
    // t119, 17 Oct 2026, MEASURED on 23124RA7EO. The device log printed
    //   -> chose 18.0sp (max 18.0sp) textPx=289 availablePx=212
    // for a field whose layout declares android:textSize="14sp". The fitter was
    // licensed to render a date a THIRD larger than the design allows, and it
    // said so in the log while every test stayed green - because this file
    // asserted maxLines and never maxSp. Two more call sites had the same fault
    // (16f and 14f on a 12sp field), now corrected in the providers.
    //
    // It survived because both axes looked like the same kind of number and only
    // one was checked. A field's fit() call must match its layout on BOTH.
    const mismatches = [];
    for (const call of callSites) {
      const declared = layoutTextSize.get(call.viewId);
      if (declared === undefined) continue; // no textSize in the layout; not this guard's business
      if (declared !== call.maxSp) {
        mismatches.push(
          `${call.file}: R.id.${call.viewId} layout declares textSize=${declared}sp ` +
            `but fit() is called with maxSp=${call.maxSp}, so the fitter may render ` +
            `it ${call.maxSp > declared ? "LARGER" : "smaller"} than the design allows`,
        );
      }
    }
    expect(
      mismatches,
      "a field's fit() maxSp must equal its layout's textSize - it is the ceiling the " +
        "fitter steps down from, and an inflated one silently overrides the design",
    ).toEqual([]);
  });

  it("the short overload documents that it means one line", () => {
    // The implicit default is load-bearing for every call site that does not
    // pass it, so it is asserted rather than assumed.
    const src = readFileSync(join(WIDGET_JAVA, "WidgetTextFit.java"), "utf8");
    expect(existsSync(join(WIDGET_JAVA, "WidgetTextFit.java"))).toBe(true);
    expect(src).toMatch(
      /widthDp,\s*float maxSp\)\s*\{\s*fit\(\s*views,\s*context,\s*viewId,\s*text,\s*widthDp,\s*maxSp,\s*1\)/,
    );
  });

  it("the wrap check measures the longest word, not the whole string", () => {
    // Wrapping divides on spaces. Measuring the whole string against one line
    // would pin every wrapping field to the floor forever.
    const src = readFileSync(join(WIDGET_JAVA, "WidgetTextFit.java"), "utf8");
    expect(src).toMatch(/maxLines\s*>\s*1\s*&&\s*paint\.measureText\(longestWord\(s\)\)/);
    expect(src).toMatch(/private static String longestWord\(String s\)/);
  });
});