// storageKeyDrift.test.js
//
// Guard against a silent zero-count drift: buildRegistryUsage(counts) keys its
// seven buckets off the strings in USAGE_KEYS, while the registries expose a
// storageKey read from the same literal repeated in every createSimpleRegistry
// call and locations repository. If one rots (a renamed key in one place only),
// registryUsage keeps returning empty counts — nobody sees an error, the
// usage-ordered pickers just silently fall back to A–Z forever.
//
// Pure assertions over module shape — no storage, no vault, no rendering.

import { describe, it, expect } from "vitest";
import { USAGE_KEYS } from "../calculations/registryUsage.js";
import { KinkRegistry } from "../registries/kinkRegistry.js";
import { ChemsRegistry } from "../registries/chemsRegistry.js";
import { ProtectionRegistry } from "../registries/protectionRegistry.js";
import { SymptomsRegistry } from "../registries/symptomsRegistry.js";
import { ResultsRegistry } from "../registries/resultsRegistry.js";
import { OrganismRegistry } from "../registries/organismRegistry.js";
import { LocationsRepository } from "../repositories/locationsRepository.js";

describe("registry storageKey drift", () => {
  it("every bucket USAGE_KEYS names resolves to the matching registry storageKey", () => {
    expect(USAGE_KEYS).toEqual({
      kink: "shos_kink_registry",
      chem: "shos_chems_registry",
      protection: "shos_protection_registry",
      symptom: "shos_symptoms_registry",
      organism: "shos_organism_registry",
      result: "shos_results_registry",
      location: "shos_locations",
    });

    const pairsByBucket = {
      kink: KinkRegistry,
      chem: ChemsRegistry,
      protection: ProtectionRegistry,
      symptom: SymptomsRegistry,
      organism: OrganismRegistry,
      result: ResultsRegistry,
      location: LocationsRepository,
    };

    for (const [bucket, expected] of Object.entries(USAGE_KEYS)) {
      const registry = pairsByBucket[bucket];
      expect(registry, `USAGE_KEYS bucket "${bucket}" has no registry to check against`).toBeDefined();
      expect(registry.storageKey, `${bucket} registry exposes storageKey ${registry.storageKey}, expected ${expected}`).toBe(expected);
    }
  });

  it("all seven registries are covered — a new bucket without a registry is a test failure", () => {
    expect(Object.keys(USAGE_KEYS).sort()).toEqual([
      "chem", "kink", "location", "organism", "protection", "result", "symptom",
    ]);
  });
});
