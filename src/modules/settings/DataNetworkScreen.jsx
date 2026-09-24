// DataNetworkScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState, useEffect } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CheckIcon as Check, CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
import { ACCENTS, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedState } from "../../calculations/loadedRepositoryState";
import { AppPreferencesRepository, DEFAULT_APP_PREFERENCES } from "../../repositories/appPreferencesRepository";

export function DataNetworkScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);

  const toggleAddressLookup = async () => {
    setPrefs(await AppPreferencesRepository.update({ addressLookupEnabled: !prefs.addressLookupEnabled }));
  };
  const toggleUpdateCheck = async () => {
    setPrefs(await AppPreferencesRepository.update({ updateCheckEnabled: !prefs.updateCheckEnabled }));
  };
  // ADDED 16 Sep 2026 — real ask: a third disclosed exception, see
  // appPreferencesRepository.js's own errorReportEndpoint comment.
  // Local-only draft state so every keystroke doesn't write to
  // storage — committed onBlur, same pattern as every other free-text
  // preference field in this file.
  const [endpointDraft, setEndpointDraft] = useState(prefs.errorReportEndpoint);
  useEffect(() => { setEndpointDraft(prefs.errorReportEndpoint); }, [prefs.errorReportEndpoint]);
  const commitEndpoint = async () => {
    const trimmed = endpointDraft.trim();
    if (trimmed === prefs.errorReportEndpoint) return;
    setPrefs(await AppPreferencesRepository.update({ errorReportEndpoint: trimmed }));
  };

  const row = (label, enabled, onToggle, description) => (
    <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{label}</span>
        <div onClick={onToggle} role="switch" tabIndex={0} aria-checked={enabled} aria-label={label}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
          style={{ width: 44, height: 26, borderRadius: 999, background: enabled ? ACCENTS.home : (darkMode ? DARK.border : NEUTRAL.border), position: "relative", cursor: "pointer", transition: "background 0.15s", flexShrink: 0 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,.4)", position: "absolute", top: 3, left: enabled ? 21 : 3, transition: "left 0.15s" }} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>{description}</div>
    </div>
  );

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Data & network</h1>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 16 }}>
          SHOS is on-device only — nothing is ever sent to a server SHOS runs. Two features do call a third party directly from your device to do their job. Both are listed here exactly, and can be turned off.
        </div>
        {row(
          "Address lookup",
          prefs.addressLookupEnabled,
          toggleAddressLookup,
          "“Use current location” and address autocomplete (Contacts, My Profile, Clinic Visits, Encounters) send a typed address or your GPS coordinates to OpenStreetMap's free Nominatim service to look up a real address or place name. Off: you can still type an address by hand, just without suggestions or auto-lookup."
        )}
        {row(
          "Check for app updates",
          prefs.updateCheckEnabled,
          toggleUpdateCheck,
          "On the installed Android app only, checks GitHub's public API on launch for a newer build. Reveals your IP address to GitHub, nothing else. Off: you can still check manually from the About screen."
        )}
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>Send problem reports</div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 8 }}>
            Settings &gt; Developer tools &gt; Error log's own "Report a problem" box always saves your note on-device. If you set a URL here, tapping Send there ALSO sends just that typed text to it directly — no export step, no email client, and nothing else about you or your device. Leave blank to keep it local-only.
          </div>
          <input
            type="url"
            value={endpointDraft}
            onChange={(e) => setEndpointDraft(e.target.value)}
            onBlur={commitEndpoint}
            placeholder="https://…"
            style={{ width: "100%", boxSizing: "border-box", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: 8, borderRadius: RADIUS.sm, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: darkMode ? DARK.bg : "#FFFFFF", color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}
          />
        </div>
      </div>
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: design/preferences section for colour
// scheme, ability to customize a module's base colour. See
// moduleColorRepository.js for the actual mechanism (merged into
// ACCENTS at load time) and its honest note on why a change here
// takes effect on next reload, not instantly.

export default DataNetworkScreen;
