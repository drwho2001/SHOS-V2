// Anonymise mode — the one place that decides what a person's name looks like.
//
// WHY THIS FILE EXISTS (28 Sep 2026 security review):
//
// Anonymise mode is documented as the thing you turn on right before handing
// your phone to someone — see privacySettingsRepository.js's own comment, "just
// allows if someone hands phone over" — and the Privacy screen says "Anonymise
// mode is ON" with no caveat. But the masking was implemented per-screen, and
// only two of the nine screens that render a contact's name consulted the flag
// at all. Real names still appeared in Global Search, Partner Notification,
// Episodes, My Profile, the Contacts duplicate checker and the Encounters edit
// sheet. The worst case was Global Search: the real name went into the search
// INDEX, so someone was findable by name while masking was on — which defeats
// the feature rather than merely leaking on one screen.
//
// The fix is to stop scattering the decision. Every screen asks this module, so
// a new screen physically cannot forget to check, and the placeholder string
// is defined once instead of being re-declared in each file — which is what let
// the two existing copies drift apart in the first place (Encounters had its
// own, with a comment explaining it could not import Contacts' because it was
// never exported).
//
// SCOPE, deliberately, is user-facing DISPLAY only. Per the owner's steer this
// is about what appears on screen, not about changing storage, exports or the
// underlying records. `contactName` and friends below are display helpers;
// nothing here mutates a contact or changes what is stored.
//
// One thing this does NOT cover, and which the Privacy screen now states
// plainly: exported files. The PDF, CSV, record export and backup paths do not
// consult anonymise mode at all (verified: zero references in any of the four
// export services). Each export already has its own explicit, user-facing
// control — the Clinic Card's per-section visibility, the "what to include"
// picker — so changing export behaviour here would be overriding a control the
// user has already set deliberately. Saying so is the honest fix, and is what
// the Privacy screen now does.

import { useLoadedState } from "./loadedRepositoryState";
import { PrivacySettingsRepository, DEFAULT_PRIVACY_SETTINGS } from "../repositories/privacySettingsRepository";

/** The single placeholder every masked surface uses. */
export const ANONYMISED = "•••• hidden";

// Keep the coverage list, file inventory and user-facing copy in one place. The
// Privacy screen and Guide must not drift from the modules checked by the wiring
// test below.
export const ANONYMISE_MODE_SURFACE_MODULES = [
  { label: "Contacts", file: "SHOS_Contacts_Prototype.jsx" },
  { label: "Encounters", file: "SHOS_Encounters_Prototype.jsx" },
  { label: "Home", file: "SHOS_Home_Prototype.jsx" },
  { label: "Global Search", file: "SHOS_GlobalSearch_Prototype.jsx" },
  { label: "Symptom Log", file: "SHOS_SymptomLog_Prototype.jsx" },
  { label: "Episodes", file: "SHOS_Timeline_Prototype.jsx" },
  { label: "Partner Notification", file: "SHOS_PartnerNotification_Prototype.jsx" },
  { label: "My Profile", file: "SHOS_MyProfile_Prototype.jsx" },
  { label: "Clinic Card", file: "SHOS_ClinicCard_Prototype.jsx" },
];
const anonymiseSurfaceLabels = ANONYMISE_MODE_SURFACE_MODULES.map(({ label }) => label);
export const ANONYMISE_MODE_SURFACES = `${anonymiseSurfaceLabels.slice(0, -1).join(", ")}, and ${anonymiseSurfaceLabels[anonymiseSurfaceLabels.length - 1]}`;

/** Read the flag with the same pattern the two working screens already used. */
export function useAnonymiseMode() {
  const [privacy] = useLoadedState(
    () => PrivacySettingsRepository.getSettings(),
    [],
    DEFAULT_PRIVACY_SETTINGS
  );
  return privacy.anonymiseModeActive === true;
}

/**
 * How a contact's name should read, given the flag.
 *
 * Nickname is preferred over real name deliberately and matches the existing
 * behaviour in both screens that already masked: a nickname is something the
 * user chose to be called, so it is far less identifying than a legal name.
 *
 * @param {{name?: string, nickname?: string}} contact
 * @param {boolean} anonymise
 * @param {string} [fallback]
 */
export function contactName(contact, anonymise, fallback = "Unnamed contact") {
  if (anonymise) return ANONYMISED;
  return contact?.nickname || contact?.name || fallback;
}

/**
 * A secondary line of contact detail: age, and anything else about a person
 * that would identify them if handed over.
 *
 * Age is included deliberately — it was already shown on the contact card, and
 * an approximate age plus a first name is materially more identifying than
 * either alone. It is masked as a unit so a masked row never leaks a stray age
 * next to a placeholder name.
 */
export function contactDetail(contact, anonymise) {
  if (anonymise) return ANONYMISED;
  const age = typeof contact?.age === "number" && contact.age > 0
    ? `${contact.ageIsApprox ? "≈" : ""}${contact.age}`
    : null;
  return age;
}

/**
 * What goes into a search index for a contact.
 *
 * This is the half people forget, and it is the half that mattered: masking a
 * name on screen while leaving it in the index means a search still returns
 * that contact when you type the real name, which is the result the user was
 * trying to prevent. When masking, a contact is findable only by browsing —
 * the same rule the app already applies to sensitive pregnancy entries, which
 * is why this reads the way it does.
 *
 * Anonymise mode is also short-lived (you turn it on to hand the phone over,
 * then off again), so a contact becoming unfindable while it is on is exactly
 * the intended trade.
 */
export function contactSearchText(contact, anonymise) {
  if (anonymise) return "";
  return [contact?.name, contact?.nickname].filter(Boolean).join(" ");
}

/**
 * Mask a list of attendee names for display. Returns the placeholder alone when
 * masking rather than a joined list, so the number of attendees — itself a
 * disclosure about how active someone is — is not shown either.
 */
export function attendeeNames(names, anonymise) {
  if (anonymise) return ANONYMISED;
  const list = (names || []).filter(Boolean);
  return list.length ? list.join(", ") : "—";
}
