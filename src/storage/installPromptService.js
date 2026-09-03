// installPromptService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 3 Sep 2026: "any missing or unconsidered notification...
// UI" — a real gap: nothing nudged a plain-browser-tab user to
// install SHOS as a PWA, despite that materially improving
// notification reliability (an installed PWA's service worker stays
// registered/updated more reliably than a tab that's rarely
// revisited, and it's the natural stepping stone for someone who
// isn't ready to sideload the Android APK). Chrome/Edge/Android's
// real `beforeinstallprompt` event is the only way to trigger the
// native install flow — and critically, it can fire at ANY time after
// page load (the browser's own engagement heuristics decide when),
// including before a user ever opens Settings — so the listener has
// to be registered at true module-load time (imported once from
// main.jsx), not lazily inside whatever screen eventually wants to
// show a nudge, or the event is simply missed and gone.
//
// iOS has no equivalent API at all (Apple's own platform limitation —
// confirmed, not assumed) — that path is handled entirely by
// NotificationPermissionBanner's own iOS-specific copy in
// SHOS_Settings_Prototype.jsx instead, not here.
let deferredPrompt = null;
let listeners = [];

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((l) => l(e));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

// Registers a callback for when a real install prompt becomes
// available — calls back immediately if one was already captured
// before this was called (a component mounting after the event fired
// still gets it), and again for a fresh one later. Returns an
// unsubscribe function.
export function onInstallPromptAvailable(cb) {
  if (deferredPrompt) cb(deferredPrompt);
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

// Triggers the real, native browser install UI. Can only ever be
// called from a genuine user gesture (a click) — same real constraint
// as notification permission requests — the browser silently ignores
// it otherwise.
export async function triggerInstallPrompt() {
  if (!deferredPrompt) return null;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice;
}
