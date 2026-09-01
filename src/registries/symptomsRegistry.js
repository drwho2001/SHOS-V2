// symptomsRegistry.js
//
// Real Notion registry (symptom_cat_id, Symptom Name, plus a relation
// to Vaccine SEs — Vaccination Record, not built yet, so that relation
// has nothing to link to on the app side and is simply omitted here,
// same treatment any not-yet-built module's relation gets elsewhere).
//
// NOT the same thing as the Symptoms Tracker (occurrences — when a
// symptom happened, how severe, resolved or not) — Architecture Lock
// v1.0 keeps these two conceptually distinct on purpose (vocabulary vs
// occurrence), confirmed still zero content overlap between their IDs
// as of the 31 Jul backend audit. This file is the vocabulary half
// only; Symptoms Tracker is its own future module.
import { createSimpleRegistry } from "./simpleRegistry.js";

// ADDED 1 Sep 2026 — real ask: richer example data needs at least one
// real symptom to tag its example Symptom Log entry with — this
// registry started genuinely empty, so there was nothing to reference.
export const SymptomsRegistry = createSimpleRegistry({
  storageKey: "shos_symptoms_registry",
  idPrefix: "symptom_cat",
  seedNames: ["Urethral discharge"],
});
