// chemsRegistry.js
//
// Real Notion registry (chem_id, Chem, plus relations: Used with →
// Contacts, Used in encounters → Encounters). Confirmed live 18 Aug
// 2026 (Contacts round). Kept architecturally separate from Kink
// Registry per Notion's own design — Chems is a neutral domain, Kink is
// red, per Doc 2.
import { createSimpleRegistry } from "./simpleRegistry.js";

export const ChemsRegistry = createSimpleRegistry({
  storageKey: "shos_chems_registry",
  idPrefix: "chem",
  seedNames: [],
});

// ADDED — real ask: "Smoking and Tobacco are the same thing" — merged
// to the one real entry going forward. Same synonym-resolution pattern
// already established for KinkRegistry (resolveKinkSynonym) — small,
// explicit map, not automatic fuzzy-matching, to avoid false-positive
// merges of genuinely different substances.
const CHEM_SYNONYMS = {
  "tobacco": "Smoking",
  "cigarettes": "Smoking",
};

export function resolveChemSynonym(name) {
  const match = CHEM_SYNONYMS[name.trim().toLowerCase()];
  return match || name;
}
