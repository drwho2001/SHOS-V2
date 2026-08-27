// darkModePreference.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "global dark or light mode should track between screens."
// One shared storage key + one shared hook, so any module can read/
// write the SAME preference instead of each module inventing its own
// local, forgetful toggle (which is exactly what Medication used to
// do before this existed).
//
// UPDATED — every module now has a real DARK palette (previously only
// Medication did), and the first-run default now follows the phone's
// own OS-level light/dark setting
// instead of always starting light. Real ask: "if phone default is
// dark mode, launch dark mode, vice versa — unless manually changed
// in settings, then remember this preference." storage.load() only
// falls back to its second argument when NOTHING has ever been saved
// under this key (localStorage.getItem returns null pre-first-toggle;
// an explicitly saved `false` is a real stored string, "false", which
// parses back to boolean false, not the fallback) — so the moment
// Settings' toggle is used once, that explicit choice is what loads
// on every future launch, system setting or not, exactly matching the
// ask. matchMedia is guarded since it doesn't exist in every
// environment (SSR, some embedded webviews).
import { useState } from "react";
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_dark_mode_preference";

function systemPrefersDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function useDarkModePreference() {
  const [darkMode, setDarkModeState] = useState(() => storage.load(STORAGE_KEY, systemPrefersDark()));
  const setDarkMode = (updater) => {
    setDarkModeState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      storage.save(STORAGE_KEY, next);
      return next;
    });
  };
  return [darkMode, setDarkMode];
}
