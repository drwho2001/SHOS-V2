// myProfileRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Stores the user's OWN shareable profile — the data behind "My Profile /
// Shareable Contact Card". This is NOT a Contact and is NOT stored in
// ContactRepository. It's a singleton (one record, not a list), and it
// deliberately only ever holds fields that are safe to share — there's
// no relationship-specific data (How did we meet, Meet again, Notes)
// to accidentally leak, because this shape never had those fields to
// begin with. That's a deliberate design choice, not an oversight: by
// keeping the profile's OWN storage shape restricted to "about me"
// fields, there's no filtering step at share-time that could be
// forgotten or get out of sync later — the shape itself is the
// guarantee.
//
// Field list resolved 18 Aug 2026 (Development page, Ideas/Future):
// body attributes ARE included; relationship-specific fields are NOT.
// Contact-handle fields (phone/Snapchat/Fabguys/Fabswingers) ARE
// included, same-day follow-up from the user: "if the platform is filled
// that will be the username/handle" — i.e. this repository holds
// The user's OWN handles for platforms he chooses to share, same shape as
// the equivalent Contact fields, just about a different person.
//
// Same repository pattern as everywhere else: getProfile()/update()
// return structuredClone copies, storage goes through the shared
// storageAdapter, not localStorage directly.

import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_my_profile";

// Single source of truth for "what does an empty profile look like" —
// mirrors the equivalent subset of DEFAULT_CONTACT field-for-field so
// the two shapes stay easy to eyeball against each other, but this is
// its OWN object, not imported from contactRepository.js. Deliberate:
// importing DEFAULT_CONTACT here would silently pull in every future
// relationship-specific field Contacts ever gains, defeating the whole
// point of this file being a restricted shape.
export const DEFAULT_PROFILE = {
  // Identity — becomes the created Contact's name/nickname on import.
  displayName: "",
  // ADDED 26 Aug 2026 — real ask: was genuinely missing entirely
  // before. Not needed on your own device (it's your own account),
  // but useful when this profile gets shared and imported as a new
  // Contact on someone else's SHOS — see profileShareService.js. Same
  // data-URL storage approach as Contact's own profilePicture field.
  profilePicture: "",
  nickname: "",
  pronouns: "",
  // ADDED — real ask: trans/hetero inclusivity. Free text with
  // suggestions (Male/Female/Trans man/Trans woman/Non-binary,
  // anything else typed in just works), same CustomOptionListsRepository
  // pattern already used everywhere else in this app — see
  // customOptionListsRepository.js's own comment on the "gender" list.
  gender: "",

  // Basics
  age: null,
  ageIsApprox: false,
  city: "",

  // Find me on — matches Contact's own fields field-for-field. The user's
  // 18 Aug clarification: a filled platform field IS the handle to
  // share (no separate "handle" vs "platform name" split).
  phone: "",
  snapchat: "",
  fabguys: "",
  fabswingers: "",
  recon: "",
  contactableVia: [],

  // Hosting / travel
  hosts: "",
  travels: "",
  travelMode: [],

  // Availability
  availability: [],
  nonAvailabilityRules: [],
  readilyAvailable: "",

  // Into / limits / chems
  statedKinks: [],
  limits: [],
  knownChems: [],
  bdsmRole: [],
  sexualPosition: [],

  // Physical
  length: "",
  thickness: "",
  foreskin: "",
  // ADDED 19 Aug 2026 — real inconsistency caught during a redundancy/
  // consistency pass: Contacts got the Uncircumcised sub-branch
  // (average/baggy/tight/unretractable) when it was built, My Profile
  // never did — an oversight, not a deliberate difference. Fixed for
  // parity.
  foreskinDetail: "",
  chastityStatus: "N/A",
  cummer: [],

  // Sexual health status — "the actual point of this page" per the
  // existing static Notion template. Manually curated by the user here,
  // same as the Notion template already was — this repository doesn't
  // pull live from Testing/Medication Log, and nothing about adding
  // this repository changes that; it's just where the manual entry
  // now lives instead of a Notion page.
  knownPrepDoxy: [],
  lastTestedDate: "",

  // Freeform "about me" note — distinct from a Contact's relationship
  // Notes field. This is the user's own about-me blurb, not a note about
  // someone else.
  aboutMeNotes: "",

  // ADDED 19 Aug 2026 — Allergies + Emergency information, for Clinic
  // Card (Doc 4 §10). Deliberately placed on THIS repository — same
  // "facts about the user himself" reasoning as knownPrepDoxy/
  // lastTestedDate above — rather than a brand-new storage singleton
  // just for two small fields (would be premature structure for a
  // single-user app, the same "scale discipline" judgment applied
  // throughout this project).
  //
  // CRITICAL, NOT the same as the rest of this file: everything else
  // in DEFAULT_PROFILE is deliberately shareable (that's this file's
  // whole purpose — see the header comment). These four fields are the
  // ONE exception — clinical/personal-safety information with real
  // downside if it ever leaked into a shared dating-profile blob and
  // zero benefit to a hookup partner seeing it, unlike PrEP/Doxy status
  // above (which the user explicitly confirmed IS shareable). See
  // profileShareService.js's mapShareToContactData() — these four are
  // DELIBERATELY absent from that function's explicit field list, not
  // a gap the next field-completeness audit should "fix". Flagged
  // there too, so both sides of this deliberate exception are visible.
  allergies: [],
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyNotes: "",

  // ADDED — real ask: Clinic Card identity fields (DOB, clinic number,
  // address, NHS number). The user's own explicit scope: needed on Clinic
  // Card definitively, NOT necessarily surfaced on My Profile's own
  // edit screen — so editing lives entirely within Clinic Card itself,
  // not here. Same non-shareable treatment as Allergies/Emergency info
  // above — real downside if this ever reached a hookup partner via a
  // shared profile, zero benefit to them. Also deliberately absent
  // from profileShareService.js's mapShareToContactData().
  dateOfBirth: "",
  clinicNumber: "",
  address: "",
  nhsNumber: "",

  updatedAt: null,
};

let profile = storage.load(STORAGE_KEY, { ...DEFAULT_PROFILE });

function persist() {
  storage.save(STORAGE_KEY, profile);
}

// ADDED 20 Aug 2026 — same fix as contactRepository.js/encounterRepository.js:
// the 19 Aug "Bottom"→"bottom"/"Sub"→"sub" house-style rename to
// BDSM_ROLE_OPTIONS only changed the option list going forward, not a
// profile's bdsmRole values already saved under the old casing.
const LEGACY_ROLE_CASING = { Bottom: "bottom", Sub: "sub" };
function normalizeRoleCasing(role) {
  return role == null ? role : (LEGACY_ROLE_CASING[role] ?? role);
}

export const MyProfileRepository = {
  // Singleton read — always returns a full shape (missing fields fall
  // back to DEFAULT_PROFILE), so callers never have to null-check.
  getProfile() {
    const merged = { ...DEFAULT_PROFILE, ...profile };
    return structuredClone({ ...merged, bdsmRole: (merged.bdsmRole || []).map(normalizeRoleCasing) });
  },

  update(changes) {
    profile = { ...DEFAULT_PROFILE, ...profile, ...changes, updatedAt: new Date().toISOString() };
    persist();
    return structuredClone(profile);
  },

  // Wholesale replace — used only by backup restore (if/when the
  // profile is added to backupService.js — not done yet, see note in
  // profileShareService.js on why it's being kept separate for now).
  replaceAll(newProfile) {
    profile = { ...DEFAULT_PROFILE, ...newProfile };
    persist();
  },
};
