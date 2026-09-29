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
  it("no WidgetBridge Capacitor plugin exists on the Java side", () => {
    const bridgePlugins = ALL_JAVA.filter((f) =>
      /@CapacitorPlugin\s*\(\s*name\s*=\s*"WidgetBridge"/.test(f.src)
    );
    // This is the single point at which the whole path becomes live: with a
    // registered plugin, bridge.updateClinicCard would resolve and the JS
    // guard `if (bridge && bridge.updateClinicCard)` would pass.
    expect(
      bridgePlugins.map((f) => path.relative(process.cwd(), f.path))
    ).toEqual([]);
  });

  it("no Java code calls the clinic-card sink directly", () => {
    // Guards against wiring it natively instead of via a plugin, which would
    // bypass the check above entirely.
    const callers = ALL_JAVA.filter(
      (f) => !f.path.endsWith("ClinicCardWidgetProvider.java") &&
        /ClinicCardWidgetProvider\.updateClinicCard\s*\(/.test(codeOnly(f.src))
    );
    expect(callers.map((f) => path.relative(process.cwd(), f.path))).toEqual([]);
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
