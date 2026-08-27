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
// HONEST SCOPE LIMIT, stated plainly rather than left implicit: this
// is the PREFERENCE layer only — it makes "is dark mode on" a real,
// shared, persistent fact. It does NOT, by itself, make every module
// visually support dark mode. Medication already has a real `DARK`
// theme object built and reads this hook. Every other module is
// currently light-only — adopting this hook there would need a real
// `DARK` palette built for that module first, which is the bigger
// Appearance/theme refactor already flagged elsewhere in this project
// as its own piece of work, not something to improvise module-by-
// module under a token budget. Building this shared hook now means
// nothing needs migrating later — a module just starts calling it the
// day it gets a real dark palette.
import { useState } from "react";
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_dark_mode_preference";

export function useDarkModePreference() {
  const [darkMode, setDarkModeState] = useState(() => storage.load(STORAGE_KEY, false));
  const setDarkMode = (updater) => {
    setDarkModeState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      storage.save(STORAGE_KEY, next);
      return next;
    });
  };
  return [darkMode, setDarkMode];
}
