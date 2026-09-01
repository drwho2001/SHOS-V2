// profileShareService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Turns MyProfileRepository's data into a shareable JSON blob (a file,
// or text the user can paste/AirDrop/message), and turns a received blob
// back into a brand-new Contact on the receiving person's own SHOS.
//
// Deliberately reuses the exact shape of backupService.js's pattern —
// same schema-version stamping, same "parse defensively, throw a
// plain-language error" approach, same browser-facing export/import
// helpers — but is its OWN file with its OWN type tag, not folded into
// buildBackup()/restoreBackup(). Reasoning: a profile share is ONE
// curated, intentionally-shared record, not a full-dataset snapshot of
// everything the user has ever logged. Keeping it separate means a backup
// file and a profile-share file can never be confused for each other
// (parseProfileShare rejects anything that isn't specifically a
// profile share), and restoring a real backup can never accidentally
// also touch profile data via the wrong code path.
//
// NOT wired into backupService.js's buildBackup()/restoreBackup() —
// that's a genuine open question (should "restore my backup" also
// restore what MY shareable profile looked like at backup time?) that
// doesn't need answering to ship this feature. Flagging it here rather
// than guessing.

import { MyProfileRepository, DEFAULT_PROFILE } from "../repositories/myProfileRepository.js";
import { ContactRepository } from "../repositories/contactRepository.js";
import { TestingRepository } from "../repositories/testingRepository.js";
import { exportTextFile } from "./fileExportHelper.js";

const SCHEMA_VERSION = 1;
const SHARE_TYPE = "shos_profile_share";

// ADDED 26 Aug 2026 — real ask: last tested date is now auto-
// calculated from actual Test records, not a manually-typed profile
// field. Same logic as SHOS_MyProfile_Prototype.jsx's own version
// (duplicated per this app's self-contained-module convention, not
// imported cross-module).
function getAutoLastTestedDate() {
  const tests = TestingRepository.getAll().filter((t) => !t.isArchived && t.date && t.date.slice(0, 10) <= new Date().toISOString().slice(0, 10));
  const sorted = [...tests].sort((a, b) => new Date(b.date) - new Date(a.date));
  return sorted[0]?.date || null;
}

// Pure data assembly — no browser APIs, fully testable in Node.
//
// CHANGED 26 Aug 2026 — real privacy fix: this used to include
// EVERYTHING except updatedAt, meaning aboutMeNotes, allergies,
// emergencyContactName/Phone, emergencyNotes, dateOfBirth,
// clinicNumber, and nhsNumber were all sitting in the actual
// transmitted file/blob — the exclusion of those fields was only ever
// enforced later, on the RECEIVING side's mapping into a Contact
// (mapShareToContactData below). That meant the raw shared data
// itself already leaked clinic/medical/identity information before
// any receiving-side logic even ran. Now uses an explicit allowlist
// matching exactly what mapShareToContactData expects to receive —
// the sensitive fields never leave the device in the first place.
export function buildProfileShare(options = {}) {
  const { includeLastTestedDate = false } = options;
  const profile = MyProfileRepository.getProfile();
  const shareableData = {
    displayName: profile.displayName,
    nickname: profile.nickname,
    pronouns: profile.pronouns,
    recon: profile.recon,
    age: profile.age,
    ageIsApprox: profile.ageIsApprox,
    city: profile.city,
    phone: profile.phone,
    snapchat: profile.snapchat,
    fabguys: profile.fabguys,
    fabswingers: profile.fabswingers,
    contactableVia: profile.contactableVia,
    hosts: profile.hosts,
    travels: profile.travels,
    travelMode: profile.travelMode,
    availability: profile.availability,
    nonAvailabilityRules: profile.nonAvailabilityRules,
    readilyAvailable: profile.readilyAvailable,
    statedKinks: profile.statedKinks,
    limits: profile.limits,
    knownChems: profile.knownChems,
    bdsmRole: profile.bdsmRole,
    sexualPosition: profile.sexualPosition,
    length: profile.length,
    thickness: profile.thickness,
    foreskin: profile.foreskin,
    foreskinDetail: profile.foreskinDetail,
    chastityStatus: profile.chastityStatus,
    cummer: profile.cummer,
    knownPrepDoxy: profile.knownPrepDoxy,
    // CHANGED 26 Aug 2026 — real ask: made genuinely optional (off
    // unless explicitly requested), not automatically included every
    // time. Already was — and stays — a plain date string with no
    // link to any real Testing record; this only adds the opt-in
    // gate on top of that, doesn't change what the value itself is.
    // CHANGED 26 Aug 2026 — real ask: computed live from actual Test
    // records at share time (same logic as the profile screen's own
    // display), not read from a stored profile field — the user's own
    // clarification: this should be auto-calculated, not manually
    // maintained. Still just a raw date string here, same as before —
    // the underlying Test record itself is never referenced or
    // shared, only its date value.
    ...(includeLastTestedDate ? { lastTestedDate: getAutoLastTestedDate() } : {}),
    profilePicture: profile.profilePicture,
    // Deliberately NOT included, ever — no toggle, no option, not
    // just "excluded by default": aboutMeNotes, allergies,
    // emergencyContactName, emergencyContactPhone, emergencyNotes,
    // dateOfBirth, clinicNumber, address, nhsNumber, updatedAt —
    // highly sensitive personal/clinical-use data.
  };
  return {
    type: SHARE_TYPE,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: shareableData,
  };
}

// Parses and sanity-checks a received profile-share blob. Throws a
// plain-language error rather than importing garbage.
export function parseProfileShare(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("That doesn't look like a valid SHOS shared profile.");
  }
  if (!parsed || typeof parsed !== "object" || !parsed.data) {
    throw new Error("That doesn't look like a SHOS shared profile.");
  }
  if (parsed.type !== SHARE_TYPE) {
    // backupService.js files carry no `type` field at all but DO carry
    // a `data.contacts` array — that's the tell for "this is actually
    // a full backup, not a shared profile" even on older backup files
    // that predate this check.
    if (Array.isArray(parsed.data.contacts) || Array.isArray(parsed.data.medications)) {
      throw new Error("That file is a SHOS backup, not a shared profile — use Restore Backup instead.");
    }
    throw new Error("That doesn't look like a SHOS shared profile.");
  }
  if (typeof parsed.schemaVersion === "number" && parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error("This profile was shared from a newer version of SHOS than this app understands.");
  }
  return parsed;
}

// Maps a parsed profile share's data onto a Contact-shaped object.
// Deliberately does NOT touch ContactRepository directly here — kept
// as a pure mapping function so it can be tested without a repository
// side-effect, same separation backupService.js uses between
// buildBackup() (pure) and exportBackup() (browser side-effect).
export function mapShareToContactData(parsedShare) {
  const d = { ...DEFAULT_PROFILE, ...parsedShare.data };
  return {
    name: d.displayName || d.nickname || "Shared profile",
    nickname: d.nickname,
    // ADDED 26 Aug 2026 — real ask: the photo should travel with a
    // shared profile, even though you don't need one for yourself on
    // your own device — once it's imported as someone else's Contact,
    // it's genuinely useful the same way any Contact's photo is.
    profilePicture: d.profilePicture,
    // ADDED — real gap found while adding Pronouns: Recon (added
    // earlier this session) was never added to this whitelist either,
    // meaning it would have silently never reached a shared profile.
    // Both are exactly the kind of thing someone WOULD want to share
    // (unlike DOB/NHS number/emergency contact, deliberately excluded
    // below) — added here, not to the exclusion list.
    pronouns: d.pronouns,
    recon: d.recon,
    age: d.age,
    ageIsApprox: d.ageIsApprox,
    city: d.city,
    phone: d.phone,
    snapchat: d.snapchat,
    fabguys: d.fabguys,
    fabswingers: d.fabswingers,
    contactableVia: d.contactableVia,
    hosts: d.hosts,
    travels: d.travels, travelMode: d.travelMode,
    availability: d.availability,
    nonAvailabilityRules: d.nonAvailabilityRules,
    readilyAvailable: d.readilyAvailable,
    statedKinks: d.statedKinks,
    limits: d.limits,
    knownChems: d.knownChems,
    bdsmRole: d.bdsmRole,
    sexualPosition: d.sexualPosition,
    length: d.length,
    thickness: d.thickness,
    foreskin: d.foreskin, foreskinDetail: d.foreskinDetail,
    chastityStatus: d.chastityStatus,
    cummer: d.cummer,
    knownPrepDoxy: d.knownPrepDoxy,
    lastTestedDate: d.lastTestedDate,
    // CHANGED 26 Aug 2026 — real correction: was mapping the profile's
    // "about me" note straight into the shared Contact's Notes field.
    // The user's own clarification: profile notes are personal (clinic
    // use, etc.), same privacy tier as allergies/DOB/NHS number below
    // — never meant to leave the device. Deliberately NOT mapped now.
    notes: "",
    // Everything else (howDidWeMeet, meetAgain, dontMeetAgainReason,
    // relationshipType, linkedContactIds, etc.) is intentionally
    // omitted here — DEFAULT_CONTACT's own defaults fill those in via
    // ContactRepository.create(), exactly as if a human had left them
    // blank on a brand-new contact card.
    //
    // ADDED 19 Aug 2026 — also deliberately NOT mapped here:
    // allergies, emergencyContactName, emergencyContactPhone,
    // emergencyNotes, dateOfBirth, clinicNumber, address, nhsNumber.
    // These exist on DEFAULT_PROFILE (see myProfileRepository.js)
    // purely for Clinic Card — clinical/personal-safety/identity data
    // with real downside if it ever reached a hookup partner via a
    // shared profile, and zero benefit to them.
    // If a future field-completeness audit flags these as "missing"
    // from this mapping, that's this comment confirming it's a
    // deliberate exclusion, not the same silent-drop bug class caught
    // twice earlier this project (travelMode, foreskinDetail) — those
    // were fields that SHOULD have been shareable and got missed by
    // accident; these four should NOT be shareable, on purpose.
  };
}

// Creates a real new Contact from a parsed share. This is the one
// function with a repository side-effect in this file.
export function importProfileAsContact(parsedShare) {
  const contactData = mapShareToContactData(parsedShare);
  return ContactRepository.create(contactData);
}

// ---------------------------------------------------------------------
// Browser-facing helpers — same caveat as backupService.js: these
// touch Blob/document/FileReader, so they're confirmed logically
// correct via the pure functions above, but the actual "does a file
// download, does picking a file work" needs a real browser to confirm.
// ---------------------------------------------------------------------

// CHANGED 1 Sep 2026 — real ask: "My profile share button doesn't
// work." Same bug class fileExportHelper.js's own header already
// documents and fixed for backupService.js's exports: a plain
// <a download> blob click does nothing visible on Android's WebView
// (no built-in handler for a blob: download), so tapping Save as file
// silently produced no file and no error — this just never got wired
// to that fix when it was added. Now goes through the same real
// Filesystem-write + native Share sheet path, falling back to the
// original browser download wherever those plugins aren't present.
export async function exportProfileShare(options = {}) {
  const share = buildProfileShare(options);
  const json = JSON.stringify(share, null, 2);
  const dateStamp = new Date().toISOString().slice(0, 10);
  await exportTextFile(`shos-shared-profile-${dateStamp}.json`, json, "application/json");
}

// Takes a File object (from an <input type="file"> picker), reads it,
// imports it as a new Contact. onDone(newContact)/onError(err) let the
// calling UI show a result without this file needing to know React.
export function importProfileShareFromFile(file, onDone, onError) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseProfileShare(reader.result);
      const newContact = importProfileAsContact(parsed);
      onDone?.(newContact);
    } catch (err) {
      onError?.(err);
    }
  };
  reader.onerror = () => onError?.(new Error("Couldn't read that file."));
  reader.readAsText(file);
}

// Text-paste variant (no file picker) — useful since the mechanism
// brief called out "some form of exportable file/blob", and a pasted
// JSON blob (from a message/AirDrop-opened text) is a valid form of
// that without requiring a file picker flow on every platform.
export function importProfileShareFromText(jsonText, onDone, onError) {
  try {
    const parsed = parseProfileShare(jsonText);
    const newContact = importProfileAsContact(parsed);
    onDone?.(newContact);
    return newContact;
  } catch (err) {
    onError?.(err);
    return null;
  }
}
