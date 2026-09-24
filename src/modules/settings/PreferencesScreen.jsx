// PreferencesScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { WarningIcon as AlertTriangle, CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight } from "@phosphor-icons/react";
import { ACCENTS, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedState } from "../../calculations/loadedRepositoryState";
import { AppPreferencesRepository, DEFAULT_APP_PREFERENCES } from "../../repositories/appPreferencesRepository";

function MenstrualTrackingToggleCard({ T }) {
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const toggle = async () => setPrefs(await AppPreferencesRepository.update({ menstrualTrackingEnabled: !prefs.menstrualTrackingEnabled }));
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16 }}>
      <div onClick={toggle} role="switch" tabIndex={0} aria-checked={prefs.menstrualTrackingEnabled} aria-label="Menstrual & contraception tracking"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Menstrual & contraception tracking</div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Adds a Cycle/Contraception/Pregnancy tab under Healthcare. Off by default — turning it on doesn't depend on any other setting.</div>
        </div>
        <div style={{ width: 40, height: 24, borderRadius: 999, background: prefs.menstrualTrackingEnabled ? ACCENTS.home : T.border, position: "relative", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 2, left: prefs.menstrualTrackingEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
        </div>
      </div>
      {/* ADDED — real ask: "option/button to hide pregnancy tab if
          toggled on, in same placeish" — persisted opt-out for the
          Pregnancy tab specifically, distinct from this whole
          Cycle/Contraception/Pregnancy toggle above. Only meaningful
          while the toggle above is on, so disabled (not hidden — same
          "why can't I tap this" clarity as PIN-gated App Lock controls
          in Privacy) until it is.
      */}
      {prefs.menstrualTrackingEnabled && (
        <div onClick={async () => setPrefs(await AppPreferencesRepository.update({ pregnancyTrackingHidden: !prefs.pregnancyTrackingHidden }))}
          role="switch" tabIndex={0} aria-checked={prefs.pregnancyTrackingHidden} aria-label="Hide Pregnancy tab"
          onKeyDown={async (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPrefs(await AppPreferencesRepository.update({ pregnancyTrackingHidden: !prefs.pregnancyTrackingHidden })); } }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Hide Pregnancy tab</div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Keeps Cycle and Contraception, removes Pregnancy specifically — regardless of profile gender. A record you already have stays reachable by tapping it directly.</div>
          </div>
          <div style={{ width: 40, height: 24, borderRadius: 999, background: prefs.pregnancyTrackingHidden ? ACCENTS.home : T.border, position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: prefs.pregnancyTrackingHidden ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ADDED 9 Sep 2026 — real ask: the "tab reorder" part of the original
// 18 Aug 2026 Settings/Management ask (see AppPreferencesRepository's
// own tabOrder comment and App.jsx's getOrderedTabs() for the full
// context). Left/right move buttons rather than real drag-and-drop —
// this app has no existing drag interaction anywhere else to match,
// and a tap-based control is far more reliably testable/verifiable
// (this session's own Playwright suite included) than native HTML5 or
// touch drag-and-drop tends to be. Home is deliberately not one of the
// 4 rows here — it always stays fixed in the centre of the real nav,
// see getOrderedTabs()'s own comment for why.
const NON_HOME_TAB_LABELS = { contacts: "Contacts", activity: "Encounter", medication: "Medication", healthcare: "Healthcare" };
const DEFAULT_TAB_ORDER = ["contacts", "activity", "medication", "healthcare"];
function TabOrderCard({ T, onChanged }) {
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const order = (Array.isArray(prefs.tabOrder) && prefs.tabOrder.length === 4 && DEFAULT_TAB_ORDER.every((k) => prefs.tabOrder.includes(k)))
    ? prefs.tabOrder : DEFAULT_TAB_ORDER;

  const move = async (index, dir) => {
    const next = index + dir;
    if (next < 0 || next >= order.length) return;
    const reordered = [...order];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    setPrefs(await AppPreferencesRepository.update({ tabOrder: reordered }));
    onChanged();
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>Bottom nav tab order</div>
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 12 }}>
        Reorder Contacts, Encounter, Medication, and Healthcare — Home always stays fixed in the centre.
      </div>
      {order.map((key, i) => (
        <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
          <span style={{ fontSize: 13, color: T.textPrimary }}>{NON_HOME_TAB_LABELS[key]}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <div role="button" aria-label={`Move ${NON_HOME_TAB_LABELS[key]} left`} onClick={() => move(i, -1)}
              style={{ padding: 6, borderRadius: 8, cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1, border: `1px solid ${T.border}` }}>
              <ChevronLeft size={14} color={T.textPrimary} />
            </div>
            <div role="button" aria-label={`Move ${NON_HOME_TAB_LABELS[key]} right`} onClick={() => move(i, 1)}
              style={{ padding: 6, borderRadius: 8, cursor: i === order.length - 1 ? "default" : "pointer", opacity: i === order.length - 1 ? 0.3 : 1, border: `1px solid ${T.border}` }}>
              <ChevronRight size={14} color={T.textPrimary} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ADDED — real ask: "review/audit all settings contents and regroup if
// needed for clarity" — the Menstrual/contraception toggle (and the
// Contacts inactive-threshold before it) had drifted into the Design
// screen ("Colour scheme"), which should only ever hold appearance
// settings. This is their real, correctly-scoped home — cross-cutting
// behavioural preferences that don't belong under Data, Advanced, or
// Appearance. Same singleton-repository backing as before
// (appPreferencesRepository.js), only the screen that surfaces it changed.
export function PreferencesScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  // ADDED 9 Sep 2026 — real ask: tab order, see TabOrderCard's own
  // comment. App.jsx reads tabOrder once at boot, so a real reload is
  // genuinely needed to apply a change here — same "changed → reload
  // now" banner already established on the Appearance/Colour-scheme
  // screen for the exact same reason (a colour override).
  const [changed, setChanged] = useState(false);
  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: T.textPrimary }}>Preferences</h1>
      </div>
      <div style={{ padding: 16 }}>
        {changed && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 12, background: "#1B1B1F", color: "#FFFFFF", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} /> Tab order needs a reload to apply.
            </div>
            <button onClick={() => window.location.reload()}
              style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #FFFFFF", background: "transparent", color: "#FFFFFF", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              Reload now
            </button>
          </div>
        )}
        <div style={{ ...TYPE.sectionLabel, color: T.textDisabled, padding: "0 0 6px" }}>Navigation</div>
        <div style={{ marginBottom: 20 }}><TabOrderCard T={T} onChanged={() => setChanged(true)} /></div>
        {/* REMOVED 15 Sep 2026 — real ask: audit whether global-Settings
            items would fit better in each module's own settings.
            Inactive contact threshold / Show Dom-sub-Top-bottom on
            cards moved into a new ContactsSettingsScreen (reachable via
            a gear icon in Contacts' own header), matching
            MedicationSettingsScreen's already-established pattern —
            same reasoning that screen was never duplicated back into
            this Preferences screen either. */}
        <div style={{ ...TYPE.sectionLabel, color: T.textDisabled, padding: "0 0 6px" }}>Healthcare</div>
        {/* CHANGED 15 Sep 2026 — real exception, stated explicitly by
            the owner: this toggle can NOT move into a Menstrual Health
            settings screen the way Contacts' own settings did, since
            when it's off there IS no module screen to reach it from —
            it has to live somewhere always-reachable regardless of the
            module's own on/off state. Stays here on purpose, not an
            oversight. */}
        <MenstrualTrackingToggleCard T={T} />
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — real Settings screen, per Doc 1's spec exactly:
// "gear icon in the Top App Bar, canonically on Home. Contents: Profile
// · Preferences · Data export/import/backup · Privacy · Appearance ·
// Developer tools." My Profile and Backup/Restore are real, working
// sections here now — moved out of the old black top bar (which is
// gone entirely, replaced by this).
// UPDATED 26 Aug 2026 — the comment below this used to say
// Preferences/Privacy/Appearance/Developer tools were "honestly
// labeled as not built yet." That was true on 19 Aug — it's stale
// now. All four are real, working sections as of this session
// (Preferences: inactiveThresholdDays; Privacy: real settings backed
// by PrivacySettingsRepository; Appearance: Design screen with real
// module colour customization; Developer tools: real reset-all-data
// with a two-step confirm). Left the old comment's honesty principle
// intact — genuinely-unbuilt things (Stats/Calendar/Trash/About were
// all real by the time they were added, so nothing here is currently
// faked) — just correcting a factual claim that time overtook.

export default PreferencesScreen;
