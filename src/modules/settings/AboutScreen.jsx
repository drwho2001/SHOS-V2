// AboutScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React from "react";
import packageJson from "../../../package.json";
const APP_VERSION = packageJson.version;
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
import { ACCENTS, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useIsDesktopWidth } from "../../calculations/responsive";

export function AboutScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  // ADDED — real audit finding (desktop full-width sweep): this
  // screen's minimal content (one short card + a couple of centered
  // lines) has nothing to grid or column — a maxWidth cap + center is
  // the appropriate treatment here, same as Guide/Glossary's own
  // measure-cap precedent.
  const isDesktopWidth = useIsDesktopWidth();

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(120px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>About</h1>
      </div>
      <div style={isDesktopWidth ? { padding: 16, maxWidth: 480, margin: "0 auto" } : { padding: 16 }}>
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ ...TYPE.recordTitle, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>SHOS</div>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled }}>Sexual Health Operating System</div>
        </div>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Version</span>
            {/* CHANGED — real ask: was hardcoded placeholder, now reads
                the actual version from package.json rather than a
                second, easy-to-forget copy of the same number. */}
            <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 600 }}>{APP_VERSION}</span>
          </div>
          {/* ADDED — real ask: "getting version back to fixes already
              done" — package.json's version had genuinely never been
              bumped since the first commit, so this row alone couldn't
              tell you which of many real builds was installed. Build
              (the actual short commit SHA, baked in automatically at
              build time via vite.config.js — see its own comment)
              never goes stale the way a manually-remembered version
              bump would. */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Build</span>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "dev"}</span>
          </div>
          {/* CHANGED — real fix: pointed at the old private repo this
              project moved off of — the public repo everyone's actual
              builds/releases now come from is SHOS-V2. */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Repository</span>
            <a href="https://github.com/drwho2001/SHOS-V2" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: ACCENTS.medication, fontWeight: 600 }}>
              GitHub →
            </a>
          </div>
          {/* ADDED — real ask: link the no-install web version alongside
              the native app's own version/repo info, for anyone on iOS
              or a computer who can't install the APK. */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Web app (iPhone / computer)</span>
            <a href="https://drwho2001.github.io/SHOS-V2/" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: ACCENTS.medication, fontWeight: 600 }}>
              Open →
            </a>
          </div>
        </div>
        <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, textAlign: "center", marginTop: 16 }}>
          Local-first — nothing here leaves this device unless you choose to export or share it.
        </div>
      </div>
    </div>
  );
}

// ADDED 22 Sep 2026 — Home-screen widgets with per-widget privacy tiers
// (Full / Redacted / Off). Widgets show on lock screen so default is
// Redacted (counts + "Next: 08:00" only, no names). Full tier shows
// medication/appointment names; Off disables the widget entirely.

export default AboutScreen;
