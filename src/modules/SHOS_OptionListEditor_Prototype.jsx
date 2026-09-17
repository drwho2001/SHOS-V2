import React, { useState } from "react";
import { CaretLeftIcon as ChevronLeft, CaretDownIcon as ChevronDown, PlusIcon as Plus, ArrowUpIcon as ArrowUp, ArrowDownIcon as ArrowDown, XIcon as X, PillIcon as Pill, ArrowCircleRightIcon as ArrowRightCircle, ClipboardTextIcon as ClipboardList, CalendarIcon as CalendarClock, TestTubeIcon as TestTube, SyringeIcon as Syringe, CalendarCheckIcon as CalendarCheck, MapPinIcon as MapPin, PlayCircleIcon as PlayCircle, TagIcon as Tag, HeartIcon as Heart, UserIcon as User, DropIcon as Drop, RulerIcon as Ruler, ArrowUUpLeftIcon as RestoreIcon, ArrowsLeftRightIcon as SwapIcon, LockIcon as Lock } from "@phosphor-icons/react";
import { CustomOptionListsRepository, OPTION_LIST_LABELS, OPTION_LIST_ICONS } from "../repositories/customOptionListsRepository";
import { findRecordsUsingOptionValue, reassociateOptionValue } from "../calculations/optionListUsage";
import { useLoadedMemo } from "../calculations/loadedRepositoryState";
import ConfirmDeleteCard from "../components/ConfirmDeleteCard";

import { useDarkModePreference } from "../calculations/darkModePreference";
import { NEUTRAL_DARK as DARK } from "../calculations/designTokens";
// ADDED 19 Aug 2026 — maps OPTION_LIST_ICONS' string names to the real
// lucide components. Kept as a lookup table (not a giant switch) so
// adding a 17th category later is one line here, matching the same
// low-friction pattern the rest of this option-lists system already
// has.
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here. See designTokens.js.
import { NEUTRAL, ACCENTS, ACTION, RADIUS, TYPE } from "../calculations/designTokens";

// EXPORTED 1 Sep 2026 — real ask: "check settings not unnecessarily
// over engineered - combine into similar things if better." Registries
// and Option lists were two separate top-level Settings entries doing
// the exact same conceptual job from a user's point of view ("edit the
// picker choices used across the app") — the only difference is an
// internal implementation detail (ID-based registry with a usage count
// vs a flat editable string list) nobody outside this codebase needs
// to know about. Combined into one "Manage lists" entry with a tab
// switcher (see SHOS_Settings_Prototype.jsx's ManageListsScreen) —
// this component and ICON_COMPONENTS below are exported so that
// switcher can reuse this exact detail screen/icon set unchanged
// rather than a second copy.
// FIXED 16 Sep 2026 — real bug found live: menstrualFlow's/
// measurementType's own OPTION_LIST_ICONS entries ("Drop"/"Ruler",
// added 19 Aug 2026) were never registered here — IconComponent
// silently resolved to undefined for both, so their rows rendered
// with no icon at all while every other list's icon showed correctly.
// Drop matches the Menstrual Health module's own Cycle-tab icon
// (see the #76 "Pregnancy list icon" entry, CLAUDE.md); Ruler is a
// new, first icon reference for Measurements — no existing in-module
// icon to match since Measurements doesn't use a domain icon on its
// own records (a deliberate choice, see its own list-icon audit).
export const ICON_COMPONENTS = { Pill, ArrowRightCircle, ClipboardList, CalendarClock, TestTube, Syringe, CalendarCheck, MapPin, PlayCircle, Tag, Heart, User, Drop, Ruler };

// ADDED 19 Aug 2026 — the "idiot-proof" editor the user asked for, for the
// simple flat option lists (see customOptionListsRepository.js for the
// full reasoning on scope and safety). ONE generic screen reused for
// every category — same "shared component once a shape repeats" rule
// already applied to SHOS_RegistryManagement_Prototype.jsx.
// ADDED 16 Sep 2026 — real ask (#75): "click entry to view associated
// records." Expands in place to a real, grouped list of every record's
// own label currently carrying this exact value — findRecordsUsingOptionValue()
// (optionListUsage.js) is the one place that scan actually happens, so
// this component stays a thin renderer over it, same "repository/
// calculation split" this app applies everywhere else. Deliberately
// read-only here — deep-linking to the record itself would need
// onNavigateToRecord threaded all the way from App.jsx through
// Settings' own multi-level nav, a bigger plumbing job than this pass
// is scoped for; seeing WHICH records are affected before deciding to
// rename/remove is the real, immediate need this closes.
function UsageDisclosure({ listName, value, T }) {
  const [open, setOpen] = useState(false);
  const records = useLoadedMemo(() => (open ? findRecordsUsingOptionValue(listName, value) : Promise.resolve(null)), [listName, value, open], null);

  return (
    <div>
      <div onClick={() => setOpen((o) => !o)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.textDisabled, cursor: "pointer" }}>
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        {open && records === null ? "Checking…" : open ? `${records.length} record${records.length === 1 ? "" : "s"} use this` : "View associated records"}
      </div>
      {open && records && records.length > 0 && (
        <div style={{ marginTop: 6, paddingLeft: 15 }}>
          {records.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: T.textSecondary, padding: "3px 0" }}>{r.recordLabel}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OptionListDetail({ listName, onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;

  const [refreshKey, setRefreshKey] = useState(0);
  const [addingValue, setAddingValue] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  // ADDED 16 Sep 2026 — real ask (#75): reassociating an archived value
  // means picking a live one to move its records onto — tracks which
  // archived value (if any) currently has its picker open.
  const [reassociatingValue, setReassociatingValue] = useState(null);
  const [reassociateStatus, setReassociateStatus] = useState(null);
  // ADDED — real audit finding: permanent delete on an archived value
  // used to fire directly off the X icon tap with zero confirmation,
  // the app's only "delete a saved value forever" action lacking the
  // safety net every other permanent-delete site (Settings' own Trash
  // screen included) already has.
  const [confirmDeleteForever, setConfirmDeleteForever] = useState(null);

  const options = useLoadedMemo(() => CustomOptionListsRepository.get(listName), [listName, refreshKey], []);
  const archivedValues = useLoadedMemo(() => CustomOptionListsRepository.getArchived(listName), [listName, refreshKey], []);
  const refresh = () => setRefreshKey((k) => k + 1);

  const restoreArchived = async (value) => {
    await CustomOptionListsRepository.restore(listName, value);
    refresh();
  };
  const deleteArchivedForever = async (value) => {
    await CustomOptionListsRepository.permanentlyDeleteArchived(listName, value);
    refresh();
  };
  const doReassociate = async (oldValue, newValue) => {
    const count = await reassociateOptionValue(listName, oldValue, newValue);
    await CustomOptionListsRepository.permanentlyDeleteArchived(listName, oldValue);
    setReassociatingValue(null);
    setReassociateStatus(`Moved ${count} record${count === 1 ? "" : "s"} from "${oldValue}" to "${newValue}".`);
    refresh();
  };

  const handleAdd = async () => {
    const trimmed = addingValue.trim();
    if (!trimmed) return;
    await CustomOptionListsRepository.add(listName, trimmed);
    setAddingValue("");
    refresh();
  };

  const startEdit = (i) => { setEditingIndex(i); setEditingValue(options[i]); };
  const commitEdit = async () => {
    const trimmed = editingValue.trim();
    if (trimmed && trimmed !== options[editingIndex]) {
      await CustomOptionListsRepository.rename(listName, options[editingIndex], trimmed);
    }
    setEditingIndex(null);
    refresh();
  };

  const remove = async (value) => {
    await CustomOptionListsRepository.remove(listName, value);
    refresh();
  };

  const move = async (i, direction) => {
    const next = [...options];
    const target = i + direction;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    await CustomOptionListsRepository.reorder(listName, next);
    refresh();
  };

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(48px + env(safe-area-inset-bottom))", background: T.bg, zIndex: 230, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ ...TYPE.subScreenTitle, color: T.textPrimary }}>{OPTION_LIST_LABELS[listName] || listName}</span>
      </div>

      <div style={{ padding: "12px 16px 8px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={addingValue} onChange={(e) => setAddingValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Add a new option"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, fontSize: 14, fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }} />
          <button onClick={handleAdd} style={{ padding: "0 16px", borderRadius: 8, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={16} /> Add
          </button>
        </div>
        <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 6 }}>Tap a value to rename it. Arrows reorder — order here is the order shown throughout the app. Removing archives it (below), rather than deleting it outright.</div>
        {options.some((opt) => CustomOptionListsRepository.isProtected(listName, opt)) && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.textDisabled, marginTop: 4 }}>
            <Lock size={11} /> A value marked with a lock can't be renamed or removed — the app depends on its exact text.
          </div>
        )}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, margin: "8px 16px 24px", overflow: "hidden" }}>
        {options.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: T.textDisabled }}>No options — add one above.</div>
        ) : options.map((opt, i) => {
          const protectedValue = CustomOptionListsRepository.isProtected(listName, opt);
          return (
          <div key={opt} style={{ padding: "10px 14px", borderBottom: i < options.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {editingIndex === i ? (
                <input autoFocus value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingIndex(null); }}
                  onBlur={commitEdit}
                  style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: `1px solid ${ACCENTS.healthcare}`, fontSize: 14, fontFamily: "'Inter', sans-serif" }} />
              ) : protectedValue ? (
                <span style={{ flex: 1, fontSize: 14, color: T.textPrimary, cursor: "default" }}>{opt}</span>
              ) : (
                <span onClick={() => startEdit(i)} style={{ flex: 1, fontSize: 14, color: T.textPrimary, cursor: "pointer" }}>{opt}</span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                {protectedValue ? (
                  <Lock size={14} color={T.textDisabled} title="Protected — the app relies on this exact value, so it can't be renamed or removed" aria-label="Protected — the app relies on this exact value, so it can't be renamed or removed" />
                ) : (
                  <>
                    <ArrowUp size={14} color={i === 0 ? T.textDisabled : T.textSecondary} style={{ cursor: i === 0 ? "default" : "pointer" }} onClick={() => i > 0 && move(i, -1)} title="Move up" />
                    <ArrowDown size={14} color={i === options.length - 1 ? T.textDisabled : T.textSecondary} style={{ cursor: i === options.length - 1 ? "default" : "pointer" }} onClick={() => i < options.length - 1 && move(i, 1)} title="Move down" />
                    <X size={14} color={ACTION.red} style={{ cursor: "pointer" }} onClick={() => remove(opt)} title="Remove this option (archives it)" aria-label="Remove this option (archives it)" />
                  </>
                )}
              </div>
            </div>
            <div style={{ marginTop: 4 }}>
              <UsageDisclosure listName={listName} value={opt} T={T} />
            </div>
          </div>
          );
        })}
      </div>

      {/* ADDED 16 Sep 2026 — real ask (#75): archived values stay
          visible and actionable here, not silently gone — see
          customOptionListsRepository.js's own remove() comment for why
          "remove" now archives instead of deleting outright. */}
      {/* FIXED — real bug caught live: reassociateStatus used to render
          only inside this "any archived values left" block, so
          reassociating the LAST archived value made both it and its
          own success message disappear in the same render, before it
          could ever be read. Moved above the length gate so it survives
          the archived section itself going empty. */}
      {reassociateStatus && <div style={{ fontSize: 12, color: ACTION.green, margin: "0 16px 12px" }}>{reassociateStatus}</div>}
      {archivedValues.length > 0 && (
        <div style={{ margin: "0 16px 24px" }}>
          <div style={{ ...TYPE.sectionLabel, color: T.textDisabled, marginBottom: 8 }}>Archived</div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
            {archivedValues.map((value, i) => (
              <div key={value} style={{ padding: "10px 14px", borderBottom: i < archivedValues.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 14, color: T.textSecondary, textDecoration: "line-through", textDecorationColor: T.textDisabled }}>{value}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <SwapIcon size={14} color={ACCENTS.healthcare} style={{ cursor: "pointer" }} onClick={() => setReassociatingValue(reassociatingValue === value ? null : value)} title="Reassociate its records with a different value" aria-label="Reassociate its records with a different value" />
                    <RestoreIcon size={14} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={() => restoreArchived(value)} title="Restore to the live list" aria-label="Restore to the live list" />
                    <X size={14} color={ACTION.red} style={{ cursor: "pointer" }} onClick={() => setConfirmDeleteForever(value)} title="Delete permanently — cannot be undone" aria-label="Delete permanently — cannot be undone" />
                  </div>
                </div>
                <div style={{ marginTop: 4 }}>
                  <UsageDisclosure listName={listName} value={value} T={T} />
                </div>
                {confirmDeleteForever === value && (
                  <ConfirmDeleteCard T={T} moduleColor={ACCENTS.healthcare}
                    message={`This permanently deletes "${value}" — unlike archiving, there's no getting it back.`}
                    onCancel={() => setConfirmDeleteForever(null)}
                    onConfirm={async () => { await deleteArchivedForever(value); setConfirmDeleteForever(null); }} />
                )}
                {reassociatingValue === value && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {options.length === 0 ? (
                      <span style={{ fontSize: 11, color: T.textDisabled }}>No live values to reassociate with yet — add one above first.</span>
                    ) : options.map((liveValue) => (
                      <span key={liveValue} onClick={() => doReassociate(value, liveValue)} role="button" tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doReassociate(value, liveValue); } }}
                        style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: `${ACCENTS.healthcare}1A`, color: ACCENTS.healthcare, cursor: "pointer" }}>
                        {liveValue}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 6 }}>Reassociate moves every record using the archived value onto the one you pick, then removes it from the archive for good. Restore just brings it back as a normal, live option.</div>
        </div>
      )}
    </div>
  );
}

export default function OptionListsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;

  const [open, setOpen] = useState(null);
  const listNames = CustomOptionListsRepository.getAllListNames();
  // CHANGED — Phase 2 encryption groundwork: CustomOptionListsRepository
  // went async — same lookup-map treatment as Settings' own
  // ManageListsScreen for its equivalent list of counts.
  const listCounts = useLoadedMemo(async () => {
    const entries = await Promise.all(listNames.map(async (name) => [name, (await CustomOptionListsRepository.get(name)).length]));
    return Object.fromEntries(entries);
  }, [], {});

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(48px + env(safe-area-inset-bottom))", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ ...TYPE.subScreenTitle, color: T.textPrimary }}>Option lists</span>
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, padding: "10px 16px 0" }}>
        Add, rename, or reorder the simple option lists used across the app — no code, no waiting on a rebuild. Changes here are permanent on this device and survive future app updates.
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, margin: "16px 16px 20px", overflow: "hidden" }}>
        {listNames.map((name) => {
          const iconConfig = OPTION_LIST_ICONS[name];
          const IconComponent = iconConfig ? ICON_COMPONENTS[iconConfig.icon] : null;
          return (
            <div key={name} onClick={() => setOpen(name)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* ADDED 19 Aug 2026 — real ask: icon+color per
                    category, same treatment as the Registries screen. */}
                {IconComponent && (
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: `${iconConfig.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <IconComponent size={14} color={iconConfig.color} />
                  </div>
                )}
                <span style={{ fontSize: 14, color: T.textPrimary, fontWeight: 500 }}>{OPTION_LIST_LABELS[name] || name}</span>
              </div>
              <span style={{ fontSize: 12, color: T.textDisabled }}>{listCounts[name] ?? 0} options ›</span>
            </div>
          );
        })}
      </div>
      {open && <OptionListDetail listName={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
