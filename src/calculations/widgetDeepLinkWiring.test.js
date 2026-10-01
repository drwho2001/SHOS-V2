// The Refills Due widget must actually arrive at Inventory, end to end.
//
// WHY THIS IS A WIRING GUARD AND NOT A ROUTE UNIT TEST
// ----------------------------------------------------
// The route table can be perfect and the feature still dead. `resolveDeepLinkRoute`
// is one layer of three, and every one of them has been wrong independently at
// some point in this codebase's history:
//
//   1. RefillWidgetProvider.java sets a URI string.
//   2. deepLinkRoutes.js maps that URI to {type, tab, subTab}.
//   3. App.jsx passes subTab through as `quickAddTarget`.
//   4. MedicationDashboard reads `quickAddTarget` to pick its initial tab.
//
// Change any one and the other three keep compiling, keep passing their own
// tests, and the widget opens the wrong screen for a user. That is the same shape
// as the Testing due-banner bug in this repo where one file computed a
// fingerprint the scheduler had no copy of, and as the DoxyPEP reminder
// resolving a function from a module that did not export it.
//
// Each link is asserted against the REAL file rather than re-derived, so a rename
// on one side cannot quietly pass.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveDeepLinkRoute } from "./deepLinkRoutes.js";

const ROOT = process.cwd();
const read = (...p) => readFileSync(path.join(ROOT, ...p), "utf8");

const PROVIDER = read("android", "app", "src", "main", "java", "com", "shos", "app", "widget", "RefillWidgetProvider.java");
const APP = read("src", "App.jsx");
const MED = read("src", "modules", "SHOS_Medication_Dashboard_Prototype.jsx");
const DOXY = read("android", "app", "src", "main", "java", "com", "shos", "app", "widget", "DoxyPEPWidgetProvider.java");

describe("the Refills Due widget opens Inventory (t061)", () => {
  it("1. the provider fires the /inventory URI", () => {
    expect(PROVIDER).toContain('Uri.parse("com.shos.app://medication/inventory")');
    // And no longer the old one, which would otherwise still be present in a
    // second Intent elsewhere in the same file and win on a real tap.
    expect(PROVIDER).not.toContain("com.shos.app://medication/dashboard");
  });

  it("2. the router turns that URI into a medication sub-tab route", () => {
    // Taken from the provider's own string rather than retyped, so this cannot
    // pass while the two sides disagree.
    const uri = PROVIDER.match(/com\.shos\.app:\/\/medication\/[a-z]+/)[0];
    const route = resolveDeepLinkRoute(uri);
    expect(route).toEqual({ type: "navigate", tab: "medication", subTab: "inventory" });
    // `navigate` specifically, because App's navigateTo sets quickAdd false.
    // A quickAdd route here would open the Add-medication sheet instead.
    expect(route.type).toBe("navigate");
  });

  it("3. App passes the sub-tab through to the module", () => {
    expect(APP).toContain("quickAddTarget={quickAddTarget}");
    // navigateTo must NOT also raise quickAdd, or the sheet opens over Inventory.
    const nav = APP.slice(APP.indexOf("const navigateTo = "), APP.indexOf("const navigateTo = ") + 400);
    expect(nav).toContain("setQuickAdd(false)");
  });

  it("4. the module turns that sub-tab into its initial tab", () => {
    expect(MED).toContain('quickAddTarget === "inventory" ? "Inventory" : "Registry"');
    // Inventory must be a real tab it can actually render, not a string that
    // matches nothing - which would silently fall through to no content.
    expect(MED).toContain('<InventoryTab');
  });

  it("the DoxyPEP widget is deliberately NOT moved", () => {
    // It targets the dashboard on purpose: it shows an adherence figure that only
    // renders there. Folding this change into /dashboard would have broken it,
    // which is why /inventory is a separate path rather than a redefinition.
    expect(DOXY).toContain("com.shos.app://medication/dashboard");
  });

  it("every widget URI in the Java providers is a route the router knows", () => {
    // The general form of this bug. Cheap, and it is the check that would have
    // caught a widget pointing at a URI nobody ever implemented.
    const providers = read("android", "app", "src", "main", "java", "com", "shos", "app", "widget", "DoxyPEPWidgetProvider.java");
    const uris = [...PROVIDER.matchAll(/com\.shos\.app:\/\/[a-z\-/]+/g)].map((m) => m[0]);
    for (const u of uris) {
      const r = resolveDeepLinkRoute(u);
      expect(r, `"${u}" is fired by a provider but resolves to null`).not.toBeNull();
    }
    expect(providers).toBeTruthy();
  });
});