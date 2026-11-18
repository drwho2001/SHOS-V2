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
  // CHANGED 18 Nov 2026 (owner): removed PEP entirely. HIV PEP is given at a
  // clinic, not routinely logged against an encounter at home — and its label
  // was easily confused with DoxyPEP. New installs never see it; existing
  // installs never had a real PEP entry (owner confirmed), so there is
  // nothing to migrate — the old add-PEP migration was removed with it.
  seedNames: ["Condom", "PrEP", "None"],
});

// 18 Nov 2026 — the old runProtectionPepMigration() was removed with PEP itself.
// Owner confirmed no real PEP entries exist, so there is no state to migrate:
// fresh installs seed without it and existing installs never had one. Keeping a
// migration here would be dead code that only exists to add a value we just
// removed. (If that ever changes, re-add an archive-only migration — never a
// hard delete, so old encounter references keep resolving.)
