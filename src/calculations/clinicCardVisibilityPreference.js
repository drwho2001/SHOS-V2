// clinicCardVisibilityPreference.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "allow customising of fields... settings to filter which
// things are shown. We'll give the most details permitted, and
// filters restrict from this." Every section defaults to visible
// (the "most detail permitted" default) — this preference only ever
// narrows what's shown, it never adds anything beyond what the real
// underlying data already provides. Same shared-hook, single-storage-
// key pattern as darkModePreference.js, so the choice persists across
// sessions rather than resetting every time Clinic Card is opened.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";
import { useLoadedState } from "./loadedRepositoryState.js";

const STORAGE_KEY = "shos_clinic_card_visibility";

// Every real section Clinic Card can show, matching its own actual
// section headers exactly — kept here as the one source of truth for
// both the settings screen and the render logic, so a future new
// section can't accidentally forget to be wired into one but not the
// other.
// CHANGED 6 Oct 2026 - the order now follows a clinic VISIT rather than an
// arbitrary one, so the thing you are asked for at reception is at the top
// instead of hunted for. This array is the ONE source of truth for both the
// render order and the visibility toggles, so a reorder moves both together and
// they cannot disagree.
//
// THE OWNER'S CORRECTION matters more than the ordering itself. Asked for
// "contacts at reception", they meant their OWN details - emergency contact, NHS
// number, clinic number, address, date of birth. But the "Recent contacts"
// section is their SEXUAL PARTNERS, which belongs later, in the consult. What
// reception actually needs is exactly what `identity` already holds, so no new
// field was needed for any of this; it is a position change and nothing else.
//
// A widget was deliberately NOT reordered this way: a widget is glanced at, not
// stepped through, so a sequential order helps only mid-visit. The widget carries
// a small stage-independent set instead.
//
// =========================== RECEPTION / ARRIVAL ===========================
export const CLINIC_CARD_SECTIONS = [
  { key: "identity", label: "Identity" },
  // Asked on the update-details form.
  { key: "medications", label: "Current medications" },
  { key: "allergies", label: "Allergies" },
  // ADDED 2 Sep 2026 — real ask: contraception/pregnancy/menstruation
  // context on the shareable clinic summary. Only ever offered as a
  // toggle when the user has menstrual tracking on at all (see
  // SHOS_ClinicCard_Prototype.jsx) — this key exists here regardless
  // so a later re-enable doesn't lose whatever they'd set it to.
  { key: "menstrualContraception", label: "Menstrual & contraception" },

  // ============================ INTO THE CONSULT ============================
  // What you recall, or are asked about, once you are in the room. Recent
  // contacts leads this group rather than sitting at reception - see the
  // correction above.
  //
  // ADDED 16 Sep 2026 — real ask: a separate "recent contacts" section
  // — links to a Contact's own profile, not the Encounter record the
  // section below also covers.
  { key: "recentContacts", label: "Recent contacts" },
  { key: "encounters", label: "Recent encounters" },
  { key: "testing", label: "Recent STI testing" },
  { key: "vaccinations", label: "Vaccinations" },
  { key: "treatment", label: "Current treatment" },
  { key: "symptoms", label: "Active symptoms" },

  // ============================== END OF VISIT ===============================
  // Deliberately last. It is arguably the most context-independent item on the
  // card — nothing about it depends on where you are in the visit — but the
  // owner's sequence put it at the end and it is one line to move if that
  // changes. Worth being clear that this was NOT omitted for being hard: it
  // already renders from MyProfileRepository, so placing it is only a position
  // change and no more work than any other entry here.
  { key: "emergency", label: "Emergency information" },
];

const DEFAULT_VISIBILITY = Object.fromEntries(CLINIC_CARD_SECTIONS.map((s) => [s.key, true]));

// ADDED 28 Sep 2026 — a SEPARATE opt-in for putting recent contacts into the
// exported PDF, deliberately not the same toggle as the on-screen section.
//
// Why it has to be separate: the Clinic Card on screen is private - it is on
// your own unlocked phone. The exported PDF is not. It gets shared, printed,
// emailed to a clinic and left on a desk. A person can reasonably want to see
// "who I've recently met" while using the app and still not want a list of those
// people's names printed on paper they hand to a third party. Tying the two
// together forces that choice onto them.
//
// Why opt-in rather than opt-out: the section is a list of the names of everyone
// the user has had sex with. The safest default for a shared artefact is to
// leave it out unless someone deliberately asks for it.
//
// Content is deliberately MINIMAL when it is on: name plus age (marked
// approximate where the user's own record says so). No contact methods, no
// location, nothing else the contact record holds - a clinician does not need
// any of it, and every extra field is something that could be read off a page
// left lying around.
export const EXPORT_INCLUDE_RECENT_CONTACTS_KEY = "exportIncludeRecentContacts";

export async function getClinicCardVisibility() {
  return { ...DEFAULT_VISIBILITY, ...(await storage.load(STORAGE_KEY, {})) };
}

/** Read the export opt-in on its own, so the export path never has to reason
 *  about the on-screen toggles at all. */
export async function getExportIncludeRecentContacts() {
  const stored = await storage.load(STORAGE_KEY, {});
  return stored?.[EXPORT_INCLUDE_RECENT_CONTACTS_KEY] === true;
}

/** Set the export opt-in, preserving every other stored key. */
export async function setExportIncludeRecentContacts(value) {
  const current = (await storage.load(STORAGE_KEY, {})) || {};
  await storage.save(STORAGE_KEY, { ...current, [EXPORT_INCLUDE_RECENT_CONTACTS_KEY]: value === true });
}

export async function setClinicCardVisibility(value) {
  await storage.save(STORAGE_KEY, { ...DEFAULT_VISIBILITY, ...(value || {}) });
}

export function useClinicCardVisibility() {
  // CHANGED 4 Sep 2026 — was a bespoke mount-time useEffect (the first
  // proof of this fix); now uses the shared useLoadedState hook
  // (loadedRepositoryState.js) that generalizes the same pattern for
  // the ~100 other real call sites the audit found with this same
  // structural conflict. Same behavior: starts from DEFAULT_VISIBILITY
  // for the one render before the real value loads.
  // CHANGED — Phase 3 prep (8 Sep 2026): this loader spread
  // storage.load()'s return value directly (`...storage.load(...)`)
  // in a non-async function — a real latent bug for when
  // storageAdapter.js itself goes async, since spreading a Promise
  // gives you nothing (no enumerable own properties), silently
  // discarding every saved visibility choice on every load. Harmless
  // today only because storage.load() is still fully synchronous.
  const [visibility, setVisibilityState] = useLoadedState(
    async () => ({ ...DEFAULT_VISIBILITY, ...(await storage.load(STORAGE_KEY, {})) }),
    [],
    DEFAULT_VISIBILITY
  );
  const setVisibility = (updater) => {
    setVisibilityState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      storage.save(STORAGE_KEY, next);
      return next;
    });
  };
  const toggleSection = (key) => setVisibility((v) => ({ ...v, [key]: !v[key] }));
  return [visibility, setVisibility, toggleSection];
}

/**
 * The PDF export opt-in, as a pair of hooks matching the shape above.
 *
 * Kept separate from `useClinicCardVisibility` on purpose rather than as
 * convenience: the two answer different questions, and a caller that needs
 * "will the export include contacts" must be unable to read it off the
 * on-screen section map by accident. Same storage key, so a saved toggle
 * cannot be lost by writing one and clobbering the other — see
 * `setExportIncludeRecentContacts`, which merges rather than replaces.
 */
export function useExportIncludeRecentContacts() {
  const [value, setValue] = useLoadedState(() => getExportIncludeRecentContacts(), [], false);
  const toggle = (next) => {
    setValue(next);
    setExportIncludeRecentContacts(next);
  };
  return [value === true, toggle];
}

export function useToggleExportIncludeRecentContacts() {
  return useExportIncludeRecentContacts()[1];
}
