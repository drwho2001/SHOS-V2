// DeveloperToolsScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState, useRef, useEffect } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { WarningIcon as AlertTriangle, CheckIcon as Check, CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, TrashIcon as Trash2, LinkBreakIcon as LinkBreak, BugIcon as Bug } from "@phosphor-icons/react";
import { ACCENTS, ACTION, ACTION_TEXT_SAFE, NEUTRAL, RADIUS, TYPE, resolveDarkAccent } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedMemo } from "../../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../../calculations/responsive";
import { hasUnbackedChanges } from "../../storage/backupService";
import { ErrorLogRepository } from "../../repositories/errorLogRepository";
import { localStorageAdapter } from "../../storage/storageAdapter";
import { findOrphanReferences } from "../../calculations/orphanReferenceCheck";
import { ContactRepository } from "../../repositories/contactRepository";
import { EncounterRepository } from "../../repositories/encounterRepository";
import { MedicationRepository } from "../../repositories/medicationRepository";
import { LogRepository } from "../../repositories/logRepository";
import { TestingRepository } from "../../repositories/testingRepository";
import { ClinicVisitsRepository } from "../../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../../repositories/symptomLogRepository";
import { VaccinationRepository } from "../../repositories/vaccinationRepository";
import { LocationsRepository } from "../../repositories/locationsRepository";
import { EpisodeRepository } from "../../repositories/episodeRepository";
import { KinkRegistry } from "../../registries/kinkRegistry";
import { ChemsRegistry } from "../../registries/chemsRegistry";
import { ProtectionRegistry } from "../../registries/protectionRegistry";
import { SymptomsRegistry } from "../../registries/symptomsRegistry";
import { OrganismRegistry } from "../../registries/organismRegistry";
import { ResultsRegistry } from "../../registries/resultsRegistry";
import ErrorLogScreen from "./ErrorLogScreen";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DeveloperToolsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  // ADDED — real audit finding (desktop full-width sweep): grid the
  // Storage overview/Data integrity/Diagnostics/Danger zone section
  // blocks on desktop, same multi-column treatment as this file's
  // other log/list-heavy screens.
  const isDesktopWidth = useIsDesktopWidth();

  const [resetStage, setResetStage] = useState("idle"); // idle -> confirming -> done
  // ADDED — real ask: a storage-usage indicator, cheap given this
  // app's actual mechanics (one device, no server to overflow into,
  // Attachments the one thing that could push toward the browser's
  // localStorage quota over time). See storageAdapter.js's own
  // getStorageUsage() comment for the byte-counting approach.
  const storageUsage = useLoadedMemo(() => localStorageAdapter.getStorageUsage(), [], { totalBytes: 0, byKey: [] });
  const [showStorageBreakdown, setShowStorageBreakdown] = useState(false);
  // ADDED — real ask: a data-integrity sweep for dangling relation-by-
  // ID references (e.g. a hard-deleted Contact an old Encounter's
  // attendeeIds still points at) — see orphanReferenceCheck.js's own
  // header for exactly what this does and doesn't cover. Same "compute
  // once per screen-open, the data's small enough" judgment already
  // applied to Global Search's own index and the Registry duplicate
  // checker.
  // ADDED — real ask: a manual "check now" trigger, since a real fix
  // (deleting a record another one still references) can happen in the
  // very same session this screen is open, and there was previously no
  // way to see that reflected without leaving and reopening Developer
  // Tools. Same refreshKey/useLoadedMemo re-run pattern already used
  // elsewhere in this file (see notifPrefs/medPrefs above).
  const [orphanCheckKey, setOrphanCheckKey] = useState(0);
  const [orphanChecking, setOrphanChecking] = useState(false);
  const orphans = useLoadedMemo(() => findOrphanReferences(), [orphanCheckKey], []);
  const [showOrphans, setShowOrphans] = useState(false);
  const recheckOrphans = async (e) => {
    e.stopPropagation();
    setOrphanChecking(true);
    setOrphanCheckKey((k) => k + 1);
    // findOrphanReferences() runs synchronously fast even at this app's
    // largest realistic data volumes (see this session's own data-
    // volume stress-testing entry in CLAUDE.md) — this is purely a
    // "did tapping it do something" affordance, not a real progress
    // indicator for a slow operation.
    setTimeout(() => setOrphanChecking(false), 400);
  };
  // ADDED — real ask: "allow error reporting" — see ErrorLogScreen's
  // own header for the full reasoning (a local, on-device log, not a
  // real third-party crash reporter).
  const errorCount = useLoadedMemo(() => ErrorLogRepository.getAll().then((l) => l.length), [], 0);
  const [showErrorLog, setShowErrorLog] = useState(false);
  // ADDED — real groundwork for encryption at rest: hasUnbackedChanges()
  // is now async (see backupService.js's own comment), so this can no
  // longer be called straight in the render body below — a Promise is
  // always truthy, so `{hasUnbackedChanges() && (...)}` would render
  // the warning permanently, regardless of the real answer.
  const unbackedChanges = useLoadedMemo(() => hasUnbackedChanges(), [], false);
  // ADDED — real groundwork for encryption at rest: LocationsRepository
  // is now async (see its own comment), so its count can no longer be
  // read straight inline in the `counts` array below like every other
  // (still-synchronous) repository here — loaded separately via
  // useLoadedMemo and substituted in.
  const locationsCount = useLoadedMemo(() => LocationsRepository.getAll().then((l) => l.length), [], 0);
  // CHANGED — Phase 2 encryption groundwork: ContactRepository went
  // async too — same treatment as locationsCount above.
  const contactsCount = useLoadedMemo(() => ContactRepository.getAll().then((l) => l.length), [], 0);
  // CHANGED — Phase 2 encryption groundwork: LogRepository/
  // EpisodeRepository went async too — same treatment as
  // locationsCount/contactsCount above.
  const logsCount = useLoadedMemo(() => LogRepository.getAll().then((l) => l.length), [], 0);
  const episodesCount = useLoadedMemo(() => EpisodeRepository.getAll().then((l) => l.length), [], 0);
  const symptomLogCount = useLoadedMemo(() => SymptomLogRepository.getAll().then((l) => l.length), [], 0);
  const vaccinationsCount = useLoadedMemo(() => VaccinationRepository.getAll().then((l) => l.length), [], 0);
  const encountersCount = useLoadedMemo(() => EncounterRepository.getAll().then((l) => l.length), [], 0);
  const testsCount = useLoadedMemo(() => TestingRepository.getAll().then((l) => l.length), [], 0);
  const medicationsCount = useLoadedMemo(() => MedicationRepository.getAll().then((l) => l.length), [], 0);
  const clinicVisitsCount = useLoadedMemo(() => ClinicVisitsRepository.getAll().then((l) => l.length), [], 0);
  // CHANGED — Phase 2 encryption groundwork: the six simpleRegistry.js-
  // based registries are now async — same useLoadedMemo treatment as
  // every other repository count above (previously read inline in the
  // counts array below, direct render-body calls that broke once these
  // registries went async).
  const kinkCount = useLoadedMemo(() => KinkRegistry.getAll().then((l) => l.length), [], 0);
  const chemsCount = useLoadedMemo(() => ChemsRegistry.getAll().then((l) => l.length), [], 0);
  const protectionCount = useLoadedMemo(() => ProtectionRegistry.getAll().then((l) => l.length), [], 0);
  const symptomsRegistryCount = useLoadedMemo(() => SymptomsRegistry.getAll().then((l) => l.length), [], 0);
  const organismCount = useLoadedMemo(() => OrganismRegistry.getAll().then((l) => l.length), [], 0);
  const resultsCount = useLoadedMemo(() => ResultsRegistry.getAll().then((l) => l.length), [], 0);
  const counts = [
    { label: "Contacts", value: contactsCount },
    { label: "Encounters", value: encountersCount },
    { label: "Medications", value: medicationsCount },
    { label: "Medication log entries", value: logsCount },
    { label: "Tests", value: testsCount },
    { label: "Clinic visits", value: clinicVisitsCount },
    { label: "Symptom Log entries", value: symptomLogCount },
    { label: "Vaccinations", value: vaccinationsCount },
    { label: "Timeline episodes", value: episodesCount },
    { label: "Kink Registry entries", value: kinkCount },
    { label: "Chems Registry entries", value: chemsCount },
    { label: "Protection Registry entries", value: protectionCount },
    { label: "Symptoms Registry entries", value: symptomsRegistryCount },
    { label: "Locations", value: locationsCount },
    { label: "Organism Registry entries", value: organismCount },
    { label: "Results Registry entries", value: resultsCount },
  ];

  const handleReset = () => {
    localStorageAdapter.clearAllAppData();
    setResetStage("done");
  };

  return (
    <div ref={dialogRef} role="dialog" aria-label="Developer tools" tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Developer tools</h1>
      </div>

      {/* ADDED — real ask: this never explained what it was actually
          counting. It's a real storage overview (every repository's
          live record count) plus a full reset below — not a
          timeframe-based count, that's a separate, still-outstanding
          Activity filter request. */}
      <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, padding: "10px 16px 0" }}>
        Live record counts across every part of the app's local storage, mainly useful for confirming a backup/restore or migration went as expected.
      </div>

      <div style={isDesktopWidth ? { columnCount: 2, columnGap: 0 } : undefined}>
      <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "16px 16px 6px" }}>Storage overview</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 20px", padding: "4px 14px" }}>
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setShowStorageBreakdown((s) => !s)} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), cursor: "pointer" }}>
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Local storage used{storageUsage.byKey.length > 0 ? (showStorageBreakdown ? " ▲" : " ▼") : ""}</span>
          <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{formatBytes(storageUsage.totalBytes)}</span>
        </div>
        {showStorageBreakdown && (
          <div style={{ padding: "6px 0 9px" }}>
            {/* ADDED — real ask: which part is actually big, not just
                the total — Attachments (base64 file data) is the one
                thing in this app that could realistically grow large
                over time, worth being able to see that directly rather
                than guessing. Top 5 keys by size is plenty for "what's
                using the space" without turning this into its own
                screen. */}
            {storageUsage.byKey.slice(0, 5).map((k) => (
              <div key={k.key} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                <span style={{ color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, fontFamily: "'JetBrains Mono', monospace" }}>{k.key.replace(/^shos_/, "")}</span>
                <span style={{ color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>{formatBytes(k.bytes)}</span>
              </div>
            ))}
          </div>
        )}
        {counts.map((c) => (
          <div key={c.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>{c.label}</span>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{c.value}</span>
          </div>
        ))}
      </div>
      </div>

      <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
      {/* ADDED — real ask: surface dangling relation-by-ID references
          (e.g. an Encounter whose attendeeIds still names a Contact
          that's since been hard-deleted) — nothing else in the app
          currently notices these. Read-only: flags them for a human to
          fix by hand, same "never silently merge/fix" restraint the
          Registry duplicate checker already applies. */}
      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Data integrity</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 20px", padding: "4px 14px" }}>
        <div onClick={() => orphans.length > 0 && setShowOrphans((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", cursor: orphans.length > 0 ? "pointer" : "default" }}>
          <LinkBreak size={15} color={orphans.length > 0 ? ACTION.red : (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled)} />
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, flex: 1 }}>Broken references</span>
          <span onClick={recheckOrphans} role="button" tabIndex={0} aria-label="Check again"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); recheckOrphans(e); } }}
            style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.home, cursor: "pointer", padding: "2px 4px" }}>
            {orphanChecking ? "Checking…" : "Check again"}
          </span>
          <span style={{ fontSize: 13, color: orphans.length > 0 ? ACTION.red : (darkMode ? DARK.textPrimary : NEUTRAL.textPrimary), fontWeight: 700 }}>
            {orphans.length === 0 ? "None found" : `${orphans.length}${showOrphans ? " ▲" : " ▼"}`}
          </span>
        </div>
        {showOrphans && orphans.length > 0 && (
          <div style={{ padding: "0 0 9px" }}>
            {orphans.map((o, i) => (
              <div key={i} style={{ padding: "8px 0", borderTop: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
                <div style={{ fontSize: 12, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 600 }}>{o.recordType}: {o.recordLabel}</div>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, marginTop: 2 }}>
                  its <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{o.field}</span> points at a {o.targetType} that no longer exists (id: {o.danglingId})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
      {/* ADDED — real ask: "allow error reporting." See
          ErrorLogScreen's own header for the full reasoning (a local,
          on-device log, not a real third-party crash-reporting
          service — this app's whole "nothing leaves the device
          without you choosing to" design applies here too). */}
      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Diagnostics</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 20px", padding: "4px 14px" }}>
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setShowErrorLog(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", cursor: "pointer" }}>
          <Bug size={15} color={errorCount > 0 ? ACTION.red : (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled)} />
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, flex: 1 }}>Error log</span>
          <span style={{ fontSize: 13, color: errorCount > 0 ? ACTION.red : (darkMode ? DARK.textPrimary : NEUTRAL.textPrimary), fontWeight: 700 }}>
            {errorCount === 0 ? "None" : errorCount}
          </span>
          <ChevronRight size={16} color={darkMode ? DARK.textSecondary : NEUTRAL.textSecondary} />
        </div>
      </div>
      {showErrorLog && <ErrorLogScreen darkMode={darkMode} onClose={() => setShowErrorLog(false)} />}
      </div>

      <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Danger zone</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: `1px solid ${ACTION.red}`, borderRadius: RADIUS.md, margin: "0 16px 20px", padding: 16 }}>
        {resetStage === "done" ? (
          <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>All app data cleared. Reload the app to see the fresh-start state.</div>
        ) : resetStage === "confirming" ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
              <AlertTriangle size={16} color={ACTION.red} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>This permanently deletes every contact, encounter, medication, log, test, clinic visit, and registry entry on this device. There's no undo — export a backup first if you're not sure.</div>
            </div>
            {/* ADDED 26 Aug 2026 — real ask: warn explicitly if there
                are genuinely unbacked-up changes, not just a generic
                "back up first" reminder every time regardless of
                whether anything's actually at risk. */}
            {unbackedChanges && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: `${ACTION.red}15`, border: `1px solid ${ACTION.red}` }}>
                <AlertTriangle size={14} color={ACTION.red} style={{ flexShrink: 0, marginTop: 2 }} />
                {/* ADDED 10 Sep 2026 — real accessibility fix: ACTION.red
                    as text on its own `${ACTION.red}15` tint (2 lines up)
                    fails 4.5:1 — see designTokens.js's own comment on
                    ACTION_TEXT_SAFE. Dark mode's resolved red already
                    has headroom, so only light mode swaps to the darker
                    stand-in. */}
                <div style={{ fontSize: 12, color: darkMode ? resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") : ACTION_TEXT_SAFE.red, fontWeight: 600 }}>You have changes since your last backup that would be lost. Export a backup before continuing.</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setResetStage("idle")} style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: darkMode ? DARK.surface : NEUTRAL.surface, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleReset} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: ACTION.red, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Yes, delete everything</button>
            </div>
          </>
        ) : (
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setResetStage("confirming")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <Trash2 size={17} color={ACTION.red} />
            <span style={{ fontSize: 14, color: ACTION.red, fontWeight: 600 }}>Reset all app data</span>
          </div>
        )}
      </div>
      </div>
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
// ADDED — real gap found in a full-app audit: Locations
// (type/address/notes/relatedContactId, see locationsRepository.js's
// own header for why it isn't one of the 6 above) had no management
// screen at all — Settings only ever showed a static count. Reuses
// this exact screen via the renderExtra escape hatch (see
// SHOS_RegistryManagement_Prototype.jsx) rather than building a whole
// separate screen for one more registry-shaped repository.

export default DeveloperToolsScreen;
