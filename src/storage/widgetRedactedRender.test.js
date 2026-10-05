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

/**
 * Replace comment contents with spaces, preserving every offset.
 *
 * Not a nicety here: a delimiter inside a comment must not be counted as code,
 * and the non-vacuity case below is what proves this stripper is not simply
 * deleting the very text it is asked to find.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  // String literals are preserved - a "//" inside one is not a comment - which
  // also means quotes must be tracked or this strips half a Java call's
  // arguments.
  let inStr = false;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (inStr) {
      out += src[i];
      if (src[i] === "\\") { out += src[i + 1] ?? ""; i += 2; continue; }
      if (src[i] === '"') inStr = false;
      i++;
      continue;
    }
    if (src[i] === '"') { inStr = true; out += src[i]; i++; continue; }
    if (two === "//") {
      while (i < src.length && src[i] !== "\n") { out += " "; i++; }
    } else if (two === "/*") {
      while (i < src.length && src.slice(i, i + 2) !== "*/") {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  "; i += 2;
    } else {
      out += src[i]; i++;
    }
  }
  return out;
}

/**
 * Does `id` sit inside one of `hiddenIds` in this layout?
 *
 * Parsed with a real tag scanner rather than a regex, because the property is
 * STRUCTURAL: hiding a container hides everything under it, and that is precisely
 * how the Clinic Card's sensitive row already works. A regex cannot express
 * "descendant of", and this repo has four audits that failed on exactly that.
 */
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

describe("redacting the payload is not the same as redacting the screen", () => {
  it("discovered the seven data widgets, or the inventory below is meaningless", () => {
    // NON-VACUITY. If this filter ever matched nothing, every test after it
    // would pass on an empty set and report a fully-wired privacy system.
    expect(dataProviders.length, "no data-rendering providers discovered").toBe(7);
  });

  it("DoxyPEP, the widget that was lying, is wired", () => {
    expect(WIRED).toContain("DoxyPEPWidgetProvider.java");
  });

  it("DoxyPEP hides the views it already names, rather than enumerating a tree", () => {
    // RemoteViews is an IPC serialization stub, not a live view tree - it cannot
    // iterate children. Gemini made this point and it corrected my design. The
    // saving grace is that each provider already hardcodes the 2-3 ids it sets
    // text on, so hiding them needs no new machinery at all.
    const src = read(path.join(WIDGET_DIR, "DoxyPEPWidgetProvider.java"));
    expect(src).toMatch(/redactedText/);
    expect(src).toMatch(/setViewVisibility\(R\.id\.widget_doxy_status,\s*View\.GONE\)/);
    expect(src).toMatch(/setViewVisibility\(R\.id\.widget_doxy_countdown,\s*View\.GONE\)/);
  });

  it("every id it hides actually exists in its layout", () => {
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

  it("the bridge forwards ClinicCard's line, defaulting to empty rather than null", () => {
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

  it("JS passes a line for every wired widget, and it discloses nothing identifying", () => {
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
    // renamed cannot make the check vacuously pass on an empty set.
    const CALC = path.join(ROOT, "src/calculations");
    const sources = readdirSync(CALC)
      .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"))
      .map((f) => ({ name: f, src: read(path.join(CALC, f)) }));
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

    // And the LINE itself, not merely that one exists. A redacted line that
    // happened to interpolate a clinic name or an appointment title would satisfy
    // every assertion above and disclose on the home screen - which is the whole
    // thing the tier exists to prevent.
    const clinic = read(path.join(ROOT, "src/calculations/clinicVisitReminderSync.js"));
    const body = clinic.slice(clinic.indexOf("function clinicCardRedactedLine"));
    const ret = body.slice(0, body.indexOf("}"));
    for (const forbidden of ["title", "location", "clinicNumber", "date", "docType", "visitType"]) {
      expect(ret, `clinicCardRedactedLine mentions "${forbidden}", which is identifying`).not.toMatch(
        new RegExp(forbidden),
      );
    }
  });
});

describe("inventory of what is not wired yet", () => {
  it("reports the remaining five, and reports none once they are done", () => {
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
    expect(
      NOT_WIRED.length === 0 || NOT_WIRED.length === 5,
      `expected either 0 or 5 unwired providers, found ${NOT_WIRED.length}: ${NOT_WIRED.join(", ")}`,
    ).toBe(true);
    if (NOT_WIRED.length) {
      console.log(`  [widget-redacted] not yet wired: ${NOT_WIRED.join(", ").replace(/\.java/g, "")}`);
    }
  });

  it("a provider already wired is never silently unwired", () => {
    // The real invariant, replacing the count. Wiring a provider is a one-way
    // door: dropping its KEY_REDACTED_TEXT would silently put health-identifying
    // text back on a home screen, and nothing else in this file would notice -
    // the tests below only check providers that ARE wired, so they would simply
    // stop being checked. Named rather than discovered, so the removal of a name
    // from this list is itself the reviewable change.
    for (const f of ["DoxyPEPWidgetProvider.java", "ClinicCardWidgetProvider.java"]) {
      expect(WIRED, `${f} was wired and is no longer - that is a privacy regression`).toContain(f);
    }
  });

  it("every WIRED provider both READS, STORES, and RENDERS its line", () => {
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
      const closeAt = dataBranch.indexOf("\n        }", pushAt);
      expect(closeAt, `${f} redacted branch's closing brace was not found`).toBeGreaterThan(-1);
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
