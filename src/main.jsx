import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

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
          <div style={{ fontSize: 11, color: "#9A9AA1", marginBottom: 24, maxWidth: 320, fontFamily: "monospace", wordBreak: "break-word" }}>
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
