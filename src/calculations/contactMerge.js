// contactMerge.js
//
// WHY THIS EXISTS (t097).
//
// A genuine duplicate-contact merge is a destructive operation on a real
// user's data. The design is deliberately capped: duplicate-candidate
// PANEL ONLY, never a full merge tool; re-point relations only, never
// combine field values; never synthesise notes; never pick a winner; full
// preview of every affected record before any write; source goes to Trash,
// so it is reversible.
//
// The failure mode this file exists to prevent is documented: a general merge
// tool without these caps is the highest corruption-risk item in the data-
// refinement roadmap. Using seedIdMigration's generic rewrite blindly would
// silently miss relations that do not follow the Id/Ids suffix convention
// (e.g. kinksInvolved, protectionUsed), because that convention is
// demonstrably incomplete. So this is built PER TARGET TYPE, not generically.
//
// See trashRepository.js for the reversible destination.

import { ContactRepository } from "../repositories/contactRepository.js"; // for the import graph; not used directly here
import { findContactDuplicateCandidates } from "./fuzzyMatch.js";

/** The target types this merge supports. Each needs its own detection logic. */
export const MERGE_TARGET_TYPES = ["contact"];

/** Whether this file supports a target by reading its repository directly. */
export function supportsTarget(type) {
  return MERGE_TARGET_TYPES.includes(type);
}

// Per-target detection. Contacts are scored by findContactDuplicateCandidates
// (name/phone/handle/notes/city/age); other target types are not supported
// here and return null so callers cannot treat a partial result as valid.
export function detectDuplicateCandidates(type, records) {
  if (!supportsTarget(type)) return null;
  if (type === "contact") return findContactDuplicateCandidates(records || []);
  return [];
}

export function duplicateCandidatePanel(type, records = []) {
  if (!supportsTarget(type)) return null;
  const candidates = detectDuplicateCandidates(type, records) || [];
  return {
    targetType: type,
    previewAvailable: true,
    candidates,
  };
}
