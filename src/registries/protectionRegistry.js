// protectionRegistry.js
//
// Real Notion registry (protection_id, Protection Name, plus a relation
// back to Encounters using it). The smallest registry in the whole
// workspace — 3 fields total. Encounters-pink per Doc 2 (moved off
// Healthcare blue — protection is encounter-context vocabulary).
import { createSimpleRegistry } from "./simpleRegistry.js";
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

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
// CHANGED 4 Sep 2026 — real groundwork for encryption at rest (see
// CLAUDE.md's Known Issues / the Notion Development log for the full
// plan): this used to touch `localStorage` directly, bypassing
// `storageAdapter` — one of a handful of real bypasses the audit
// found. Routed through the same adapter every other flag/preference
// in this app already uses, so this one-time flag ends up under the
// same encryption boundary once that lands, rather than sitting
// outside it as a real gap.
const PEP_ADDED_FLAG = "shos_protection_pep_added_v1";
if (!storage.load(PEP_ADDED_FLAG, false)) {
  ProtectionRegistry.findOrCreate("PEP");
  storage.save(PEP_ADDED_FLAG, true);
}
