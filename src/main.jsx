import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
// ADDED 3 Sep 2026 — real ask: an install-to-home-screen nudge tied to
// notification reliability. Imported here (not lazily inside whatever
// screen eventually shows the nudge) purely for its module-level side
// effect — registering the beforeinstallprompt listener as early as
// possible, since that real event can fire at any point after load,
// entirely on the browser's own schedule, and is lost forever if
// nothing was listening yet when it did. See that file's own header.
import "./storage/installPromptService.js";
// ADDED — real ask: researched known Capacitor bugs. Imported here for
// the same reason as installPromptService.js above — primeEarlyNativeActionBuffer()
// inside this file runs as a module-level side effect, starting to
// listen for a notification action tap as early as this app's JS can
// possibly run, closing as much as this app's own code can of a real,
// still-open Capacitor gap where localNotificationActionPerformed can
// fire before React has mounted and registered its own listener — see
// that function's own comment in notificationService.js.
import "./storage/notificationService.js";

// CHANGED 1 Sep 2026 — real fix, found during a smoothness/efficiency
// review: index.html loaded Inter/JetBrains Mono from a render-blocking
// Google Fonts <link rel="stylesheet">, so on any slow, flaky, or
// blocked connection (a real risk on mobile — a subway, a captive
// wifi portal, a network that blocks Google's CDN) the ENTIRE app sat
// unpainted waiting on that one external request, reproduced directly:
// a simulated bad connection stalled first paint by 12+ seconds even
// though the app's own JS bundle finishes loading and executing in
// under 25ms. Doubly wrong for THIS app specifically, whose whole
// design is local-only/no-network-dependency — a health-tracking app
// phoning a third party for its own fonts before it can render
// anything, and never working fully offline, both cut against that.
// Self-hosted via @fontsource (same real font files, MIT-licensed
// npm packages, bundled through the normal build — same weights the
// Google Fonts URL requested, nothing added or dropped) — now just
// another JS-bundled asset with zero runtime network dependency.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";

// ADDED — critical fix: a real device report of the app white/dark-
// screening on both an update and a fresh install, with no way back in
// (force-close, reopen, same crash). Root cause: this app had NO error
// boundary anywhere — React unmounts the ENTIRE tree on any uncaught
// render error with nothing above it to catch it, so even a small bug
// anywhere in the tree blanks the whole screen with zero recovery path,
// which is exactly the reported symptom (native status bar still
// visible since that's outside React, WebView content area empty).
// This is the one, permanent fix for that whole CLASS of failure, not
// just today's specific bug — must be a class component (only class
// components support componentDidCatch/getDerivedStateFromError, no
// hook equivalent exists), and deliberately uses only inline styles
// and no app imports beyond React itself, so it can never itself fail
// to render even if the crash is import-level or storage-level.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught a render error:", error, info);
  }
  // Clears exactly the two newest, most likely-to-be-corrupt pieces of
  // app state (the "resume last tab" fields added this session) before
  // reloading — a real, targeted recovery step for the reported crash,
  // not just a blind reload that would hit the identical crash again if
  // the bad state persists in storage.
  handleResetAndReload = () => {
    try {
      const raw = window.localStorage.getItem("shos_app_preferences");
      if (raw) {
        const parsed = JSON.parse(raw);
        delete parsed.lastActiveTab;
        delete parsed.lastActiveAt;
        window.localStorage.setItem("shos_app_preferences", JSON.stringify(parsed));
      }
    } catch (e) {
      console.error("[ErrorBoundary] Couldn't clear navigation state:", e);
    }
    window.location.reload();
  };
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: "fixed", inset: 0, background: "#F0F0F3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "sans-serif", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1B1B1F", marginBottom: 10 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: "#5B5B62", marginBottom: 20, maxWidth: 320 }}>
            SHOS hit an error and couldn't display normally. Your data is safe — nothing here touches it. Tap below to reset navigation state and reload.
          </div>
          <div style={{ fontSize: 11, color: "#656568", marginBottom: 24, maxWidth: 320, fontFamily: "monospace", wordBreak: "break-word" }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button onClick={this.handleResetAndReload}
            style={{ padding: "14px 28px", borderRadius: 999, border: "none", background: "#1B1B1F", color: "#FFFFFF", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Reset and reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// ADDED — real ask: "ensure can be downloaded as pwa too." Registers
// public/sw.js so the installed/bookmarked web app can actually launch
// offline — see that file's own comment for the caching strategy.
// Native-only guard: skips entirely inside the installed Android app
// (same Capacitor.isNativePlatform() pattern already used throughout
// this app, e.g. notificationService.js) — the native app already has
// its own real offline capability (this whole app is localStorage-
// only, no network dependency for its core function), so a service
// worker running inside Capacitor's own WebView would be an
// unnecessary extra moving part there, not a real benefit.
if ("serviceWorker" in navigator) {
  const registerServiceWorker = () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn("[main] Service worker registration failed:", err);
    });
  };
  import("@capacitor/core").then(({ Capacitor }) => {
    if (Capacitor.isNativePlatform()) return;
    // FIXED — real bug caught in testing: `window.addEventListener("load", ...)`
    // registered too late whenever the async dynamic import above
    // resolved AFTER the page's own load event already fired (common
    // in a fast local dev reload) — a listener added after an event
    // already happened simply never fires, so the service worker
    // silently never registered. Checking readyState first covers
    // both cases: register right away if load has already happened,
    // otherwise wait for it exactly as before.
    if (document.readyState === "complete") registerServiceWorker();
    else window.addEventListener("load", registerServiceWorker);
  });
}
