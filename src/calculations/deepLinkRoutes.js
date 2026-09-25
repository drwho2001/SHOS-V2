// deepLinkRoutes.js — pure mapping from an incoming app URL (custom scheme)
 // to an in-app navigation action. Used by App.jsx's routeShortcutUrl for
 // Android widget taps and App Shortcuts (com.shos.app://... data URIs).
 //
 // Pure and I/O-free by design (repository/calculation split): no storage
 // reads, no React — so it is unit-tested directly. See deepLinkRoutes.test.js.
 // Returns { type: "quickAdd", tab, target } | { type: "navigate", tab, subTab } | { type: "action", action, payload } | null.
 const VALID_HEALTHCARE_SUBTABS = [
   "testing",
   "clinicVisits",
   "vaccinations",
   "symptomLog",
   "measurements",
   "menstrualHealth",
 ];

 // Aliases for subTab values widgets have used that are not canonical
 // Healthcare keys. "menstrual" was what CycleWidget fired; the real key is
 // "menstrualHealth" (an unmatched key would silently land on Testing, the
 // default — wrong destination with no error to reveal it).
 const HEALTHCARE_SUBTAB_ALIASES = {
   menstrual: "menstrualHealth",
   menstrualContraception: "menstrualHealth",
 };

 export function resolveDeepLinkRoute(urlString) {
   if (!urlString || typeof urlString !== "string") return null;
   let url;
   try {
     url = new URL(urlString);
   } catch {
     return null;
   }
   const host = (url.hostname || "").toLowerCase();
   const path = url.pathname || "";
   if (host === "medication") {
     // Bare com.shos.app://medication (the long-press "Log dose" shortcut):
     // established behavior opens the add sheet — kept, not changed here.
     if (path === "/log" || path === "/dashboard") {
       // Widget taps ("Log Medication" label, DoxyPEP/Refill status widgets):
       // land on the dashboard where the per-medication Log-dose buttons
       // live, not a blank Add-medication form (which is for NEW meds).
       return { type: "navigate", tab: "medication" };
     }
     return { type: "quickAdd", tab: "medication" };
   }
   if (host === "encounter") return { type: "quickAdd", tab: "activity" };
   if (host === "contact") {
     if (path === "/add") return { type: "quickAdd", tab: "contacts" };
     return null;
   }
   if (host === "clinic-visits") return { type: "navigate", tab: "healthcare", subTab: "clinicVisits" };
   if (host === "clinic-card") return { type: "navigate", tab: "healthcare", subTab: "clinicCard" };
   if (host === "healthcare") {
     const raw = url.searchParams.get("subTab");
     const subTab = VALID_HEALTHCARE_SUBTABS.includes(raw)
       ? raw
       : HEALTHCARE_SUBTAB_ALIASES[raw] || "testing";
     return { type: "navigate", tab: "healthcare", subTab };
   }
   if (host === "widget") {
     if (path === "/reveal-clinic") return { type: "action", action: "revealClinicCard" };
     return null;
   }
   // anything unknown: no App-level opener exists
   return null;
 }
