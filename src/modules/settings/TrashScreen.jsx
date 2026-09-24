// TrashScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import ConfirmDeleteCard from "../../components/ConfirmDeleteCard";
import { CheckIcon as Check, CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
import { ACCENTS, ACTION, NEUTRAL, RADIUS, TYPE, resolveDarkAccent } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedState } from "../../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../../calculations/responsive";
import { ContactRepository } from "../../repositories/contactRepository";
import { EncounterRepository } from "../../repositories/encounterRepository";
import { MedicationRepository } from "../../repositories/medicationRepository";
import { TestingRepository } from "../../repositories/testingRepository";
import { ClinicVisitsRepository } from "../../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../../repositories/symptomLogRepository";
import { VaccinationRepository } from "../../repositories/vaccinationRepository";
import { MeasurementRepository } from "../../repositories/measurementRepository";
import { TrashRepository, MODULE_LABELS as TRASH_MODULE_LABELS } from "../../repositories/trashRepository";

const TRASH_REPOSITORIES = {
  contacts: ContactRepository,
  encounters: EncounterRepository,
  testing: TestingRepository,
  clinicVisits: ClinicVisitsRepository,
  symptomLog: SymptomLogRepository,
  vaccinations: VaccinationRepository,
  medications: MedicationRepository,
  measurements: MeasurementRepository,
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

export function TrashScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  // ADDED — real audit finding (desktop full-width sweep): this
  // screen's deleted-item rows have uneven title lengths, so CSS
  // multi-column flow fits better than a uniform card grid — same
  // treatment as Registry Management/Glossary's own row lists.
  const isDesktopWidth = useIsDesktopWidth();
  // Local T-shaped object for the shared ConfirmDeleteCard — this screen
  // otherwise reads NEUTRAL/DARK directly rather than a per-module T,
  // but the card needs .actionRed/.textPrimary/etc. on one object.
  const T = { ...(darkMode ? DARK : NEUTRAL), actionRed: darkMode ? resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") : ACTION.red };

  const [items, setItems] = useLoadedState(() => TrashRepository.getAll(), [], []);
  const refresh = async () => setItems(await TrashRepository.getAll());
  // ADDED 26 Aug 2026 — real ask: 4 real actions (restore all/
  // selected, delete all/selected), with real multi-select on this
  // screen — reuses the exact same Select-toggle + toolbar pattern
  // already proven across every other module this session, rather
  // than inventing a new one just for Trash.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };
  // CHANGED 10 Sep 2026 — standardised delete confirmation: these three
  // were native window.confirm() dialogs, now the shared inline card.
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);

  const restoreEntries = async (entries) => {
    for (const entry of entries) {
      const repo = TRASH_REPOSITORIES[entry.moduleKey];
      if (repo) await repo.restore(entry.record);
      await TrashRepository.removeEntry(entry.trashId);
    }
    refresh();
  };

  const restoreItem = (entry) => restoreEntries([entry]);
  const restoreAll = () => restoreEntries(items);
  const restoreSelected = async () => { await restoreEntries(items.filter((e) => selectedIds.includes(e.trashId))); exitSelectMode(); };

  const deletePermanently = async (entry) => {
    await TrashRepository.removeEntry(entry.trashId);
    setConfirmDeleteEntry(null);
    refresh();
  };
  const deleteAll = async () => {
    await TrashRepository.emptyAll();
    setConfirmDeleteAll(false);
    refresh();
  };
  const deleteSelected = async () => {
    for (const id of selectedIds) await TrashRepository.removeEntry(id);
    setConfirmDeleteSelected(false);
    exitSelectMode();
    refresh();
  };

  const recordLabel = (entry) => entry.record.title || entry.record.name || entry.record.displayName || "Untitled";

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
          <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Trash</h1>
        </div>
        {items.length > 0 && (
          <span role="button" tabIndex={0} aria-label={selectMode ? "Done selecting" : "Select items"} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, color: ACCENTS.medication, cursor: "pointer" }}>
            {selectMode ? "Done" : "Select"}
          </span>
        )}
      </div>
      {selectMode && (
        <div style={{ background: "#1B1B1F", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600 }}>{selectedIds.length} selected</span>
          <div style={{ display: "flex", gap: 16 }}>
            <span role="button" tabIndex={0} aria-label="Restore selected items" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => selectedIds.length > 0 && restoreSelected()} style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Restore</span>
            <span role="button" tabIndex={0} aria-label="Delete selected items" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => selectedIds.length > 0 && setConfirmDeleteSelected(true)} style={{ fontSize: 13, color: selectedIds.length > 0 ? resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
            <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
          </div>
        </div>
      )}
      {confirmDeleteSelected && (
        <ConfirmDeleteCard
          T={T}
          message={`Permanently delete ${selectedIds.length} item${selectedIds.length > 1 ? "s" : ""}? This can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDeleteSelected(false)}
          onConfirm={deleteSelected}
        />
      )}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, marginBottom: 14 }}>
          Deleted items stay here for 30 days before they're no longer shown. This is separate from the "tap to undo" that appears right after deleting something.
        </div>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, fontSize: 13 }}>Nothing in the trash.</div>
        ) : (
          <>
            {/* ADDED 26 Aug 2026 — real ask: "restore all" and "delete
                all", not just per-item and not just selected — always
                visible when there's anything to act on, independent of
                select mode. */}
            {!selectMode && (
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={restoreAll} style={{ fontSize: 13, fontWeight: 600, color: ACCENTS.medication, cursor: "pointer" }}>Restore all</span>
                <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setConfirmDeleteAll(true)} style={{ fontSize: 13, fontWeight: 600, color: ACTION.red, cursor: "pointer" }}>Delete all</span>
              </div>
            )}
            {confirmDeleteAll && (
              <ConfirmDeleteCard
                T={T}
                margin="0 0 12px"
                message={`Permanently delete all ${items.length} item${items.length > 1 ? "s" : ""} in the trash? This can't be undone.`}
                confirmLabel="Delete all"
                onCancel={() => setConfirmDeleteAll(false)}
                onConfirm={deleteAll}
              />
            )}
            <div style={isDesktopWidth ? { columnCount: 2, columnGap: 16 } : { background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden" }}>
              {items.map((entry, i) => (
                <div key={entry.trashId} onClick={() => selectMode && toggleSelected(entry.trashId)}
                  {...(selectMode ? {
                    role: "checkbox", "aria-checked": selectedIds.includes(entry.trashId), "aria-label": recordLabel(entry), tabIndex: 0,
                    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSelected(entry.trashId); } },
                  } : {})}
                  style={isDesktopWidth
                    ? { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", breakInside: "avoid", marginBottom: 8, background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, cursor: selectMode ? "pointer" : "default" }
                    : { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < items.length - 1 ? "1px solid #DCDCE1" : "none", cursor: selectMode ? "pointer" : "default" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    {selectMode && (
                      <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${selectedIds.includes(entry.trashId) ? ACCENTS.medication : "#DCDCE1"}`, background: selectedIds.includes(entry.trashId) ? ACCENTS.medication : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {selectedIds.includes(entry.trashId) && <Check size={12} color="#FFFFFF" />}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                      <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recordLabel(entry)}</div>
                      <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, marginTop: 2 }}>{TRASH_MODULE_LABELS[entry.moduleKey] || entry.moduleKey} · deleted {new Date(entry.deletedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>
                    </div>
                  </div>
                  {!selectMode && (
                    <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                      <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => restoreItem(entry)} style={{ fontSize: 12, fontWeight: 700, color: ACCENTS.medication, cursor: "pointer" }}>Restore</span>
                      <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setConfirmDeleteEntry(entry)} style={{ fontSize: 12, fontWeight: 700, color: ACTION.red, cursor: "pointer" }}>Delete</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {confirmDeleteEntry && (
              <div style={{ marginTop: 12 }}>
                <ConfirmDeleteCard
                  T={T}
                  margin="0"
                  message="Delete this permanently? It won't be recoverable after this."
                  onCancel={() => setConfirmDeleteEntry(null)}
                  onConfirm={() => deletePermanently(confirmDeleteEntry)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


export default TrashScreen;
