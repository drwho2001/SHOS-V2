// Every data widget must honour its Redacted tier, not merely be SAFE at it.
//
// THE BUG THIS GUARDS, which was mine
// -----------------------------------
// sendWidgetUpdate correctly filters the payload at a Redacted tier, and its own
// unit tests assert that and pass. But WidgetBridgePlugin only forwards the
// named legacy fields it already knew about, so category/state/tier were
// received and never stored. Every provider then fell back to its own default
// placeholder - which for DoxyPEP meant a widget could read "No active window"
// while a window was active.
//
// That is the instructive part and the reason this file exists rather than a
// one-line note: the filter was CORRECT, the tests were GREEN, and the app still
// lied to the user. Filtering protects the payload; only the provider decides
// what is rendered, so only the provider can be asserted on.
//
// WHAT IS ASSERTED
// ----------------
// DoxyPEP is wired. The other six are NOT, and that is stated rather than
// hidden: this file is the mechanism plus a visible inventory of what remains,
// so a new session can see exactly how far the pattern has been taken rather
// than discovering it by reading seven providers. If the inventory is ever
// complete the file still passes, because "everything is wired" is the state it
// is aiming at - but the list below is the thing to check first.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WIDGET_DIR = path.join(ROOT, "android/app/src/main/java/com/shos/app/widget");
const LAYOUT_DIR = path.join(ROOT, "android/app/src/main/res/layout");
const read = (p) => readFileSync(p, "utf8");
// The JS pushers, DISCOVERED rather than listed - so a pusher added later is
// covered without this file being edited, and so removing a file cannot make a
// check pass on an empty set. Module scope because callSites() needs it too, and a
// per-test copy left callSites reading nothing.
const CALC = path.join(ROOT, "src/calculations");
const sources = readdirSync(CALC)
  .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"))
  .map((f) => ({ name: f, src: read(path.join(CALC, f)) }));

/**
 * Replace comment contents with spaces, preserving every offset.
 *
 * Not a nicety here: a delimiter inside a comment must not be counted as code,
 * and the non-vacuity case below is what proves this stripper is not simply
 * deleting the very text it is asked to find.
 */
/**
 * Blank out every string literal and comment, preserving all offsets.
 *
 * A state machine rather than four regexes, and the reason is measured rather than
 * stylistic: an apostrophe inside a COMMENT - and these files are full of prose
 * containing "the owner's" and "widget's" - opens a string that never closes, so a
 * `'(?:[^'\\]|\\.)*'` regex runs to the end of the file and deletes real code.
 * That is how `nextDoseRedactedLine` came to look undeclared to a brace counter
 * running on blanked text. Regexes for "a string literal" cannot tell a quote in
 * code from a quote in a comment; a scanner can, because it tracks state.
 *
 * Template literals are blanked to their opening and closing backticks only, so
 * the ${...} interpolations inside them survive as code - which is correct, since
 * their braces are real braces.
 */
function blankNonCode(src) {
  const out = src.split("");
  const blank = (from, to) => {
    for (let i = from; i < to && i < src.length; i++) if (src[i] !== "\n") out[i] = " ";
  };
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "//") { while (i < src.length && src[i] !== "\n") { out[i] = " "; i++; } continue; }
    if (two === "/*") { const e = src.indexOf("*/", i + 2); blank(i, e < 0 ? src.length : e + 2); i = e < 0 ? src.length : e + 2; continue; }
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === "\\") j++; j++; }
      if (j >= src.length) { i++; continue; } // unterminated: not a literal
      // The delimiters are KEPT and only the contents blanked. Blanking them too
      // destroyed the very method-name and key strings these assertions locate -
      // every `sendWidgetUpdate(bridge, "x"` became `sendWidgetUpdate(bridge, `, so
      // the callers stopped being findable at all.
      blank(i + 1, j);
      i = j + 1;
      continue;
    }
    if (c === "`") {
      // Contents blanked, both delimiters KEPT, and the ${...} interpolations
      // inside left as code - their braces are real braces and the brace counter
      // must see them.
      let j = i + 1;
      let depth = 0;
      while (j < src.length) {
        if (src[j] === "\\") { blank(j, j + 2); j += 2; continue; }
        if (src[j] === "$" && src[j + 1] === "{") { depth++; j += 2; continue; }
        if (depth > 0) {
          if (src[j] === "{") depth++;
          else if (src[j] === "}") depth--;
          j++;
          continue;
        }
        if (src[j] === "`") break;
        blank(j, j + 1);
        j++;
      }
      i = j < src.length ? j + 1 : src.length;
      continue;
    }
    i++;
  }
  return out.join("");
}

/**
 * Replace comment and string CONTENTS with spaces, keeping offsets and keeping
 * delimiters, so string LITERALS remain readable while a delimiter inside prose
 * cannot be counted as code.
 *
 * Built on blankNonCode - one scanner, not two - so it cannot reintroduce the
 * apostrophe-in-a-comment bug blankNonCode's own doc describes.
 */
function stripComments(src) {
  const out = src.split("");
  const blank = (from, to) => {
    for (let i = from; i < to && i < src.length; i++) if (src[i] !== "\n") out[i] = " ";
  };
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "//") { while (i < src.length && src[i] !== "\n") { out[i] = " "; i++; } continue; }
    if (two === "/*") { const e = src.indexOf("*/", i + 2); blank(i, e < 0 ? src.length : e + 2); i = e < 0 ? src.length : e + 2; continue; }
    // A string literal is SKIPPED WHOLE - contents and all - so a "//" inside one
    // is not a comment and its text stays readable. Blanking string contents here
    // was the bug: the assertions locate calls by the literal method name inside
    // sendWidgetUpdate(bridge, "updateAppointment", ...), so a version that
    // blanked string contents made every caller unfindable and the suite reported
    // that a wired provider "has no pusher".
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === "\\") j++; j++; }
      i = j < src.length ? j + 1 : src.length;
      continue;
    }
    if (c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== "`") { if (src[j] === "\\") j += 2; else j++; }
      i = j < src.length ? j + 1 : src.length;
      continue;
    }
    i++;
  }
  return out.join("");
}

/**
 * Does `id` sit inside one of `hiddenIds` in this layout?
 *
 * Parsed with a real tag scanner rather than a regex, because the property is
 * STRUCTURAL: hiding a container hides everything under it, and that is precisely
 * how the Clinic Card's sensitive row already works. A regex cannot express
 * "descendant of", and this repo has four audits that failed on exactly that.
 */
/**
 * Every offset at which `sendWidgetUpdate(bridge, "<widget>"` appears, across the
 * concatenated pushers.
 *
 * Returned rather than searched inline so the loop above cannot accidentally
 * check only the first one - which is the bug this exists to fix.
 */
function callSites(widget) {
  const src = sources.map((s) => s.src).join("\n");
  const code = stripComments(src);
  const out = [];
  for (let i = code.indexOf(`sendWidgetUpdate(bridge, "${widget}"`); i !== -1;
       i = code.indexOf(`sendWidgetUpdate(bridge, "${widget}"`, i + 1)) {
    out.push(i);
  }
  return out;
}

/** Does `id` sit inside one of `hiddenIds` in this layout? */
function insideHidden(layoutXml, id, hiddenIds) {
  const stack = [];
  // Sequential scan over tags only; self-closing tags push and pop immediately,
  // which is what makes this correct for a layout with a mix of both forms.
  const tag = /<(\/?)(\w+)([^>]*?)(\/?)>/g;
  let m;
  while ((m = tag.exec(layoutXml)) !== null) {
    const [, closing, name, attrs, selfClose] = m;
    if (closing) { stack.pop(); continue; }
    const myId = (attrs.match(/android:id="@\+id\/(\w+)"/) || [])[1];
    if (myId === id && stack.some((a) => hiddenIds.has(a))) return true;
    if (selfClose) continue;
    stack.push(myId);
  }
  return false;
}

/** Providers that render stored data, discovered rather than listed. */
const dataProviders = readdirSync(WIDGET_DIR)
  .filter((f) => f.endsWith("WidgetProvider.java"))
  .filter((f) => {
    const src = read(path.join(WIDGET_DIR, f));
    // CHANGED 4 Oct 2026 - the static fallback layout is now excluded. Every
    // provider gained an `unavailableViews()` helper that renders
    // R.layout.widget_unavailable when the encrypted store is unavailable, and this
    // line took the FIRST R.layout match in the file - so it started resolving
    // every provider to the fallback and asserting that the data views it hides
    // exist in a layout that, by design, contains no data views at all.
    //
    // The fallback is a genuinely different thing and is checked by
    // widgetTapAndFallbackGuard, which asserts it carries exactly one fixed
    // string and no @string/ reference. Filtering it here is a narrowing of THIS
    // guard's scope to data-bearing layouts, not a weakening: the assertions
    // themselves are untouched, and they now run against the layout the provider
    // actually renders data into.
    const layouts = [...src.matchAll(/R\.layout\.(\w+)/g)].map((m) => m[1]);
    const layout = layouts.find((l) => l !== "widget_unavailable");
    return layout && readdirSync(LAYOUT_DIR).includes(`${layout}.xml`) && /WidgetPrefs\.get\(/.test(src);
  })
  .sort();

/** Providers already honouring a redacted line. */
const WIRED = dataProviders.filter((f) => /KEY_REDACTED_TEXT|redactedText/.test(read(path.join(WIDGET_DIR, f))));
const NOT_WIRED = dataProviders.filter((f) => !WIRED.includes(f));

// 40s, explicitly. This test re-reads all fourteen provider files, all twelve
  // layouts, the bridge, and every pusher under src/calculations - on EVERY run -
  // and then does delimiter balancing over the whole concatenated source. Standalone
  // it takes ~24s, which is not a normal test's cost and which vitest's 5s default
  // treats as a failure under load.
//
// So the budget is stated rather than inferred: a timeout here presents as an
  // assertion failure of something this file never asserted, which is exactly the
// misdiagnosis that cost hours on jsxComponentBindingGuard before it was given a
// budget of its own.
const SCAN_TIMEOUT_MS = 40_000;

describe("redacting the payload is not the same as redacting the screen", () => {
  it("discovered the seven data widgets, or the inventory below is meaningless", SCAN_TIMEOUT_MS, () => {
    // NON-VACUITY. If this filter ever matched nothing, every test after it
    // would pass on an empty set and report a fully-wired privacy system.
    expect(dataProviders.length, "no data-rendering providers discovered").toBe(7);
  });

  it("DoxyPEP, the widget that was lying, is wired", SCAN_TIMEOUT_MS, () => {
    expect(WIRED).toContain("DoxyPEPWidgetProvider.java");
  });

  it("DoxyPEP hides the views it already names, rather than enumerating a tree", SCAN_TIMEOUT_MS, () => {
    // RemoteViews is an IPC serialization stub, not a live view tree - it cannot
    // iterate children. Gemini made this point and it corrected my design. The
    // saving grace is that each provider already hardcodes the 2-3 ids it sets
    // text on, so hiding them needs no new machinery at all.
    const src = read(path.join(WIDGET_DIR, "DoxyPEPWidgetProvider.java"));
    expect(src).toMatch(/redactedText/);
    expect(src).toMatch(/setViewVisibility\(R\.id\.widget_doxy_status,\s*View\.GONE\)/);
    expect(src).toMatch(/setViewVisibility\(R\.id\.widget_doxy_countdown,\s*View\.GONE\)/);
  });

  it("every id it hides actually exists in its layout", SCAN_TIMEOUT_MS, () => {
    // setViewVisibility on an id absent from the inflated layout is a runtime
    // failure on a home screen, and it is exactly the kind of thing CI's
    // compiler cannot see because RemoteViews ids are resolved reflectively.
    const src = read(path.join(WIDGET_DIR, "DoxyPEPWidgetProvider.java"));
    // Exclude the static fallback: it renders no data views by design, so the
    // ids this provider hides are resolved against the layout it actually renders
    // data into. Same narrowing as the provider filter above - the assertions
    // themselves are unchanged.
    const layoutName = [...src.matchAll(/R\.layout\.(\w+)/g)]
      .map((m) => m[1])
      .find((l) => l !== "widget_unavailable");
    const layout = read(path.join(LAYOUT_DIR, `${layoutName}.xml`));
    for (const id of src.matchAll(/setViewVisibility\(R\.id\.(\w+)/g)) {
      expect(layout, `${id[1]} is hidden but does not exist in ${layoutName}.xml`).toContain(
        `@+id/${id[1]}`,
      );
    }
  });

  it("the bridge forwards ClinicCard's line, defaulting to empty rather than null", SCAN_TIMEOUT_MS, () => {
    const bridge = read(path.join(ROOT, "android/app/src/main/java/com/shos/app/WidgetBridgePlugin.java"));
    // Every WIRED provider, not just DoxyPEP. The bug this file exists for was
    // precisely that a provider was wired on the JS side and the bridge never
    // handed it the value - so asserting DoxyPEP's forwarding said nothing about
    // the other six. A new provider that stores and reads its key but is never fed
    // one would render nothing, and would pass every test above.
    for (const f of WIRED) {
      const cls = f.replace(".java", "");
      const method = (read(path.join(WIDGET_DIR, f)).match(/public static void (update\w+)\(/) || [])[1];
      expect(method, `${f} exposes no static update method`).toBeTruthy();

      // START at the plugin's OWN method for this provider and END at the matching
      // close paren of that call. Every earlier version of this assertion looked
      // for the argument over a fixed window or from the first mention of the name
      // in the file, and both stayed green against mutations that deleted it -
      // because a shorter call, or the *next* provider's method above it, still
      // satisfied "clinicNum, ... opt(call, "redactedText")". Only the real call
      // spans are honest.
      const anchor = bridge.indexOf(`public void ${method}(PluginCall`);
      expect(
        anchor,
        `the bridge exposes no ${method} method, so ${f} can never be updated at all`,
      ).toBeGreaterThan(-1);
      const callAt = bridge.indexOf(`${cls}.${method}(`, anchor);
      expect(
        callAt,
        `${method} never calls ${cls}.${method}, so the provider is never written to`,
      ).toBeGreaterThan(-1);

      let depth = 0, close = -1;
      for (let i = callAt + `${cls}.${method}`.length; i < bridge.length; i++) {
        const ch = bridge[i];
        if (ch === "(") depth++;
        else if (ch === ")") { depth--; if (depth === 0) { close = i; break; } }
      }
      expect(close, `${cls}.${method}'s call has no closing paren`).toBeGreaterThan(-1);

      const inner = bridge.slice(callAt + `${cls}.${method}`.length + 1, close);
      // Every argument must come from the PluginCall, and the LAST one must be the
      // redacted line. Asserting it is last is what makes "the bridge reads
      // redactedText but hands the provider something else" fail.
      // CRLF-safe: `$` in JS does not match before a trailing \r, so the shipped
      // CRLF sources failed this while a normalised copy would have passed. The
      // final argument is found by delimiter balance instead, for the same reason
      // - `$`-anchored matching is fragile on sources this repo does not reformat.
      // Over STRIPPED source. Comments here are load-bearing prose and contain both
      // commas and balanced parentheses ("(t059)", "(4 = no redacted line)"), so
      // balancing raw Java found the last comma inside the comment and reported
      // the sentence after it as the final argument.
      const innerCode = stripComments(inner);
      let bd = 0, lastComma = -1;
      for (let i = innerCode.length - 1; i >= 0; i--) {
        const ch = innerCode[i];
        if ("([{".includes(ch)) bd++;
        else if (")]}".includes(ch)) bd--;
        else if (ch === "," && bd === 0) { lastComma = i; break; }
      }
      expect(
        lastComma,
        `${cls}.${method}'s call has no top-level argument separator`,
      ).toBeGreaterThan(-1);
      // Sliced from innerCode, not from inner - the offsets above are stripped-source
      // offsets, and slicing the original by them lands inside the comment.
      const lastArg = innerCode.slice(lastComma + 1).trim();
      // `toBe` with a RegExp is Object.is, not a pattern match - it only compares
      // against the literal regex object, so it can never pass. Worth naming
      // because a guard written that way looks like a real assertion and is
      // simply always red (or, once someone "fixes" it to a plain string, always
      // red for a different reason).
      expect(
        lastArg,
        `${cls}.${method} is not given a redacted line as its final argument`,
      ).toMatch(/^opt\(call,\s*"redactedText"\)$/);
    }
  });

  it("JS passes a line for every wired widget, and it discloses nothing identifying", SCAN_TIMEOUT_MS, () => {
    // The other half of the same fix, and the half that is cheap to test. At
    // full the real fields are used; at off nothing at all is sent.
    const helper = read(path.join(ROOT, "src/calculations/widgetBridgeUpdate.js"));
    expect(helper).toMatch(/tier === "redacted" && redactedText/);
    const test = read(path.join(ROOT, "src/calculations/widgetBridgeUpdate.test.js"));
    expect(test).toMatch(/redactedText\)\.toBeUndefined\(\)/);
    expect(test).toMatch(/toEqual\(\{ tier: "off" \}\)/);

    // EVERY wired widget's pusher must pass a fifth argument. Asserting this for
    // DoxyPEP alone proved nothing about the other six - which is exactly how a
    // provider could be wired natively, never fed a line, and render nothing at a
    // Redacted tier while every assertion in this file passed.
    //
    // The method name comes from the provider's own bridge method rather than a
    // table here, so this cannot drift from the code it is protecting: a widget
    // renamed on the native side fails here instead of silently going unchecked.
    // Every pusher under src/calculations, DISCOVERED - so a pusher added later is
    // covered rather than needing this file edited, and so a file removed or
    // renamed cannot make the check vacuously pass on an empty set. The discovery
    // itself is at module scope, above - a per-test copy here left callSites()
    // reading nothing, which is exactly the kind of failure a guard must not have.
    expect(sources.length, "no pusher sources discovered").toBeGreaterThan(5);

    for (const f of WIRED) {
      const method = (read(path.join(WIDGET_DIR, f)).match(/public static void (update\w+)\(/) || [])[1];
      expect(method, `${f} exposes no static update method`).toBeTruthy();

      // `lastIndexOf` of the whole stripped file is deliberately NOT used, and the
      // reason is the specific shape of these pushers: the method name appears
      // INSIDE the explanatory comment above the call as well ("bridge forwards
      // ... to updateClinicCard"). Matching either occurrence finds prose. The
      // only unambiguous anchor is the string literal inside a call, so every
      // index below is taken from a version with comments blanked AND is then
      // verified to actually sit inside `sendWidgetUpdate(`.
      const codeCallers = sources.filter((s) => {
        const code = stripComments(s.src);
        return code.includes(`sendWidgetUpdate(`) && code.includes(`"${method}"`);
      });
      expect(
        codeCallers.length,
        `${f} is wired natively but no pusher under src/calculations passes ${method} to sendWidgetUpdate`,
      ).toBeGreaterThan(0);

      // The call must carry a FIFTH argument, found by BALANCING BRACES from the
      // opening paren rather than by any fixed window.
      //
      // Three narrower attempts all passed against a mutation that deleted the
      // fifth argument, and the reason is worth keeping: the payload is an object
      // literal ~1,600 characters long, so every "the text after the closing brace"
      // or "{0,900}" window ends up sampling only the payload and concluding
      // nothing follows. The distance from the method name to the fifth argument is
      // 1,566-1,581 characters today; any constant near that is wrong the moment
      // one field is added. Parsing the actual call is the only version that
      // cannot be fooled by how long the payload happens to be.
      // Comments are stripped BEFORE any offset is computed, and that is load-bearing
      // rather than hygiene. These pushers carry long explanatory comments, and
      // updateClinicCardWidget's own cites its two root causes by number in
      // parentheses - so balancing delimiters over raw source counted three
      // phantom arguments from prose and reported 7 for a call that passes 5.
      // Stripping afterwards is impossible once the offsets are wrong, so it has
      // to happen first. It is also what stops a commented-out invocation from
      // satisfying the whole check.
      for (const c of codeCallers) {
        const code = stripComments(c.src);
        const at = code.indexOf(`"${method}"`);
        expect(at, `${c.name}: ${method} is not in code, only in a comment`).toBeGreaterThan(-1);

        // The nearest preceding sendWidgetUpdate( - backwards, because taking the
        // first in the file measured ClinicCard's call against a different
        // pusher's two arguments.
        const open = code.lastIndexOf("sendWidgetUpdate(", at);
        expect(open, `${c.name} mentions ${method} but never in sendWidgetUpdate`).toBeGreaterThan(-1);

        // ...and the END must come after the method name, or the two halves of the
        // call belong to different calls.
        let depth = 0, end = -1;
        for (let i = open + "sendWidgetUpdate(".length - 1; i < code.length; i++) {
          const ch = code[i];
          if ("([{".includes(ch)) depth++;
          else if (")]}".includes(ch)) { depth--; if (depth === 0) { end = i; break; } }
        }
        expect(end, `${c.name}: could not find the end of the ${method} call`).toBeGreaterThan(-1);
        expect(
          end,
          `${c.name}: the sendWidgetUpdate call found before ${method} closes before ` +
            `${method} appears, so these are two different calls`,
        ).toBeGreaterThan(at);

        const args = code.slice(open + "sendWidgetUpdate(".length, end);
        let argDepth = 0, commas = 0;
        for (const ch of args) {
          if ("([{".includes(ch)) argDepth++;
          else if (")]}".includes(ch)) argDepth--;
          else if (ch === "," && argDepth === 0) commas++;
        }
        expect(
          commas,
          `${c.name}: ${method}'s sendWidgetUpdate call passes ${commas} top-level arguments ` +
            `(4 = no redacted line), so ${f} can never render one`,
        ).toBe(4);

        // The method string must be one of THAT call's arguments, not merely
        // somewhere after its opening paren. Without this, deleting the call - or
        // leaving only a commented-out copy above it - satisfied every other
        // assertion, because the scanner found a sendWidgetUpdate( earlier in the
        // file and balanced from there.
        expect(
          args.indexOf(`"${method}"`),
          `${c.name}: ${method} is not an argument of the call that was measured`,
        ).toBeGreaterThan(-1);

// The last TOP-LEVEL argument. `lastIndexOf(",")` is wrong for this - it
        // finds the comma inside the fifth argument's own call, and returns a
        // fragment rather than the argument. Which is worth stating because it is
        // the same mistake as the fixed-window version: a plausible-looking string
        // instead of an honest failure.
        //
        // Declared here, before the assertions that use it.
        let d = 0, lastComma = -1;
        for (let i = args.length - 1; i >= 0; i--) {
          const ch = args[i];
          if (")]}".includes(ch)) d++;
          else if ("([{".includes(ch)) d--;
          else if (ch === "," && d === 0) { lastComma = i; break; }
        }
        expect(
          lastComma,
          `${c.name}: ${method}'s call has no top-level argument separator, so it passes ` +
            `at most one argument and no redacted line`,
        ).toBeGreaterThan(-1);
        const fifth = args.slice(lastComma + 1).trim();

        // Non-vacuity: the extraction must have isolated ONE argument. A balanced
        // call legitimately contains parentheses, so the proof is that the whole
        // argument is consumed - an unclosed delimiter means the slice ran past the
        // argument boundary and into the rest of the file.
        let fd = 0;
        for (const ch of fifth) {
          if ("([{".includes(ch)) fd++;
          else if (")]}".includes(ch)) fd--;
          expect(fd, `${c.name}: ${method}'s final argument is unbalanced`).toBeGreaterThanOrEqual(0);
        }
        expect(fd, `${c.name}: ${method}'s final argument has unclosed brackets`).toBe(0);

        expect(
          !/^(undefined|null|""|''|``)$/.test(fifth),
          `${c.name}: ${method} passes ${fifth || "(nothing)"} as its redacted line, which can ` +
            `only ever read as "no line present"`,
        ).toBe(true);
        expect(fifth, `${c.name}: ${method}'s redacted line is not a call`).toMatch(
          /^[A-Za-z_$][\w$.]*\([^()]*\)$/,
        );
      }
    }

    // And the LINES themselves, not merely that one exists. A redacted line that
    // happened to interpolate a medication name, a clinic or an appointment title
    // would satisfy every assertion above and disclose on the home screen - which
    // is the whole thing the tier exists to prevent.
    //
    // EVERY builder, not just the Clinic Card's. Four of the five lines I added
    // were unguarded: mutations that made the Cycle line leak the day number, the
    // Refills line leak a medication name, and the Next Dose line leak the drug
    // itself all stayed green.
    //
    // The forbidden list is derived from what each widget's payload actually
    // carries, per provider, rather than one global list - a global list would
    // either miss a field or forbid the count that is deliberately allowed.
    const SENSITIVE = {
      clinicCard: ["title", "location", "clinicNumber", "date", "docType", "visitType", "nhs"],
      nextDose: ["medName", "med.name", "nextDoseTime", "name"],
      refillDue: ["nextRefill", "medName", "name"],
      lastTest: ["lastTest", "retestDue", "testName", "organism"],
      nextAppointment: ["nextAppt", "title", "clinic"],
      cycle: ["day", "nextPeriod", "cycleLength", "startDate"],
    };
    // The builder is found THROUGH ITS CALL SITE, not by matching the first
    // function in the file. The earlier version took the first `*RedactedLine`
    // in the concatenated source, so four of six widgets were checked against
    // whichever function happened to be first - and a mutation to the Cycle or
    // Next Dose line stayed green while the Clinic Card's was tested six times.
    for (const [widget, fields] of Object.entries(SENSITIVE)) {
      // EVERY CALL SITE, not the first. refillDue is pushed from two files -
      // medicationReminderSync.js and refillReminderSync.js - each with its own copy
      // of the line builder. Checking only the first left the second unchecked,
      // and a mutation that hardcoded "PrEP due" into that second copy stayed
      // green: the guard read the alphabetically-earlier file, mutated the other.
      //
      // Duplication between the two is deliberate and recorded in both files; what
      // is not acceptable is a privacy guard that silently covers one of them.
      for (const callAt of callSites(widget)) {
      // The SAME concatenation callSites() searched, so every offset below is in
      // this string's coordinates. Building it per iteration from the raw sources
      // instead made the offsets point into different text.
      const src = sources.map((s) => s.src).join("\n");
      expect(callAt, `no sendWidgetUpdate call found for ${widget}`).toBeGreaterThan(-1);
      // Balanced to the call's own closing paren, so the window cannot run into a
      // later call - refillDue is pushed from two files, and a fixed window would
      // read whichever came second.
      const open = src.indexOf("(", src.indexOf("sendWidgetUpdate", callAt));
      let callDepth = 0, close = -1;
      for (let i = open; i < src.length; i++) {
        if ("([{".includes(src[i])) callDepth++;
        else if (")]}".includes(src[i])) { callDepth--; if (callDepth === 0) { close = i; break; } }
      }
      expect(close, `${widget}'s call could not be balanced`).toBeGreaterThan(-1);
      const tail = src.slice(callAt, close);
      const used = tail.match(/(\w+RedactedLine)\(/);
      expect(
        used,
        `${widget}'s call site never passes a Redacted line builder, so it can only fall ` +
          `back to its own placeholder`,
      ).toBeTruthy();
      
      // To the end of the function: the first `}` at brace depth 0 after the
      // opening one, so a nested block cannot truncate the slice.
      // Braces are counted on a SKELETON built from the WHOLE source with literals and
      // comments blanked, never on a slice of the raw text.
      //
      // Both earlier attempts got this wrong in the same way, and the second was
      // worse: `body` extended to the end of the concatenated file, so a single
      // unpaired quote in any LATER file made the blanking regex match across
      // thousands of characters and delete braces that were never there. The
      // function then appeared to close mid-identifier, which is why four of six
      // builders reported no literals at all and every leak mutation stayed green.
      //
      // Order matters: blank once, globally, then count, then slice. Blanking
      // after slicing cannot work, because the slice boundaries depend on the
      // blanking.
// EVERY DECLARATION of this builder, not the first.
        //
        // refillDue is pushed from two files, each carrying its own copy of
        // refillRedactedLine, so "the first declaration" is whichever file sorts
        // first - and the other copy is then never examined. A mutation that
        // hardcoded "PrEP due" into that second copy left the suite green.
        //
        // The skeleton is built once for the whole source and the declarations
        // found in it, so the offsets are consistent with the slices below.
        const skeleton = blankNonCode(src);
        const decls = [...skeleton.matchAll(new RegExp(`function ${used[1]}\\(`, "g"))].map((m) => m.index);
        expect(decls.length, `${used[1]} is called but never declared`).toBeGreaterThan(0);
        for (const defAt of decls) {
        let braceDepth = 0, end = -1;
        for (let i = skeleton.indexOf("{", defAt); i < skeleton.length; i++) {
          if (skeleton[i] === "{") braceDepth++;
          else if (skeleton[i] === "}") { braceDepth--; if (braceDepth === 0) { end = i + 1; break; } }
        }
        expect(end, `${used[1]}() has no closing brace`).toBeGreaterThan(defAt);
        const body = src.slice(defAt, end);
      const ret = body.slice(0, end);
      // Every string LITERAL in the line must come from a closed vocabulary.
      //
      // The interpolation check below catches a field reaching the line; this
      // catches the other half, which is a hardcoded value. Four mutations
      // slipped through it - a line hardcoded to say "PrEP due", one saying
      // "at Dean Street", and two naming a drug - because none of them
      // interpolates anything at all. There is no field to catch, so the check has
      // to be about the words themselves.
      //
      // Deliberately a closed list rather than a denylist of identifying words: a
      // denylist has to anticipate every name, drug and street a developer might
      // type, and fails quietly on the one they did not think of. A vocabulary of
      // what a Redacted line is ALLOWED to say cannot be evaded that way, and a
      // new safe phrase is a one-line change in a visible place.
      // Every word in the line must come from a closed vocabulary. Word-by-word
      // rather than whole-literal, because the shipped lines are assembled from
      // fragments - "Clinic card - nothing due" is three safe words joined, and
      // a whole-literal allowlist would have to enumerate every combination each
      // builder happens to produce.
      //
      // Deliberately a closed list rather than a denylist of identifying words: a
      // denylist has to anticipate every name, drug and street a developer might
      // type, and fails quietly on the one they did not think of. What a Redacted
      // line is ALLOWED to say cannot be evaded that way, and adding a safe word
      // is a one-line change in a visible place.
      //
      // Prose inside the function is ignored - the explanation above it is where
      // this list earns its keep, and it names things the line must never contain.
      const code = ret.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
      const ALLOWED_WORDS = new Set([
        // Categories.
        "testing", "medication", "refills", "appointments", "tracking",
        "clinic", "card", "doxypep",
        // Coarse states.
        "logged", "none", "due", "all", "stocked", "booked", "nothing",
        "upcoming", "active", "overdue", "no", "data",
        // Used only as a unit noun in "N tests booked".
        "test", "tests",
      ]);
      const COUNTDOWN = /^in \d+[hdm]( \d+[hm])?$/;
      // TEMPLATE literals are scanned too, not only double-quoted ones. Almost every
      // line is built with a template, so scanning only "..." checked nothing
      // that ships - and six mutations that rewrote a template to leak a drug, a
      // street or a date all passed.
      const literals = [
        ...[...code.matchAll(/"([^"\\]*)"/g)].map((m) => m[1]),
        ...[...code.matchAll(/`([^`]*)`/g)].map((m) => m[1]),
      ].filter((s) => s.trim().length >= 2);
      for (const lit of literals) {
        // Interpolations are removed first: the check is about the FIXED words,
        // and `${...}` is covered by the field check below.
        const fixed = lit.replace(/\$\{[^}]*\}/g, " ").trim();
        // Interpolation bodies are replaced by a DIGIT, not by nothing. That matters:
        // stripping them entirely turned "in ${hours}h ${mins % 60}m" into
        // "in  h  m", which matches neither the countdown pattern nor the word
        // list - so the one shipped countdown line failed its own guard.
        const numeric = lit.replace(/\$\{[^}]*\}/g, "0");
        const isCount = /^\d+$/.test(fixed);
        const ok = !fixed || isCount || COUNTDOWN.test(numeric) ||
          fixed.toLowerCase().split(/[\s-]+/).every((w) => ALLOWED_WORDS.has(w));
        expect(
          ok,
          `${used[1]}() contains the literal "${lit}", whose words are not all on the ` +
            `allowed list for a Redacted line. A hardcoded name, drug or address ` +
            `discloses exactly as much as an interpolated one - a mutation that ` +
            `hardcoded "PrEP due" or "at Dean Street" passed every other assertion here.`,
        ).toBe(true);
      }

      // The field must not be INTERPOLATED into the line, not merely mentioned.
      // Reading lastTest as a boolean - "test logged" or "none logged" - discloses
      // nothing, and forbidding the bare name made the shipped code fail, which is
      // the same class of error as flagging a provider's own masked "tap to
      // reveal" branch as a disclosure. What must never happen is the VALUE
      // reaching the home screen.
      for (const field of fields) {
        const f = field.replace(/\./g, "\\.");
        expect(
          ret,
          `${used[1]}() interpolates "${field}" into the Redacted line, which is ` +
            `health-identifying for ${widget}. A Redacted line may carry a category ` +
            `and a coarse count only.`,
        ).not.toMatch(new RegExp(`\\$\\{\\s*[^}]*\\b${f}\\b`));
        // ...and not concatenated into a string either, which is the same
        // disclosure written differently.
        expect(
          ret,
          `${used[1]}() concatenates "${field}" into the Redacted line.`,
        ).not.toMatch(new RegExp(`["'\`][^"'\`]*\\+\\s*\\b${f}\\b`));
      }
        }
      }
    }

    // And the keys must be DISTINCT, because all seven providers share ONE
    // SharedPreferences file: a shared key name means each provider silently
    // overwrites the previous one's line. Asserting the key exists - which the
    // tests above do - says nothing about whether two providers collided.
    const keys = WIRED.map((f) =>
      (read(path.join(WIDGET_DIR, f)).match(/KEY_REDACTED_TEXT\s*=\s*"([^"]+)"/) || [])[1],
    );
    expect(new Set(keys).size, `redacted-text keys collide: ${keys.join(", ")}`).toBe(keys.length);
  });
});

describe("inventory of what is not wired yet", () => {
  it("reports the remaining five, and reports none once they are done", SCAN_TIMEOUT_MS, () => {
    // Deliberately a description rather than a failure. Making it a hard failure
    // would mean either shipping six half-wired widgets or writing a test that
    // breaks every time one is finished - and this repo's rule is that a guard
    // should describe a property, not track a work list. The list is printed so
    // the next session sees it without reading seven providers.
    //
    // CHANGED 5 Oct 2026 - the accepted count was hardcoded to exactly 6, which
    // made the assertion satisfied by a coincidence rather than by the thing it
    // describes: it passed on any unwired total of 6, and failed on 5 when
    // ClinicCard was correctly wired. A guard that demands a stale number is a
    // guard that reads like coverage while measuring nothing. The invariant that
    // is actually worth keeping is "the set only ever SHRINKS" - wired providers
    // are never un-wired - so that is asserted directly instead, by naming the
    // providers already done.
    // All seven are wired as of 5 Oct 2026, so this is now an assertion rather
    // than a description - which is the only state worth asserting. The "either 0
    // or N" form it replaces was satisfied by a coincidence: it passed on any
    // unwired count of 6, and would have failed on 5 the moment Clinic Card was
    // correctly wired. A guard that demands a stale number reads like coverage
    // while measuring nothing.
    expect(
      NOT_WIRED,
      `every data widget must honour its Redacted tier. Still unwired: ${NOT_WIRED.join(", ")}`,
    ).toEqual([]);
  });

  it("a provider already wired is never silently unwired", SCAN_TIMEOUT_MS, () => {
    // The real invariant, replacing the count. Wiring a provider is a one-way
    // door: dropping its KEY_REDACTED_TEXT would silently put health-identifying
    // text back on a home screen, and nothing else in this file would notice -
    // the tests below only check providers that ARE wired, so they would simply
    // stop being checked. Named rather than discovered, so the removal of a name
    // from this list is itself the reviewable change.
    for (const f of [
      "DoxyPEPWidgetProvider.java", "ClinicCardWidgetProvider.java",
      "TestWidgetProvider.java", "RefillWidgetProvider.java",
      "AppointmentWidgetProvider.java", "NextDoseWidgetProvider.java",
      "CycleWidgetProvider.java",
    ]) {
      expect(WIRED, `${f} was wired and is no longer - that is a privacy regression`).toContain(f);
    }
  });

  it("every WIRED provider both READS, STORES, and RENDERS its line", SCAN_TIMEOUT_MS, () => {
    // REPLACED a test I wrote wrongly. It asserted the bridge and the provider
    // agree on the storage key string, and both failures were the guard being
    // right: the bridge never touches that key at all. It passes a value to the
    // provider's update method and the provider owns the key. Demanding the two
    // agree on a string would have been inventing an invariant out of nothing.
    //
    // The real invariant, and the one that actually breaks things, is that a
    // wired provider both stores and reads its key. A provider that writes the
    // line without reading it would pass every other test here and render
    // nothing - the payload is in storage and never displayed.
    //
    // CHANGED 5 Oct 2026 - and this now covers RENDERING too, because three
    // mutations of the Clinic Card change left the suite green: reading the line
    // and then not using it, using it but leaving the location visible, and using
    // it but leaving the clinic-number row visible. Each is a real disclosure on
    // the home screen, and each satisfied every assertion above. A provider can
    // store and read a redaction and still leak; only the ids it hides decide.
    const bridge = read(path.join(ROOT, "android/app/src/main/java/com/shos/app/WidgetBridgePlugin.java"));
    for (const f of WIRED) {
      const src = read(path.join(WIDGET_DIR, f));
      const key = (src.match(/KEY_REDACTED_TEXT\s*=\s*"(\w+)"/) || [])[1];
      expect(key, `${f} has no redacted-text key`).toBeTruthy();
      expect(src, `${f} never stores its redacted line - writes ${key}`).toMatch(
        new RegExp(`putString\\(KEY_REDACTED_TEXT`),
      );
      expect(src, `${f} never reads its redacted line - reads ${key}`).toMatch(
        new RegExp(`getString\\(KEY_REDACTED_TEXT`),
      );
      // And the bridge must hand it a value for the write to have anything to
      // store.
      expect(bridge, `${f}'s line is never forwarded by the bridge`).toMatch(/opt\(call, "redactedText"\)/);

      // RENDERING. The line must reach a view, and every OTHER view this provider
      // would otherwise fill with real text must be hidden in the same block. The
      // window is anchored on the provider's own KEY_REDACTED_TEXT read so it
      // cannot drift onto an unrelated part of the file.
      const at = src.indexOf(`getString(KEY_REDACTED_TEXT`);
      expect(at, `${f} has no read to anchor rendering on`).toBeGreaterThan(-1);
      // The redacted branch and everything up to its early return - that is the
      // whole of the code that can execute at a Redacted tier.
      const dataBranch = src.slice(at);
      const target = (dataBranch.match(/setTextViewText\(R\.id\.(\w+),\s*redactedText\)/) || [])[1];
      expect(
        target,
        `${f} reads its redacted line but never renders it - it would show nothing`,
      ).toBeTruthy();

      // The redacted branch must be TERMINATED, not merely started. Without an
      // early return the code below it still runs and overwrites the redaction -
      // a widget that hides nothing while appearing to. Located by its own
      // `updateAppWidget` call rather than by indentation, so reformatting the
      // provider cannot silently turn this into a vacuous slice.
      const pushAt = dataBranch.indexOf("appWidgetManager.updateAppWidget(appWidgetId, views)");
      expect(pushAt, `${f} redacted branch never pushes`).toBeGreaterThan(-1);
      // The return must be the FIRST one after the push, not merely somewhere
      // later in the method. Searching the whole remainder passed against a
      // mutation that deleted this very return, because the enclosing method ends
      // with one - so the guard was satisfied by an exit that happens long after
      // the data branch has already overwritten the redaction.
      // Bounded by the closing brace of the redacted `if` block, which is the thing
      // whose body it must be. Anchoring on "the next push" instead failed against
      // the shipped code because the branch pushes and returns immediately - there
      // is no intervening push to bound by - so the window ran to the end of the
      // method and found a later return.
      // By brace depth, not by indentation. The shipped code is mixed-line-ending and
      // its five providers nest at different depths, so a literal "\n        }"
      // anchor matched nothing in four of them and the assertion silently became
      // "is there a return somewhere later in the method" - which a mutation that
      // DELETED this very return passed, since the method still ends with one.
      const branchOpen = dataBranch.lastIndexOf("{", pushAt);
      expect(branchOpen, `${f} redacted branch's opening brace was not found`).toBeGreaterThan(-1);
      let bd2 = 0, closeAt = -1;
      for (let i = branchOpen; i < dataBranch.length; i++) {
        if (dataBranch[i] === "{") bd2++;
        else if (dataBranch[i] === "}") { bd2--; if (bd2 === 0) { closeAt = i; break; } }
      }
      expect(closeAt, `${f} redacted branch has no closing brace`).toBeGreaterThan(branchOpen);
      const body = dataBranch.slice(pushAt, closeAt);
      expect(
        /\breturn\b/.test(body),
        `${f} redacted branch pushes but does not return inside its own block, so the data ` +
          `branch below still runs and overwrites the redaction`,
      ).toBe(true);

      // WHICH VIEWS CAN DISCLOSE, taken from the LAYOUT rather than from the
      // provider's own code.
      //
      // My first two attempts derived this from the source and both were wrong in
      // a way that made the guard vacuous: slicing from the redacted branch to its
      // push covers only the redacted branch, so a provider could delete any hide
      // and stay green; widening it to the whole file then flagged the MASKED
      // branch's "••••• tap to reveal" as a disclosure, which is the opposite
      // error - it would demand a widget stop rendering its own redaction.
      //
      // The layout is the honest source: a view is disclosed unless it is itself
      // hidden, or it sits INSIDE a container that is hidden. Hiding a container
      // hides its children, which is how the sensitive row already works - and
      // that fact is not visible from the provider's code at all.
      const layoutName = [...src.matchAll(/R\.layout\.(\w+)/g)]
        .map((m) => m[1])
        .find((l) => l !== "widget_unavailable");
      const layout = read(path.join(LAYOUT_DIR, `${layoutName}.xml`));
      // The ARGUMENT matters, not just that setViewVisibility was called. Collecting
      // ids alone counted `setViewVisibility(id, View.VISIBLE)` as hiding the view
      // - so a mutation that un-hid the sensitive row stayed green, which is
      // precisely the disclosure this tier exists to prevent. Only a GONE (or
      // INVISIBLE) argument hides anything.
      const branchText = dataBranch.slice(0, pushAt);
      const hiddenInBranch = new Set(
        [...branchText.matchAll(/setViewVisibility\(R\.id\.(\w+),\s*(?:android\.view\.)?View\.(GONE|INVISIBLE)\s*\)/g)]
          .map((m) => m[1]),
      );
      expect(hiddenInBranch.size, `${f} hides no views at a Redacted tier`).toBeGreaterThan(0);

      // Every id the provider fills with text must be neutralised by one of those
      // hides. Every id it touches anywhere, because the masked branch and the
      // revealed branch are all reachable at Full and must all be covered.
      for (const id of new Set([...src.matchAll(/setTextViewText\(R\.id\.(\w+)/g)].map((m) => m[1]))) {
        if (id === target) continue;
        expect(
          hiddenInBranch.has(id) || insideHidden(layout, id, hiddenInBranch),
          `${f} reveals ${id} at a Redacted tier - it is filled with text and neither ` +
            `it nor any container holding it is hidden`,
        ).toBe(true);
      }
      expect(
        target,
        `${f} reads its redacted line but never renders it - it would show nothing`,
      ).toBeTruthy();

      // Every id the DATA branch fills must be hidden. Discovered from the source
      // rather than listed, so a new disclosing view added to the data branch is
      // caught here rather than quietly left visible.
      //
      // A SUBTLETY worth stating, because getting it wrong either way is bad. The
      // masked branch also calls setTextViewText on the same ids - with "••••• tap
      // to reveal" - and those must NOT count as disclosures, or a provider that
      // masks perfectly would be reported as leaking. The two are told apart by
      // WHERE they are: everything from the line's own `return` onward is
      // unreachable once a redacted line exists, so only the code BEFORE that
      // return can render at a Redacted tier. That is also why the exemption is
      // structural rather than a list of names.
      //
      // The one carrying the line is additionally exempt, and it is exempt by
      // BEING the target rather than by a name in this file: a provider is free to
      // choose which view holds the line, and hardcoding "the title" would have
      // been a second source of truth about each provider's layout.
      const rest = src.slice(at);
    }
  });
});
