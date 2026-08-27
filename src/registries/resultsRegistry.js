// resultsRegistry.js
//
// Real Notion registry (result_id pattern, confirmed 🟢 consistent via
// the 31 Jul 2026 Backend Verification Report). Testing relates to this
// for the "Result" field — the actual outcome of a test (Positive,
// Negative, Pending, etc.), kept as its own small registry rather than
// a hardcoded option list, matching how the live Notion schema treats
// it (a relation, not a select).
import { createSimpleRegistry } from "./simpleRegistry.js";

export const ResultsRegistry = createSimpleRegistry({
  storageKey: "shos_results_registry",
  idPrefix: "result",
  seedNames: ["Positive", "Negative", "Pending", "Inconclusive", "Not tested"],
});
