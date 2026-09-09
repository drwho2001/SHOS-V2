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
// CHANGED — Phase 2 encryption groundwork: ProtectionRegistry is now
// async — wrapped in an async IIFE, same pattern as kinkRegistry.js's
// own expansion flag (a module-load-time side effect can't itself be
// async).
// CHANGED — Phase 4 (Sep 2026): a real, pre-existing bug the self-
// invoking IIFE version of this had, only surfaced once storage.save()
// started needing an unlocked vault — module evaluation always happens
// before App.jsx's own bootReady gate resolves, so this would ALWAYS
// fail to save (not just occasionally) for anyone with App Lock on,
// forever leaving PEP unadded and silently retrying every cold boot.
// Exported as a real function instead, called once from App.jsx's own
// finishBootAfterUnlock() after a real unlock.
export const PEP_ADDED_FLAG = "shos_protection_pep_added_v1";
export async function runProtectionPepMigration() {
  if (!(await storage.load(PEP_ADDED_FLAG, false))) {
    await ProtectionRegistry.findOrCreate("PEP");
    await storage.save(PEP_ADDED_FLAG, true);
  }
}
