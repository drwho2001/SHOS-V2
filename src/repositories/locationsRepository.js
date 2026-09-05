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
// rather than shipping an empty suggestion list on first use.
//
// CHANGED — real gap found in a full-app audit: `type` was never
// wired to any UI (see Settings' Locations screen for that fix), and
// once it was, these 5 seed entries' `type` just parroted their own
// `name` word-for-word ("Sauna" typed "Sauna", "Public" typed
// "Public"...) — accurate but pointless with only one of each. `type`
// earns its keep once there's more than one location of the same kind
// (two different named saunas, "his place" vs a second guy's place,
// both grouped under the same type) — left unset here so the field
// doesn't look like a redundant echo of the name on a fresh install.
let seedLocations = [
  { ...DEFAULT_LOCATION, id: "location_001", name: "Home", createdAt: "2026-07-01T09:00:00.000Z", isArchived: false },
  { ...DEFAULT_LOCATION, id: "location_002", name: "His place", createdAt: "2026-07-01T09:00:00.000Z", isArchived: false },
  { ...DEFAULT_LOCATION, id: "location_003", name: "Sauna", createdAt: "2026-07-01T09:00:00.000Z", isArchived: false },
  { ...DEFAULT_LOCATION, id: "location_004", name: "Public", createdAt: "2026-07-01T09:00:00.000Z", isArchived: false },
  { ...DEFAULT_LOCATION, id: "location_005", name: "Car", createdAt: "2026-07-01T09:00:00.000Z", isArchived: false },
];

// CHANGED — real groundwork for encryption at rest (see CLAUDE.md's
// Known Issues / the Notion Development log for the full plan). Same
// `ensureLoaded()`/memoized-`loadPromise` pattern as
// notificationHistoryRepository.js/resourcesRepository.js —
// `locations` starts `null`, every exported method awaits
// `ensureLoaded()` first. `nextLocationNumber` (derived from
// `locations`) moves inside `ensureLoaded()` too, computed the one
// time `locations` actually resolves, not before.
let locations = null;
let nextLocationNumber = null;
let loadPromise = null;
async function ensureLoaded() {
  if (locations === null) {
    if (!loadPromise) loadPromise = storage.load(STORAGE_KEY, seedLocations);
    locations = await loadPromise;
    nextLocationNumber = computeNextLocationNumber(locations);
  }
  return locations;
}

async function persist() {
  await storage.save(STORAGE_KEY, locations);
}

function computeNextLocationNumber(existing) {
  const numbers = existing.map((l) => {
    const match = /^location_(\d+)$/.exec(l.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateLocationId() {
  const id = `location_${String(nextLocationNumber).padStart(3, "0")}`;
  nextLocationNumber += 1;
  return id;
}

export const LocationsRepository = {
  // CHANGED 18 Aug 2026 — same defensive-merge fix as every other
  // repository this session.
  async getAll() {
    await ensureLoaded();
    return structuredClone(locations.map((l) => ({ ...DEFAULT_LOCATION, ...l })));
  },

  async getById(id) {
    await ensureLoaded();
    const found = locations.find((l) => l.id === id);
    return found ? structuredClone({ ...DEFAULT_LOCATION, ...found }) : null;
  },

  async getByName(name) {
    await ensureLoaded();
    const found = locations.find((l) => l.name.toLowerCase() === name.toLowerCase());
    return found ? structuredClone({ ...DEFAULT_LOCATION, ...found }) : null;
  },

  async create(data) {
    await ensureLoaded();
    const newLocation = {
      ...DEFAULT_LOCATION,
      ...data,
      id: generateLocationId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    locations = [...locations, newLocation];
    await persist();
    return newLocation;
  },

  async findOrCreate(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = await this.getByName(trimmed);
    if (existing) return existing;
    return this.create({ name: trimmed });
  },

  async update(id, changes) {
    await ensureLoaded();
    let updated = null;
    locations = locations.map((l) => {
      if (l.id !== id) return l;
      // ADDED — real ask, from a build audit: consistency with every
      // other repository's own updatedAt stamping (see episodeRepository.js/
      // logRepository.js's own comments on why this matters for
      // backupService.js's staleness check).
      updated = { ...l, ...changes, updatedAt: new Date().toISOString() };
      return updated;
    });
    await persist();
    return updated;
  },

  async archive(id) {
    return this.update(id, { isArchived: true });
  },

  async unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  // ADDED — real gap found via the new orphan-reference checker
  // (orphanReferenceCheck.js): Location has no delete() of its own
  // (archive-only), but `relatedContactId` still needs clearing when
  // the CONTACT it points at is hard-deleted elsewhere — same "only
  // clears the link" role as measurementRepository.js's own
  // unlinkClinicVisit()/unlinkTest(), called by contactRepository.js's
  // own delete(). CHANGED — contactRepository.js's own delete()/
  // bulkDelete() call this WITHOUT awaiting it (deliberately — they're
  // still fully synchronous themselves, part of this same 22-file hard
  // bucket, not yet converted) — safe as fire-and-forget since nothing
  // in those callers depends on this write's completion timing, same
  // reasoning already used for App.jsx's notification-history record().
  async unlinkContact(contactId) {
    await ensureLoaded();
    locations = locations.map((l) => (l.relatedContactId === contactId ? { ...l, relatedContactId: "" } : l));
    await persist();
  },

  async replaceAll(newLocations) {
    locations = newLocations;
    nextLocationNumber = computeNextLocationNumber(locations);
    await persist();
  },
};
