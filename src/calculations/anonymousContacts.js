// anonymousContacts.js — one owner for the "add anonymous people quickly"
// rule used from an encounter/session. For group/public/sauna/cruising
// encounters the user often only needs a name to attach an act to; a full
// contact form (name/age/city/role/position) is the wrong tool.
//
// Reuses the two EXISTING flags rather than inventing a third state:
//   - markedComplete: suppresses the "Incomplete" required-field warnings
//   - excludeFromActiveTracking: a deliberate one-off is never "inactive"
// Both are already in DEFAULT_CONTACT and already mean exactly this (see
// their comments in contactRepository.js and the seed "Anonymous — sauna").
// These are self-contained facts, not derived state, so a pure builder is
// the right seam: it is testable without a repository or React.
import { DEFAULT_CONTACT } from "../repositories/contactRepository.js";

/** Default base name for an auto-named anonymous contact. */
export const ANONYMOUS_BASE_NAME = "Anonymous";

/** Clamp a requested count to a sane one-tap range (1..20). */
export function clampAnonymousCount(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(20, Math.trunc(value)));
}

/**
 * Build the record data for N anonymous contacts. Names are stochastic-free
 * and deterministic ("Anonymous", "Anonymous 2", ...) so they are stable and
 * easy to find in a picker. The first is unsuffixed to read naturally.
 */
export function buildAnonymousContacts(count = 1) {
  const n = clampAnonymousCount(count);
  return Array.from({ length: n }, (_, i) => ({
    ...DEFAULT_CONTACT,
    name: i === 0 ? ANONYMOUS_BASE_NAME : `${ANONYMOUS_BASE_NAME} ${i + 1}`,
    markedComplete: true,
    excludeFromActiveTracking: true,
  }));
}
