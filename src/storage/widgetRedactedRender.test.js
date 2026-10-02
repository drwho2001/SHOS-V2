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

/** Providers that render stored data, discovered rather than listed. */
const dataProviders = readdirSync(WIDGET_DIR)
  .filter((f) => f.endsWith("WidgetProvider.java"))
  .filter((f) => {
    const src = read(path.join(WIDGET_DIR, f));
    const layout = (src.match(/R\.layout\.(\w+)/) || [])[1];
    return layout && readdirSync(LAYOUT_DIR).includes(`${layout}.xml`) && /WidgetPrefs\.get\(/.test(src);
  })
  .sort();

/**
 * Providers that honour a redacted line.
 *
 * Matched on the SHARED HELPER rather than on the string "redactedText", because
 * the seven near-duplicate inline branches are exactly what Gemini warned against:
 * seven places for one typo. DoxyPEP originally had its own inline branch and was
 * converted onto the helper, so this assertion is what keeps that from spreading.
 */
const WIRED = dataProviders.filter((f) => /WidgetRedacted\.apply\(/.test(read(path.join(WIDGET_DIR, f))));
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

  it("DoxyPEP names its own views to the shared helper", () => {
    // CHANGED when DoxyPEP was converted off its inline branch onto
    // WidgetRedacted.apply. The previous version asserted the provider itself
    // called setViewVisibility twice, which is precisely the duplication the
    // helper exists to remove - so the assertion had to move with the code, not
    // be deleted: it still proves the provider supplies ITS OWN ids, which is
    // the thing that can go wrong silently.
    //
    // RemoteViews is an IPC serialization stub, not a live view tree (Gemini made
    // this point and it corrected my design), so there is no traversal - the ids
    // have to be named, and a wrong id is a runtime failure on a home screen.
    const src = read(path.join(WIDGET_DIR, "DoxyPEPWidgetProvider.java"));
    expect(src).toMatch(/WidgetRedacted\.apply\(/);
    expect(src).toMatch(/R\.id\.widget_doxy_title/);
    expect(src).toMatch(/R\.id\.widget_doxy_status/);
    expect(src).toMatch(/R\.id\.widget_doxy_countdown/);
  });

  it("there is exactly ONE implementation of the redacted render", () => {
    // The anti-duplication assertion, narrowed.
    //
    // The first version of this asserted no provider calls setViewVisibility at
    // all, and it failed on NextDose - which has three, for the Chronometer
    // show/hide it legitimately owns. Hiding a countdown that does not exist is
    // the provider's own business and has nothing to do with redaction, so the
    // assertion was claiming something false.
    //
    // What is actually wanted is one implementation, not zero call sites. So:
    // the helper holds the loop, and every provider calls it exactly once. If a
    // provider grows a second branch of its own, this fails - which is the
    // outcome Gemini warned about (seven near-duplicate inline branches, seven
    // places for one typo).
    const helper = read(path.join(WIDGET_DIR, "WidgetRedacted.java"));
    expect(helper, "the shared helper is missing").toMatch(/setViewVisibility/);
    for (const f of WIRED) {
      const src = read(path.join(WIDGET_DIR, f));
      const calls = src.match(/WidgetRedacted\.apply\(/g) || [];
      expect(calls.length, `${f} calls WidgetRedacted.apply ${calls.length} times; expected exactly once`).toBe(1);
    }
  });

  it("every id it hides actually exists in its layout", () => {
    // setViewVisibility on an id absent from the inflated layout is a runtime
    // failure on a home screen, and it is exactly the kind of thing CI's
    // compiler cannot see because RemoteViews ids are resolved reflectively.
    const src = read(path.join(WIDGET_DIR, "DoxyPEPWidgetProvider.java"));
    const layoutName = src.match(/R\.layout\.(\w+)/)[1];
    const layout = read(path.join(LAYOUT_DIR, `${layoutName}.xml`));
    for (const id of src.matchAll(/setViewVisibility\(R\.id\.(\w+)/g)) {
      expect(layout, `${id[1]} is hidden but does not exist in ${layoutName}.xml`).toContain(
        `@+id/${id[1]}`,
      );
    }
  });

  it("the bridge forwards the line, defaulting to empty rather than null", () => {
    const bridge = read(path.join(ROOT, "android/app/src/main/java/com/shos/app/WidgetBridgePlugin.java"));
    // WIDENED from {0,300} to {0,700}: the only reason it failed is that the
    // explanatory comment added at the call site pushed the argument further from
    // the method name. The property - the bridge hands the line to the provider -
    // is untouched, so the window grows and the assertion stays.
    expect(bridge).toMatch(/DoxyPEPWidgetProvider\.updateDoxyPEP\([\s\S]{0,700}?opt\(call, "redactedText"\)/);
    // Empty rather than absent, so the provider needs no null case and a stale
    // value from a previous update cannot survive a tier change back to full.
    expect(bridge).toMatch(/opt\(call, "redactedText"\)/);
  });

  it("JS sends the line only at redacted, never at full or off", () => {
    // The other half of the same fix, and the half that is cheap to test. At
    // full the real fields are used; at off nothing at all is sent.
    const helper = read(path.join(ROOT, "src/calculations/widgetBridgeUpdate.js"));
    expect(helper).toMatch(/tier === "redacted" && redactedText/);
    const test = read(path.join(ROOT, "src/calculations/widgetBridgeUpdate.test.js"));
    expect(test).toMatch(/redactedText\)\.toBeUndefined\(\)/);
    expect(test).toMatch(/toEqual\(\{ tier: "off" \}\)/);
  });
});

describe("inventory of what is not wired yet", () => {
  it("reports the remaining six, and reports none once they are done", () => {
    // Deliberately a description rather than a failure. Making it a hard failure
    // would mean either shipping six half-wired widgets or writing a test that
    // breaks every time one is finished - and this repo's rule is that a guard
    // should describe a property, not track a work list. The list is printed so
    // the next session sees it without reading seven providers.
    // The other six were wired in the follow-up commit, so this is now a hard
    // requirement rather than a progress note. It was deliberately written as a
    // description while the work was in flight, because a guard that fails on a
    // work list is either deleted or blocks anyone finishing it - and the number
    // to assert has now changed for a real reason, not because someone loosened
    // it to make a run green.
    expect(
      NOT_WIRED,
      `every data widget must honour its Redacted tier. Not wired: ${NOT_WIRED.join(", ")}`,
    ).toEqual([]);
    if (NOT_WIRED.length) {
      console.log(`  [widget-redacted] not yet wired: ${NOT_WIRED.join(", ").replace(/\.java/g, "")}`);
    }
  });

  it("every wired provider both READS and WRITES its key", () => {
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
    }
  });
});
