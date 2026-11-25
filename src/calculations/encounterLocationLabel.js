// encounterLocationLabel.js — 25 Nov 2026, owner's hotel-stay finding.
//
// An encounter can now carry TWO different kinds of "where":
//   * locationId -> a saved place from the Locations registry (permanent)
//   * temporaryLocation -> a one-off string on THIS encounter only (hotel)
//
// The owner explicitly does not want the hotel stay written as a permanent
// address on themselves or as a reusable saved place. So the label keeps the
// two visibly separate and masks only the temporary one in Anonymise mode:
// the registry name is the user's own vocabulary (or an anonymised contact
// label from the caller), while the hotel/room text is identifying detail
// typed ad hoc and gets no persistence outside the encounter.
export const ANONYMISED_LOCATION = "•••• hidden";

export function formatEncounterLocation({ savedName = "", temporary = "", anonymise = false } = {}) {
  const parts = [];
  if (savedName) parts.push(savedName);
  if (temporary) parts.push(anonymise ? ANONYMISED_LOCATION : temporary);
  return parts.join(" · ");
}
