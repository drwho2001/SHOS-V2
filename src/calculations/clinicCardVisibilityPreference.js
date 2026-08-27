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
import { useState } from "react";
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
  { key: "symptoms", label: "Active symptoms" },
  { key: "encounters", label: "Recent encounters" },
  { key: "emergency", label: "Emergency information" },
];

const DEFAULT_VISIBILITY = Object.fromEntries(CLINIC_CARD_SECTIONS.map((s) => [s.key, true]));

export function useClinicCardVisibility() {
  const [visibility, setVisibilityState] = useState(() => ({ ...DEFAULT_VISIBILITY, ...storage.load(STORAGE_KEY, {}) }));
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
