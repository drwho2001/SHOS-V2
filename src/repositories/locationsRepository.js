// locationsRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real Notion database (Identity tier, same tier as Contacts) — Name,
// Type (select), Maps address (Notion's "place" property type — kept
// here as a plain text address string; no live geocoding available in
// this environment, same honest limitation as Contacts' Address field),
// Notes, plus relations to Encounters and Contacts.
//
// NOT the shared simpleRegistry factory — checked against the other
// four "trivial" registries this session and Locations genuinely has
// more shape (Type, an address, Notes), so it gets its own file rather
// than being force-fit into the factory built for the smaller ones.
// Same repository CONTRACT as everything else (getAll/getById/create/
// update/archive, structuredClone, opaque IDs) — just not sharing code
// with the factory, since the actual field shape differs.
//
// `relatedContactId` is a single optional link (e.g. "His House" links
// to that one contact) — Notion's own relation allows multiple, but
// The user's real Type options ("His House", "His Car") read as
// inherently single-contact per location, so this is a deliberate
// simplification, flagged here rather than silently narrowed. Revisit
// as a real array if a location ever needs multiple linked contacts.

import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_locations";

export const LOCATION_TYPE_OPTIONS = [
  "🏠 His House", "🚗 His Car", "My House", "My Car", "🌲 Public",
  "👀 Cruising", "🛀 Sauna", "🏨 Hotel", "🏟️ Event", "🏥 Clinic", "Other",
];

export const DEFAULT_LOCATION = {
  name: "",
  type: "",
  address: "",
  notes: "",
  relatedContactId: "",
};

// ADDED 18 Aug 2026 — real feedback: Location needed visible quick-tap
// suggestions (see RegistrySinglePicker in SHOS_Encounters_Prototype.jsx),
// and the user named specific examples they wanted covered — seeding them here
// rather than shipping an empty suggestion list on first use. "His" maps
// to His House (the more common case); His Car exists as its own type
// for when that distinction actually matters.
let seedLocations = [
  { ...DEFAULT_LOCATION, id: "location_001", name: "Home", type: "My House", createdAt: "2026-07-01T09:00:00.000Z", isArchived: false },
  { ...DEFAULT_LOCATION, id: "location_002", name: "His place", type: "🏠 His House", createdAt: "2026-07-01T09:00:00.000Z", isArchived: false },
  { ...DEFAULT_LOCATION, id: "location_003", name: "Sauna", type: "🛀 Sauna", createdAt: "2026-07-01T09:00:00.000Z", isArchived: false },
  { ...DEFAULT_LOCATION, id: "location_004", name: "Public", type: "🌲 Public", createdAt: "2026-07-01T09:00:00.000Z", isArchived: false },
  { ...DEFAULT_LOCATION, id: "location_005", name: "Car", type: "My Car", createdAt: "2026-07-01T09:00:00.000Z", isArchived: false },
];

let locations = storage.load(STORAGE_KEY, seedLocations);

function persist() {
  storage.save(STORAGE_KEY, locations);
}

function computeNextLocationNumber(existing) {
  const numbers = existing.map((l) => {
    const match = /^location_(\d+)$/.exec(l.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}
let nextLocationNumber = computeNextLocationNumber(locations);

function generateLocationId() {
  const id = `location_${String(nextLocationNumber).padStart(3, "0")}`;
  nextLocationNumber += 1;
  return id;
}

export const LocationsRepository = {
  // CHANGED 18 Aug 2026 — same defensive-merge fix as every other
  // repository this session.
  getAll() {
    return structuredClone(locations.map((l) => ({ ...DEFAULT_LOCATION, ...l })));
  },

  getById(id) {
    const found = locations.find((l) => l.id === id);
    return found ? structuredClone({ ...DEFAULT_LOCATION, ...found }) : null;
  },

  getByName(name) {
    const found = locations.find((l) => l.name.toLowerCase() === name.toLowerCase());
    return found ? structuredClone({ ...DEFAULT_LOCATION, ...found }) : null;
  },

  create(data) {
    const newLocation = {
      ...DEFAULT_LOCATION,
      ...data,
      id: generateLocationId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    locations = [...locations, newLocation];
    persist();
    return newLocation;
  },

  findOrCreate(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = this.getByName(trimmed);
    if (existing) return existing;
    return this.create({ name: trimmed });
  },

  update(id, changes) {
    let updated = null;
    locations = locations.map((l) => {
      if (l.id !== id) return l;
      updated = { ...l, ...changes };
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

  replaceAll(newLocations) {
    locations = newLocations;
    nextLocationNumber = computeNextLocationNumber(locations);
    persist();
  },
};
