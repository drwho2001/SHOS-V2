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
import { useState, useEffect } from "react";
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_clinic_card_visibility";

// Every real section Clinic Card can show, matching its own actual
// section headers exactly — kept here as the one source of truth for
// both the settings screen and the render logic, so a future new
// section can't accidentally forget to be wired into one but not the
// other.
export const CLINIC_CARD_SECTIONS = [
  { key: "identity", label: "Identity" },
  { key: "medications", label: "Current medications" },
  { key: "allergies", label: "Allergies" },
  { key: "vaccinations", label: "Vaccinations" },
  { key: "testing", label: "Recent STI testing" },
  { key: "treatment", label: "Current treatment" },
  // ADDED 2 Sep 2026 — real ask: contraception/pregnancy/menstruation
  // context on the shareable clinic summary. Only ever offered as a
  // toggle when the user has menstrual tracking on at all (see
  // SHOS_ClinicCard_Prototype.jsx) — this key exists here regardless
  // so a later re-enable doesn't lose whatever they'd set it to.
  { key: "menstrualContraception", label: "Menstrual & contraception" },
  { key: "symptoms", label: "Active symptoms" },
  { key: "encounters", label: "Recent encounters" },
  { key: "emergency", label: "Emergency information" },
];

const DEFAULT_VISIBILITY = Object.fromEntries(CLINIC_CARD_SECTIONS.map((s) => [s.key, true]));

export function useClinicCardVisibility() {
  // CHANGED 4 Sep 2026 — real groundwork for encryption at rest (see
  // CLAUDE.md's Known Issues / the Notion Development log for the
  // full plan): storage.load() is slated to become async once real
  // encryption lands, and a useState lazy initializer can't await a
  // Promise. Moved the initial read into a mount-time effect instead,
  // so this hook no longer depends on storage.load() being
  // synchronous. Starts from DEFAULT_VISIBILITY (every section
  // visible — the "most detail permitted" default this file's own
  // header already documents) for the one render before the effect
  // resolves, the same kind of brief loading moment every other
  // screen already has, not a new one.
  const [visibility, setVisibilityState] = useState(DEFAULT_VISIBILITY);
  useEffect(() => {
    setVisibilityState({ ...DEFAULT_VISIBILITY, ...storage.load(STORAGE_KEY, {}) });
  }, []);
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
