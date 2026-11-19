// HealthcareSettingsScreen — the module's OWN settings, reachable from the
// gear on the Healthcare title banner (19 Nov 2026 owner ask: match the
// Contacts/Medication pattern, move module-only settings out of general
// Preferences). Owns no data: both cards write through AppPreferencesRepository
// as before, only their surface moved. The menstrual toggle is safe here even
// though it can switch the reproductive module off — Healthcare itself is
// always reachable, unlike the old "no module screen when off" problem.
import React, { useEffect, useRef } from "react";
import { FONT_FAMILY, NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { ACCENTS, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedState } from "../../calculations/loadedRepositoryState";
import { AppPreferencesRepository, DEFAULT_APP_PREFERENCES } from "../../repositories/appPreferencesRepository";
import { HEALTHCARE_TAB_KEYS, HEALTHCARE_VISIBLE_MAX, resolveVisibleTabs } from "../../calculations/healthcareTabs";
import { useTranslation } from "../../i18n/index.js";

const HEALTHCARE_TAB_LABELS = {
  symptomLog: "Symptoms",
  testing: "Testing",
  clinicVisits: "Clinic Visits",
  vaccinations: "Vaccinations",
  measurements: "Measurements",
  menstrualHealth: "Reproductive health",
};

// The toggle knob is a fixed white control affordance, not a themed surface.
// NEUTRAL.surface is the shared white token — a raw hex in a NEW file would
// trip styleColourGuard's new-file rule.
const TOGGLE_KNOB_BG = NEUTRAL.surface;

function HealthcareTabsCard({ T, onChanged }) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const available = HEALTHCARE_TAB_KEYS.filter((k) => k !== "menstrualHealth" || prefs.menstrualTrackingEnabled);
  const visible = resolveVisibleTabs(prefs.healthcareVisibleTabs, available);
  const atCap = visible.length >= HEALTHCARE_VISIBLE_MAX;
  const toggle = async (key) => {
    const isVisible = visible.includes(key);
    if (!isVisible && atCap) return;
    const next = isVisible ? visible.filter((k) => k !== key) : [...visible, key];
    setPrefs(await AppPreferencesRepository.update({ healthcareVisibleTabs: next }));
    onChanged?.();
  };
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
        {t("preferences.healthcareTabs", "Healthcare tabs shown")}
      </div>
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 12 }}>
        {t("preferences.healthcareTabsDesc", "Choose which sections get their own button. The rest live under “More”. Keep to {max} so the row stays on one line.", { max: HEALTHCARE_VISIBLE_MAX })}
      </div>
      {available.map((key) => {
        const on = visible.includes(key);
        const disabled = !on && atCap;
        return (
          <div key={key} onClick={() => toggle(key)} role="switch" tabIndex={disabled ? -1 : 0}
            aria-checked={on} aria-disabled={disabled}
            aria-label={t("preferences.healthcareTabToggle", "{tab} tab shown", { tab: HEALTHCARE_TAB_LABELS[key] })}
            onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(key); } }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, padding: "8px 0", borderTop: `1px solid ${T.border}`, minHeight: 44 }}>
            <span style={{ fontSize: TYPE.control.fontSize, color: T.textPrimary }}>{HEALTHCARE_TAB_LABELS[key]}</span>
            <div style={{ width: 40, height: 24, borderRadius: 999, background: on ? ACCENTS.home : T.border, position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: TOGGLE_KNOB_BG }} />
            </div>
          </div>
        );
      })}
      {atCap && (
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 8 }}>
          {t("preferences.healthcareTabsAtCap", "Three buttons is the maximum for one line — turn one off to show a different section.")}
        </div>
      )}
    </div>
  );
}

function MenstrualTrackingToggleCard({ T, onChanged }) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const toggle = async () => {
    setPrefs(await AppPreferencesRepository.update({ menstrualTrackingEnabled: !prefs.menstrualTrackingEnabled }));
    onChanged?.();
  };
  return (
    <div data-tour="cycle-toggle" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
      <div onClick={toggle} role="switch" tabIndex={0} aria-checked={prefs.menstrualTrackingEnabled} aria-label={t("preferences.menstrualTracking", "Menstrual & contraception tracking")}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.textPrimary }}>{t("preferences.menstrualTracking", "Menstrual & contraception tracking")}</div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{t("preferences.menstrualTrackingDesc", "Adds a Cycle/Contraception/Pregnancy tab under Healthcare. Off by default — turning it on doesn't depend on any other setting.")}</div>
        </div>
        <div style={{ width: 40, height: 24, borderRadius: 999, background: prefs.menstrualTrackingEnabled ? ACCENTS.home : T.border, position: "relative", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 2, left: prefs.menstrualTrackingEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: TOGGLE_KNOB_BG }} />
        </div>
      </div>
      {prefs.menstrualTrackingEnabled && (
        <div onClick={async () => setPrefs(await AppPreferencesRepository.update({ pregnancyTrackingHidden: !prefs.pregnancyTrackingHidden }))}
          role="switch" tabIndex={0} aria-checked={prefs.pregnancyTrackingHidden} aria-label={t("preferences.hidePregnancy", "Hide Pregnancy tab")}
          onKeyDown={async (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPrefs(await AppPreferencesRepository.update({ pregnancyTrackingHidden: !prefs.pregnancyTrackingHidden })); } }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.textPrimary }}>{t("preferences.hidePregnancy", "Hide Pregnancy tab")}</div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{t("preferences.hidePregnancyDesc", "Keeps Cycle and Contraception, removes Pregnancy specifically — regardless of profile gender. A record you already have stays reachable by tapping it directly.")}</div>
          </div>
          <div style={{ width: 40, height: 24, borderRadius: 999, background: prefs.pregnancyTrackingHidden ? ACCENTS.home : T.border, position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: prefs.pregnancyTrackingHidden ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: TOGGLE_KNOB_BG }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function HealthcareSettingsScreen({ onClose, onOpenGeneralSettings, onPreferencesUpdated } = {}) {
  const { t } = useTranslation();
  const darkMode = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  const dialogRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div ref={dialogRef} role="dialog" aria-label={t("healthcare.settings", "Healthcare settings")} tabIndex={0}
      style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: FONT_FAMILY }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <div aria-hidden="true" data-notch-band="1" style={{ position: "absolute", left: 0, right: 0, bottom: "100%", height: "env(safe-area-inset-top)", background: T.bg, pointerEvents: "none" }} />
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label={t("common.back", "Back")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose?.(); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: T.textPrimary }}>{t("healthcare.settings", "Healthcare settings")}</h1>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12, lineHeight: 1.45 }}>
          {t("healthcare.settingsDesc", "Which Healthcare sections appear as buttons, and whether reproductive tracking is on.")}
        </div>
        <MenstrualTrackingToggleCard T={T} onChanged={onPreferencesUpdated} />
        <HealthcareTabsCard T={T} onChanged={onPreferencesUpdated} />
        {onOpenGeneralSettings && (
          <div onClick={() => { onClose?.(); onOpenGeneralSettings(); }} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose?.(); onOpenGeneralSettings(); } }}
            style={{ marginTop: 12, padding: 14, borderRadius: RADIUS.md, border: `1px solid ${T.border}`, background: T.surface, color: T.textPrimary, fontSize: TYPE.control.fontSize, cursor: "pointer" }}>
            {t("common.generalSettings", "General settings")}
          </div>
        )}
      </div>
    </div>
  );
}
