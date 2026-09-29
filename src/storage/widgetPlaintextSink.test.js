// widgetPlaintextSink.test.js — guard on the dormant NHS-number sink in the
// Android home-screen widgets.
//
// WHY THIS IS A TEST AND NOT JUST A COMMENT. The finding is that
// ClinicCardWidgetProvider would write an NHS number into unencrypted
// SharedPreferences, and that the Java method doing it is one method call away
// from being live. Comments alone have been shown in this repo to lose to
// events: a whole feature was half-committed under a blanket `git add -A`, and
// three "coverage" tests never could have failed. The next natural step for
// this widget code is obvious to anyone who opens it — every provider is
// registered in the manifest, none of them do anything, and the obvious thing
// to do next is implement the missing bridge. This test is what makes that
// step fail loudly instead of silently shipping an NHS number in plaintext.
//
// WHY THE ASSERTION IS "NOT REACHABLE" AND NOT "NOT PRESENT". The dead code is
// harmless on its own and deleting it is a product decision, not a bug fix —
// an NHS number on a lock-screen widget is genuinely low value when the Clinic
// Card itself is one tap away, but the owner may want it. So the invariant
// protected here is the security-relevant one: this data cannot currently reach
// disk. If someone wires the bridge, these tests fail and force the encryption
// question to be answered, which is the moment it matters.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const JAVA_ROOT = path.join(process.cwd(), "android", "app", "src", "main", "java");
const WIDGET_DIR = path.join(JAVA_ROOT, "com", "shos", "app", "widget");

function javaFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? javaFiles(full) : [full];
  });
}

const ALL_JAVA = javaFiles(JAVA_ROOT).map((f) => ({
  path: f,
  src: readFileSync(f, "utf8"),
}));
const CLINIC = readFileSync(path.join(WIDGET_DIR, "ClinicCardWidgetProvider.java"), "utf8");

// Comments record what a bug WAS by quoting the defective line verbatim, which
// is exactly what makes a raw substring check report a fixed problem as still
// present. That has bitten two guards in this repo already.
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the widget NHS-number sink is not reachable", () => {
  // NOTE, 29 Sep 2026: the invariant below CHANGED SHAPE when the bridge was
  // built. It used to assert "no WidgetBridge plugin exists", which was true,
  // and was precisely why the sink was unreachable. The plugin now exists -
  // building it was the point - so that assertion would be false by design and
  // keeping it would have meant deleting the guard.
  //
  // What the guard protects never changed: the NHS number must never reach
  // widget storage. The route changed from "there is no route" to "there is a
  // route, and the bridge deliberately refuses to use it", which is the
  // stronger assertion - it now survives the bridge being written, and would
  // catch someone 'fixing' the bridge by forwarding the field it is handed.
  it("the bridge discards the NHS number rather than forwarding it", () => {
    const plugin = ALL_JAVA.find((f) => f.path.endsWith("WidgetBridgePlugin.java"));
    expect(plugin, "WidgetBridgePlugin.java should exist - the bridge is built").toBeTruthy();
    const code = codeOnly(plugin.src);
    expect(code).toMatch(/updateClinicCard/);
    // The final argument of the provider call is the nhsNum parameter. It must
    // be an empty string, never opt(call, "nhsNum") or getString("nhsNum").
    const at = code.indexOf("ClinicCardWidgetProvider.updateClinicCard");
    const callSite = code.slice(at, code.indexOf(");", at));
    expect(callSite).not.toMatch(/nhsNum/i);
  });

  it("no Java code writes an NHS-number key to widget storage", () => {
    // Independent of the bridge, and by any route: reading the key is fine,
    // putting a real value into it is not.
    const writers = ALL_JAVA.filter((f) =>
      /\.putString\(\s*KEY_APPT_NHS_NUM\s*,/.test(codeOnly(f.src))
    );
    expect(writers.map((f) => path.relative(process.cwd(), f.path))).toEqual([]);
  });

  it("widget storage is encrypted, not plain SharedPreferences", () => {
    // The other half of the promise. EncryptedSharedPreferences uses a
    // Keystore-backed key - the only kind a widget can read from a cold-started
    // process, since the app's own vault key is non-extractable and in-memory
    // only. See WidgetPrefs.java.
    //
    // WidgetPrefs itself is excluded: it is the helper, and its one plain call
    // is the documented last-resort fallback for when the Keystore is
    // unavailable (which would otherwise crash every widget update). The
    // separate assertion below still requires the encrypted path to exist, so
    // excluding the helper cannot make this vacuous.
    const providers = ALL_JAVA.filter(
      (f) => f.path.includes(`${path.sep}widget${path.sep}`) && !f.path.endsWith("WidgetPrefs.java")
    );
    const plain = providers.filter((f) =>
      /getSharedPreferences\(\s*PREFS_NAME\s*,\s*Context\.MODE_PRIVATE\s*\)/.test(codeOnly(f.src))
    );
    expect(plain.map((f) => path.basename(f.path))).toEqual([]);
    const helper = ALL_JAVA.find((f) => f.path.endsWith("WidgetPrefs.java"));
    expect(helper, "WidgetPrefs.java should exist").toBeTruthy();
    expect(helper.src).toMatch(/EncryptedSharedPreferences\.create/);
  });

  it("the bridge is registered with Capacitor, or the JS guard can never pass", () => {
    // The single line whose absence is why this feature did not work at all.
    // registerPlugin("WidgetBridge") in JS only resolves to a real method if
    // the class is registered in MainActivity; without it every update method
    // is undefined and the providers stay exactly as dead as they were.
    const main = ALL_JAVA.find((f) => f.path.endsWith(`MainActivity.java`));
    expect(main, "MainActivity.java should exist").toBeTruthy();
    expect(main.src).toMatch(/registerPlugin\(\s*WidgetBridgePlugin\.class\s*\)/);
  });

  it("documents the hazard at the sink itself, so the next reader is warned", () => {
    // A comment is a weak guard, but an absent one here is a gap: the method
    // looks like ordinary widget plumbing. This asserts the warning exists at
    // the point of danger, not that it is worded a particular way.
    expect(CLINIC).toMatch(/KEY_APPT_NHS_NUM\s*=\s*"clinic_appt_nhs_num"/);
    expect(/unencrypted|plaintext|SharedPreferences/i.test(CLINIC)).toBe(true);
  });
});

describe("the stripper used by these guards is not vacuous", () => {
  // A stripper that removed everything would make the negative checks above
  // pass for the wrong reason — the same failure this repo keeps cataloguing.
  it("still sees real code after comment removal", () => {
    const stripped = codeOnly(CLINIC);
    expect(stripped).toMatch(/SharedPreferences/);
    expect(stripped).toMatch(/getString/);
  });
});
