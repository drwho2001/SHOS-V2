// contactRepository.js
//
// CHANGES THIS ROUND (the user's feedback):
// - `city` is back as a real stored field, editable directly — the
//   previous "derive it from the address text" approach is dropped.
// - `contactableVia` is back to being a plain, manually-entered field —
//   the auto-derivation from Phone/Snapchat/Fabguys/Fabswingers is
//   dropped per the user's explicit steer ("skip autofill and allow user
//   input"). The `otherPlatforms` rename from last round is reverted.
// - `carDetails` added — only relevant, and only shown in the UI, when
//   `drives` is true. Still stored even if drives later gets toggled
//   off, so nothing typed in gets silently lost.
//
// City, Stated Kinks, Limits, and Contactable via all now use a
// "combobox" pattern in the UI (contactRepository.js doesn't know or
// care about that — it just stores whatever value ends up chosen or
// typed). See contactCalculations.js for how the suggestion lists for
// that combobox are built.
//
// PERSISTENCE, added this round: contacts now survive closing and
// reopening the app, via localStorageAdapter (see storageAdapter.js).
// This repository still doesn't know or care that it's specifically
// localStorage underneath — it only knows the load(key, fallback) /
// save(key, value) shape. Swapping in a different adapter later (e.g.
// an encrypted cloud backend) means editing storageAdapter.js, not this
// file. Kept synchronous on purpose — see the note further down on why
// this doesn't need to be async yet.

import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_contacts";


// ---------------------------------------------------------------------
// Known option sets for fields that stay fixed single/multi-select
// (unchanged from the live Notion values).
// ---------------------------------------------------------------------

// ⚠️ APP-ONLY DIVERGENCE FROM NOTION (the user's explicit call, 17 Aug 2026):
// Notion's live schema still has ONE "Hosting/Travel Options" select field
// with combined values ("Hosts", "Hosts sometimes", "Travels", etc). The
// app now splits this into three independent concepts — Hosts, Travels,
// and a general meet-up frequency. This is deliberately NOT reflected
// back into Notion's schema for now. Logged in the Notion working log,
// not the schema itself — see the AI Development page for the dated
// entry. If this ever gets ported back to Notion, this comment is the
// pointer to why the two don't match.
export const HOSTS_OPTIONS = ["Yes", "Sometimes", "No"];
export const TRAVELS_OPTIONS = ["Yes", "Sometimes", "No"];
// ADDED 18 Aug 2026 — the user's ask: capture HOW someone travels, not just
// whether they do. Multi-select, since someone might use different
// modes depending on the day (car sometimes, public transport other
// times) — a single-select would force an artificial either/or choice.
// Only shown/meaningful when travels isn't explicitly "No" (same
// "only relevant when its parent condition allows it" pattern already
// used for carDetails/foreskinDetail).
export const TRAVEL_MODE_OPTIONS = ["Public transport", "Car", "Cycle", "Walk", "Taxi"];
// ⚠️ APP-ONLY CORRECTION (17 Aug 2026, the user): Notion's live "Availability"
// multi_select actually contains both "Night" and "Nights" as separate
// options — an inconsistent-pluralization duplicate, not a deliberate
// distinction. Fixed here (kept "Nights", to match the plural pattern
// used by Weekends/Weekdays/Days/Mornings) but NOT changed in Notion's
// schema — same app-only-divergence pattern as the Hosting/Travel split
// above. Note: "Afternoon" is still singular where the others are
// plural — left as-is since the user only flagged Night/Nights specifically;
// worth a follow-up question if it's meant to be "Afternoons".
export const AVAILABILITY_OPTIONS = ["Flexible", "Weekends", "Weekdays", "Nights", "Days", "Mornings", "Afternoon", "Visitor / N/A"];
export const READILY_AVAILABLE_OPTIONS = ["Readily available", "Inaccessible", "Unavailable foreseeably"];
// REMOVED 26 Aug 2026 — real ask: Relationship type is now user-
// editable via CustomOptionListsRepository ("relationshipType" key,
// see customOptionListsRepository.js), replacing this fixed array.
// Same option strings preserved there, so existing contacts' stored
// values are unaffected.
export const MEET_AGAIN_OPTIONS = ["Yes", "Tentatively", "No"];
export const LENGTH_OPTIONS = ["Short", "Average", "Long"];
// CHANGED 18 Aug 2026 — renamed Thickness → Girth (the user's ask: name
// should say what it measures). Values unchanged.
export const GIRTH_OPTIONS = ["Skinny", "Average", "Thick"];
// CHANGED 18 Aug 2026 — simplified to the top-level state only. The
// old flat list mixed circumcision status with foreskin FIT ("Loose",
// "Too tight") as if they were the same kind of thing. The user's ask:
// branch — pick circumcision status first, then (only if Uncircumcised)
// a separate fit detail. See FORESKIN_DETAIL_OPTIONS below.
export const FORESKIN_OPTIONS = ["Circumcised", "Uncircumcised", "Unknown / N/A"];
// ADDED 18 Aug 2026 — only meaningful, and only shown in the UI, when
// foreskin === "Uncircumcised" — same "only relevant/shown when its
// parent condition is true" pattern already used for carDetails (only
// shown when drives is true).
export const FORESKIN_DETAIL_OPTIONS = ["Average", "Baggy", "Tight", "Unretractable"];
export const CHASTITY_OPTIONS = ["N/A", "Uncaged", "Caged"];
// ADDED 18 Aug 2026 — Cummer's flat 8-option list is now grouped into
// three sub-lists purely for DISPLAY (frequency/volume/style) — the
// stored shape is unchanged, still one flat array on the contact/
// profile record. Each group renders as its own small MultiSelectChips
// sharing the same value/onChange, so toggling any option in any group
// correctly adds/removes just that one value from the shared array —
// no new component or data shape needed for this.
// CHANGED 19 Aug 2026 — real gap from the ~90-item StackBlitz batch:
// "Multiple loads" is about HOW OFTEN he cums in one session, not how
// much — moved from Volume to Frequency. Small/Average added to Volume,
// which previously only had "Big load" (no way to record anything less).
export const CUMMER_FREQUENCY_OPTIONS = ["Doesn't", "Premature", "Takes ages", "Only once", "Multiple loads"];
export const CUMMER_VOLUME_OPTIONS = ["Small", "Average", "Big load"];
export const CUMMER_STYLE_OPTIONS = ["Squirter", "Dribbler"];
export const CUMMER_OPTIONS = ["Doesn't", "Premature", "Takes ages", "Only once", "Multiple loads", "Small", "Average", "Big load", "Squirter", "Dribbler"];

// New this round: known PrEP/DoxyPEP status, and the day/time rule
// builder for non-availability (and its inverse, availability) windows.
export const PREP_DOXY_OPTIONS = ["PrEP", "DoxyPEP"];
export const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const TIME_CONSTRAINT_TYPES = ["All day", "Before", "After"];
export const AVAILABILITY_RULE_TYPES = ["Unavailable", "Available"];

// ⚠️ APP-ONLY ADDITION (17 Aug 2026, the user): confirmed via a fresh Notion
// fetch that no equivalent field exists in the live Contacts schema —
// this genuinely isn't there yet, not something missed. Logged here per
// the same pattern as the Hosting/Travel split; revisit adding to Notion
// if it turns out to earn its place long-term.
// CHANGED 18 Aug 2026 — reordered per the user's ask (Dom→Switch→Sub, their
// own stated "descending dominance" ordering), Vanilla added as a new
// option — not everyone tracked here has a kink/power-exchange dynamic
// at all, and there wasn't a way to say that before.
// CHANGED 19 Aug 2026 — real ask: house style is "Dom" capitalized,
// "sub" lowercase, applied consistently. No other code checks this
// exact string (confirmed via project-wide grep before changing it),
// so this is a safe, isolated fix — nothing downstream depends on the
// old capitalization.
export const BDSM_ROLE_OPTIONS = ["Dom", "Switch", "sub", "Vanilla"];
// CHANGED 19 Aug 2026 — same house style fix as KINK_ROLE_OPTIONS —
// Top capitalized, bottom lowercase, matching Dom/sub. Vers/Oral only/
// Side/Kink are neither pole, stay as-is.
export const SEXUAL_POSITION_OPTIONS = ["Top", "Vers", "bottom", "Oral only", "Side", "Kink"];
// ADDED 18 Aug 2026 — new field, the user's ask: a simple personal rating,
// shown as its emoji on the card. Single-select (one rating per
// contact, not a tag list) — ordered best to worst, matching how the
// options read naturally. Emoji embedded directly in the option string
// (same pattern LOCATION_TYPE_OPTIONS already uses), so no separate
// emoji-lookup map is needed anywhere this gets displayed.
export const RATING_OPTIONS = ["😍 Love", "😊 Happy", "😐 Meh", "😕 Reticent", "😠 Angry"];

// ---------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------

// The single source of truth for "what does an empty contact look like".
// create() uses this, the seed data below uses it, and the UI's
// Add-contact form uses it too (imported from here, not re-typed) — one
// shape, not several that can drift apart.
export const DEFAULT_CONTACT = {
  name: "", nickname: "", pronouns: "",
  // ADDED — real ask: trans/hetero inclusivity, same field as My
  // Profile's own gender addition — see that repository's comment.
  gender: "",
  age: null, ageIsApprox: false,
  // ADDED 19 Aug 2026 — real gap from the Notion-vs-app audit. Stored
  // as a data URL (base64-encoded image), not a file path or upload
  // URL — there's no real backend/cloud storage in this app, so a data
  // URL is the only way to keep a photo genuinely self-contained,
  // working the same in the browser preview and in a real deployed
  // build. Deliberate tradeoff, worth knowing: data URLs are larger
  // than the original file (~33% bigger) and every browser caps
  // localStorage around 5–10MB total across the WHOLE app, not just
  // this field — a handful of photos is fine, dozens of full-resolution
  // ones could genuinely fill it up. No compression/resizing built yet;
  // worth adding if this becomes a real problem, not before.
  profilePicture: "",
  phone: "", snapchat: "", fabguys: "", fabswingers: "", recon: "", contactableVia: [],
  city: "", address: "",
  hosts: "", travels: "", travelMode: [],
  availability: [], nonAvailabilityRules: [], readilyAvailable: "",
  // CHANGED 18 Aug 2026 — carRegistration added, split out from
  // carDetails: registration is a distinct, more sensitive piece of
  // information (identifies a specific vehicle/person) than a general
  // description like "Blue Ford Focus" — the user's ask was to keep them
  // separate rather than one freeform field mixing both.
  drives: false, carDetails: "", carRegistration: "",
  relationshipType: [], howDidWeMeet: [], meetAgain: "", dontMeetAgainReason: "",
  // CHANGED 18 Aug 2026 — statedKinks/limits/knownChems now hold
  // REGISTRY IDs (kink_NNN, chem_NNN), not free text. Kink Registry and
  // Chems Registry are real, built modules as of this session — see
  // kinkRegistry.js/chemsRegistry.js. Resolve an id to its display name
  // via KinkRegistry.getById(id).name / ChemsRegistry.getById(id).name
  // (the UI does this, this file just stores the facts). Genuinely
  // migrates existing prototype data cleanly: seed data below never
  // populated these with real values, so there's nothing to convert.
  statedKinks: [], limits: [],
  knownChems: [],
  bdsmRole: [], sexualPosition: [],
  // ADDED 18 Aug 2026 — foreskinDetail: only meaningful when foreskin
  // is "Uncircumcised" (see FORESKIN_DETAIL_OPTIONS above).
  length: "", thickness: "", foreskin: "", foreskinDetail: "", chastityStatus: "N/A", cummer: [],
  // ADDED — real ask: contraception, gated to Female/Trans-male gender
  // in the UI (see SHOS_Contacts_Prototype.jsx's own comment on the
  // gating condition). Free text with suggestions, same
  // CustomOptionListsRepository pattern as gender above.
  contraception: "",
  knownPrepDoxy: [], lastTestedDate: "",
  notes: "",
  linkedContactIds: [],
  linkedContactLabels: {},
  // ADDED 18 Aug 2026 — personal rating, see RATING_OPTIONS above.
  rating: "",
  // ADDED 19 Aug 2026 — real ask: manual override for the active/
  // inactive flag. The user's own example: a genuine one-off/anonymous
  // encounter that will never recur isn't "inactive" in any meaningful
  // sense — that flag exists to prompt "has it really been this
  // long?", which is the wrong question for something deliberately
  // one-time. When true, this Contact is excluded from the inactive
  // calculation entirely, regardless of the configurable threshold
  // below.
  excludeFromActiveTracking: false,
  // ADDED 26 Aug 2026 — real ask: manual override for the new
  // required-fields "Incomplete" tag — handles legacy/placeholder
  // contacts (e.g. anonymous entries you'll never meet again) that
  // will genuinely never have age/city/role filled in, without
  // nagging forever. Same override pattern as
  // excludeFromActiveTracking above.
  markedComplete: false,
  // ADDED 26 Aug 2026 — real ask: favourite contacts sort to the top,
  // regardless of the active sort mode. Named favourited (not
  // "pinned") to match the actual star icon used in the UI.
  favourited: false,
};

// ---------------------------------------------------------------------
// Seed data — each entry spreads DEFAULT_CONTACT and only overrides
// what's actually different, rather than repeating the full field list
// four times (the exact duplication risk flagged earlier this session).
// ---------------------------------------------------------------------

let seedContacts = [
  {
    ...DEFAULT_CONTACT,
    id: "contact_001",
    name: "Alex",
    notes: "Met through mutual friends.",
    createdAt: "2026-07-01T09:00:00.000Z",
    isArchived: false,
  },
  {
    ...DEFAULT_CONTACT,
    id: "contact_002",
    name: "Jordan",
    snapchat: "jordan_snap",
    contactableVia: ["Snapchat"],
    city: "Leeds",
    drives: true,
    carDetails: "Blue Ford Focus",
    createdAt: "2026-07-15T09:00:00.000Z",
    isArchived: false,
  },
  {
    ...DEFAULT_CONTACT,
    id: "contact_003",
    name: "Sam",
    phone: "07700 900123",
    contactableVia: ["Phone/WhatsApp"],
    city: "Manchester",
    notes: "Prefers texting only.",
    createdAt: "2026-08-01T09:00:00.000Z",
    isArchived: false,
  },
  {
    ...DEFAULT_CONTACT,
    id: "contact_004",
    name: "Riley",
    createdAt: "2026-06-01T09:00:00.000Z",
    isArchived: true,
  },
];

// Real startup: load whatever's actually been saved before. On a
// genuinely first run (nothing in storage yet), fall back to the seed
// data above so the app isn't empty on day one.
let contacts = storage.load(STORAGE_KEY, seedContacts);

// Every mutating method below calls this after changing `contacts` —
// keeping "change the in-memory array" and "persist it" as two
// explicit, adjacent steps rather than hiding the save inside a proxy
// or a setter, so it's obvious from reading any method that it saves.
function persist() {
  storage.save(STORAGE_KEY, contacts);
}

// Derived from the actual IDs present, not from contacts.length — so a
// mixed-up array (e.g. after a manual edit or a future import) can't
// produce a duplicate ID. This was the one real weak point in the
// original array-length approach; scanning existing IDs closes it
// without needing to give up human-readable IDs for random UUIDs.
function computeNextContactNumber(existingContacts) {
  const numbers = existingContacts.map((c) => {
    const match = /^contact_(\d+)$/.exec(c.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}
let nextContactNumber = computeNextContactNumber(contacts);

function generateContactId() {
  const id = `contact_${String(nextContactNumber).padStart(3, "0")}`;
  nextContactNumber += 1;
  return id;
}

// ---------------------------------------------------------------------
// The repository itself.
//
// getAll()/getById() return deep copies (via structuredClone), not the
// live stored objects — so nothing outside this file can accidentally
// mutate a contact's data without going through update()/create(), which
// are the only places that actually change what's stored.
// ---------------------------------------------------------------------

// ADDED 18 Aug 2026 — statedKinks changed shape: was a flat array of
// Kink Registry IDs (["kink_004"]), is now an array of selections
// ({kinkId, role}) so a role (Top/Bottom/Vers) can optionally attach to
// each one — the user's real ask: whether someone's a fisting top or bottom
// changes his own future-meet intentions, so it needs tracking, but
// only some kinks need it and it's optional even for those. This helper
// is the migration: a contact saved before this change stored plain
// strings; a contact saved after stores objects. Reading through this
// on every getAll()/getById() means BOTH shapes silently normalize to
// the current one every time, forever — no one-off migration script
// ever needs to run, and no old data becomes unreadable.
// CHANGED 18 Aug 2026 — limits now goes through this too. Originally
// left as a plain ID array on the reasoning that a role doesn't mean
// anything for something explicitly NOT wanted — the user's follow-up: he
// wants the same tracking on Limits as Kinks regardless (e.g. a limit
// can still be role-specific — "no fisting bottom" is a more precise
// limit than "no fisting" full stop). `knownChems` still stays a plain
// ID array — role genuinely doesn't apply to a chem the way it does to
// an act.
// ADDED 20 Aug 2026 — the 19 Aug "Bottom"→"bottom"/"Sub"→"sub" house-style
// rename (see BDSM_ROLE_OPTIONS/SEXUAL_POSITION_OPTIONS/KINK_ROLE_OPTIONS
// above) only changed the option list going forward — it didn't touch
// role values already saved under the old casing. Same self-healing
// pattern as normalizeKinkSelections below: fold legacy casing to
// current on every read, forever, rather than a one-off migration.
const LEGACY_ROLE_CASING = { Bottom: "bottom", Sub: "sub" };
function normalizeRoleCasing(role) {
  return role == null ? role : (LEGACY_ROLE_CASING[role] ?? role);
}

function normalizeKinkSelections(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((entry) => {
    if (typeof entry === "string") return { kinkId: entry, role: null };
    if (entry && typeof entry === "object" && entry.kinkId) {
      return { kinkId: entry.kinkId, role: normalizeRoleCasing(entry.role ?? null) };
    }
    return null;
  }).filter(Boolean);
}

export const ContactRepository = {
  // CHANGED 18 Aug 2026 — getAll()/getById() now merge each raw stored
  // record over DEFAULT_CONTACT before returning it, not just clone it
  // as-is. This is the fix for a real, confirmed gap the user raised: every
  // repository except MyProfileRepository was returning contacts exactly
  // as they were stored, with nothing filling in fields that didn't
  // exist yet when that record was created. Concretely: bdsmRole and
  // sexualPosition were added to this file after Contacts had already
  // been in real use — any contact record saved before that point would
  // load back with those fields simply MISSING, not empty-array, and
  // the edit sheet's `.includes()` calls on them would throw. This
  // wasn't hypothetical; it was a live latent bug waiting for exactly
  // this kind of addition. The fix: any field DEFAULT_CONTACT knows
  // about but a stored record predates now silently fills in as that
  // field's default the moment it's read, every time, forever forward —
  // adding a new field to DEFAULT_CONTACT is now automatically safe for
  // every contact saved by every earlier version of the app.
  // Also now runs statedKinks AND limits through normalizeKinkSelections()
  // (see above) so old flat-ID-array contacts and new role-aware
  // contacts both read back in the current shape.
  getAll() {
    return structuredClone(
      contacts.map((c) => {
        const merged = { ...DEFAULT_CONTACT, ...c };
        return {
          ...merged,
          statedKinks: normalizeKinkSelections(merged.statedKinks), limits: normalizeKinkSelections(merged.limits),
          bdsmRole: (merged.bdsmRole || []).map(normalizeRoleCasing), sexualPosition: (merged.sexualPosition || []).map(normalizeRoleCasing),
        };
      })
    );
  },

  getById(id) {
    const found = contacts.find((c) => c.id === id);
    if (!found) return null;
    const merged = { ...DEFAULT_CONTACT, ...found };
    return structuredClone({
      ...merged,
      statedKinks: normalizeKinkSelections(merged.statedKinks), limits: normalizeKinkSelections(merged.limits),
      bdsmRole: (merged.bdsmRole || []).map(normalizeRoleCasing), sexualPosition: (merged.sexualPosition || []).map(normalizeRoleCasing),
    });
  },

  create(data) {
    const newContact = {
      ...DEFAULT_CONTACT,
      ...data,
      id: generateContactId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    contacts = [...contacts, newContact];
    persist();
    return newContact;
  },

  update(id, changes) {
    let updatedContact = null;
    contacts = contacts.map((c) => {
      if (c.id !== id) return c;
      // ADDED 26 Aug 2026 — real ask: last-updated indicator, rolled
      // out consistently across every module. IMPORTANT: unlike every
      // other module, this is deliberately EXCLUDED from
      // hasUnbackedChanges()'s "activity" check in backupService.js —
      // per the user's own explicit clarification, editing a Contact's
      // profile isn't the same thing as a logged encounter, so it
      // shouldn't trigger the "you have unbacked-up changes" warning
      // the way a new Test or Activity genuinely should.
      updatedContact = { ...c, ...changes, updatedAt: new Date().toISOString() };
      return updatedContact;
    });
    persist();
    return updatedContact;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  // ADDED — real ask: "not just edit or archive contact but also
  // option to delete permanently" — the exact original wording this
  // whole feature traces back to. Same reasoning as every other
  // module's delete() this session: archive stays correct for
  // anything real, this is for a genuinely wrong/unwanted entry.
  delete(id) {
    contacts = contacts.filter((c) => c.id !== id);
    persist();
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  // ADDED 26 Aug 2026 — real ask: long-press multi-select on cards,
  // with bulk delete/archive. Same underlying logic as the single-
  // record methods above, just applied to several ids at once.
  bulkArchive(ids) {
    ids.forEach((id) => this.archive(id));
  },

  bulkDelete(ids) {
    contacts = contacts.filter((c) => !ids.includes(c.id));
    persist();
  },

  // ADDED 26 Aug 2026 — real ask: undo for delete, not just archive.
  // Reinserts the exact record as it was — same id, same createdAt —
  // unlike create() which always generates a fresh id. Only usable
  // within the real grace-period window the UI holds the deleted
  // record open for (see ContactsModule's own deletedRecent state);
  // once that window closes, the reference is dropped and this can't
  // be called anymore — there's no "undelete from nothing."
  restore(record) {
    if (contacts.some((c) => c.id === record.id)) return; // already present, no-op
    contacts = [...contacts, record];
    persist();
  },

  // Links two contacts together (e.g. a couple). Deliberately symmetric
  // — both contacts get the other's id added to their own
  // `linkedContactIds`, so opening EITHER profile shows the link, not
  // just the one that was edited. This is why it's a repository method
  // rather than the UI calling update() twice itself: keeping "a link is
  // a two-sided fact" as one atomic operation in one place.
  //
  // `label` (new, 18 Aug 2026) describes the relationship — "Dom/Sub",
  // "bf/gf", etc. Stored as ONE shared label, the same on both sides,
  // not a separate label per direction. Worth being upfront about the
  // trade-off: "Dom/Sub" is actually asymmetric (A is Dom OF B, not
  // just "a Dom/Sub pair") — a fully accurate model would let each side
  // hold its own role. This keeps it simple, matching how the user's own
  // examples read ("bf/gf" is one descriptive label, not two). Revisit
  // if per-side roles turn out to matter in practice.
  //
  // NOTE — Encounters<->Contacts two-way linking is NOT built here. That
  // needs the Encounters module to exist first (it doesn't yet, in the
  // app) — same dependency the user already identified when Contacts was
  // built before Encounters. This only covers Contact<->Contact.
  linkContacts(idA, idB, label = "") {
    if (idA === idB) return;
    const a = contacts.find((c) => c.id === idA);
    const b = contacts.find((c) => c.id === idB);
    if (!a || !b) return;
    if (!a.linkedContactIds.includes(idB)) this.update(idA, { linkedContactIds: [...a.linkedContactIds, idB] });
    if (!b.linkedContactIds.includes(idA)) this.update(idB, { linkedContactIds: [...b.linkedContactIds, idA] });
    if (label) {
      const freshA = contacts.find((c) => c.id === idA);
      const freshB = contacts.find((c) => c.id === idB);
      this.update(idA, { linkedContactLabels: { ...freshA.linkedContactLabels, [idB]: label } });
      this.update(idB, { linkedContactLabels: { ...freshB.linkedContactLabels, [idA]: label } });
    }
  },

  unlinkContacts(idA, idB) {
    const a = contacts.find((c) => c.id === idA);
    const b = contacts.find((c) => c.id === idB);
    if (a) {
      const { [idB]: _removed, ...restA } = a.linkedContactLabels;
      this.update(idA, { linkedContactIds: a.linkedContactIds.filter((id) => id !== idB), linkedContactLabels: restA });
    }
    if (b) {
      const { [idA]: _removed, ...restB } = b.linkedContactLabels;
      this.update(idB, { linkedContactIds: b.linkedContactIds.filter((id) => id !== idA), linkedContactLabels: restB });
    }
  },

  // Wholesale replace — used only by backup restore. Overwrites every
  // stored contact with whatever's in the backup file, recomputes the
  // ID counter from the restored data (so new contacts created after a
  // restore don't collide with restored IDs), and persists.
  replaceAll(newContacts) {
    contacts = newContacts;
    nextContactNumber = computeNextContactNumber(contacts);
    persist();
  },
};
