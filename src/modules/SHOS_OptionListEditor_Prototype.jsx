import React, { useState } from "react";
import { CaretLeftIcon as ChevronLeft, PlusIcon as Plus, ArrowUpIcon as ArrowUp, ArrowDownIcon as ArrowDown, XIcon as X, PillIcon as Pill, ArrowCircleRightIcon as ArrowRightCircle, ClipboardTextIcon as ClipboardList, CalendarIcon as CalendarClock, TestTubeIcon as TestTube, SyringeIcon as Syringe, CalendarCheckIcon as CalendarCheck, MapPinIcon as MapPin, PlayCircleIcon as PlayCircle, TagIcon as Tag, HeartIcon as Heart, UserIcon as User } from "@phosphor-icons/react";
import { CustomOptionListsRepository, OPTION_LIST_LABELS, OPTION_LIST_ICONS } from "../repositories/customOptionListsRepository";

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
import { NEUTRAL, ACCENTS, ACTION, RADIUS } from "../calculations/designTokens";

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
export const ICON_COMPONENTS = { Pill, ArrowRightCircle, ClipboardList, CalendarClock, TestTube, Syringe, CalendarCheck, MapPin, PlayCircle, Tag, Heart, User };

// ADDED 19 Aug 2026 — the "idiot-proof" editor the user asked for, for the
// simple flat option lists (see customOptionListsRepository.js for the
// full reasoning on scope and safety). ONE generic screen reused for
// every category — same "shared component once a shape repeats" rule
// already applied to SHOS_RegistryManagement_Prototype.jsx.
export function OptionListDetail({ listName, onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;

  const [refreshKey, setRefreshKey] = useState(0);
  const [addingValue, setAddingValue] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  const options = CustomOptionListsRepository.get(listName);
  const refresh = () => setRefreshKey((k) => k + 1);

  const handleAdd = () => {
    const trimmed = addingValue.trim();
    if (!trimmed) return;
    CustomOptionListsRepository.add(listName, trimmed);
    setAddingValue("");
    refresh();
  };

  const startEdit = (i) => { setEditingIndex(i); setEditingValue(options[i]); };
  const commitEdit = () => {
    const trimmed = editingValue.trim();
    if (trimmed && trimmed !== options[editingIndex]) {
      CustomOptionListsRepository.rename(listName, options[editingIndex], trimmed);
    }
    setEditingIndex(null);
    refresh();
  };

  const remove = (value) => {
    CustomOptionListsRepository.remove(listName, value);
    refresh();
  };

  const move = (i, direction) => {
    const next = [...options];
    const target = i + direction;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    CustomOptionListsRepository.reorder(listName, next);
    refresh();
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: T.bg, zIndex: 230, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>{OPTION_LIST_LABELS[listName] || listName}</span>
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
        <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 6 }}>Tap a value to rename it. Arrows reorder — order here is the order shown throughout the app.</div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, margin: "8px 16px 24px", overflow: "hidden" }}>
        {options.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: T.textDisabled }}>No options — add one above.</div>
        ) : options.map((opt, i) => (
          <div key={opt} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < options.length - 1 ? `1px solid ${T.border}` : "none" }}>
            {editingIndex === i ? (
              <input autoFocus value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingIndex(null); }}
                onBlur={commitEdit}
                style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: `1px solid ${ACCENTS.healthcare}`, fontSize: 14, fontFamily: "'Inter', sans-serif" }} />
            ) : (
              <span onClick={() => startEdit(i)} style={{ flex: 1, fontSize: 14, color: T.textPrimary, cursor: "pointer" }}>{opt}</span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <ArrowUp size={14} color={i === 0 ? T.textDisabled : T.textSecondary} style={{ cursor: i === 0 ? "default" : "pointer" }} onClick={() => i > 0 && move(i, -1)} title="Move up" />
              <ArrowDown size={14} color={i === options.length - 1 ? T.textDisabled : T.textSecondary} style={{ cursor: i === options.length - 1 ? "default" : "pointer" }} onClick={() => i < options.length - 1 && move(i, 1)} title="Move down" />
              <X size={14} color={ACTION.red} style={{ cursor: "pointer" }} onClick={() => remove(opt)} title="Remove this option" aria-label="Remove this option" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OptionListsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;

  const [open, setOpen] = useState(null);
  const listNames = CustomOptionListsRepository.getAllListNames();

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Option lists</span>
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
              <span style={{ fontSize: 12, color: T.textDisabled }}>{CustomOptionListsRepository.get(name).length} options ›</span>
            </div>
          );
        })}
      </div>
      {open && <OptionListDetail listName={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
