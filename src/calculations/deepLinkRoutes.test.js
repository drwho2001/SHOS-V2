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
    // t060 - the bare link now carries `recordId: null` rather than omitting the
    // key. Asserted explicitly because the Appointments widget emits this bare
    // form for EVERY Redacted-tier user (the id is not an allowlisted field
    // there), so the no-id path is the common path and must keep resolving to the
    // list rather than to a record that does not exist.
    expect(resolveDeepLinkRoute("com.shos.app://clinic-visits")).toEqual({ type: "navigate", tab: "healthcare", subTab: "clinicVisits", recordId: null });
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

  // t060 - the Appointments widget opens the SPECIFIC appointment it is showing,
  // by carrying the id as a query param on the existing host. This is the half
  // that used to land on the bare list.
  it("carries a clinic-visit id from the widget deep link (t060)", () => {
    expect(resolveDeepLinkRoute("com.shos.app://clinic-visits?id=visit_abc123")).toEqual({
      type: "navigate",
      tab: "healthcare",
      subTab: "clinicVisits",
      recordId: "visit_abc123",
    });
    // The id must not disturb WHERE it lands - the module and sub-tab are the
    // part that was already working, and a refactor that moved the query param
    // into the path would silently change the destination.
    expect(resolveDeepLinkRoute("com.shos.app://clinic-visits?id=visit_abc123").subTab).toBe("clinicVisits");
  });

  it("treats an empty id as absent rather than as an id (t060)", () => {
    // `?id=` with nothing after it must NOT resolve to recordId "", or the app
    // would try to open a record whose id is the empty string.
    expect(resolveDeepLinkRoute("com.shos.app://clinic-visits?id=").recordId).toBeNull();
    // An id containing reserved characters survives URL decoding, so an id with a
    // space or a slash is not truncated or mis-split by the parser.
    expect(resolveDeepLinkRoute("com.shos.app://clinic-visits?id=visit%20a%2Fb").recordId).toBe("visit a/b");
  });

  it("ignores an unrelated query param rather than adopting it as a record id (t060)", () => {
    // Only `id` means a record. A future widget that adds `?from=` must not
    // accidentally start deep-linking to whatever it put there.
    expect(resolveDeepLinkRoute("com.shos.app://clinic-visits?from=widget").recordId).toBeNull();
    // And the id is case-sensitive as an exact param name - this app's own ids
    // are, and an upper-case variant would be a different record.
    expect(resolveDeepLinkRoute("com.shos.app://clinic-visits?ID=x").recordId).toBeNull();
  });
});
