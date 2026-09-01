// SHOS_MenstrualHealth_Prototype.jsx
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Cycle / Contraception / Pregnancy — three internal tabs of one
// Healthcare sub-tab, not three separate ones, because Pregnancy
// directly gates the other two and keeping that relationship local to
// one screen beats spreading it across tabs someone has to mentally
// cross-reference. Three separate repositories underneath though
// (menstrualCycleRepository.js/contraceptionRepository.js/
// pregnancyRepository.js), matching how Testing/Clinic Visits/
// Vaccinations already stay separate files despite one Healthcare tab.
//
// GATED BEHIND appPreferencesRepository.js's menstrualTrackingEnabled
// — opt-in for anyone, decoupled from gender (menopause HRT/TRT
// tracking already established gender-based assumptions don't hold
// here). Only the Pregnancy tab gets an ADDITIONAL, narrower default:
// hidden for Male/Trans-female gender specifically (same exact
// condition My Profile's own contraception field already uses), since
// that's a real anatomical fact, not an assumption — never a hard
// block though, a "Show pregnancy tracking anyway" link stays.
//
// PREGNANCY GATING CYCLE/CONTRACEPTION — an active pregnancy
// (pregnancyRepository.js's getActive()) shows a banner and replaces
// the Cycle/Contraception "+ Add" prompts with a paused note, never
// hides them outright — a manual entry (e.g. spotting during
// pregnancy) is still possible. Ending in Miscarriage/Abortion/Ectopic
// is real, visible data — never hidden by this gating, only optionally
// masked per-entry via `sensitive` (a completely separate, user-set
// thing — see PregnancyDetail below).
import React, { useState, useMemo, useEffect, useRef } from "react";
import { PlusIcon as Plus, CaretLeftIcon as ChevronLeft, CheckIcon as Check, ArrowsClockwiseIcon as RefreshCcw, TrashIcon as Trash2, XIcon as X, EyeIcon as Eye, EyeSlashIcon as EyeSlash, DropIcon as Drop, PillIcon as Pill, BabyIcon as Baby } from "@phosphor-icons/react";
import { MenstrualCycleRepository, DEFAULT_CYCLE } from "../repositories/menstrualCycleRepository";
import { ContraceptionRepository, DEFAULT_CONTRACEPTION_ENTRY } from "../repositories/contraceptionRepository";
import { PregnancyRepository, DEFAULT_PREGNANCY, TEST_RESULT_OPTIONS, OUTCOME_OPTIONS } from "../repositories/pregnancyRepository";
import { TrashRepository } from "../repositories/trashRepository";
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { MyProfileRepository } from "../repositories/myProfileRepository";
import { useEditUndo } from "../calculations/editUndoHelpers";
import { nowAsDateString } from "../calculations/dateInputHelpers";
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS, resolveDarkAccent } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

const LIGHT = { ...NEUTRAL, healthcareBlue: ACCENTS.healthcare, actionRed: ACTION.red };
const DARK = { ...NEUTRAL_DARK, healthcareBlue: resolveDarkAccent("healthcare", ACCENTS.healthcare), actionRed: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") };
const radius = RADIUS;

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
// Same exact condition already used by My Profile's own contraception
// field visibility — see SHOS_MyProfile_Prototype.jsx's showsContraception.
function couldMenstruate(gender) {
  return ["female", "trans-male"].includes((gender || "").trim().toLowerCase());
}
function couldBePregnant(gender) {
  return couldMenstruate(gender);
}

function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}
function TextField({ label, value, onChange, T, placeholder, type = "text", readOnly = false }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: T.textSecondary }}>{label}</div>
        {type === "date" && !readOnly && (
          <span onClick={() => onChange(nowAsDateString())} style={{ fontSize: 11, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }}>Now</span>
        )}
      </div>
      {readOnly ? (
        <div style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textSecondary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }}>{value || "—"}</div>
      ) : (
        <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      )}
    </div>
  );
}
function SelectField({ label, value, onChange, options, T, hint }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}{hint && <span style={{ color: T.textDisabled, fontWeight: 400 }}> — {hint}</span>}</div>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }}>
        <option value="">—</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}
function ReadRow({ label, value, T, alert }) {
  if (value === "" || value == null || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.textSecondary, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: alert ? T.actionRed : T.textPrimary, fontWeight: 500, textAlign: "right" }}>{display}</span>
    </div>
  );
}
function RelationPicker({ label, value, onChange, T, items, placeholder }) {
  const [query, setQuery] = useState("");
  const queryLower = query.trim().toLowerCase();
  const available = items.filter((i) => !value.includes(i.id));
  const visibleSuggestions = queryLower ? available.filter((i) => i.name.toLowerCase().includes(queryLower)).slice(0, 8) : available.slice(0, 3);
  const nameFor = (id) => items.find((i) => i.id === id)?.name || "?";
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((id) => (
            <div key={id} onClick={() => onChange(value.filter((v) => v !== id))}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer" }}>
              {nameFor(id)} ✕
            </div>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…"
          style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 12, boxSizing: "border-box", marginBottom: 6 }} />
      )}
      {visibleSuggestions.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {visibleSuggestions.map((i) => (
            <div key={i.id} onClick={() => { onChange([...value, i.id]); setQuery(""); }}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              + {i.name}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: T.textDisabled, fontStyle: "italic" }}>{placeholder}</div>
      )}
    </div>
  );
}
function FreeTextSuggestField({ label, value, onChange, options, onAddNew, T, placeholder }) {
  const typed = (value || "").trim();
  const visibleSuggestions = (typed ? options.filter((v) => v.toLowerCase().includes(typed.toLowerCase())) : options).filter((v) => v !== value).slice(0, 8);
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((v) => (
            <div key={v} onClick={() => onChange(v)} style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>{v}</div>
          ))}
        </div>
      )}
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        onBlur={() => { if (value && value.trim()) onAddNew(value.trim()); }}
        onKeyDown={(e) => { if (e.key === "Enter" && value && value.trim()) { e.preventDefault(); onAddNew(value.trim()); e.target.blur(); } }}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}
function BottomSheet({ title, onClose, T, children, footer }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 210 }} onClick={onClose}>
      <div style={{ background: T.bg, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: T.healthcareBlue, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 14px", flexShrink: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>{title}</span>
          <X size={20} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  );
}
function SaveButton({ label, onClick, canSave, T }) {
  return (
    <button onClick={() => canSave && onClick()} style={{ width: "100%", padding: 16, borderRadius: radius.full, border: "none", background: canSave ? T.healthcareBlue : T.textDisabled, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
      {label}
    </button>
  );
}
function ListRow({ isSelected, selectMode, onClick, T, children }) {
  return (
    <div onClick={onClick}
      style={{ background: isSelected ? `${T.healthcareBlue}10` : T.surface, border: `1px solid ${isSelected ? T.healthcareBlue : T.border}`, borderRadius: radius.md, padding: 12, cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
      {selectMode && (
        <div style={{ width: 20, height: 20, borderRadius: radius.full, border: `2px solid ${isSelected ? T.healthcareBlue : T.border}`, background: isSelected ? T.healthcareBlue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {isSelected && <Check size={12} color="#FFFFFF" />}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
function DetailHeader({ onBack, onEdit, onDelete, T }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
      <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }} onClick={onEdit}>Edit</span>
        <Trash2 size={17} color={T.actionRed} style={{ cursor: "pointer" }} onClick={onDelete} />
      </div>
    </div>
  );
}
function DeleteConfirm({ onCancel, onConfirm, T }) {
  return (
    <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}11` }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>This permanently deletes the record — unlike archiving, there's no getting it back.</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.actionRed, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
      </div>
    </div>
  );
}
function DeleteToast({ toast, onUndo, onRedo, T, noun }) {
  if (!toast) return null;
  return (
    <div onClick={toast.mode === "undo" ? onUndo : onRedo}
      style={{ position: "fixed", bottom: 90, left: 20, right: 20, maxWidth: 560, margin: "0 auto", background: "#1B1B1F", color: "#FFFFFF", padding: "12px 16px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", zIndex: 40, boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
      <span style={{ fontSize: 13 }}>{toast.mode === "undo" ? `${toast.records.length} ${noun}${toast.records.length > 1 ? "s" : ""} deleted` : `${toast.records.length} ${noun}${toast.records.length > 1 ? "s" : ""} restored`}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue }}>{toast.mode === "undo" ? "Tap to undo" : "Tap to redo"}</span>
    </div>
  );
}

// Small standalone hook covering the identical delete/undo/redo/Trash
// wiring every module in this app already uses — kept local to this
// file (not shared cross-module) matching this app's own established
// self-contained-module convention, just no longer typed out 3x by
// hand within this one file for Cycle/Contraception/Pregnancy each.
function useDeleteUndo(repo, moduleKey) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const undo = () => {
    if (!toast) return;
    toast.records.forEach((r) => repo.restore(r));
    setToast({ mode: "redo", records: toast.records });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 8000);
  };
  const redo = () => {
    if (!toast) return;
    TrashRepository.add(moduleKey, toast.records);
    toast.records.forEach((r) => repo.delete(r.id));
    setToast(null);
    clearTimeout(timerRef.current);
  };
  const trigger = (records) => {
    TrashRepository.add(moduleKey, records);
    records.forEach((r) => repo.delete(r.id));
    setToast({ mode: "undo", records });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 8000);
  };
  return { toast, undo, redo, trigger };
}

// ═══════════════════════════════════════════════════════════════════
// CYCLE
// ═══════════════════════════════════════════════════════════════════
function CycleSheet({ cycle, onSave, onClose, T }) {
  const isNew = !cycle;
  const [flowOptions, setFlowOptions] = useState(() => CustomOptionListsRepository.get("menstrualFlow"));
  const [form, setForm] = useState(() => cycle ? { ...cycle } : { ...DEFAULT_CYCLE, startDate: new Date().toISOString().slice(0, 10) });
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const symptoms = useMemo(() => SymptomsRegistry.getAll().filter((s) => !s.isArchived), []);
  const canSave = !!form.startDate;
  return (
    <BottomSheet title={isNew ? "Log period" : "Edit period"} onClose={onClose} T={T} footer={<SaveButton label={isNew ? "Add" : "Save changes"} onClick={() => onSave(form)} canSave={canSave} T={T} />}>
      <TextField label="Start date" value={form.startDate} onChange={set("startDate")} T={T} type="date" />
      <TextField label="End date (optional — leave blank if ongoing)" value={form.endDate} onChange={set("endDate")} T={T} type="date" />
      <SelectField label="Flow" value={form.flow} onChange={set("flow")} options={flowOptions} T={T} />
      <RelationPicker label="Symptoms during this period" value={form.symptomIds} onChange={set("symptomIds")} T={T} items={symptoms} placeholder="No symptoms in registry" />
      <div style={{ padding: "8px 0 20px" }}>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Notes</div>
        <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={3}
          style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
      </div>
    </BottomSheet>
  );
}

function CycleTab({ T, isPregnant }) {
  const [screen, setScreen] = useState({ name: "list" });
  const [cycles, setCycles] = useState(() => MenstrualCycleRepository.getAll().filter((c) => !c.isArchived).sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)));
  const refresh = () => setCycles(MenstrualCycleRepository.getAll().filter((c) => !c.isArchived).sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)));
  const deleteUndo = useDeleteUndo(MenstrualCycleRepository, "menstrualCycles");
  const editUndo = useEditUndo(MenstrualCycleRepository);
  const avgLength = useMemo(() => MenstrualCycleRepository.getAverageCycleLengthDays(), [cycles]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const create = (data) => { MenstrualCycleRepository.create(data); refresh(); setScreen({ name: "list" }); };
  const save = (data) => {
    editUndo.captureBeforeEdit(screen.id);
    MenstrualCycleRepository.update(screen.id, data);
    editUndo.notifyEdited(screen.id);
    refresh();
    setScreen({ name: "detail", id: screen.id });
  };

  if (screen.name === "detail") {
    const c = MenstrualCycleRepository.getById(screen.id);
    if (!c) return null;
    const symptomNames = c.symptomIds.map((id) => SymptomsRegistry.getById(id)?.name).filter(Boolean);
    return (
      <div>
        <DetailHeader onBack={() => setScreen({ name: "list" })} onEdit={() => setScreen({ name: "edit", id: c.id })} onDelete={() => setConfirmDelete(true)} T={T} />
        {confirmDelete && <DeleteConfirm onCancel={() => setConfirmDelete(false)} onConfirm={() => { deleteUndo.trigger([c]); refresh(); setConfirmDelete(false); setScreen({ name: "list" }); }} T={T} />}
        <div style={{ padding: "0 16px 100px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Drop size={16} color={T.healthcareBlue} weight="fill" />
            <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{formatDate(c.startDate)}{c.endDate ? ` – ${formatDate(c.endDate)}` : " (ongoing)"}</span>
          </div>
          <SectionCard title="Details" T={T}>
            <ReadRow label="Flow" value={c.flow} T={T} />
            <ReadRow label="Symptoms" value={symptomNames} T={T} />
          </SectionCard>
          <SectionCard title="Notes" T={T}><ReadRow label="Notes" value={c.notes} T={T} /></SectionCard>
        </div>
      </div>
    );
  }

  return (
    <div>
      {isPregnant ? (
        <div style={{ margin: "12px 16px", padding: 12, borderRadius: radius.md, border: `1px solid ${T.healthcareBlue}`, background: `${T.healthcareBlue}11`, fontSize: 12, color: T.textSecondary }}>
          Cycle tracking is paused while pregnant — you can still add an entry manually if you need to (e.g. spotting).
        </div>
      ) : avgLength ? (
        <div style={{ margin: "12px 16px 0", fontSize: 12, color: T.textSecondary }}>Average cycle length so far: <strong style={{ color: T.textPrimary }}>{avgLength} days</strong></div>
      ) : null}
      <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
        <div onClick={() => setScreen({ name: "add" })} style={{ width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", pointerEvents: "auto" }}>
          <Plus size={24} />
        </div>
      </div>
      <div style={{ padding: "12px 16px 100px", display: "flex", flexDirection: "column", gap: 8 }}>
        {cycles.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>No periods logged yet. Tap + to add one.</div>}
        {cycles.map((c) => (
          <ListRow key={c.id} T={T} onClick={() => setScreen({ name: "detail", id: c.id })}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{formatDate(c.startDate)}{c.endDate ? ` – ${formatDate(c.endDate)}` : " (ongoing)"}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{c.flow || "Flow not set"}</div>
          </ListRow>
        ))}
      </div>
      <DeleteToast toast={deleteUndo.toast} onUndo={deleteUndo.undo} onRedo={deleteUndo.redo} T={T} noun="period" />
      {screen.name === "add" && <CycleSheet cycle={null} onSave={create} onClose={() => setScreen({ name: "list" })} T={T} />}
      {screen.name === "edit" && <CycleSheet cycle={MenstrualCycleRepository.getById(screen.id)} onSave={save} onClose={() => setScreen({ name: "detail", id: screen.id })} T={T} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CONTRACEPTION
// ═══════════════════════════════════════════════════════════════════
function ContraceptionSheet({ entry, onSave, onClose, T }) {
  const isNew = !entry;
  const [methodOptions, setMethodOptions] = useState(() => CustomOptionListsRepository.get("contraception"));
  const [form, setForm] = useState(() => entry ? { ...entry } : { ...DEFAULT_CONTRACEPTION_ENTRY, startDate: new Date().toISOString().slice(0, 10) });
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const visits = useMemo(() => ClinicVisitsRepository.getAll().filter((v) => !v.isArchived).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), []);
  const canSave = !!form.method && !!form.startDate;

  // Real convenience: setting intervalDays auto-computes nextDueDate
  // from startDate, matching medicationRepository.js's own
  // scheduleIntervalDays-driven next-due math — still freely editable
  // afterward, this is just a sensible starting point.
  const setInterval = (days) => {
    const numeric = days === "" ? null : Number(days);
    setForm((f) => {
      if (!numeric || !f.startDate) return { ...f, intervalDays: numeric };
      const due = new Date(f.startDate);
      due.setDate(due.getDate() + numeric);
      return { ...f, intervalDays: numeric, nextDueDate: due.toISOString().slice(0, 10) };
    });
  };

  return (
    <BottomSheet title={isNew ? "Add contraception" : "Edit contraception"} onClose={onClose} T={T} footer={<SaveButton label={isNew ? "Add" : "Save changes"} onClick={() => onSave(form)} canSave={canSave} T={T} />}>
      <FreeTextSuggestField label="Method" value={form.method} onChange={set("method")} options={methodOptions}
        onAddNew={(v) => setMethodOptions(CustomOptionListsRepository.add("contraception", v))} T={T} placeholder="e.g. Depot, IUD, Combined pill" />
      <TextField label="Start date" value={form.startDate} onChange={set("startDate")} T={T} type="date" />
      <TextField label="End date (leave blank if currently active)" value={form.endDate} onChange={set("endDate")} T={T} type="date" />
      <TextField label="Renewal interval in days (optional — e.g. 84 for a 12-week depot shot)" value={form.intervalDays ?? ""} onChange={setInterval} T={T} type="number" placeholder="e.g. 84, or 1825 for a 5-year IUD" />
      <TextField label="Next due" value={form.nextDueDate} onChange={set("nextDueDate")} T={T} type="date" />
      {visits.length > 0 && (
        <SelectField label="Linked clinic visit (optional)" value={form.linkedClinicVisitId || ""} onChange={set("linkedClinicVisitId")}
          options={visits.map((v) => v.id)} T={T} />
      )}
      <div style={{ padding: "8px 0 20px" }}>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Notes</div>
        <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={3}
          style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
      </div>
    </BottomSheet>
  );
}

function ContraceptionTab({ T, isPregnant }) {
  const [screen, setScreen] = useState({ name: "list" });
  const [, force] = useState(0);
  const refresh = () => force((v) => v + 1);
  const all = ContraceptionRepository.getAll().filter((e) => !e.isArchived).sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
  const active = all.filter((e) => !e.endDate);
  const past = all.filter((e) => e.endDate);
  const deleteUndo = useDeleteUndo(ContraceptionRepository, "contraception");
  const editUndo = useEditUndo(ContraceptionRepository);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const create = (data) => { ContraceptionRepository.create(data); refresh(); setScreen({ name: "list" }); };
  const save = (data) => {
    editUndo.captureBeforeEdit(screen.id);
    ContraceptionRepository.update(screen.id, data);
    editUndo.notifyEdited(screen.id);
    refresh();
    setScreen({ name: "detail", id: screen.id });
  };

  if (screen.name === "detail") {
    const e = ContraceptionRepository.getById(screen.id);
    if (!e) return null;
    const linkedVisit = e.linkedClinicVisitId ? ClinicVisitsRepository.getById(e.linkedClinicVisitId) : null;
    const overdue = e.nextDueDate && e.nextDueDate < today && !e.endDate;
    return (
      <div>
        <DetailHeader onBack={() => setScreen({ name: "list" })} onEdit={() => setScreen({ name: "edit", id: e.id })} onDelete={() => setConfirmDelete(true)} T={T} />
        {confirmDelete && <DeleteConfirm onCancel={() => setConfirmDelete(false)} onConfirm={() => { deleteUndo.trigger([e]); refresh(); setConfirmDelete(false); setScreen({ name: "list" }); }} T={T} />}
        <div style={{ padding: "0 16px 100px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Pill size={16} color={T.healthcareBlue} weight="fill" />
            <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{e.method}</span>
          </div>
          <SectionCard title="Details" T={T}>
            <ReadRow label="Started" value={formatDate(e.startDate)} T={T} />
            <ReadRow label="Ended" value={e.endDate ? formatDate(e.endDate) : "Currently active"} T={T} />
            <ReadRow label="Next due" value={e.nextDueDate ? formatDate(e.nextDueDate) : ""} T={T} alert={overdue} />
            {linkedVisit && <ReadRow label="Linked clinic visit" value={formatDate(linkedVisit.date)} T={T} />}
          </SectionCard>
          <SectionCard title="Notes" T={T}><ReadRow label="Notes" value={e.notes} T={T} /></SectionCard>
        </div>
      </div>
    );
  }

  return (
    <div>
      {isPregnant && (
        <div style={{ margin: "12px 16px", padding: 12, borderRadius: radius.md, border: `1px solid ${T.healthcareBlue}`, background: `${T.healthcareBlue}11`, fontSize: 12, color: T.textSecondary }}>
          Contraception reminders are paused while pregnant.
        </div>
      )}
      <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
        <div onClick={() => setScreen({ name: "add" })} style={{ width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", pointerEvents: "auto" }}>
          <Plus size={24} />
        </div>
      </div>
      <div style={{ padding: "12px 16px 100px" }}>
        {all.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>No contraception logged yet. Tap + to add one.</div>}
        {active.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Currently active</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {active.map((e) => {
                const overdue = e.nextDueDate && e.nextDueDate < today;
                return (
                  <ListRow key={e.id} T={T} onClick={() => setScreen({ name: "detail", id: e.id })}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{e.method}</div>
                    <div style={{ fontSize: 12, color: overdue ? T.actionRed : T.textSecondary, marginTop: 2, fontWeight: overdue ? 700 : 400 }}>
                      {e.nextDueDate ? `${overdue ? "Overdue since" : "Next due"} ${formatDate(e.nextDueDate)}` : `Started ${formatDate(e.startDate)}`}
                    </div>
                  </ListRow>
                );
              })}
            </div>
          </div>
        )}
        {past.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {past.map((e) => (
                <ListRow key={e.id} T={T} onClick={() => setScreen({ name: "detail", id: e.id })}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{e.method}</div>
                  <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{formatDate(e.startDate)} – {formatDate(e.endDate)}</div>
                </ListRow>
              ))}
            </div>
          </div>
        )}
      </div>
      <DeleteToast toast={deleteUndo.toast} onUndo={deleteUndo.undo} onRedo={deleteUndo.redo} T={T} noun="entry" />
      {screen.name === "add" && <ContraceptionSheet entry={null} onSave={create} onClose={() => setScreen({ name: "list" })} T={T} />}
      {screen.name === "edit" && <ContraceptionSheet entry={ContraceptionRepository.getById(screen.id)} onSave={save} onClose={() => setScreen({ name: "detail", id: screen.id })} T={T} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PREGNANCY
// ═══════════════════════════════════════════════════════════════════
function PregnancySheet({ pregnancy, onSave, onClose, T }) {
  const isNew = !pregnancy;
  const [form, setForm] = useState(() => pregnancy ? { ...pregnancy } : { ...DEFAULT_PREGNANCY, testDate: new Date().toISOString().slice(0, 10) });
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const canSave = !!form.testDate && !!form.testResult;
  const isPositive = form.testResult === "Positive";
  const isResolved = OUTCOME_OPTIONS.includes(form.status);
  return (
    <BottomSheet title={isNew ? "Log pregnancy test" : "Edit pregnancy entry"} onClose={onClose} T={T} footer={<SaveButton label={isNew ? "Add" : "Save changes"} onClick={() => onSave(form)} canSave={canSave} T={T} />}>
      <TextField label="Test date" value={form.testDate} onChange={set("testDate")} T={T} type="date" />
      <SelectField label="Result" value={form.testResult} onChange={set("testResult")} options={TEST_RESULT_OPTIONS} T={T} />
      {isPositive && (
        <>
          <TextField label="Estimated due date (optional)" value={form.estimatedDueDate} onChange={set("estimatedDueDate")} T={T} type="date" />
          <SelectField label="Outcome" value={isResolved ? form.status : ""} onChange={set("status")} options={OUTCOME_OPTIONS} T={T} hint="leave blank while ongoing" />
          {isResolved && <TextField label="Outcome date" value={form.outcomeDate} onChange={set("outcomeDate")} T={T} type="date" />}
          {isResolved && (
            <div onClick={() => set("sensitive")(!form.sensitive)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", cursor: "pointer" }}>
              {form.sensitive ? <EyeSlash size={16} color={T.healthcareBlue} /> : <Eye size={16} color={T.textSecondary} />}
              <span style={{ fontSize: 13, color: T.textPrimary }}>Mask this entry (shown as "tap to reveal" in your list)</span>
            </div>
          )}
        </>
      )}
      <div style={{ padding: "8px 0 20px" }}>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Notes</div>
        <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={3}
          style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
      </div>
    </BottomSheet>
  );
}

function PregnancyTab({ T }) {
  const [screen, setScreen] = useState({ name: "list" });
  const [revealedIds, setRevealedIds] = useState([]);
  const all = PregnancyRepository.getAll().filter((p) => !p.isArchived).sort((a, b) => new Date(b.testDate || 0) - new Date(a.testDate || 0));
  const deleteUndo = useDeleteUndo(PregnancyRepository, "pregnancies");
  const editUndo = useEditUndo(PregnancyRepository);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, force] = useState(0);
  const refresh = () => force((v) => v + 1);

  const create = (data) => { PregnancyRepository.create(data); refresh(); setScreen({ name: "list" }); };
  const save = (data) => {
    editUndo.captureBeforeEdit(screen.id);
    PregnancyRepository.update(screen.id, data);
    editUndo.notifyEdited(screen.id);
    refresh();
    setScreen({ name: "detail", id: screen.id });
  };

  const isMasked = (p) => p.sensitive && !revealedIds.includes(p.id);
  const summaryLabel = (p) => {
    if (isMasked(p)) return "Tap to reveal";
    if (OUTCOME_OPTIONS.includes(p.status)) return p.status;
    if (p.status === "Ongoing") return "Ongoing";
    return p.testResult;
  };

  if (screen.name === "detail") {
    const p = PregnancyRepository.getById(screen.id);
    if (!p) return null;
    const masked = isMasked(p);
    return (
      <div>
        <DetailHeader onBack={() => setScreen({ name: "list" })} onEdit={() => setScreen({ name: "edit", id: p.id })} onDelete={() => setConfirmDelete(true)} T={T} />
        {confirmDelete && <DeleteConfirm onCancel={() => setConfirmDelete(false)} onConfirm={() => { deleteUndo.trigger([p]); refresh(); setConfirmDelete(false); setScreen({ name: "list" }); }} T={T} />}
        <div style={{ padding: "0 16px 100px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Baby size={16} color={T.healthcareBlue} weight="fill" />
            <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{formatDate(p.testDate)}</span>
          </div>
          {masked ? (
            <div onClick={() => setRevealedIds((ids) => [...ids, p.id])} style={{ marginTop: 14, padding: 20, textAlign: "center", borderRadius: radius.md, border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer" }}>
              <EyeSlash size={22} color={T.textSecondary} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: T.textSecondary }}>This entry is marked sensitive. Tap to reveal.</div>
            </div>
          ) : (
            <>
              <SectionCard title="Details" T={T}>
                <ReadRow label="Test result" value={p.testResult} T={T} />
                <ReadRow label="Estimated due date" value={p.estimatedDueDate ? formatDate(p.estimatedDueDate) : ""} T={T} />
                <ReadRow label="Status" value={p.status} T={T} alert={OUTCOME_OPTIONS.includes(p.status) && p.status !== "Live birth"} />
                <ReadRow label="Outcome date" value={p.outcomeDate ? formatDate(p.outcomeDate) : ""} T={T} />
              </SectionCard>
              <SectionCard title="Notes" T={T}><ReadRow label="Notes" value={p.notes} T={T} /></SectionCard>
              {p.sensitive && (
                <div onClick={() => setRevealedIds((ids) => ids.filter((id) => id !== p.id))} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, cursor: "pointer" }}>
                  <EyeSlash size={13} color={T.textSecondary} />
                  <span style={{ fontSize: 11, color: T.textSecondary }}>Hide again</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
        <div onClick={() => setScreen({ name: "add" })} style={{ width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", pointerEvents: "auto" }}>
          <Plus size={24} />
        </div>
      </div>
      <div style={{ padding: "12px 16px 100px", display: "flex", flexDirection: "column", gap: 8 }}>
        {all.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>No pregnancy tests logged yet. Tap + to add one.</div>}
        {all.map((p) => {
          const masked = isMasked(p);
          return (
            <ListRow key={p.id} T={T} onClick={() => masked ? setRevealedIds((ids) => [...ids, p.id]) : setScreen({ name: "detail", id: p.id })}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {masked && <EyeSlash size={13} color={T.textSecondary} />}
                <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, fontStyle: masked ? "italic" : "normal" }}>{summaryLabel(p)}</span>
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{formatDate(p.testDate)}</div>
            </ListRow>
          );
        })}
      </div>
      <DeleteToast toast={deleteUndo.toast} onUndo={deleteUndo.undo} onRedo={deleteUndo.redo} T={T} noun="entry" />
      {screen.name === "add" && <PregnancySheet pregnancy={null} onSave={create} onClose={() => setScreen({ name: "list" })} T={T} />}
      {screen.name === "edit" && <PregnancySheet pregnancy={PregnancyRepository.getById(screen.id)} onSave={save} onClose={() => setScreen({ name: "detail", id: screen.id })} T={T} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODULE ROOT
// ═══════════════════════════════════════════════════════════════════
export default function MenstrualHealthModule() {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;
  const gender = MyProfileRepository.getProfile().gender;
  const [showPregnancyAnyway, setShowPregnancyAnyway] = useState(false);
  const showsPregnancyByDefault = couldBePregnant(gender);
  const [subTab, setSubTab] = useState("cycle");
  const [, force] = useState(0);
  const activePregnancy = PregnancyRepository.getActive();

  const tabs = [
    { key: "cycle", label: "Cycle" },
    { key: "contraception", label: "Contraception" },
    ...((showsPregnancyByDefault || showPregnancyAnyway) ? [{ key: "pregnancy", label: "Pregnancy" }] : []),
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ position: "sticky", top: 62, zIndex: 6, background: T.bg, padding: "10px 16px 4px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, textTransform: "uppercase", letterSpacing: 0.5 }}>Menstrual & Contraception</span>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {tabs.map((t) => (
            <div key={t.key} onClick={() => setSubTab(t.key)}
              style={{ padding: "5px 12px", borderRadius: radius.full, fontSize: 12, fontWeight: 700, cursor: "pointer", background: subTab === t.key ? T.healthcareBlue : T.surface, color: subTab === t.key ? "#FFFFFF" : T.textSecondary, border: `1px solid ${subTab === t.key ? T.healthcareBlue : T.border}` }}>
              {t.label}
            </div>
          ))}
        </div>
      </div>
      {activePregnancy && (
        <div style={{ margin: "12px 16px 0", padding: 12, borderRadius: radius.md, background: T.healthcareBlue, display: "flex", alignItems: "center", gap: 8 }}
          onClick={() => setSubTab("pregnancy")}>
          <Baby size={16} color="#FFFFFF" weight="fill" />
          <span style={{ fontSize: 12, color: "#FFFFFF", fontWeight: 600 }}>Currently pregnant since {formatDate(activePregnancy.testDate)}{activePregnancy.estimatedDueDate ? ` · est. due ${formatDate(activePregnancy.estimatedDueDate)}` : ""} — tap for details</span>
        </div>
      )}
      {!showsPregnancyByDefault && !showPregnancyAnyway && subTab !== "pregnancy" && (
        <div style={{ margin: "10px 16px 0", textAlign: "right" }}>
          <span onClick={() => setShowPregnancyAnyway(true)} style={{ fontSize: 11, color: T.textDisabled, cursor: "pointer", textDecoration: "underline" }}>Show pregnancy tracking anyway</span>
        </div>
      )}
      {subTab === "cycle" && <CycleTab T={T} isPregnant={!!activePregnancy} />}
      {subTab === "contraception" && <ContraceptionTab T={T} isPregnant={!!activePregnancy} />}
      {subTab === "pregnancy" && <PregnancyTab T={T} />}
    </div>
  );
}
