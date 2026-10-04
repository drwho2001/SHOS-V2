import fs from "node:fs";
import { it, expect } from "vitest";

/**
 * A deep link that resolves is not a deep link that works.
 *
 * MEASURED ON A REAL DEVICE (4 Oct 2026): `com.shos.app://clinic-card` resolved
 * cleanly to `{ type: "navigate", tab: "healthcare", subTab: "clinicCard" }`, the
 * app switched to Healthcare, and the Clinic Card never opened. Tapping the
 * Clinic Card widget therefore looked exactly like the "every widget tap lands
 * on the dashboard" bug it was supposed to be a fix for.
 *
 * WHY A STATIC GUARD. The existing deepLinkRoutes tests assert the route table
 * is correct - which it was, entirely. They cannot assert that something
 * downstream CONSUMES the route, because that consumer lives in a React module.
 * This is the same shape as every other "the wiring shipped but nothing calls
 * it" bug this repo has recorded: a function that works perfectly in tests while
 * the sweep that should have attached it silently did not.
 *
 * WHY NOT A REGEX OVER THE ROUTE TABLE. `deepLinkRoutes.test.js` already owns
 * that. Duplicating the file list here is a second source of truth that can
 * drift, which is how a guard starts asserting nothing.
 */
const ROUTES = "src/calculations/deepLinkRoutes.js";
const APP = "src/App.jsx";

it("every navigate route's subTab is either a real sub-tab or explicitly handled", () => {
  const routes = fs.readFileSync(ROUTES, "utf8");
  const app = fs.readFileSync(APP, "utf8");
  const healthcare = fs.readFileSync(
    "src/modules/SHOS_Healthcare_Prototype.jsx",
    "utf8",
  );

  // The six real Healthcare sub-tabs, read out of the module's own switch rather
  // than hardcoded here.
  const subTabs = [...healthcare.matchAll(/subTab === "(\w+)"/g)].map((m) => m[1]);

  // Every `subTab: "x"` the route table can emit for the healthcare tab.
  const emitted = [...routes.matchAll(/tab: "healthcare", subTab: "(\w+)"/g)].map(
    (m) => m[1],
  );

  expect(emitted.length, "no healthcare subTab routes found - route table changed?").toBeGreaterThan(0);

  for (const sub of emitted) {
    const isRealSubTab = subTabs.includes(sub);
    // A non-subTab value must be named literally in App.jsx's deep-link handler,
    // which is the only place that can turn it into an actual navigation.
    const handledInApp = new RegExp(`subTab === "${sub}"`).test(app);
    expect(
      isRealSubTab || handledInApp,
      `route emits subTab "${sub}", which is neither a real Healthcare sub-tab ` +
        `(${subTabs.join(", ")}) nor handled in App.jsx's deep-link handler - ` +
        `so the link resolves and nothing happens`,
    ).toBe(true);
  }
});

it("the clinic-card route actually opens the Clinic Card, both cold and warm", () => {
  const app = fs.readFileSync(APP, "utf8");
  const healthcare = fs.readFileSync(
    "src/modules/SHOS_Healthcare_Prototype.jsx",
    "utf8",
  );

  // Producer: the deep-link handler sets the flag.
  expect(
    /subTab === "clinicCard"\) setPendingOpenClinicCard\(true\)/.test(app),
    "App.jsx no longer sets pendingOpenClinicCard for the clinic-card route",
  ).toBe(true);

  // Threaded: the prop reaches the module.
  expect(
    /openClinicCardOnDeepLink=\{pendingOpenClinicCard\}/.test(app),
    "App.jsx does not pass openClinicCardOnDeepLink to the active module",
  ).toBe(true);

  // Receiver ACCEPTS it - the mutation this file exists for. Asserting only that
  // the producer sets the flag proves nothing: deleting the prop from the
  // destructured parameter list leaves the flag set and the Clinic Card closed,
  // which is the exact defect. So the consumer's own parameter list is read.
  const params = healthcare.match(/function HealthcareScreen\(\{([\s\S]*?)\}\)/);
  expect(params, "could not read HealthcareScreen's parameter list").toBeTruthy();
  expect(
    params[1],
    "HealthcareScreen does not accept openClinicCardOnDeepLink, so the flag has no consumer",
  ).toMatch(/openClinicCardOnDeepLink/);
  expect(
    /if \(openClinicCardOnDeepLink\)/.test(healthcare),
    "HealthcareScreen never acts on openClinicCardOnDeepLink",
  ).toBe(true);
  expect(
    /setShowClinicCard\(true\)/.test(healthcare),
    "the deep-link path does not open the Clinic Card",
  ).toBe(true);
});