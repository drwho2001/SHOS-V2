// widgetBridgeFieldNameGuard.test.js
//
// NEW GUARD, 13 Oct 2026. Every assertion here corresponds to a LIVE BUG: the
// DoxyPEP widget rendered its title and nothing else, on every device, at every
// tier.
//
// THE BUG CLASS: a field was RENAMED on the JS side of the bridge and the Java
// side kept the old name. DoxyPEP's JS sends `state` and `countdownAt`; the
// plugin read `status` and `expiryMs`. Two names that do not exist.
//
// WHY IT WAS SILENT, AND WHY IT LOOKED LIKE SOMETHING ELSE
// -------------------------------------------------------
// `opt(call, "status")` returns "" for an absent key, the provider stores "",
// and its own `prefs.getString(KEY_DOXY_STATUS, "No active window")` default
// then NEVER APPLIES - a present-but-empty value beats a default. So the status
// TextView was set to the empty string and the widget showed its title and an
// empty body. Meanwhile `expiryMs` was always 0, so the branch that renders
// "Active / Expired / Xh Ym remaining" was never taken.
//
// The nastiest part: `status` and `expiryMs` are NOT on
// ALLOWED_AT_REDACTED for doxyPepWindow (which is ["category","state",
// "countdownAt"]), so default-deny DROPS them at the Redacted tier. The Java was
// reading two field names that are impossible at Full tier and stripped at
// Redacted. No tier could ever populate them.
//
// THIS IS THE SAME FAMILY as widgetArgumentOrderGuard.test.js, one layer up.
// That guard checks the ORDER of the arguments reaching the provider. This one
// checks the NAMES of the fields read out of the call - the other way a
// JS-to-Java bridge can silently deliver nothing while every type matches and
// the build stays green.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const PLUGIN = "android/app/src/main/java/com/shos/app/WidgetBridgePlugin.java";
const CALC_DIR = "src/calculations";

/** Every bridge key the plugin reads for a given @PluginMethod. */
function javaKeysReadFor(methodName) {
  const src = fs.readFileSync(PLUGIN, "utf8").replace(/\/\/.*$/gm, "");
  const start = src.indexOf(`public void ${methodName}(PluginCall call)`);
  if (start < 0) return null;
  const body = src.slice(start, src.indexOf("\n    @PluginMethod", start + 10) > 0
    ? src.indexOf("\n    @PluginMethod", start + 10)
    : src.length);
  const keys = new Set();
  for (const m of body.matchAll(/opt\(call,\s*"([^"]+)"\)/g)) keys.add(m[1]);
  for (const m of body.matchAll(/call\.get\w+\(\s*"([^"]+)"/g)) keys.add(m[1]);
  return keys;
}

/**
 * Every object-literal key a JS file writes, parsed rather than grepped.
 *
 * PARSED WITH @babel/parser because a regex over `\w+:` misses ES6 SHORTHAND
 * properties (`nextAppt,`), which is most of what these payloads actually look
 * like. The first version of this guard did that and reported four false
 * positives - nextAppt, futureCount, docType, clinicNum, phase - all real fields
 * written in shorthand. A guard that cries wolf four times on the first run
 * trains the next reader to delete it.
 */
function jsNamesIn(file) {
  const p = path.join(CALC_DIR, file);
  if (!fs.existsSync(p)) return null;
  let ast;
  try {
    ast = parse(fs.readFileSync(p, "utf8"), { sourceType: "module", plugins: ["jsx"] });
  } catch {
    return new Set(); // a file this parser cannot read is not evidence of anything
  }
  const names = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const c of node) walk(c);
      return;
    }
    if (typeof node.type !== "string") return;
    // ObjectProperty covers BOTH `k: v` and the shorthand `k` - in Babel the
    // shorthand form is an ObjectProperty with shorthand:true and key===value.
    if (node.type === "ObjectProperty") {
      const k = node.key;
      if (k) names.add(k.name ?? k.value);
    }
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
      walk(node[key]);
    }
  };
  walk(ast);
  return names;
}

// The bridge method name -> the JS file that builds that widget's payload.
const BRIDGES = [
  { method: "updateDoxyPEP", js: "doxyPepSync.js" },
  { method: "updateAppointment", js: "clinicVisitReminderSync.js" },
  { method: "updateClinicCard", js: "clinicVisitReminderSync.js" },
  { method: "updateRefill", js: "medicationReminderSync.js" },
  { method: "updateNextDose", js: "medicationReminderSync.js" },
  { method: "updateTest", js: "testingReminderSync.js" },
  { method: "updateCycle", js: "cycleWidgetSync.js" },
];

// Every method reads `tier` and `redactedText`; those are added by
// widgetBridgeUpdate itself rather than by the payload, so they are not a
// name the payload file has to mention.
const INJECTED_BY_THE_HELPER = new Set(["tier", "redactedText"]);

describe("every field the Java bridge reads is a field the JS actually sends", () => {
  it("found every wired bridge", () => {
    // Non-vacuity. If a bridge were renamed and this file not updated, the loop
    // below would silently check fewer widgets and everything would stay green.
    for (const b of BRIDGES) {
      expect(javaKeysReadFor(b.method), `no plugin method ${b.method}`).not.toBeNull();
      expect(jsNamesIn(b.js), `no JS file ${b.js}`).not.toBeNull();
    }
    expect(BRIDGES.length).toBe(7);
  });

  for (const { method, js } of BRIDGES) {
    it(`${method} reads no field ${js} never sends`, () => {
      const read = javaKeysReadFor(method);
      const sent = jsNamesIn(js);
      const orphans = [...read].filter(
        (k) => !INJECTED_BY_THE_HELPER.has(k) && !sent.has(k)
      );
      expect(
        orphans,
        `${method} reads bridge field(s) [${orphans.join(", ")}] that ${js} never ` +
          `sends. opt() returns "" for an absent key, so the provider stores an ` +
          `EMPTY value and its own default never applies - the widget renders blank ` +
          `rather than falling back. Note that a field absent from ` +
          `ALLOWED_AT_REDACTED is ALSO dropped at the Redacted tier, so a name ` +
          `like this can be impossible at every tier at once. Fix by renaming on ` +
          `the side that has the wrong name, so the Java reads the names the ` +
          `privacy allowlist protects.`
      ).toEqual([]);
    });
  }

  it("names the DoxyPEP fix explicitly, so a regression is legible", () => {
    // The concrete instance, asserted by name rather than by the general rule
    // above, because the general rule compares against names in a file and this
    // one deserves a statement that survives the implementation changing shape.
    const read = javaKeysReadFor("updateDoxyPEP");
    expect(read).toContain("state");
    expect(read).toContain("countdownAt");
    expect(read).not.toContain("status");
    expect(read).not.toContain("expiryMs");
  });
});