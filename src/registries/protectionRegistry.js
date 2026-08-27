// protectionRegistry.js
//
// Real Notion registry (protection_id, Protection Name, plus a relation
// back to Encounters using it). The smallest registry in the whole
// workspace — 3 fields total. Encounters-pink per Doc 2 (moved off
// Healthcare blue — protection is encounter-context vocabulary).
import { createSimpleRegistry } from "./simpleRegistry.js";

export const ProtectionRegistry = createSimpleRegistry({
  storageKey: "shos_protection_registry",
  idPrefix: "protection",
  seedNames: ["Condom", "PrEP", "PEP", "None"],
});

// ADDED — real ask: "PEP" was missing as a protection option. Same
// real gap as the Kink Registry migration — `seedNames` only ever
// applies to a genuinely empty registry, so a device that already has
// real data needs this to actually see "PEP" added, not just a fresh
// install.
const PEP_ADDED_FLAG = "shos_protection_pep_added_v1";
try {
  if (typeof localStorage !== "undefined" && !localStorage.getItem(PEP_ADDED_FLAG)) {
    ProtectionRegistry.findOrCreate("PEP");
    localStorage.setItem(PEP_ADDED_FLAG, "true");
  }
} catch {
  // Same "never let a background convenience break the app" reasoning
  // as the Kink Registry's own version of this.
}
