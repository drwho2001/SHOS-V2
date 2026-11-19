// EncountersSettingsScreen — module-owned defaults for the Encounter list,
// reachable from the gear on the Encounter title banner (19 Nov 2026).
// These were three transient list-header toggles that reset on every visit;
// they are now persisted via AppPreferencesRepository. They are DEFAULTS,
// not locks — the in-list toggles still override them for the current visit.
import React, { useEffect, useRef } from "react";
import { FONT_FAMILY, NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { ACCENTS, NEUTRAL, RADIUS, TYPE, resolveDarkAccent } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedState } from "../../calculations/loadedRepositoryState";
import { AppPreferencesRepository, DEFAULT_APP_PREFERENCES } from "../../repositories/appPreferencesRepository";
import { useTranslation } from "../../i18n/index.js";

const TOGGLE_KNOB_BG = NEUTRAL.surface;

function SettingSwitch({ label, description, checked, onChange, T, accent, testId }) {
  return (
    <div data-tour={testId} onClick={onChange} role="switch" tabIndex={0} aria-checked={checked} aria-label={label}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(); } }}
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "12px 0", borderTop: `1px solid ${T.border}` }}>
      <div style={{ flex: 1, paddingRight: 12 }}>
        <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.textPrimary }}>{label}</div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{description}</div>
      </div>
      <div style={{ width: 40, height: 24, borderRadius: 999, background: checked ? accent : T.border, position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 2, left: checked ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: TOGGLE_KNOB_BG }} />
      </div>
    </div>
  );
}

export default function EncountersSettingsScreen({ onClose, onPreferencesUpdated } = {}) {
  const { t } = useTranslation();
  const darkMode = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  const accent = resolveDarkAccent("encounters", ACCENTS.encounters, "#D370C7");
  const dialogRef = useRef(null);
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const update = async (changes) => {
    const next = await AppPreferencesRepository.update(changes);
    setPrefs(next);
    onPreferencesUpdated?.();
  };
  return (
    <div ref={dialogRef} role="dialog" aria-label={t("encounters.settings", "Encounter settings")} tabIndex={0}
      style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: FONT_FAMILY }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <div aria-hidden="true" data-notch-band="1" style={{ position: "absolute", left: 0, right: 0, bottom: "100%", height: "env(safe-area-inset-top)", background: T.bg, pointerEvents: "none" }} />
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label={t("common.back", "Back")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose?.(); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: T.textPrimary }}>{t("encounters.settings", "Encounter settings")}</h1>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12, lineHeight: 1.45 }}>
          {t("encounters.settingsDesc", "How the Encounter list starts. You can still change these on the list itself for the current visit.")}
        </div>
        <div data-tour="encounter-sort-default" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
            {t("encounters.defaultSort", "Default sort")}
          </div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 12 }}>
            {t("encounters.defaultSortDesc", "Newest first shows your most recent encounter at the top.")}
          </div>
          <div style={{ display: "flex", background: T.surfaceVariant, borderRadius: RADIUS.full, padding: 3 }}>
            {[["newest", t("encounters.sortNewest", "Newest first")], ["oldest", t("encounters.sortOldest", "Oldest first")]].map(([key, label]) => (
              <div key={key} onClick={() => update({ encounterDefaultSort: key })} role="button" tabIndex={0} aria-pressed={prefs.encounterDefaultSort === key}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); update({ encounterDefaultSort: key }); } }}
                style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: RADIUS.full, cursor: "pointer", fontSize: TYPE.control.fontSize, fontWeight: 600, background: prefs.encounterDefaultSort === key ? T.surface : "transparent", color: prefs.encounterDefaultSort === key ? accent : T.textSecondary }}>
                {label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: "4px 16px" }}>
          <SettingSwitch T={T} accent={accent} testId="encounter-session-summaries-default"
            label={t("encounters.showSessionSummariesDefault", "Show session summaries")}
            description={t("encounters.showSessionSummariesDesc", "Start with the Live session strip visible when you open Encounter.")}
            checked={!!prefs.encounterShowSessionSummaries}
            onChange={() => update({ encounterShowSessionSummaries: !prefs.encounterShowSessionSummaries })} />
          <SettingSwitch T={T} accent={accent} testId="encounter-show-archived-default"
            label={t("encounters.showArchivedDefault", "Show archived by default")}
            description={t("encounters.showArchivedDesc", "Off by default — archived encounters stay hidden until you ask for them.")}
            checked={!!prefs.encounterShowArchived}
            onChange={() => update({ encounterShowArchived: !prefs.encounterShowArchived })} />
        </div>
      </div>
    </div>
  );
}
