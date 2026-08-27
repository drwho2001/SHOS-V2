// organismRegistry.js
//
// Real Notion registry (organism_id pattern, confirmed via the 31 Jul
// 2026 Backend Verification Report's registry ID-tag audit table —
// 🟢 consistent, same as Kink/Chems/Protection/Medicines/Symptoms).
// Testing relates to this for the "Organism" field — which specific
// organism a test came back positive for (Chlamydia, Gonorrhoea, etc.)
// — kept separate from "Testing for?" (what was screened FOR) since a
// test can screen for several things but only come back positive for
// one specific organism.
//
// Seeded with the organisms already visible in Testing's own live
// "Testing for?" option list (same real names, not invented) — that
// field and this registry cover overlapping but distinct concepts
// (screened-for vs. confirmed-positive-for), so starting from the same
// real vocabulary keeps them consistent rather than drifting apart.
import { createSimpleRegistry } from "./simpleRegistry.js";

export const OrganismRegistry = createSimpleRegistry({
  storageKey: "shos_organism_registry",
  idPrefix: "organism",
  seedNames: ["Chlamydia", "Gonorrhoea", "Syphilis", "HIV", "Mpox", "MGen"],
});
