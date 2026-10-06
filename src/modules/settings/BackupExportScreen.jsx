// BackupExportScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useRef, useEffect, useState } from "react";
import { NEUTRAL_DARK as DARK, STICKY_SCREEN_HEADER_TOP } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, DownloadSimpleIcon as Download, UploadSimpleIcon as Upload, FileCsvIcon as FileCsv, LockIcon as Lock, FolderIcon as Folder, FunnelIcon as Filter, ClockIcon as Clock } from "@phosphor-icons/react";
import { ACTION, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { countSampleData, onSampleDataChanged } from "../../repositories/clearSampleData";

export function BackupExportScreen({ onClose, doPlainExport, doPlainExportToFolder, chooseFolderAvailable, plainExportStatus, plainFolderExportStatus, onImportClick, onSelectiveExport, onCSVExport, onEncryptedExport, onAutoBackupSettings }) {
  const [darkMode] = useDarkModePreference();
  // ADDED 27 Sep 2026 - how many sample records an export would still carry.
  // See the warning row below for why this belongs on THIS screen.
  const [sampleDataCount, setSampleDataCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { countSampleData().then((r) => { if (!cancelled) setSampleDataCount(r.total); }).catch(() => {}); };
    refresh();
    // Same reason as the Developer Tools panel: the sample data can be cleared
    // from the first-run banner on Home, and a stale "N sample records are in
    // this export" warning would keep telling the user to clear data they have
    // already cleared. The warning outliving the problem is its own bug.
    return onSampleDataChanged(refresh);
  }, []);
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  // Local copy of SettingsScreen's own SettingsRow — that one is
  // defined inside SettingsScreen's own closure (over its darkMode),
  // not at module scope, so it isn't reachable from this standalone
  // component. Same exact markup/styling, closing over this
  // component's own darkMode instead.
  const SettingsRow = ({ icon: Icon, label, onClick }) => (
    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={17} weight="regular" color={darkMode ? DARK.textDisabled : "#5B5B62"} />
        <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 500 }}>{label}</span>
      </div>
      <ChevronRight size={16} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} />
    </div>
  );
  return (
    <div ref={dialogRef} role="dialog" aria-label="Backup & Export" tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: STICKY_SCREEN_HEADER_TOP, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Backup &amp; Export</h1>
      </div>
      <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, padding: "12px 16px 4px" }}>
        Everything here makes a copy of your data or brings one back in — nothing here ever leaves this device unless you choose to send it somewhere yourself.
      </div>
      {/* ADDED 27 Sep 2026 — warn before exporting while sample data is present.
          buildBackup() reads through the repositories, so a user who exports on
          day one archives the made-up contacts, encounters and a POSITIVE STI
          result into a file they are quite likely to hand to a clinic or move
          to a new phone. The first-run banner on Home says the data is sample
          data, but the user may have dismissed it and still be weeks from
          clearing anything — and the moment it actually matters is here, at the
          point of export.

          Advisory rather than a blocker: exporting is legitimate (someone may
          genuinely want the demo data to look at), and a dialog here would be
          the wrong place to force a decision. */}
      {sampleDataCount > 0 && (
        <div style={{ margin: "8px 16px 0", padding: "10px 12px", borderRadius: 10, border: `1px solid ${darkMode ? DARK.border : NEUTRAL.border}`, background: darkMode ? DARK.surfaceVariant : NEUTRAL.surfaceVariant }}>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, lineHeight: 1.45 }}>
            Heads up: {sampleDataCount} of the records in this export are still SHOS's made-up
            sample data, not yours. Clear it first if this file is going to a clinic or a new
            phone — it’s in Settings → Support → Developer tools.
          </div>
        </div>
      )}
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "12px 16px 8px", overflow: "hidden" }}>
        {/* CHANGED — real bug found in the user's own testing: passing
            `exportBackup` directly meant the DOM click's SyntheticEvent
            got passed as `includeKeys`, which buildBackup() then tried
            to iterate as a selective-key Set and threw. Selective
            export never hit this because its own button already
            wrapped the call in an arrow function that discards the
            event. Wrapping this one the same way. */}
        <SettingsRow icon={Upload} label="Export backup" onClick={doPlainExport} />
        {/* ADDED — real ask: real confirmation for this button — it
            fires the OS share sheet with no feedback of its own, and
            round-trip verification (backupService.js's own
            verifyBackupJson()) now genuinely can fail here, which
            deserves to be visible, not swallowed. Same status-row
            pattern already used for Export backup to a folder/
            Encrypted export below — this exact row just never had one. */}
        {plainExportStatus && (
          <div style={{ fontSize: 12, color: plainExportStatus.ok === false ? ACTION.red : (darkMode ? DARK.textSecondary : NEUTRAL.textSecondary), padding: "0 16px 10px", textAlign: "center" }}>{plainExportStatus.msg}</div>
        )}
        {/* ADDED — real ask: an explicit "choose exactly where this
            goes" alternative to the row above, which opens the Share
            sheet (send it somewhere) rather than a real folder picker.
            Only shown once actually available — see
            fileExportHelper.js's isChooseFolderExportAvailable. */}
        {chooseFolderAvailable && (
          <SettingsRow icon={Folder} label="Export backup to a folder…" onClick={doPlainExportToFolder} />
        )}
        {/* FIXED — real bug found in the same pass as the round-trip
            verification above: this status was tracked (set on every
            export attempt) but never actually rendered anywhere —
            silently dead state, the failure branches included. */}
        {plainFolderExportStatus && (
          <div style={{ fontSize: 12, color: plainFolderExportStatus.ok === false ? ACTION.red : (darkMode ? DARK.textSecondary : NEUTRAL.textSecondary), padding: "0 16px 10px", textAlign: "center" }}>{plainFolderExportStatus.msg}</div>
        )}
        {/* ADDED 19 Aug 2026 — real ask: default export stays one tap
            (the row above, unchanged), this is the opt-in "choose what
            to include" path. */}
        {/* CHANGED 26 Aug 2026 — real fix: these icons were backwards,
            same Download/Upload direction confusion the user corrected for
            Contacts' Import earlier this session, mirrored here —
            Export (data leaving) reads as Upload, Restore (data coming
            back in) reads as Download. */}
        <SettingsRow icon={Filter} label="Selective export…" onClick={onSelectiveExport} />
        {/* ADDED — real ask: CSV export, for reading data elsewhere
            (Excel/Sheets), separate from the JSON backup above (which
            is for restoring into SHOS, not for opening as a
            spreadsheet). */}
        <SettingsRow icon={FileCsv} label="Export as CSV…" onClick={onCSVExport} />
        {/* ADDED — real ask: password-protected backup, for storing or
            sending a backup somewhere less trusted than this device. */}
        <SettingsRow icon={Lock} label="Export encrypted backup…" onClick={onEncryptedExport} />
        <SettingsRow icon={Download} label="Restore from backup" onClick={onImportClick} />
        {/* MOVED 1 Sep 2026 from Preferences — a backup-scheduling
            setting belongs next to the other backup controls, not
            bundled with an unrelated Contacts-display setting under a
            generic "Preferences" label. */}
        <SettingsRow icon={Clock} label="Automatic backups" onClick={onAutoBackupSettings} />
      </div>
    </div>
  );
}

// ADDED — real ask, from a build audit: two real network calls in this
// app (Nominatim address lookup, GitHub update checks) were previously
// undisclosed anywhere in the UI and had no way to turn off — worth
// being upfront about for an app whose whole framing is on-device-only,
// privacy-paramount. Both default ON (see AppPreferencesRepository's
// own comment on why) — this is disclosure and control, not a warning
// to be scared of. Same standalone-screen pattern as AutomaticBackupsScreen.

export default BackupExportScreen;
