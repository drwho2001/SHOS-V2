// AutomaticBackupsScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState, useEffect } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
import { ACCENTS, ACTION, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedState } from "../../calculations/loadedRepositoryState";
import { isCustomAutoExportFolderAvailable, pickAutoExportFolder } from "../../storage/fileExportHelper";
import { AppPreferencesRepository, DEFAULT_APP_PREFERENCES } from "../../repositories/appPreferencesRepository";

const AUTO_EXPORT_INTERVAL_OPTIONS = [
  { days: 7, label: "Weekly" },
  { days: 14, label: "Fortnightly" },
  { days: 30, label: "Monthly" },
  { days: 90, label: "Quarterly" },
];

// REMOVED 1 Sep 2026 — real ask: "move inactive contact threshold to
// somewhere else / merge." This screen used to hold Automatic backups
// too (moved out to the Data section — see that past comment, still
// preserved below on AutomaticBackupsScreen), leaving Inactive contact
// threshold as the sole remaining field in an otherwise-empty screen.
// That one field is now InactiveThresholdCard, folded directly into
// DesignScreen above (a Contacts-display setting fits "how each module
// looks/behaves" better than its own near-empty screen) — see that
// screen's own comment for the reasoning.

// MOVED 1 Sep 2026 out of PreferencesScreen — see that function's own
// comment. Same content/behavior as before, now with its own header
// and reachable directly from the Data section next to Export/Restore.
export function AutomaticBackupsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  // ADDED — real ask: an editable save location, previously stuck on
  // the public Documents folder with no way to change it. Native-only —
  // checked once on mount, not every render, same pattern as the
  // existing isChooseFolderExportAvailable() check elsewhere in this file.
  const [folderPickerAvailable, setFolderPickerAvailable] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState("");
  useEffect(() => {
    let cancelled = false;
    isCustomAutoExportFolderAvailable().then((available) => { if (!cancelled) setFolderPickerAvailable(available); });
    return () => { cancelled = true; };
  }, []);

  const toggleAutoExport = async () => {
    setPrefs(await AppPreferencesRepository.update({ autoExportEnabled: !prefs.autoExportEnabled }));
  };
  const setAutoExportInterval = async (days) => {
    setPrefs(await AppPreferencesRepository.update({ autoExportIntervalDays: days }));
  };
  const chooseFolder = async () => {
    setPickerError("");
    setPickerBusy(true);
    const result = await pickAutoExportFolder();
    setPickerBusy(false);
    if (result.ok) {
      setPrefs(await AppPreferencesRepository.update({ autoExportFolder: result.folder }));
    } else if (result.reason !== "cancelled") {
      setPickerError("Couldn't set that folder — please try again.");
    }
  };
  const resetFolder = async () => {
    setPickerError("");
    setPrefs(await AppPreferencesRepository.update({ autoExportFolder: null }));
  };

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Automatic backups</h1>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Automatic backups</span>
            <div onClick={toggleAutoExport} role="switch" tabIndex={0} aria-checked={prefs.autoExportEnabled} aria-label="Automatic backups"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAutoExport(); } }}
              style={{ width: 44, height: 26, borderRadius: 999, background: prefs.autoExportEnabled ? ACCENTS.home : (darkMode ? DARK.border : NEUTRAL.border), position: "relative", cursor: "pointer", transition: "background 0.15s", flexShrink: 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,.4)", position: "absolute", top: 3, left: prefs.autoExportEnabled ? 21 : 3, transition: "left 0.15s" }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: prefs.autoExportEnabled ? 12 : 0 }}>
            Writes a full backup {prefs.autoExportFolder ? "to your chosen folder" : "straight to your phone's Documents folder"} on its own, on
            whatever schedule you pick below — no need to remember to tap Export. Only
            runs when there's something new since the last backup. Nothing leaves this
            device; it's the same local file the manual Export button produces.
          </div>
          {prefs.autoExportEnabled && (
            <div role="radiogroup" aria-label="Backup interval" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {AUTO_EXPORT_INTERVAL_OPTIONS.map((opt) => (
                <span key={opt.days} onClick={() => setAutoExportInterval(opt.days)} role="radio" tabIndex={0} aria-checked={prefs.autoExportIntervalDays === opt.days}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAutoExportInterval(opt.days); } }}
                  style={{
                    padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: prefs.autoExportIntervalDays === opt.days ? ACCENTS.healthcare : (darkMode ? DARK.surfaceVariant : NEUTRAL.bg),
                    color: prefs.autoExportIntervalDays === opt.days ? "#FFFFFF" : (darkMode ? DARK.textSecondary : NEUTRAL.textSecondary),
                  }}>
                  {opt.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* ADDED — real ask: an editable save location. Native-only —
            the plugin behind this (a persisted Android SAF folder
            reference) has no web equivalent, so this card simply isn't
            offered there. */}
        {folderPickerAvailable && (
          <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>Save location</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 12 }}>
              {prefs.autoExportFolder
                ? `Currently saving to "${prefs.autoExportFolder.name || "the chosen folder"}".`
                : "Currently saving to your phone's Documents folder (the default). Pick a different folder if you'd rather it went somewhere else — a synced cloud folder, for example."}
            </div>
            {pickerError && <div style={{ fontSize: 11, color: ACTION.red, marginBottom: 8 }}>{pickerError}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span onClick={pickerBusy ? undefined : chooseFolder} role="button" tabIndex={0}
                onKeyDown={(e) => { if (!pickerBusy && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); chooseFolder(); } }}
                style={{ padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: pickerBusy ? "default" : "pointer", opacity: pickerBusy ? 0.6 : 1, background: ACCENTS.home, color: "#FFFFFF" }}>
                {pickerBusy ? "Choosing…" : prefs.autoExportFolder ? "Change folder" : "Choose a folder…"}
              </span>
              {prefs.autoExportFolder && (
                <span onClick={resetFolder} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); resetFolder(); } }}
                  style={{ padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>
                  Reset to default
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ADDED 16 Sep 2026 — real ask: "other apps don't have the export/
// backup options as separated as we do." The 7 rows below (Export
// backup/to a folder/Selective/CSV/Encrypted/Restore/Automatic
// backups) used to sit directly on the main Settings list; each was
// added for a real, separate reason (see each row's own comment,
// unchanged below), so none of them could be dropped or merged into
// "single functions" without losing something a real request asked
// for — but there's no reason all 7 need their own top-level row.
// Consolidated behind one "<h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Backup & Export</h1>" entry, same sub-screen
// pattern as every other multi-control settings area in this file.

export default AutomaticBackupsScreen;
