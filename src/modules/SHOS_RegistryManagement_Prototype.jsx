import React, { useState, useMemo } from "react";
import { CaretLeftIcon as ChevronLeft, CaretDownIcon as ChevronDown, CaretUpIcon as ChevronUp, PlusIcon as Plus, ArchiveIcon as Archive, ArrowUUpLeftIcon as ArchiveRestore, CopyIcon as Copy, XIcon as X } from "@phosphor-icons/react";
import { useDarkModePreference } from "../calculations/darkModePreference";
import { NEUTRAL_DARK as DARK } from "../calculations/designTokens";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here. See designTokens.js.
import { NEUTRAL, ACTION, RADIUS, resolveDarkAccent } from "../calculations/designTokens";
// ADDED — real ask: "add button to check through registries... for
// duplicates using fuzzy matching... so user doesn't have to dig."
import { findDuplicatePairs } from "../calculations/fuzzyMatch";
import { useLoadedMemo } from "../calculations/loadedRepositoryState";

// ADDED 19 Aug 2026 — Registry Management, per the user's priority order.
// ONE shared screen for all 6 registries (Kink/Chems/Protection/
// Symptoms/Organism/Results) rather than 6 near-identical files — this
// is exactly the moment the project's own standing rule allows a
// shared abstraction: the underlying shape (getAll/create/update/
// archive/unarchive, name + isArchived) has now repeated 6 times for
// real, confirmed by reading each registry's own factory call, not
// assumed upfront. Same judgment already applied once this project for
// `simpleRegistry.js` itself.
//
// Real, previously-missing capability this closes: until now, a bad
// or duplicate registry entry could only be renamed/managed by editing
// it through whichever Contact/Encounter/Test picker happened to
// reference it — there was no direct way in. This is that direct way.
//
// DELIBERATELY NOT BUILT — merge. The user's own past framing named merge
// as a real goal ("rename/merge a kink directly"), but merging two
// entries means correctly rewriting every reference to the losing ID
// across a different set of fields per registry (some plain ID arrays,
// some {kinkId, role} objects) — a real, non-trivial per-registry
// operation where a rushed implementation risks silently combining two
// genuinely different concepts. Scoped out this pass rather than built
// blind; rename + a visible usage count (so a near-duplicate is at
// least easy to SPOT) covers the immediate "can't fix a bad entry
// without hunting through a picker" pain point for now.
// ADDED — real gap found in a full-app audit: Locations has real
// extra shape (type/address/notes/relatedContactId, see
// locationsRepository.js) that this generic name-only screen can't
// edit. Rather than force-fitting Locations' extra fields into every
// caller here, `renderExtra` is an optional per-caller escape hatch —
// undefined for the other 5 registries, so nothing changes for them —
// rendered only in edit mode, below the name row.
function RegistryRow({ entry, usage, isEditing, editingName, setEditingName, startEdit, commitEdit, setEditingId, toggleArchive, refresh, RenderExtra, T, color }) {
  const [showExtra, setShowExtra] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        {isEditing ? (
          <input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
            onBlur={commitEdit}
            style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: `1px solid ${color}`, fontSize: 14, fontFamily: "'Inter', sans-serif" }} />
        ) : (
          <div onClick={() => startEdit(entry)} style={{ flex: 1, cursor: "pointer" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: entry.isArchived ? T.textDisabled : T.textPrimary }}>{entry.name}</span>
            <span style={{ fontSize: 11, color: T.textDisabled, marginLeft: 8 }}>{usage === 0 ? "unused" : `used ${usage}×`}</span>
          </div>
        )}
        {RenderExtra && (
          <div onClick={() => setShowExtra((s) => !s)} style={{ cursor: "pointer", flexShrink: 0 }} title="Details">
            {showExtra ? <ChevronUp size={15} color={T.textSecondary} /> : <ChevronDown size={15} color={T.textSecondary} />}
          </div>
        )}
        <div onClick={() => toggleArchive(entry)} style={{ cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}
          title={entry.isArchived ? "Restore" : "Archive"}>
          {entry.isArchived ? <ArchiveRestore size={15} color={color} /> : <Archive size={15} color={T.textSecondary} />}
        </div>
      </div>
      {RenderExtra && showExtra && (
        <div style={{ padding: "0 14px 14px" }}>
          <RenderExtra entry={entry} refresh={refresh} T={T} color={color} />
        </div>
      )}
    </div>
  );
}

export default function RegistryManagementScreen({ registry, label, color, computeUsage, renderExtra: RenderExtra, onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  const actionRed = darkMode ? resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") : ACTION.red;

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);
  const [showArchived, setShowArchived] = useState(false);
  const [addingName, setAddingName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  // ADDED — real ask: surface likely duplicates (fuzzy-matched, same
  // engine as the "did you mean?" prompts at entry time) instead of
  // leaving them for the user to spot by scrolling — see
  // findDuplicatePairs' own comment in fuzzyMatch.js for why this
  // flags for review rather than auto-merging.
  const [showDuplicates, setShowDuplicates] = useState(false);

  const allEntries = useLoadedMemo(() => registry.getAll(), [refreshKey], []);
  const active = allEntries.filter((e) => !e.isArchived).sort((a, b) => a.name.localeCompare(b.name));
  const archived = allEntries.filter((e) => e.isArchived).sort((a, b) => a.name.localeCompare(b.name));
  const duplicatePairs = useMemo(() => findDuplicatePairs(allEntries), [allEntries]);
  // ADDED — real perf/redundancy fix: computeUsage (each of these scans
  // 1-3 full repositories — see registryUsage.js) was being called once
  // per row directly inside Row/.map(), unmemoized, right next to
  // duplicatePairs above which WAS already correctly memoized — an
  // oversight, not a choice. With N entries that's N full-table scans
  // recomputed on every render, including every keystroke while typing
  // a new entry name or renaming one (both drive re-renders here). Now
  // computed once per allEntries change into a lookup map.
  const usageMap = useMemo(() => new Map(allEntries.map((e) => [e.id, computeUsage(e.id)])), [allEntries, computeUsage]);

  const handleAdd = () => {
    const trimmed = addingName.trim();
    if (!trimmed) return;
    registry.findOrCreate(trimmed);
    setAddingName("");
    refresh();
  };

  const startEdit = (entry) => { setEditingId(entry.id); setEditingName(entry.name); };
  const commitEdit = () => {
    const trimmed = editingName.trim();
    if (trimmed) registry.update(editingId, { name: trimmed });
    setEditingId(null);
    refresh();
  };

  const toggleArchive = (entry) => {
    if (entry.isArchived) registry.unarchive(entry.id);
    else registry.archive(entry.id);
    refresh();
  };

  // CHANGED — real fix while adding renderExtra (see its own comment
  // above): this was a plain function called via active.map(Row), not
  // a real component, so it couldn't hold its own state. Extracting it
  // to a proper component so an extra-fields expand toggle can live
  // per-row without interfering with the existing rename-on-blur flow
  // — critically, expand/collapse is now its OWN state, not tangled up
  // with editingId, so opening the extra-fields panel can never
  // accidentally blur-and-close an in-progress rename (the same class
  // of bug already fixed elsewhere this session for suggestion chips).
  const Row = (entry) => (
    <RegistryRow key={entry.id} entry={entry} usage={usageMap.get(entry.id) ?? 0}
      isEditing={editingId === entry.id} editingName={editingName} setEditingName={setEditingName}
      startEdit={startEdit} commitEdit={commitEdit} setEditingId={setEditingId}
      toggleArchive={toggleArchive} refresh={refresh} RenderExtra={RenderExtra} T={T} color={color} />
  );

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, flex: 1 }}>{label}</span>
        {duplicatePairs.length > 0 && (
          <div onClick={() => setShowDuplicates(true)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 999, border: `1px solid ${actionRed}`, color: actionRed, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Copy size={13} /> {duplicatePairs.length} possible dupe{duplicatePairs.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {showDuplicates && (
        <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 230 }} onClick={() => setShowDuplicates(false)}>
          <div style={{ background: T.bg, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 16, borderTopRightRadius: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 14px", background: color, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>Possible duplicates</span>
              <X size={20} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={() => setShowDuplicates(false)} aria-label="Close duplicates panel" />
            </div>
            <div style={{ padding: "6px 20px 0", fontSize: 12, color: T.textSecondary }}>
              Flagged by name similarity — nothing is merged automatically. Rename one to match the other, or archive the one you don't want.
            </div>
            <div style={{ overflowY: "auto", padding: "10px 20px 24px", flex: 1 }}>
              {duplicatePairs.length === 0 ? (
                <div style={{ fontSize: 13, color: T.textDisabled, padding: "20px 0", textAlign: "center" }}>No likely duplicates found.</div>
              ) : duplicatePairs.map(({ a, b }) => (
                <div key={`${a.id}-${b.id}`} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  {[a, b].map((entry) => (
                    <div key={entry.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: entry.isArchived ? T.textDisabled : T.textPrimary }}>{entry.name}{entry.isArchived ? " (archived)" : ""}</span>
                      {!entry.isArchived && (
                        <span onClick={() => { registry.archive(entry.id); refresh(); }} style={{ fontSize: 11, fontWeight: 700, color: actionRed, cursor: "pointer" }}>Archive this one</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "12px 16px 8px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={addingName} onChange={(e) => setAddingName(e.target.value)} placeholder={`New ${label.toLowerCase()} entry`}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, fontSize: 14, fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }} />
          <button onClick={handleAdd} style={{ padding: "0 16px", borderRadius: 8, border: "none", background: color, color: "#FFFFFF", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={16} /> Add
          </button>
        </div>
        <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 6 }}>Tap a name to rename it. Renaming updates everywhere it's used, immediately.</div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, margin: "8px 16px 0", overflow: "hidden" }}>
        {active.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: T.textDisabled }}>No entries yet.</div>
        ) : active.map(Row)}
      </div>

      {archived.length > 0 && (
        <div style={{ margin: "16px 16px 24px" }}>
          <div onClick={() => setShowArchived((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 0", fontSize: 13, color: T.textSecondary, fontWeight: 600 }}>
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </div>
          {showArchived && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
              {archived.map(Row)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
