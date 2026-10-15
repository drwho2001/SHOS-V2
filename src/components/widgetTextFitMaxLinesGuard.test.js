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

describe("WidgetTextFit maxLines agrees with the layout it is fitting", () => {
  /** view id -> declared maxLines, across every widget layout. */
  const layoutMaxLines = new Map();
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
    }
  }

  /** Every fit() call site: view id -> maxLines the caller will pass. */
  const callSites = [];
  for (const file of readdirSync(WIDGET_JAVA)) {
    if (!file.endsWith(".java")) continue;
    const java = readFileSync(join(WIDGET_JAVA, file), "utf8");
    const re =
      /WidgetTextFit\.fit\(\s*views,\s*context,\s*R\.id\.(\w+),[\s\S]*?wDp,\s*([\d.]+)f\s*(?:,\s*(\d+)\s*)?\)/g;
    let m;
    while ((m = re.exec(java)) !== null) {
      callSites.push({
        file,
        viewId: m[1],
        // Absent seventh argument means the short overload, which passes 1.
        maxLines: m[3] === undefined ? 1 : Number(m[3]),
      });
    }
  }

  it("found both sides of the contract (guard against a vacuous pass)", () => {
    // Without this the whole file passes if either the layout parse or the
    // call-site regex stops matching - which is exactly what happened the first
    // time a provider passed wDp under a different name.
    expect(
      layoutMaxLines.size,
      "expected widget layouts declaring android:id + android:maxLines",
    ).toBeGreaterThanOrEqual(10);
    expect(
      callSites.length,
      "expected WidgetTextFit.fit(...) call sites in the widget providers",
    ).toBeGreaterThanOrEqual(10);
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