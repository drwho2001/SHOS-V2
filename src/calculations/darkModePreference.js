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
// own OS-level light/dark setting instead of always starting light.
// Real ask: "if phone default is dark mode, launch dark mode, vice
// versa — unless manually changed in settings, then remember this
// preference." storage.load() only falls back to its second argument
// when NOTHING has ever been saved under this key (localStorage.getItem
// returns null pre-first-toggle; an explicitly saved `false` is a real
// stored string, "false", which parses back to boolean false, not the
// fallback) — so the moment Settings' toggle is used once, that
// explicit choice is what loads on every future launch, system setting
// or not, exactly matching the ask. matchMedia is guarded since it
// doesn't exist in every environment (SSR, some embedded webviews).
//
// FIXED — real bug found in real device testing: every call site had
// its OWN independent useState, only ever read from storage once at
// THAT component's own mount time. Toggling the preference in Settings
// updated Settings' own copy and storage, but every other
// already-mounted screen kept whatever value it happened to read when
// IT mounted — genuinely stuck, not just slow to update. That's why it
// looked like "mixture of light and dark" and only Home ever refreshed
// (Home is the one screen that force-remounts on every nav tap). Now a
// real shared external store (useSyncExternalStore, built into React
// 18): one live value, one place it's written, every subscribed
// component re-renders the instant it changes — no per-screen
// staleness possible.
import { useSyncExternalStore } from "react";
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_dark_mode_preference";

function systemPrefersDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

let currentValue = storage.load(STORAGE_KEY, systemPrefersDark());
const listeners = new Set();

function setDarkModeValue(updater) {
  const next = typeof updater === "function" ? updater(currentValue) : updater;
  if (next === currentValue) return;
  currentValue = next;
  storage.save(STORAGE_KEY, next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDarkModePreference() {
  const darkMode = useSyncExternalStore(subscribe, () => currentValue);
  return [darkMode, setDarkModeValue];
}
