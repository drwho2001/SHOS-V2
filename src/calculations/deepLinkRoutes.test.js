import { describe, it, expect } from "vitest";
import { resolveDeepLinkRoute } from "./deepLinkRoutes.js";

describe("resolveDeepLinkRoute", () => {
  it("null for empty garbage unknown", () => {
    expect(resolveDeepLinkRoute(null)).toBeNull();
    expect(resolveDeepLinkRoute("")).toBeNull();
    expect(resolveDeepLinkRoute("not a url")).toBeNull();
    expect(resolveDeepLinkRoute("com.shos.app://nope")).toBeNull();
    expect(resolveDeepLinkRoute("com.shos.app://contact")).toBeNull();
  });
  it("shortcut compat", () => {
    expect(resolveDeepLinkRoute("com.shos.app://medication")).toEqual({ type: "quickAdd", tab: "medication" });
    expect(resolveDeepLinkRoute("com.shos.app://encounter")).toEqual({ type: "quickAdd", tab: "activity" });
    expect(resolveDeepLinkRoute("com.shos.app://encounter/add")).toEqual({ type: "quickAdd", tab: "activity" });
  });
  it("widget routes", () => {
    expect(resolveDeepLinkRoute("com.shos.app://contact/add")).toEqual({ type: "quickAdd", tab: "contacts" });
    expect(resolveDeepLinkRoute("com.shos.app://medication/log")).toEqual({ type: "navigate", tab: "medication" });
    expect(resolveDeepLinkRoute("com.shos.app://medication/dashboard")).toEqual({ type: "navigate", tab: "medication" });
    // t061 - the Refills Due widget. Owner's correction: Inventory, not the
    // dashboard, because a refills widget must not open the screen with no stock
    // and no running total. `navigate` and not `quickAdd` is the load-bearing
    // part: App.jsx's navigateTo sets quickAdd false, so this cannot double as a
    // request to open the Add-medication sheet.
    expect(resolveDeepLinkRoute("com.shos.app://medication/inventory")).toEqual({
      type: "navigate",
      tab: "medication",
      subTab: "inventory",
    });
    // /dashboard must NOT quietly start selecting inventory too - the DoxyPEP
    // status widget targets it and belongs on the dashboard.
    expect(resolveDeepLinkRoute("com.shos.app://medication/dashboard").subTab).toBeUndefined();
    expect(resolveDeepLinkRoute("com.shos.app://clinic-visits")).toEqual({ type: "navigate", tab: "healthcare", subTab: "clinicVisits" });
    expect(resolveDeepLinkRoute("com.shos.app://healthcare?subTab=testing")).toEqual({ type: "navigate", tab: "healthcare", subTab: "testing" });
    expect(resolveDeepLinkRoute("com.shos.app://healthcare?subTab=menstrual")).toEqual({ type: "navigate", tab: "healthcare", subTab: "menstrualHealth" });
    expect(resolveDeepLinkRoute("com.shos.app://healthcare?subTab=bogus")).toEqual({ type: "navigate", tab: "healthcare", subTab: "testing" });
  });
  it("clinic-card routes", () => {
    expect(resolveDeepLinkRoute("com.shos.app://clinic-card")).toEqual({ type: "navigate", tab: "healthcare", subTab: "clinicCard" });
  });
  it("widget action routes", () => {
    expect(resolveDeepLinkRoute("com.shos.app://widget/reveal-clinic")).toEqual({ type: "action", action: "revealClinicCard" });
  });
});
