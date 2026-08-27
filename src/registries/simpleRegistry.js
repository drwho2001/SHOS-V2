// simpleRegistry.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// A "registry" here means a small vocabulary list — Kink Registry, Chems
// Registry, Protection Registry, Symptoms Registry. Checked live against
// Notion this session: all four turned out to have the exact same shape
// (just a name, an id, and relations back to the records that reference
// them). That's a genuine, discovered repeat — not an assumption made
// upfront — so this is the point the project's own standing rule says a
// shared abstraction is allowed: "generic abstractions are to be
// discovered after multiple modules exist, never imposed upfront."
//
// This is a FACTORY, not a shared base class or a generic "Registry"
// object the rest of the app imports directly. Each real registry
// (kinkRegistry.js, chemsRegistry.js, etc.) calls this once, with its
// own storage key and seed data, and exports its own domain-named
// object (KinkRegistry, ChemsRegistry...). Nothing outside those files
// ever imports from here directly — domain-first naming stays intact
// at every call site, this file just avoids retyping identical
// getAll/getById/create/update/archive logic four times.
//
// If a future registry needs a field this shape doesn't have (Locations
// already doesn't — it has Type, an address, and Notes — which is
// exactly why Locations gets its OWN repository file, not this
// factory), that's the signal this abstraction has reached its limit
// for that case. Don't stretch this factory to fit it; write that one
// by hand instead, the same way Locations does.

import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

// config: { storageKey, idPrefix, seedNames }
// Returns a registry object: getAll/getById/getByName/create/update/
// archive/unarchive/replaceAll — same contract as every other
// repository in the app (structuredClone on read, opaque IDs).
export function createSimpleRegistry({ storageKey, idPrefix, seedNames = [] }) {
  const DEFAULT_ENTRY = { name: "" };

  const seedEntries = seedNames.map((name, i) => ({
    ...DEFAULT_ENTRY,
    id: `${idPrefix}_${String(i + 1).padStart(3, "0")}`,
    name,
    createdAt: new Date().toISOString(),
    isArchived: false,
  }));

  let entries = storage.load(storageKey, seedEntries);

  function persist() {
    storage.save(storageKey, entries);
  }

  function computeNextNumber(existing) {
    const numbers = existing.map((e) => {
      const match = new RegExp(`^${idPrefix}_(\\d+)$`).exec(e.id);
      return match ? parseInt(match[1], 10) : 0;
    });
    return (numbers.length ? Math.max(...numbers) : 0) + 1;
  }
  let nextNumber = computeNextNumber(entries);

  function generateId() {
    const id = `${idPrefix}_${String(nextNumber).padStart(3, "0")}`;
    nextNumber += 1;
    return id;
  }

  return {
    // CHANGED 18 Aug 2026 — same defensive-merge fix as every other
    // repository this session. Fixes this once, here, and every
    // registry built on this factory (Kink/Chems/Protection/Symptoms)
    // gets the protection automatically — this is exactly the kind of
    // shared-abstraction payoff the factory was extracted for.
    getAll() {
      return structuredClone(entries.map((e) => ({ ...DEFAULT_ENTRY, ...e })));
    },

    getById(id) {
      const found = entries.find((e) => e.id === id);
      return found ? structuredClone({ ...DEFAULT_ENTRY, ...found }) : null;
    },

    // Case-insensitive exact match — used by the shared RegistryPicker
    // UI to check "does this name already exist" before creating a
    // duplicate when someone types a new tag.
    getByName(name) {
      const found = entries.find((e) => e.name.toLowerCase() === name.toLowerCase());
      return found ? structuredClone({ ...DEFAULT_ENTRY, ...found }) : null;
    },

    create(data) {
      const newEntry = {
        ...DEFAULT_ENTRY,
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        isArchived: false,
      };
      entries = [...entries, newEntry];
      persist();
      return newEntry;
    },

    // Convenience used by the picker: find-or-create by name in one
    // call, so typing a brand-new tag and picking an existing one look
    // identical to the calling UI code.
    findOrCreate(name) {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = this.getByName(trimmed);
      if (existing) return existing;
      return this.create({ name: trimmed });
    },

    update(id, changes) {
      let updated = null;
      entries = entries.map((e) => {
        if (e.id !== id) return e;
        updated = { ...e, ...changes };
        return updated;
      });
      persist();
      return updated;
    },

    archive(id) {
      return this.update(id, { isArchived: true });
    },

    unarchive(id) {
      return this.update(id, { isArchived: false });
    },

    replaceAll(newEntries) {
      entries = newEntries;
      nextNumber = computeNextNumber(entries);
      persist();
    },
  };
}
