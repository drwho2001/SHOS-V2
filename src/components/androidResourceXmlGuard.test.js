import fs from "node:fs";
import path from "node:path";
import sax from "sax";
import { it, expect } from "vitest";

/**
 * Every Android resource/layout XML must be well-formed.
 *
 * WHY THIS EXISTS. A comment placed inside a tag's attribute list is not legal
 * XML, and it fails at `:app:parseDebugLocalResources` - so it survives the
 * whole local gate (build, lint, every unit test, encoding) and only CI's APK
 * job catches it:
 *
 *   [Fatal Error] next_dose_widget.xml:46:9: Element type "Chronometer" must be
 *   followed by either attribute specifications, ">" or "/>".
 *
 * That is the XML twin of the JSX bug this repo has already recorded, where a
 * `//` comment between two JSX elements is not a comment at all - it is TEXT,
 * and it rendered a paragraph of source code onto the Clinic Card in a published
 * APK. Same root cause both times: a comment in a position whose grammar has no
 * comment production, in a language where the mistake parses as something else.
 *
 * Parsed with `sax` rather than a regex, for the reason this repo has four
 * recorded regex-audit failures: a regex cannot see a comment inside a tag
 * without also matching comments in legal positions, so it either cries wolf or
 * needs an exemption list, and an exemption list is how the check gets deleted.
 */
const RES = "android/app/src/main/res";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".xml")) out.push(p);
  }
  return out;
}

it("every Android resource XML is well-formed", () => {
  const files = walk(RES);
  // Precondition, not decoration: without it, a wrong RES path would make walk()
// return nothing and the malformed-file assertion would pass on an empty list -
// the exact vacuity this repo keeps recording. Guessed ">100" on the first run
// and this fired immediately: there are 48 resource XML files. The threshold is
// a sanity bound, not the count; the count is printed on success so a large drop
// is visible.
expect(files.length, "found far fewer resource XML files than expected").toBeGreaterThan(20);

  const broken = [];
  for (const f of files) {
    try {
      // strict mode throws on anything not well-formed, including a comment
      // inside a tag.
      sax.parser(true).write(fs.readFileSync(f, "utf8")).close();
    } catch (e) {
      broken.push(`${f}: ${e.message.split("\n")[0]}`);
    }
  }

  expect(broken, `malformed XML:\n${broken.join("\n")}`).toEqual([]);
  console.log(`  ${files.length} resource XML files parsed well-formed`);
});

it("proves the parser rejects the shape this guard exists for", () => {
  // Non-vacuity: prove the parser actually rejects a comment inside a tag,
  // rather than trusting that it "looks strict". A throwaway fixture, not an
  // assertion that some file is currently broken - that would break the day the
  // last one is fixed and would train the next reader to delete the test.
  const bad =
    '<LinearLayout xmlns:android="x" android:id="@+id/widget_root" ' +
    '<!-- not legal here -->\nandroid:clickable="false" />';
  expect(() => sax.parser(true).write(bad).close()).toThrow();

  // And that it accepts the legal position for the same comment, so the guard
  // cannot push the codebase towards avoiding comments entirely.
  const good =
    '<LinearLayout xmlns:android="x" android:id="@+id/widget_root">' +
    "<!-- legal here --><TextView /></LinearLayout>";
  expect(() => sax.parser(true).write(good).close()).not.toThrow();
});