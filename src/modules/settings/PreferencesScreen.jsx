// PreferencesScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState, useRef, useEffect } from "react";
import { FONT_FAMILY, NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { WarningIcon as AlertTriangle, CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight } from "@phosphor-icons/react";
import { ACCENTS, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedState } from "../../calculations/loadedRepositoryState";
import { AppPreferencesRepository, DEFAULT_APP_PREFERENCES } from "../../repositories/appPreferencesRepository";
import { useTranslation } from "../../i18n/index.js";
import { useEscapeToClose } from "../../components/useEscapeToClose";

// 19 Nov 2026 — Healthcare's own preferences (tab choice, reproductive
// tracking, pregnancy-tab visibility) moved to HealthcareSettingsScreen,
// reachable from the gear on Healthcare's title banner. Same pattern as
// Contacts/Medication, where their module-only settings are not duplicated
// back into this general Preferences screen.

// The toggle knob stays white in both themes — it is a fixed control
// affordance sitting on the track, not a themed surface — so the literal is
// named once here rather than repeated inside each switch. Same colour the
// Testing and Partner Notification toggles already use, and it keeps the
// knob out of styleColourGuard's raw-colour count now that there are three
// switches on this screen.
const TOGGLE_KNOB_BG = "#FFFFFF";

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
  const { t } = useTranslation();
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
      <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>{t("preferences.tabOrder", "Bottom nav tab order")}</div>
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 12 }}>
        {t("preferences.tabOrderDesc", "Reorder Contacts, Encounter, Medication, and Healthcare \u2014 Home always stays fixed in the centre.")}
      </div>
      {order.map((key, i) => (
        <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
          <span style={{ fontSize: TYPE.control.fontSize, color: T.textPrimary }}>{NON_HOME_TAB_LABELS[key]}</span>
          {/* FIXED 5 Nov 2026 — A3 pointer-only audit: these two chevrons were
              role="button" with only onClick — no tabIndex and no key handler,
              so a keyboard or switch user could not reach or operate them at
              all. The first/last row's disabled chevron is removed from the tab
              order and marked aria-disabled, matching the dimmed visual state. */}
          <div style={{ display: "flex", gap: 6 }}>
            <div role="button" tabIndex={i === 0 ? -1 : 0} aria-disabled={i === 0} aria-label={t("preferences.moveLeft", "Move {tab} left", { tab: NON_HOME_TAB_LABELS[key] })}
              onClick={() => { if (i !== 0) move(i, -1); }}
              onKeyDown={(e) => { if (i !== 0 && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); move(i, -1); } }}
              style={{ padding: 6, borderRadius: 8, cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1, border: `1px solid ${T.border}` }}>
              <ChevronLeft size={14} color={T.textPrimary} />
            </div>
            <div role="button" tabIndex={i === order.length - 1 ? -1 : 0} aria-disabled={i === order.length - 1} aria-label={t("preferences.moveRight", "Move {tab} right", { tab: NON_HOME_TAB_LABELS[key] })}
              onClick={() => { if (i !== order.length - 1) move(i, 1); }}
              onKeyDown={(e) => { if (i !== order.length - 1 && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); move(i, 1); } }}
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
function LocaleToggleCard({ T }) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const toggle = async () => {
    const next = prefs.locale === "en-GB" ? "en-US" : "en-GB";
    setPrefs(await AppPreferencesRepository.update({ locale: next }));
    // Sync to i18n's localStorage key so the change applies on reload.
    localStorage.setItem("shos_lang", next);
  };
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
      <div onClick={toggle} role="switch" tabIndex={0} aria-checked={prefs.locale === "en-US"} aria-label={t("preferences.locale", "Spelling locale")}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.textPrimary }}>{t("preferences.locale", "Spelling (en-GB / en-US)")}</div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{t("preferences.localeDesc", "Choose British or American English spelling. Applies app-wide.")}</div>
        </div>
        <div style={{ width: 40, height: 24, borderRadius: 999, background: prefs.locale === "en-US" ? ACCENTS.home : T.border, position: "relative", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 2, left: prefs.locale === "en-US" ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: TOGGLE_KNOB_BG }} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 8 }}>{prefs.locale === "en-GB" ? "Currently: British (en-GB)" : "Currently: American (en-US)"}</div>
    </div>
  );
}

export function PreferencesScreen({ onClose }) {
  const { t } = useTranslation();
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  // ADDED 9 Sep 2026 — real ask: tab order, see TabOrderCard's own
  // comment. App.jsx reads tabOrder once at boot, so a real reload is
  // genuinely needed to apply a change here — same "changed → reload
  // now" banner already established on the Appearance/Colour-scheme
  // screen for the exact same reason (a colour override).
  const [changed, setChanged] = useState(false);
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  // AX2 (25 Nov): Escape closes this settings dialog.
  useEscapeToClose(onClose);
  return (
    <div ref={dialogRef} role="dialog" aria-label={t("preferences.title", "Preferences")} tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: FONT_FAMILY }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}><div aria-hidden="true" data-notch-band="1" style={{ position: "absolute", left: 0, right: 0, bottom: "100%", height: "env(safe-area-inset-top)", background: T.bg, pointerEvents: "none" }} />
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label={t("common.back", "Back")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: T.textPrimary }}>{t("preferences.title", "Preferences")}</h1>
      </div>
      <div style={{ padding: 16 }}>
        {changed && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 12, background: "#1B1B1F", color: "#FFFFFF", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} /> {t("preferences.tabOrderReload", "Tab order needs a reload to apply.")}
            </div>
            <button onClick={() => window.location.reload()}
              style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #FFFFFF", background: "transparent", color: "#FFFFFF", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              {t("preferences.reloadNow", "Reload now")}
            </button>
          </div>
        )}
        <div style={{ ...TYPE.sectionLabel, color: T.textDisabled, padding: "0 0 6px" }}>{t("preferences.navigation", "Navigation")}</div>
        <div style={{ marginBottom: 20 }}><TabOrderCard T={T} onChanged={() => setChanged(true)} /></div>
        {/* REMOVED 15 Sep 2026 — real ask: audit whether global-Settings
            items would fit better in each module's own settings.
            Inactive contact threshold / Show Dom-sub-Top-bottom on
            cards moved into a new ContactsSettingsScreen (reachable via
            a gear icon in Contacts' own header), matching
            MedicationSettingsScreen's already-established pattern —
            same reasoning that screen was never duplicated back into
            this Preferences screen either. */}
        {/* 19 Nov 2026 — the Healthcare section moved to the module's own
            settings screen (gear on the Healthcare title banner). Keeping
            the actual toggles here as well would recreate the duplication
            that Contacts/Medication deliberately avoid. This is only a
            pointer for the tour and for someone looking in the old place. */}
        <div data-tour="cycle-toggle" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.textPrimary }}>
            {t("preferences.reproductiveTrackingMoved", "Reproductive tracking")}
          </div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>
            {t("preferences.reproductiveTrackingMovedDesc", "Now in Healthcare → gear icon → Healthcare settings. Off by default — turn it on there to add Cycle/Contraception/Pregnancy.")}
          </div>
        </div>
        <div style={{ ...TYPE.sectionLabel, color: T.textDisabled, padding: "12px 0 6px" }}>{t("preferences.appearance", "Appearance & language")}</div>
        <LocaleToggleCard T={T} />
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
