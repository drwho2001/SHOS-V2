import { NEUTRAL_DARK as DARK } from "../calculations/designTokens";
// SHOS_Settings_Prototype.jsx
//
// ADDED — real architecture extraction, per GPT's own "app shell"
// review (accepted with its explicit caveat: audit first, preserve
// functionality, no wholesale rewrite for its own sake). The real
// audit finding: App.jsx contained 6 full feature screens that don't
// belong in what's supposed to be routing/global-state shell code —
// this file is the entire Settings sub-tree (Export, Developer Tools,
// Registries, Privacy, Preferences, and the top-level Settings screen
// itself) moved out as ONE unit, since they're only ever reached from
// one place and share real context with each other. Pure code motion
// — every line of actual behavior below is unchanged from what was
// working in App.jsx; only the file it lives in has changed.
import React, { useState, useMemo, useEffect } from "react";
import packageJson from "../../package.json";
const APP_VERSION = packageJson.version;
import {
  WarningIcon as AlertTriangle, CheckIcon as Check, CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight, EyeIcon as Eye, EyeSlashIcon as EyeOff,
  ListChecksIcon as ClipboardCheck, DatabaseIcon as Database, DownloadSimpleIcon as Download,
  FireIcon as Flame, TreeStructureIcon as ListTree, MicroscopeIcon as Microscope,
  PillIcon as Pill, GearIcon as SettingsIcon, ShieldIcon as Shield,
  StethoscopeIcon as Stethoscope, TrashIcon as Trash2, UploadSimpleIcon as Upload, UserIcon as User,
  TagIcon as Palette, ArrowUUpLeftIcon as ResetIcon, CalendarIcon as Calendar,
  FileCsvIcon as FileCsv,
} from "@phosphor-icons/react";
import { ACCENTS, ACTION } from "../calculations/designTokens";
import { ModuleColorRepository, CUSTOMIZABLE_MODULE_KEYS } from "../repositories/moduleColorRepository";
import { computeAdherence } from "../calculations/medicationCalculations";
import { isQualifyingEncounter, DOXYPEP_WINDOW_HOURS, findDoxyPepMedication } from "../calculations/doxyPepCalculations";
import {
  getActivitiesPerMonth, getTopKinks, getTestingFrequencyStats, BASHH_TESTING_INTERVAL_DAYS, BASHH_TESTING_SOURCE_URL,
  getOverallAdherence, getDoxyPepComplianceRate, getContactsAddedPerMonth,
} from "../calculations/statsCalculations";
import { useDarkModePreference } from "../calculations/darkModePreference";
import { exportBackup, importBackupFromFile, EXPORT_GROUPS, getLastBackupInfo, hasUnbackedChanges } from "../storage/backupService";
import { exportRecordsAsCSV } from "../storage/csvExportService";
import { localStorageAdapter } from "../storage/storageAdapter";
import { computeKinkUsage, computeChemsUsage, computeProtectionUsage, computeSymptomsUsage, computeOrganismUsage, computeResultsUsage } from "../calculations/registryUsage";
import { ContactRepository } from "../repositories/contactRepository";
import { EncounterRepository } from "../repositories/encounterRepository";
import { MedicationRepository } from "../repositories/medicationRepository";
import { LogRepository } from "../repositories/logRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { TrashRepository, MODULE_LABELS as TRASH_MODULE_LABELS } from "../repositories/trashRepository";
import { getCalendarEvents, groupEventsByDay } from "../calculations/calendarCalculations";
import { LocationsRepository } from "../repositories/locationsRepository";
import { PrivacySettingsRepository } from "../repositories/privacySettingsRepository";
import { AppPreferencesRepository } from "../repositories/appPreferencesRepository";
import { EpisodeRepository } from "../repositories/episodeRepository";
import { KinkRegistry } from "../registries/kinkRegistry";
import { ChemsRegistry } from "../registries/chemsRegistry";
import { ProtectionRegistry } from "../registries/protectionRegistry";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { OrganismRegistry } from "../registries/organismRegistry";
import { ResultsRegistry } from "../registries/resultsRegistry";
import MyProfileModule from "./SHOS_MyProfile_Prototype";
import RegistryManagementScreen from "./SHOS_RegistryManagement_Prototype";
import OptionListsScreen from "./SHOS_OptionListEditor_Prototype";

function SelectiveExportSheet({ onClose, onExported }) {
  const [darkMode] = useDarkModePreference();

  // All items checked by default — "everything, but deselectable",
  // exactly as asked, rather than starting from nothing and making
  // The user build the full set back up by hand every time.
  const allKeys = EXPORT_GROUPS.flatMap((g) => g.items.map((i) => i.dataKey));
  const [checked, setChecked] = useState(() => new Set(allKeys));

  const isGroupFullyChecked = (group) => group.items.every((i) => checked.has(i.dataKey));
  const isGroupPartiallyChecked = (group) => group.items.some((i) => checked.has(i.dataKey)) && !isGroupFullyChecked(group);

  const toggleItem = (dataKey) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  };
  const toggleGroup = (group) => {
    const shouldCheck = !isGroupFullyChecked(group);
    setChecked((prev) => {
      const next = new Set(prev);
      group.items.forEach((i) => (shouldCheck ? next.add(i.dataKey) : next.delete(i.dataKey)));
      return next;
    });
  };

  const doExport = () => {
    exportBackup(checked.size === allKeys.length ? null : Array.from(checked));
    onExported?.();
    onClose();
  };

  const Box = ({ state }) => (
    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${state === "empty" ? "#9A9AA1" : ACCENTS.healthcare}`, background: state === "full" ? ACCENTS.healthcare : state === "partial" ? "#C7D5F7" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {state === "full" && <Check size={12} color="#FFFFFF" weight="bold" />}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 220 }} onClick={onClose}>
      <div style={{ background: darkMode ? DARK.bg : "#F0F0F3", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Export — choose what to include</span>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 4 }}>Everything is included by default. Untick anything you'd rather leave out of this particular file.</div>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 20px", flex: 1 }}>
          {EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, marginBottom: 10, overflow: "hidden" }}>
              <div onClick={() => toggleGroup(group)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", borderBottom: group.items.length > 1 ? "1px solid #DCDCE1" : "none" }}>
                <Box state={isGroupFullyChecked(group) ? "full" : isGroupPartiallyChecked(group) ? "partial" : "empty"} />
                <span style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{group.label}</span>
              </div>
              {group.items.length > 1 && group.items.map((item) => (
                <div key={item.dataKey} onClick={() => toggleItem(item.dataKey)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px 9px 34px", cursor: "pointer" }}>
                  <Box state={checked.has(item.dataKey) ? "full" : "empty"} />
                  <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 20px", borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", flexShrink: 0 }}>
          <button onClick={doExport} disabled={checked.size === 0}
            style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: checked.size === 0 ? "#9A9AA1" : ACCENTS.healthcare, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: checked.size === 0 ? "default" : "pointer" }}>
            {checked.size === allKeys.length ? "Export everything" : `Export selected (${checked.size} of ${allKeys.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ADDED — real ask: "CSV next". Reuses EXPORT_GROUPS' own grouping
// (same source of truth as Selective export above) but excludes the
// two groups that aren't lists of records — My Profile (a singleton)
// and App settings (custom option lists / privacy settings, which are
// simple key-value config, not spreadsheet-shaped data). Deliberately
// one tap = one CSV file, not a multi-select like Selective export:
// each record type has a genuinely different column shape, so there's
// no single sensible "combined" CSV to build toward.
const CSV_EXPORT_GROUPS = EXPORT_GROUPS.filter((g) => g.key !== "profile" && g.key !== "appSettings");

function CSVExportSheet({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const [status, setStatus] = useState(null);

  const doExport = async (item) => {
    setStatus({ dataKey: item.dataKey, msg: "Exporting…", ok: null });
    try {
      await exportRecordsAsCSV(item.dataKey, item.label);
      setStatus({ dataKey: item.dataKey, msg: `${item.label} exported.`, ok: true });
    } catch (err) {
      setStatus({ dataKey: item.dataKey, msg: err.message, ok: false });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 220 }} onClick={onClose}>
      <div style={{ background: darkMode ? DARK.bg : "#F0F0F3", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Export as CSV</span>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 4 }}>Pick one record type — spreadsheet-readable (Excel, Sheets), for reading elsewhere, not for restoring into SHOS itself (use a backup for that).</div>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 20px 20px", flex: 1 }}>
          {CSV_EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, marginBottom: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px 6px", fontSize: 12, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5 }}>{group.label}</div>
              {group.items.map((item) => (
                <div key={item.dataKey} onClick={() => doExport(item)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", cursor: "pointer", borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
                  <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{item.label}</span>
                  {status?.dataKey === item.dataKey ? (
                    <span style={{ fontSize: 11, color: status.ok === false ? ACTION.red : status.ok ? ACTION.green : (darkMode ? DARK.textDisabled : "#9A9AA1") }}>{status.msg}</span>
                  ) : (
                    <FileCsv size={16} color={darkMode ? DARK.textDisabled : "#9A9AA1"} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — Developer tools, real content instead of the
// honest-but-empty "Not built yet" stub. Deliberately modest scope for
// a single-user prototype: a storage overview (so the user can see at a
// glance whether the app is actually holding what he thinks it's
// holding) and a full reset, which is the one genuinely useful
// "developer tool" this app needs right now. Preferences/Privacy/
// Appearance stay stubbed — those involve real, unresolved design
// forks (what counts as identifiable for the anonymise-mode idea;
// the font/theme system's own cross-cutting refactor already flagged
// as needing its own dedicated session) that shouldn't be guessed at
// just to fill in a Settings row.
function DeveloperToolsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [resetStage, setResetStage] = useState("idle"); // idle -> confirming -> done
  const counts = [
    { label: "Contacts", value: ContactRepository.getAll().length },
    { label: "Encounters", value: EncounterRepository.getAll().length },
    { label: "Medications", value: MedicationRepository.getAll().length },
    { label: "Medication log entries", value: LogRepository.getAll().length },
    { label: "Tests", value: TestingRepository.getAll().length },
    { label: "Clinic visits", value: ClinicVisitsRepository.getAll().length },
    { label: "Symptom Log entries", value: SymptomLogRepository.getAll().length },
    { label: "Vaccinations", value: VaccinationRepository.getAll().length },
    { label: "Timeline episodes", value: EpisodeRepository.getAll().length },
    { label: "Kink Registry entries", value: KinkRegistry.getAll().length },
    { label: "Chems Registry entries", value: ChemsRegistry.getAll().length },
    { label: "Protection Registry entries", value: ProtectionRegistry.getAll().length },
    { label: "Symptoms Registry entries", value: SymptomsRegistry.getAll().length },
    { label: "Locations", value: LocationsRepository.getAll().length },
    { label: "Organism Registry entries", value: OrganismRegistry.getAll().length },
    { label: "Results Registry entries", value: ResultsRegistry.getAll().length },
  ];

  const handleReset = () => {
    localStorageAdapter.clearAllAppData();
    setResetStage("done");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Developer tools</span>
      </div>

      {/* ADDED — real ask: this never explained what it was actually
          counting. It's a real storage overview (every repository's
          live record count) plus a full reset below — not a
          timeframe-based count, that's a separate, still-outstanding
          Activity filter request. */}
      <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", padding: "10px 16px 0" }}>
        Live record counts across every part of the app's local storage, mainly useful for confirming a backup/restore or migration went as expected.
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 16px 6px" }}>Storage overview</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", padding: "4px 14px" }}>
        {counts.map((c) => (
          <div key={c.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{c.label}</span>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{c.value}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Danger zone</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: `1px solid ${ACTION.red}`, borderRadius: 16, margin: "0 16px 20px", padding: 16 }}>
        {resetStage === "done" ? (
          <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>All app data cleared. Reload the app to see the fresh-start state.</div>
        ) : resetStage === "confirming" ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
              <AlertTriangle size={16} color={ACTION.red} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>This permanently deletes every contact, encounter, medication, log, test, clinic visit, and registry entry on this device. There's no undo — export a backup first if you're not sure.</div>
            </div>
            {/* ADDED 26 Aug 2026 — real ask: warn explicitly if there
                are genuinely unbacked-up changes, not just a generic
                "back up first" reminder every time regardless of
                whether anything's actually at risk. */}
            {hasUnbackedChanges() && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: `${ACTION.red}15`, border: `1px solid ${ACTION.red}` }}>
                <AlertTriangle size={14} color={ACTION.red} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: ACTION.red, fontWeight: 600 }}>You have changes since your last backup that would be lost. Export a backup before continuing.</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setResetStage("idle")} style={{ flex: 1, padding: 12, borderRadius: 12, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: darkMode ? DARK.surface : "#FFFFFF", color: darkMode ? DARK.textSecondary : "#5B5B62", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleReset} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: ACTION.red, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Yes, delete everything</button>
            </div>
          </>
        ) : (
          <div onClick={() => setResetStage("confirming")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <Trash2 size={17} color={ACTION.red} />
            <span style={{ fontSize: 14, color: ACTION.red, fontWeight: 600 }}>Reset all app data</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — Registries picker: the entry point to the 6
// shared Registry Management screens. Colors match Doc 2's real domain
// assignments exactly (Kink=red, Protection=Encounters pink, Chems=
// neutral grey, Symptoms/Organism/Results=Healthcare blue), re-checked
// directly against the doc rather than guessed at.
// ADDED 19 Aug 2026 — real ask: "like in Notion, all options should
// have an emoji and colour theme... clean to infer from" — an icon +
// color per REGISTRY/CATEGORY (matching Notion's own per-database icon
// convention), not per individual entry within a registry (a bigger,
// separate ask — per-value icons for every single Kink/Chem/etc. entry
// would need real UI work letting the user pick one per entry, not done
// here, flagged rather than silently attempted). Organism → Microscope
// is the user's own named example, applied literally.
const REGISTRIES = [
  { key: "kink", label: "Kink Registry", registry: KinkRegistry, color: "#E5484D", icon: Flame, computeUsage: computeKinkUsage },
  { key: "protection", label: "Protection Registry", registry: ProtectionRegistry, color: "#E24E9C", icon: Shield, computeUsage: computeProtectionUsage },
  { key: "chems", label: "Chems Registry", registry: ChemsRegistry, color: "#5B5B62", icon: Pill, computeUsage: computeChemsUsage },
  { key: "symptoms", label: "Symptoms Registry", registry: SymptomsRegistry, color: ACCENTS.healthcare, icon: Stethoscope, computeUsage: computeSymptomsUsage },
  { key: "organism", label: "Organism Registry", registry: OrganismRegistry, color: ACCENTS.healthcare, icon: Microscope, computeUsage: computeOrganismUsage },
  { key: "results", label: "Results Registry", registry: ResultsRegistry, color: ACCENTS.healthcare, icon: ClipboardCheck, computeUsage: computeResultsUsage },
];

function RegistriesScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [openRegistry, setOpenRegistry] = useState(null);
  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Registries</span>
      </div>
      <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", padding: "10px 16px 0" }}>
        Manage the shared vocabularies used across Contacts, Encounters, Testing, and Clinic Visits — rename or archive an entry directly, rather than only through whichever picker happens to reference it.
      </div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "16px 16px 20px", overflow: "hidden" }}>
        {REGISTRIES.map((r) => (
          <div key={r.key} onClick={() => setOpenRegistry(r)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* CHANGED 19 Aug 2026 — plain color dot replaced with a
                  real icon+color badge, matching every entry's own
                  logical icon rather than an undifferentiated dot. */}
              <div style={{ width: 28, height: 28, borderRadius: 999, background: `${r.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <r.icon size={14} color={r.color} />
              </div>
              <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>{r.label}</span>
            </div>
            <ChevronRight size={16} color={darkMode ? DARK.textDisabled : "#9A9AA1"} />
          </div>
        ))}
      </div>
      {openRegistry && (
        <RegistryManagementScreen registry={openRegistry.registry} label={openRegistry.label} color={openRegistry.color} computeUsage={openRegistry.computeUsage} onClose={() => setOpenRegistry(null)} />
      )}
    </div>
  );
}

// ADDED 19 Aug 2026 — Privacy screen: Anonymise mode. Real, scoped ask
// from the user, not the earlier vague "what counts as identifiable"
// unknown — see privacySettingsRepository.js for the full reasoning
// and exact field-tier list.
function PrivacyScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [settings, setSettings] = useState(() => PrivacySettingsRepository.getSettings());
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  // ADDED — real ask: force reconfirmation before accepting a new PIN,
  // to catch typos (a wrong PIN saved silently would lock the user out of
  // his own Anonymise-revert/App-Lock later, with no way back in).
  const [confirmPin, setConfirmPin] = useState("");
  // ADDED — real ask: eye-icon show/hide toggle on PIN entry, matching
  // the pattern used elsewhere on the web. Shared across every PIN
  // field on this screen.
  const [showPins, setShowPins] = useState(false);

  const refresh = () => setSettings(PrivacySettingsRepository.getSettings());

  const activate = () => { PrivacySettingsRepository.activate(); refresh(); };
  const attemptDeactivate = () => {
    const result = PrivacySettingsRepository.deactivate(pinEntry);
    if (result.ok) { setPinEntry(""); setPinError(""); refresh(); }
    else setPinError(result.error);
  };
  const savePin = () => {
    const trimmed = newPin.trim();
    if (trimmed.length < 4) { setPinError("PIN should be at least 4 digits."); return; }
    // CHANGED — real ask: force reconfirmation before accepting.
    if (trimmed !== confirmPin.trim()) { setPinError("PINs don't match — check both and try again."); return; }
    PrivacySettingsRepository.update({ anonymisePin: trimmed });
    setNewPin(""); setConfirmPin(""); setSettingPin(false); setPinError("");
    refresh();
  };

  // ADDED 19 Aug 2026 — App Lock toggle, real ask. Guarded: can't turn
  // on without a PIN already set, since App Lock with no PIN would
  // show a lock screen that anything (even leaving the field blank)
  // trivially bypasses — confusing, not actually locked. Turning OFF
  // never needs the PIN re-entered here; you're already inside
  // Settings, which the lock screen itself already gated.
  const toggleAppLock = () => {
    if (!settings.appLockEnabled && !settings.anonymisePin) {
      setPinError("Set a PIN below first, then App Lock can use it.");
      return;
    }
    PrivacySettingsRepository.update({ appLockEnabled: !settings.appLockEnabled });
    refresh();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Privacy & Security</span>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Big, clearly separated toggle button — never on by default,
            per the user's explicit instruction, and always one tap to turn
            ON regardless of any PIN. */}
        <div onClick={settings.anonymiseModeActive ? undefined : activate}
          style={{ padding: 18, borderRadius: 16, background: settings.anonymiseModeActive ? "#1B1B1F" : (darkMode ? DARK.surface : "#FFFFFF"), border: `1px solid ${settings.anonymiseModeActive ? "#1B1B1F" : (darkMode ? DARK.border : "#DCDCE1")}`, cursor: settings.anonymiseModeActive ? "default" : "pointer", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {settings.anonymiseModeActive ? <EyeOff size={20} color="#FFFFFF" /> : <Eye size={20} color={darkMode ? DARK.textPrimary : "#1B1B1F"} />}
            <span style={{ fontSize: 15, fontWeight: 700, color: settings.anonymiseModeActive ? "#FFFFFF" : (darkMode ? DARK.textPrimary : "#1B1B1F") }}>
              {settings.anonymiseModeActive ? "Anonymise mode is ON" : "Turn on Anonymise mode"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: settings.anonymiseModeActive ? "#DCDCE1" : (darkMode ? DARK.textSecondary : "#5B5B62"), marginTop: 6 }}>
            {settings.anonymiseModeActive
              ? "Names, photos, addresses, and car details are hidden across Contacts."
              : "Tap right before handing your phone over — hides names, photos, addresses, and car registration in Contacts. Never turns on by itself."}
          </div>
        </div>

        {settings.anonymiseModeActive && (
          <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 8 }}>
              {settings.anonymisePin ? "Enter your PIN to turn it back off" : "Turn it back off"}
            </div>
            {settings.anonymisePin && (
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={pinEntry} onChange={(e) => { setPinEntry(e.target.value); setPinError(""); }} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="PIN"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
            )}
            {pinError && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 8 }}>{pinError}</div>}
            <button onClick={attemptDeactivate} style={{ width: "100%", padding: 12, borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
              Turn off Anonymise mode
            </button>
          </div>
        )}

        {/* CHANGED — real ask: moved to sit immediately below the base
            Anonymise toggle (was further down, after App Lock) — also
            now genuinely disabled, not just visually de-emphasized,
            unless Anonymise mode is actually on. Toggling "further"
            hiding when the base tier isn't even active never made
            sense — there'd be nothing for it to add on top of. */}
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16, marginBottom: 16, opacity: settings.anonymiseModeActive ? 1 : 0.5 }}>
          <div onClick={settings.anonymiseModeActive ? () => { PrivacySettingsRepository.update({ hideFurtherEnabled: !settings.hideFurtherEnabled }); refresh(); } : undefined}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: settings.anonymiseModeActive ? "pointer" : "default" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Also hide kinks & physical attributes</div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>
                {settings.anonymiseModeActive
                  ? "Stated kinks, limits, length/girth, and Cummer stats — hidden in addition to the base fields above, only while Anonymise mode is on."
                  : "Turn on Anonymise mode above first — this only ever applies on top of it."}
              </div>
            </div>
            <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.hideFurtherEnabled ? ACCENTS.healthcare : "#DCDCE1", position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: settings.hideFurtherEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: darkMode ? DARK.surface : "#FFFFFF" }} />
            </div>
          </div>
        </div>

        {/* ADDED 19 Aug 2026 — App Lock, real ask, separate from
            Anonymise mode: gates opening the app at all, not just
            masking fields once it's open. Biometric (Face ID/
            fingerprint) isn't available here — needs the Capacitor
            native wrapper's own APIs, not buildable in a browser/PWA. */}
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div onClick={toggleAppLock} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>App Lock</div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>Require your PIN just to open the app at all. Uses the same PIN as the Revert PIN below. Biometric unlock isn't available yet — needs the native app version.</div>
            </div>
            <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.appLockEnabled ? ACCENTS.healthcare : "#DCDCE1", position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: settings.appLockEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: darkMode ? DARK.surface : "#FFFFFF" }} />
            </div>
          </div>
          {/* ADDED 19 Aug 2026 — real fix while building this: without
              this, the "set a PIN first" guard message had nowhere to
              actually render when neither the deactivate flow nor the
              set-PIN flow was open — the user would tap the toggle, nothing
              would visibly happen, and the guard would silently do
              nothing from his side. */}
          {pinError && !settings.anonymiseModeActive && !settingPin && (
            <div style={{ fontSize: 12, color: ACTION.red, marginTop: 8 }}>{pinError}</div>
          )}
        </div>

        {/* CHANGED — real ask: "App Lock and Revert PIN should be
            neighbours" — moved to sit directly below App Lock now,
            since they share the exact same PIN. */}
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>Revert PIN</div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 10 }}>
            {settings.anonymisePin ? "A PIN is set — used for both Anonymise mode's revert and App Lock above." : "No PIN set yet — anyone can turn Anonymise mode back off right now, and App Lock can't be turned on. Set one so both actually protect you."}
          </div>
          {settingPin ? (
            <>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={newPin} onChange={(e) => setNewPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="New PIN (4+ digits)"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
              {/* ADDED — real ask: force reconfirmation before accepting,
                  to catch typos before they lock the user out later. */}
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="Confirm new PIN"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
              {pinError && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 8 }}>{pinError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setSettingPin(false); setNewPin(""); setConfirmPin(""); setPinError(""); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: "transparent", color: darkMode ? DARK.textSecondary : "#5B5B62", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={savePin} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Save PIN</button>
              </div>
            </>
          ) : (
            <button onClick={() => setSettingPin(true)} style={{ width: "100%", padding: 10, borderRadius: 999, border: `1px solid ${ACCENTS.healthcare}`, background: "transparent", color: ACCENTS.healthcare, fontWeight: 700, cursor: "pointer" }}>
              {settings.anonymisePin ? "Change PIN" : "Set a PIN"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — Preferences, real now. Deliberately small — one
// real, concrete setting (the user's own ask), not speculative toggles
// filling out a section just because it existed. More real
// Preferences items land here as they come up, same pattern as
// Privacy/Registries/Option lists getting built incrementally rather
// than all at once up front.
function PreferencesScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [prefs, setPrefs] = useState(() => AppPreferencesRepository.getPreferences());
  const [draftValue, setDraftValue] = useState(() => String(prefs.inactiveThresholdDays));

  const save = () => {
    const parsed = parseInt(draftValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    const updated = AppPreferencesRepository.update({ inactiveThresholdDays: parsed });
    setPrefs(updated);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Preferences</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>Inactive contact threshold</div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 12 }}>
            Days since a Contact's last Encounter before it shows the red "inactive" flag. Was fixed at 90 — now yours to set. A specific contact can also be excluded from this entirely (edit that contact → "One-off / never expect to recur").
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} type="number" min="1"
              style={{ width: 90, padding: "10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>days</span>
            <button onClick={save} style={{ marginLeft: "auto", padding: "10px 18px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
              Save
            </button>
          </div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1", marginTop: 10 }}>Currently: {prefs.inactiveThresholdDays} days.</div>
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
const MODULE_LABELS = { contacts: "Contacts", encounters: "Encounter", medication: "Medication", healthcare: "Healthcare", home: "Home" };

// ADDED 26 Aug 2026 — real ask: clickable info explaining the
// calculation behind a stat, citing real guidance (BASHH/CDC) where
// relevant. A styled "i" rather than a new icon import — this session
// already found two confirmed-broken icon imports elsewhere, so a
// zero-risk approach felt safer than a third guess.
function InfoIcon({ onClick }) {
  const [darkMode] = useDarkModePreference();

  return (
    <div onClick={onClick} style={{ width: 16, height: 16, borderRadius: 999, border: "1px solid #9A9AA1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", cursor: "pointer", flexShrink: 0 }}>i</div>
  );
}

function StatRow({ label, value, explanation, sourceUrl }) {
  const [darkMode] = useDarkModePreference();

  const [showInfo, setShowInfo] = useState(false);
  return (
    <div style={{ padding: "12px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{label}</span>
          <InfoIcon onClick={() => setShowInfo((s) => !s)} />
        </div>
        <span style={{ fontSize: 15, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 700 }}>{value}</span>
      </div>
      {showInfo && (
        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: darkMode ? DARK.bg : "#F0F0F3", fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", lineHeight: 1.5 }}>
          {explanation}
          {sourceUrl && (
            <div style={{ marginTop: 4 }}>
              <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#3D63C9", fontSize: 11 }}>View source guidance →</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: Stats page, grouped by context
// (Activity/Healthcare/Medication/Contacts), each stat with a
// clickable info explaining the calculation and citing real clinical
// guidance where relevant (BASHH), not just internal app logic.
function StatsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const encounters = useMemo(() => EncounterRepository.getAll(), []);
  const contacts = useMemo(() => ContactRepository.getAll(), []);
  const tests = useMemo(() => TestingRepository.getAll(), []);
  // computeAdherence() reads med.logs directly — not part of the raw
  // repository record, so it has to be stitched on here too (same as
  // SHOS_Medication_Dashboard_Prototype.jsx's loadMedications()).
  const medications = useMemo(() => MedicationRepository.getAll().map((med) => ({ ...med, logs: LogRepository.getForMedication(med.id) })), []);

  const activityMonths = useMemo(() => getActivitiesPerMonth(encounters, 6), [encounters]);
  const topKinks = useMemo(() => getTopKinks(encounters, contacts, (id) => KinkRegistry.getById(id)?.name, 5), [encounters, contacts]);
  const testingStats = useMemo(() => getTestingFrequencyStats(tests), [tests]);
  const adherence = useMemo(() => getOverallAdherence(medications, computeAdherence), [medications]);
  const doxyCompliance = useMemo(() => {
    const doxyMed = findDoxyPepMedication(medications);
    if (!doxyMed) return null;
    return getDoxyPepComplianceRate(encounters, LogRepository.getForMedication(doxyMed.id), isQualifyingEncounter, DOXYPEP_WINDOW_HOURS);
  }, [encounters, medications]);
  const contactMonths = useMemo(() => getContactsAddedPerMonth(contacts, 6), [contacts]);

  const maxActivity = Math.max(1, ...activityMonths.map((b) => b.count));
  const maxContacts = Math.max(1, ...contactMonths.map((b) => b.count));

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Stats</span>
      </div>
      <div style={{ padding: 16 }}>

        {/* Activity */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.encounters, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Encounter</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Encounters per month</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
              {activityMonths.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: `${Math.max(4, (b.count / maxActivity) * 44)}px`, background: ACCENTS.encounters, borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : "#9A9AA1" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 8 }}>Top kinks/roles logged</div>
            {topKinks.length === 0 ? (
              <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#9A9AA1", fontStyle: "italic" }}>Nothing logged yet.</div>
            ) : topKinks.map((k) => (
              <div key={k.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{k.name}</span>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", fontWeight: 600 }}>{k.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Healthcare */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.healthcare, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Healthcare</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <StatRow label="Tests logged" value={testingStats.testCount}
            explanation="Total non-archived tests with a real (not future-scheduled) date." />
          <StatRow label="Average interval between tests"
            value={testingStats.averageIntervalDays != null ? `${testingStats.averageIntervalDays} days` : "Not enough data"}
            explanation="Average days between consecutive tests. Needs at least 2 real tests to calculate." />
          <StatRow label="Within BASHH-recommended interval?"
            value={testingStats.withinBashhInterval == null ? "—" : testingStats.withinBashhInterval ? "Yes" : "No"}
            explanation={`BASHH's 2023 summary guidance recommends 3-monthly (90-day) asymptomatic STI screening for higher-risk groups, matching CDC's own 3–6 month guidance for PrEP users. This compares days since your last test against that 90-day reference point — not a personalised recommendation, just the cited benchmark.`}
            sourceUrl={BASHH_TESTING_SOURCE_URL} />
        </div>

        {/* Medication */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.medication, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Medication</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <StatRow label="Overall adherence (7-day)" value={adherence != null ? `${adherence}%` : "Not enough data"}
            explanation="Average of each daily/scheduled medication's own 7-day adherence rate (doses actually logged vs. doses expected). PRN medications aren't included — there's no fixed expected schedule to measure against." />
          <StatRow label="DoxyPEP compliance" value={doxyCompliance != null ? `${doxyCompliance}%` : "No DoxyPEP medication set up"}
            explanation="Of each qualifying-activity window (see the DoxyPEP alert's own logic — mucous-membrane contact, BASHH/CDC-sourced), the percentage where a dose was actually logged within the real 72-hour window. Sequential activity in the same window counts once, matching the real alert's own anchoring rule." />
        </div>

        {/* Contacts */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.contacts, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Contacts</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Contacts added per month</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
              {contactMonths.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: `${Math.max(4, (b.count / maxContacts) * 44)}px`, background: ACCENTS.contacts, borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : "#9A9AA1" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: hex/RGB entry alongside the native
// colour picker, since that alone "feels v dated". CMYK deliberately
// NOT implemented — it's a print colour model, not a screen one;
// converting a CMYK value to the RGB this app actually renders in is
// inherently lossy/approximate, and offering it would imply an
// accuracy that doesn't really exist for on-screen colour.
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Number(n) || 0));
  return "#" + [clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function ColorInputRow({ colorKey, currentValue, isOverridden, onSetColor, onReset, label }) {
  const [darkMode] = useDarkModePreference();

  const [expanded, setExpanded] = useState(false);
  const [hexDraft, setHexDraft] = useState(currentValue);
  const rgb = hexToRgb(currentValue) || { r: 0, g: 0, b: 0 };

  const commitHex = (v) => {
    setHexDraft(v);
    if (/^#?[a-f\d]{6}$/i.test(v)) onSetColor(colorKey, v.startsWith("#") ? v : `#${v}`);
  };
  const commitRgbChannel = (channel, value) => {
    const next = { ...rgb, [channel]: value };
    onSetColor(colorKey, rgbToHex(next.r, next.g, next.b));
  };

  return (
    <div style={{ borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div onClick={() => setExpanded((e) => !e)} style={{ width: 16, height: 16, borderRadius: "50%", background: currentValue, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: "pointer" }} />
          <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>{label}</span>
          {isOverridden && <span style={{ fontSize: 10, color: darkMode ? DARK.textDisabled : "#9A9AA1", fontStyle: "italic" }}>(customised)</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isOverridden && (
            <ResetIcon size={16} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ cursor: "pointer" }} onClick={onReset} title="Reset to default" />
          )}
          {/* CHANGED — real ask: the native colour picker (its own
              R/G/B or H/S/L sliders, not anything this app renders)
              wasn't opening preset to the module's actual current
              colour, defaulting to 0/black instead. The HTML spec for
              input[type=color]'s value requires a strict lowercase
              #rrggbb string — ACCENTS/ModuleColorRepository store hex
              in uppercase (e.g. "#D97706"), which some WebView colour
              pickers silently reject as invalid rather than
              normalizing, falling back to their own default. */}
          <input type="color" value={currentValue.toLowerCase()} onChange={(e) => onSetColor(colorKey, e.target.value)}
            style={{ width: 36, height: 28, padding: 0, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 6, cursor: "pointer" }} />
          <span onClick={() => setExpanded((e) => !e)} style={{ fontSize: 11, color: "#3D63C9", fontWeight: 600, cursor: "pointer" }}>{expanded ? "Hide" : "Hex/RGB"}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>Hex</div>
          <input value={hexDraft} onChange={(e) => commitHex(e.target.value)} placeholder="#RRGGBB"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontFamily: "monospace", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>RGB</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["r", "g", "b"].map((channel) => (
              <input key={channel} type="number" min="0" max="255" value={rgb[channel]}
                onChange={(e) => commitRgbChannel(channel, e.target.value)}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 13, boxSizing: "border-box" }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: Trash / recently deleted, a genuine
// persistent holding area distinct from the 8s undo toast built
// earlier this session — that toast only covers the immediate moment
// of deletion, this is for "I deleted this three days ago and want it
// back." 30-day retention, matching common conventions (Photos apps,
// most email clients).
const TRASH_REPOSITORIES = {
  contacts: ContactRepository,
  encounters: EncounterRepository,
  testing: TestingRepository,
  clinicVisits: ClinicVisitsRepository,
  symptomLog: SymptomLogRepository,
  vaccinations: VaccinationRepository,
  medications: MedicationRepository,
};

// ADDED 26 Aug 2026 — real ask: calendar view, Google-Calendar-style,
// pulling real events from every module. Lives in Settings per the user's
// own placement call — Healthcare (where Timeline currently sits) is
// domain-specific, wrong home for something cross-module; Home
// already has its own Timeline shortcut, so a full duplicate there
// would be redundant. A compact icon-based entry point on Home
// supplements this (see SHOS_Home_Prototype.jsx), not a second full
// shortcut. See calendarCalculations.js for the real scope decision
// on what counts as an "event" (daily medication doses deliberately
// excluded — see that file's own comment for why).
const CALENDAR_MODULE_TARGETS = {
  encounters: { tab: "activity", subTab: null },
  testing: { tab: "healthcare", subTab: "testing" },
  clinicVisits: { tab: "healthcare", subTab: "clinicVisits" },
  vaccinations: { tab: "healthcare", subTab: "vaccinations" },
  symptomLog: { tab: "healthcare", subTab: "symptomLog" },
  medications: { tab: "medication", subTab: null },
};

// ADDED 26 Aug 2026 — real ask: About/version screen, a genuine
// missing basic flagged in the final audit. version/buildDate come
// from package.json and the actual build timestamp — real values,
// not decorative. GitHub link points at the actual repo so a real
// build issue can be traced back to source.
function AboutScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>About</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>SHOS</div>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#9A9AA1" }}>Sexual Health Operating System</div>
        </div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Version</span>
            {/* CHANGED — real ask: was hardcoded placeholder, now reads
                the actual version from package.json rather than a
                second, easy-to-forget copy of the same number. */}
            <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600 }}>{APP_VERSION}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Repository</span>
            <a href="https://github.com/drwho2001/Claude-shos-v1" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#3D63C9", fontWeight: 600 }}>
              GitHub →
            </a>
          </div>
        </div>
        <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1", textAlign: "center", marginTop: 16 }}>
          Local-first — nothing here leaves this device unless you choose to export or share it.
        </div>
      </div>
    </div>
  );
}

function CalendarScreen({ onClose, onNavigateToRecord }) {
  const [darkMode] = useDarkModePreference();

  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState(null);
  // ADDED 26 Aug 2026 — real ask: filters, standard on every other
  // module's list this session — shouldn't have been skipped here.
  const ALL_MODULE_KEYS = ["encounters", "testing", "clinicVisits", "vaccinations", "symptomLog", "medications"];
  const [showFilters, setShowFilters] = useState(false);
  const [activeModules, setActiveModules] = useState(ALL_MODULE_KEYS);
  const toggleModule = (key) => setActiveModules((cur) => cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]);

  const allEvents = useMemo(() => getCalendarEvents({
    encounters: EncounterRepository.getAll(),
    tests: TestingRepository.getAll(),
    clinicVisits: ClinicVisitsRepository.getAll(),
    vaccinations: VaccinationRepository.getAll(),
    symptomEntries: SymptomLogRepository.getAll(),
    medications: MedicationRepository.getAll(),
  }), []);
  const events = useMemo(() => allEvents.filter((e) => activeModules.includes(e.moduleKey)), [allEvents, activeModules]);
  const grouped = useMemo(() => groupEventsByDay(events), [events]);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const dayKey = (day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const selectedEvents = selectedDay ? (grouped[dayKey(selectedDay)] || []) : [];

  const goToEvent = (ev) => {
    const target = CALENDAR_MODULE_TARGETS[ev.moduleKey];
    if (!target) return;
    onNavigateToRecord?.(target.tab, ev.id, target.subTab);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
          <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Calendar</span>
        </div>
        <span onClick={() => setShowFilters((s) => !s)} style={{ fontSize: 12, fontWeight: 600, color: activeModules.length < ALL_MODULE_KEYS.length ? "#3D63C9" : "#5B5B62", cursor: "pointer" }}>
          Filter{activeModules.length < ALL_MODULE_KEYS.length ? ` (${activeModules.length})` : ""}
        </span>
      </div>
      {showFilters && (
        <div style={{ padding: "10px 16px 0", display: "flex", flexWrap: "wrap", gap: 6, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", paddingBottom: 10 }}>
          {ALL_MODULE_KEYS.map((key) => {
            const active = activeModules.includes(key);
            return (
              <div key={key} onClick={() => toggleModule(key)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? ACCENTS[key] : "#DCDCE1"}`, color: active ? ACCENTS[key] : "#9A9AA1", background: active ? `${ACCENTS[key]}15` : "transparent" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? ACCENTS[key] : "#9A9AA1" }} />
                {TRASH_MODULE_LABELS[key]}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <ChevronLeft size={20} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={() => { setCursor(new Date(year, month - 1, 1)); setSelectedDay(null); }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
          <ChevronRight size={20} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={() => { setCursor(new Date(year, month + 1, 1)); setSelectedDay(null); }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1", fontWeight: 700, padding: "4px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const key = dayKey(day);
            const dayEvents = grouped[key] || [];
            const isToday = key === todayKey;
            const isSelected = selectedDay === day;
            const moduleColorsPresent = [...new Set(dayEvents.map((e) => e.moduleKey))].map((k) => ACCENTS[k] || "#9A9AA1");
            return (
              <div key={i} onClick={() => setSelectedDay(isSelected ? null : day)}
                style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 8, cursor: "pointer", background: isSelected ? "#1B1B1F" : isToday ? "#E7E7EB" : "transparent", gap: 2 }}>
                <span style={{ fontSize: 12, color: isSelected ? "#FFFFFF" : "#1B1B1F", fontWeight: isToday ? 700 : 400 }}>{day}</span>
                {moduleColorsPresent.length > 0 && (
                  <div style={{ display: "flex", gap: 2 }}>
                    {moduleColorsPresent.slice(0, 3).map((c, j) => <div key={j} style={{ width: 4, height: 4, borderRadius: "50%", background: c }} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedDay && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              {new Date(year, month, selectedDay).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ fontSize: 13, color: darkMode ? DARK.textDisabled : "#9A9AA1", fontStyle: "italic" }}>Nothing logged this day.</div>
            ) : (
              <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden" }}>
                {selectedEvents.map((ev, i) => (
                  <div key={i} onClick={() => goToEvent(ev)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: i < selectedEvents.length - 1 ? "1px solid #DCDCE1" : "none", cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENTS[ev.moduleKey] || "#9A9AA1", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1" }}>{TRASH_MODULE_LABELS[ev.moduleKey] || ev.moduleKey}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TrashScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [items, setItems] = useState(() => TrashRepository.getAll());
  const refresh = () => setItems(TrashRepository.getAll());
  // ADDED 26 Aug 2026 — real ask: 4 real actions (restore all/
  // selected, delete all/selected), with real multi-select on this
  // screen — reuses the exact same Select-toggle + toolbar pattern
  // already proven across every other module this session, rather
  // than inventing a new one just for Trash.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };

  const restoreEntries = (entries) => {
    entries.forEach((entry) => {
      const repo = TRASH_REPOSITORIES[entry.moduleKey];
      if (repo) repo.restore(entry.record);
      TrashRepository.removeEntry(entry.trashId);
    });
    refresh();
  };

  const restoreItem = (entry) => restoreEntries([entry]);
  const restoreAll = () => restoreEntries(items);
  const restoreSelected = () => { restoreEntries(items.filter((e) => selectedIds.includes(e.trashId))); exitSelectMode(); };

  const deletePermanently = (entry) => {
    if (window.confirm("Delete this permanently? It won't be recoverable after this.")) {
      TrashRepository.removeEntry(entry.trashId);
      refresh();
    }
  };
  const deleteAll = () => {
    if (window.confirm(`Permanently delete all ${items.length} item${items.length > 1 ? "s" : ""} in the trash? This can't be undone.`)) {
      TrashRepository.emptyAll();
      refresh();
    }
  };
  const deleteSelected = () => {
    if (window.confirm(`Permanently delete ${selectedIds.length} item${selectedIds.length > 1 ? "s" : ""}? This can't be undone.`)) {
      selectedIds.forEach((id) => TrashRepository.removeEntry(id));
      exitSelectMode();
      refresh();
    }
  };

  const recordLabel = (entry) => entry.record.title || entry.record.name || entry.record.displayName || "Untitled";

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
          <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Trash</span>
        </div>
        {items.length > 0 && (
          <span onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, color: "#3D63C9", cursor: "pointer" }}>
            {selectMode ? "Done" : "Select"}
          </span>
        )}
      </div>
      {selectMode && (
        <div style={{ background: "#1B1B1F", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600 }}>{selectedIds.length} selected</span>
          <div style={{ display: "flex", gap: 16 }}>
            <span onClick={() => selectedIds.length > 0 && restoreSelected()} style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#6E6E74", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Restore</span>
            <span onClick={() => selectedIds.length > 0 && deleteSelected()} style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FF7A7E" : "#6E6E74", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
            <span onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
          </div>
        </div>
      )}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#9A9AA1", marginBottom: 14 }}>
          Deleted items stay here for 30 days before they're no longer shown. This is separate from the "tap to undo" that appears right after deleting something.
        </div>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: darkMode ? DARK.textDisabled : "#9A9AA1", fontSize: 13 }}>Nothing in the trash.</div>
        ) : (
          <>
            {/* ADDED 26 Aug 2026 — real ask: "restore all" and "delete
                all", not just per-item and not just selected — always
                visible when there's anything to act on, independent of
                select mode. */}
            {!selectMode && (
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <span onClick={restoreAll} style={{ fontSize: 13, fontWeight: 600, color: "#3D63C9", cursor: "pointer" }}>Restore all</span>
                <span onClick={deleteAll} style={{ fontSize: 13, fontWeight: 600, color: ACTION.red, cursor: "pointer" }}>Delete all</span>
              </div>
            )}
            <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden" }}>
              {items.map((entry, i) => (
                <div key={entry.trashId} onClick={() => selectMode && toggleSelected(entry.trashId)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < items.length - 1 ? "1px solid #DCDCE1" : "none", cursor: selectMode ? "pointer" : "default" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    {selectMode && (
                      <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${selectedIds.includes(entry.trashId) ? "#3D63C9" : "#DCDCE1"}`, background: selectedIds.includes(entry.trashId) ? "#3D63C9" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {selectedIds.includes(entry.trashId) && <Check size={12} color="#FFFFFF" />}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                      <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recordLabel(entry)}</div>
                      <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1", marginTop: 2 }}>{TRASH_MODULE_LABELS[entry.moduleKey] || entry.moduleKey} · deleted {new Date(entry.deletedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>
                    </div>
                  </div>
                  {!selectMode && (
                    <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                      <span onClick={() => restoreItem(entry)} style={{ fontSize: 12, fontWeight: 700, color: "#3D63C9", cursor: "pointer" }}>Restore</span>
                      <span onClick={() => deletePermanently(entry)} style={{ fontSize: 12, fontWeight: 700, color: ACTION.red, cursor: "pointer" }}>Delete</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DesignScreen({ onClose }) {
  const [overrides, setOverrides] = useState(() => ModuleColorRepository.getOverrides());
  const [changed, setChanged] = useState(false);
  // ADDED 26 Aug 2026 — real ask: single global dark mode toggle here,
  // replacing Medication's own per-module icon. Same shared
  // useDarkModePreference() hook/storage key as before — only the
  // location of the control changed, not the preference itself.
  const [darkMode, setDarkMode] = useDarkModePreference();

  const setColor = (key, hex) => {
    ModuleColorRepository.setOverride(key, hex);
    setOverrides(ModuleColorRepository.getOverrides());
    setChanged(true);
  };
  const reset = (key) => {
    ModuleColorRepository.resetOverride(key);
    setOverrides(ModuleColorRepository.getOverrides());
    setChanged(true);
  };
  const resetAll = () => {
    ModuleColorRepository.resetAll();
    setOverrides({});
    setChanged(true);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Colour scheme</span>
      </div>
      <div style={{ padding: 16 }}>
        {changed && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 12, background: "#1B1B1F", color: "#FFFFFF", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} /> Colour changes need a reload to apply everywhere.
            </div>
            {/* ADDED 26 Aug 2026 — real ask: auto-reload on design edit.
                Not a true instant auto-reload — native colour inputs
                fire continuously while dragging in most browsers, so
                reloading on every event would interrupt you mid-pick.
                A one-tap reload right here, the moment you're done
                choosing, is the safe version of the same ask. */}
            <button onClick={() => window.location.reload()}
              style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #FFFFFF", background: "transparent", color: "#FFFFFF", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              Reload now
            </button>
          </div>
        )}
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
            <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>Dark mode</span>
            <div onClick={() => setDarkMode((d) => !d)}
              style={{ width: 44, height: 26, borderRadius: 999, background: darkMode ? "#1B1B1F" : "#DCDCE1", position: "relative", cursor: "pointer", transition: "background 0.15s" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: darkMode ? DARK.surface : "#FFFFFF", position: "absolute", top: 3, left: darkMode ? 21 : 3, transition: "left 0.15s" }} />
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Module colours</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden" }}>
          {CUSTOMIZABLE_MODULE_KEYS.map((key) => {
            const isOverridden = key in overrides;
            const currentValue = overrides[key] || ACCENTS[key];
            return (
              <ColorInputRow key={key} colorKey={key} currentValue={currentValue} isOverridden={isOverridden}
                label={MODULE_LABELS[key]} onSetColor={setColor} onReset={() => reset(key)} />
            );
          })}
        </div>
        {Object.keys(overrides).length > 0 && (
          <div onClick={resetAll} style={{ marginTop: 14, fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", textDecoration: "underline", cursor: "pointer", textAlign: "center" }}>
            Reset all to defaults
          </div>
        )}
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
function SettingsScreen({ onClose, onExport, onImportClick, status, onNavigateToRecord, initialScreen, registerModuleBackHandler }) {
  const [darkMode] = useDarkModePreference();

  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showSelectiveExport, setShowSelectiveExport] = useState(false);
  const [showCSVExport, setShowCSVExport] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showRegistries, setShowRegistries] = useState(false);
  const [showOptionLists, setShowOptionLists] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  // ADDED 26 Aug 2026 — real ask: design/preferences section for
  // colour scheme, ability to customize a module's base colour.
  const [showDesign, setShowDesign] = useState(false);
  // ADDED 26 Aug 2026 — real ask: Stats page.
  const [showStats, setShowStats] = useState(false);
  // ADDED 26 Aug 2026 — real ask: Trash / recently deleted.
  const [showTrash, setShowTrash] = useState(false);
  // ADDED 26 Aug 2026 — real ask: calendar view.
  const [showCalendar, setShowCalendar] = useState(initialScreen === "calendar");
  // ADDED 26 Aug 2026 — real ask: About/version screen, a genuine
  // missing basic flagged in the final audit — with multiple APK
  // builds now flowing through GitHub Actions, there was no way to
  // confirm which build is actually installed.
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    if (!registerModuleBackHandler) return;
    registerModuleBackHandler(() => {
      if (showCalendar) { setShowCalendar(false); return true; }
      if (showAbout) { setShowAbout(false); return true; }
      if (showTrash) { setShowTrash(false); return true; }
      if (showStats) { setShowStats(false); return true; }
      if (showDesign) { setShowDesign(false); return true; }
      if (showPreferences) { setShowPreferences(false); return true; }
      if (showPrivacy) { setShowPrivacy(false); return true; }
      if (showOptionLists) { setShowOptionLists(false); return true; }
      if (showRegistries) { setShowRegistries(false); return true; }
      if (showDevTools) { setShowDevTools(false); return true; }
      if (showSelectiveExport) { setShowSelectiveExport(false); return true; }
      if (showCSVExport) { setShowCSVExport(false); return true; }
      if (showMyProfile) { setShowMyProfile(false); return true; }
      return false; // nothing open on top — let App.jsx's own fallback close all of Settings
    });
    return () => registerModuleBackHandler(null);
  }, [showCalendar, showAbout, showTrash, showStats, showDesign, showPreferences, showPrivacy, showOptionLists, showRegistries, showDevTools, showSelectiveExport, showCSVExport, showMyProfile, registerModuleBackHandler]);

  // CHANGED 26 Aug 2026 — real ask: chrome-level icons (export/import/
  // settings/search) should be thick black lines, not too weighty.
  // Added an optional iconColor override (default unchanged, gray) so
  // this only affects the specific rows asked for, not every Registry/
  // Settings row that shares this component.
  const SettingsRow = ({ icon: Icon, label, onClick, disabled, iconColor = "#5B5B62" }) => (
    <div onClick={disabled ? undefined : onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={17} weight={iconColor !== "#5B5B62" ? "bold" : "regular"} color={iconColor} />
        <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>{label}</span>
      </div>
      {!disabled && <ChevronRight size={16} color={darkMode ? DARK.textDisabled : "#9A9AA1"} />}
      {disabled && <span style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1", fontStyle: "italic" }}>Not built yet</span>}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 200, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px", position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Settings</span>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 16px 6px" }}>Profile</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", overflow: "hidden" }}>
        <SettingsRow icon={User} label="My Profile" onClick={() => setShowMyProfile(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Data</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* CHANGED — real bug found in the user's own testing: passing
            `exportBackup` directly meant the DOM click's SyntheticEvent
            got passed as `includeKeys`, which buildBackup() then tried
            to iterate as a selective-key Set and threw. Selective
            export never hit this because its own button already
            wrapped the call in an arrow function that discards the
            event. Wrapping this one the same way. */}
        <SettingsRow icon={Upload} label="Export backup" onClick={() => onExport()} iconColor="#1B1B1F" />
        {/* ADDED 19 Aug 2026 — real ask: default export stays one tap
            (the row above, unchanged), this is the opt-in "choose what
            to include" path. */}
        {/* CHANGED 26 Aug 2026 — real fix: these icons were backwards,
            same Download/Upload direction confusion the user corrected for
            Contacts' Import earlier this session, mirrored here —
            Export (data leaving) reads as Upload, Restore (data coming
            back in) reads as Download. */}
        <SettingsRow icon={Upload} label="Selective export…" onClick={() => setShowSelectiveExport(true)} iconColor="#1B1B1F" />
        {/* ADDED — real ask: CSV export, for reading data elsewhere
            (Excel/Sheets), separate from the JSON backup above (which
            is for restoring into SHOS, not for opening as a
            spreadsheet). */}
        <SettingsRow icon={FileCsv} label="Export as CSV…" onClick={() => setShowCSVExport(true)} iconColor="#1B1B1F" />
        <SettingsRow icon={Download} label="Restore from backup" onClick={onImportClick} iconColor="#1B1B1F" />
      </div>
      {status && (
        <div style={{ margin: "0 16px 20px", padding: "10px 14px", borderRadius: 12, background: "#FFF4CE", color: darkMode ? DARK.textPrimary : "#1B1B1F", fontSize: 12 }}>{status}</div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Advanced</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* CHANGED 19 Aug 2026 — Developer tools is now real (storage
            overview + reset), moved out of the "Not built yet" group
            below. */}
        <SettingsRow icon={Database} label="Developer tools" onClick={() => setShowDevTools(true)} />
        {/* ADDED 19 Aug 2026 — Registries, real per the user's priority
            order. */}
        <SettingsRow icon={ListTree} label="Registries" onClick={() => setShowRegistries(true)} />
        {/* ADDED 19 Aug 2026 — Option lists, the "idiot-proof editor"
            the user asked for, for the simpler flat-string option lists. */}
        <SettingsRow icon={ListTree} label="Option lists" onClick={() => setShowOptionLists(true)} />
        {/* CHANGED 19 Aug 2026 — real fix: Privacy was already real
            (onClick worked), but had been left sitting visually under
            "Not built yet" below since that entry was first added —
            moved up to where it actually belongs. */}
        <SettingsRow icon={SettingsIcon} label="Privacy" onClick={() => setShowPrivacy(true)} />
        {/* ADDED 19 Aug 2026 — Preferences, real now: the configurable
            inactive-contact threshold, the user's own first concrete ask
            for this previously fully-stubbed section. */}
        <SettingsRow icon={SettingsIcon} label="Preferences" onClick={() => setShowPreferences(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Design</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", overflow: "hidden" }}>
        {/* CHANGED 26 Aug 2026 — real ask: was a disabled "Not built
            yet" stub, now a real, working section. */}
        <SettingsRow icon={Palette} label="Colour scheme" onClick={() => setShowDesign(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Insights</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", overflow: "hidden" }}>
        {/* ADDED 26 Aug 2026 — real ask: Stats page. */}
        <SettingsRow icon={Database} label="Stats" onClick={() => setShowStats(true)} />
        {/* ADDED 26 Aug 2026 — real ask: calendar view. */}
        <SettingsRow icon={Calendar} label="Calendar" onClick={() => setShowCalendar(true)} />
        {/* ADDED 26 Aug 2026 — real ask: Trash / recently deleted. */}
        <SettingsRow icon={Trash2} label="Trash" onClick={() => setShowTrash(true)} />
        {/* ADDED 26 Aug 2026 — real ask: About/version screen. */}
        <SettingsRow icon={ClipboardCheck} label="About" onClick={() => setShowAbout(true)} />
      </div>

      {showMyProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 210 }}>
          <MyProfileModule onClose={() => setShowMyProfile(false)} registerModuleBackHandler={registerModuleBackHandler} />
        </div>
      )}
      {showSelectiveExport && (
        <SelectiveExportSheet onClose={() => setShowSelectiveExport(false)} />
      )}
      {showCSVExport && (
        <CSVExportSheet onClose={() => setShowCSVExport(false)} />
      )}
      {showDevTools && (
        <DeveloperToolsScreen onClose={() => setShowDevTools(false)} />
      )}
      {showRegistries && (
        <RegistriesScreen onClose={() => setShowRegistries(false)} />
      )}
      {showOptionLists && (
        <OptionListsScreen onClose={() => setShowOptionLists(false)} />
      )}
      {showPrivacy && (
        <PrivacyScreen onClose={() => setShowPrivacy(false)} />
      )}
      {showPreferences && (
        <PreferencesScreen onClose={() => setShowPreferences(false)} />
      )}
      {showDesign && (
        <DesignScreen onClose={() => setShowDesign(false)} />
      )}
      {showStats && (
        <StatsScreen onClose={() => setShowStats(false)} />
      )}
      {showCalendar && (
        <CalendarScreen onClose={() => setShowCalendar(false)} onNavigateToRecord={onNavigateToRecord} />
      )}
      {showTrash && (
        <TrashScreen onClose={() => setShowTrash(false)} />
      )}
      {showAbout && (
        <AboutScreen onClose={() => setShowAbout(false)} />
      )}
    </div>
  );
}
export default SettingsScreen;
