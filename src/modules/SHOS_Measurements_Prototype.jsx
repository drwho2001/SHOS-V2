// SHOS_Measurements_Prototype.jsx
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// The single standardised place for any numeric health value — CD4
// count, viral load, hormone levels, weight, blood pressure. See
// measurementRepository.js's own file-level comment for the full
// "one room, three doors" design this came out of (a Measurement can
// be added standalone here, or inline from Clinic Visits/Testing,
// which just creates the same kind of record with a link attached).
//
// GROUPED BY TYPE, not a flat date-sorted feed — a real, deliberate
// design decision: a type logged weekly (e.g. Blood pressure) would
// otherwise bury a type logged twice a year (e.g. CD4 count) under
// noise. Each type gets its own section, newest entry first.
import React, { useState, useMemo, useEffect, useRef } from "react";
import { PlusIcon as Plus, CaretLeftIcon as ChevronLeft, CheckIcon as Check, ArrowsClockwiseIcon as RefreshCcw, TrashIcon as Trash2, XIcon as X } from "@phosphor-icons/react";
import { MeasurementRepository, DEFAULT_MEASUREMENT, BLOOD_PRESSURE_TYPE, BLOOD_PRESSURE_UNIT, getAvailableUnits } from "../repositories/measurementRepository";
import { TrashRepository } from "../repositories/trashRepository";
import { exportRecordAsFile } from "../storage/recordExportService";
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { findClosestMatch } from "../calculations/fuzzyMatch";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";
import { useEditUndo } from "../calculations/editUndoHelpers";
import { nowAsDateString } from "../calculations/dateInputHelpers";
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS, resolveDarkAccent } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

const LIGHT = { ...NEUTRAL, healthcareBlue: ACCENTS.healthcare, actionRed: ACTION.red };
const DARK = { ...NEUTRAL_DARK, healthcareBlue: resolveDarkAccent("healthcare", ACCENTS.healthcare), actionRed: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") };
const radius = RADIUS;

// Grey placeholder hints — real ask: suggest the variety of values/
// units that can be entered, not just a bare empty box. Types with a
// unit picker (see getAvailableUnits) don't need a unit hint here.
const PLACEHOLDER_HINTS = {
  "Viral load": { value: "e.g. 340, or <20", unit: "e.g. copies/mL" },
  "CD4 count": { value: "e.g. 620", unit: "e.g. cells/µL" },
  LH: { value: "e.g. 5.2", unit: "e.g. IU/L" },
  FSH: { value: "e.g. 4.8", unit: "e.g. IU/L" },
  Other: { value: "e.g. 42", unit: "e.g. units" },
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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

// Type field — free text with suggestions, same "type + auto-save as
// suggestion" pattern as Vaccinations' own VaccineField, but with two
// real differences: (1) a genuine "Did you mean X?" prompt via
// findClosestMatch before silently creating a near-duplicate type —
// unlike a generic typo, a near-duplicate MEASUREMENT type silently
// splits trend data, so this is worth the extra step here specifically.
// (2) "Blood pressure" is excluded from the offered options when
// editing an existing NON-BP entry (can't switch into it — see
// measurementRepository.js's own comment on why), and the whole field
// is locked read-only when editing an existing BP entry (can't switch
// out of it either) — both sides of the "excluded from the picker, not
// forced into a mismatched edit form" fix agreed during design.
function MeasurementTypeField({ value, onChange, options, onAddNew, T, locked }) {
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const typed = (value || "").trim();
  const visibleSuggestions = (typed ? options.filter((v) => v.toLowerCase().includes(typed.toLowerCase())) : options)
    .filter((v) => v !== value).slice(0, 8);

  const commit = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const exact = options.some((o) => o.toLowerCase() === trimmed.toLowerCase());
    if (exact) { setPendingSuggestion(null); return; }
    const close = findClosestMatch(options, trimmed);
    if (close) { setPendingSuggestion(close); return; }
    onAddNew(trimmed);
    setPendingSuggestion(null);
  };

  if (locked) {
    return (
      <div style={{ padding: "8px 0" }}>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Type</div>
        <div style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textSecondary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }}>{value}</div>
        <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 4, fontStyle: "italic" }}>Type can't be changed on a Blood pressure entry — delete and re-add instead.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Type</div>
      {pendingSuggestion && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 10px", borderRadius: radius.sm, border: `1px solid ${T.healthcareBlue}`, background: `${T.healthcareBlue}11` }}>
          <span style={{ fontSize: 12, color: T.textPrimary, flex: 1 }}>Did you mean "{pendingSuggestion}"?</span>
          <span onClick={() => { onChange(pendingSuggestion); setPendingSuggestion(null); }} style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }}>Use it</span>
          <span onClick={() => { onAddNew(value.trim()); setPendingSuggestion(null); }} style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, cursor: "pointer" }}>No, add new</span>
        </div>
      )}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((v) => (
            <div key={v} onClick={() => { onChange(v); setPendingSuggestion(null); }}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              {v}
            </div>
          ))}
        </div>
      )}
      <input value={value ?? ""} onChange={(e) => { onChange(e.target.value); setPendingSuggestion(null); }}
        onBlur={() => commit(value || "")}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(value || ""); e.target.blur(); } }}
        placeholder="e.g. Testosterone, Weight, CD4 count"
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

// Value + unit — a locked select when the type has real conversion
// units (see UNIT_CONFIG in measurementRepository.js), a free-text
// unit field otherwise. This is the "unit wheel" resolved during
// design: the picker alone was never the fix for the cross-lab unit
// mismatch problem, real conversion (in the repository) is — this
// just offers whichever unit the picker allows, storage does the rest.
function ValueUnitFields({ type, value, unit, onValueChange, onUnitChange, T }) {
  const unitOptions = getAvailableUnits(type);
  const hints = PLACEHOLDER_HINTS[type] || { value: "e.g. 42", unit: "e.g. units" };
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}>
        <TextField label="Value" value={value ?? ""} onChange={(v) => onValueChange(v === "" ? null : Number(v))} T={T} type="number" placeholder={hints.value} />
      </div>
      <div style={{ flex: 1 }}>
        {unitOptions.length > 0 ? (
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Unit</div>
            <select value={unit ?? unitOptions[0]} onChange={(e) => onUnitChange(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }}>
              {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        ) : (
          <TextField label="Unit" value={unit ?? ""} onChange={onUnitChange} T={T} placeholder={hints.unit} />
        )}
      </div>
    </div>
  );
}

function MeasurementSheet({ measurement, presetType, presetLink, onSave, onClose, T }) {
  const isNew = !measurement;
  const [typeOptions, setTypeOptions] = useState(() => CustomOptionListsRepository.get("measurementType"));
  // "Blood pressure" excluded from what's offered when editing an
  // existing non-BP entry — can't switch INTO it (see file comment).
  const editableOptions = !isNew && measurement.type !== BLOOD_PRESSURE_TYPE
    ? typeOptions.filter((o) => o !== BLOOD_PRESSURE_TYPE)
    : typeOptions;
  const draftKey = `measurement_${measurement?.id || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    if (measurement) return { ...measurement };
    // ADDED — real ask: "memory" for repeat entries — a new entry's
    // type/unit prefilled from the last entry of that type, quick-add
    // from a type-group header (presetType). Value is deliberately
    // NEVER prefilled — a stale reading carried forward would be a
    // real logging bug, not a convenience.
    const base = { ...DEFAULT_MEASUREMENT, date: new Date().toISOString().slice(0, 10), type: presetType || "", ...presetLink };
    if (presetType) {
      const last = MeasurementRepository.getLastEntry(presetType);
      if (last) return { ...base, unit: last.unit, enteredUnit: last.enteredUnit };
      // Same fix as setType() below — a preset type with real
      // conversion units still needs its canonical unit written into
      // state up front, not just shown as the select's visual default.
      const availableUnits = getAvailableUnits(presetType);
      if (availableUnits.length) return { ...base, unit: availableUnits[0] };
    }
    return base;
  });
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    saveDraft(draftKey, form);
  }, [form]);
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const isBP = form.type === BLOOD_PRESSURE_TYPE;
  const canSave = form.type.trim().length > 0 && (isBP ? (form.systolic != null && form.diastolic != null) : form.value != null);

  // Real "memory": switching type on a NEW entry prefills that type's
  // last-used unit, same reasoning as the presetType path above.
  const setType = (newType) => {
    if (isNew && newType && newType !== BLOOD_PRESSURE_TYPE) {
      const last = MeasurementRepository.getLastEntry(newType);
      // FIXED — real bug found in testing: a type with real conversion
      // units (Testosterone/Estradiol/Weight) showed its canonical
      // unit as the select's visible default, but nothing had actually
      // written that into form state yet, so an entry saved without
      // ever touching the Unit dropdown silently stored unit: "" —
      // not what the picker was showing. Falls back to the type's own
      // canonical unit (getAvailableUnits(newType)[0]) whenever there's
      // no prior entry to inherit a unit from, so what's displayed and
      // what's saved always agree.
      const availableUnits = getAvailableUnits(newType);
      const defaultUnit = last ? last.unit : (availableUnits[0] || "");
      setForm((f) => ({ ...f, type: newType, unit: defaultUnit, value: null }));
    } else {
      setForm((f) => ({ ...f, type: newType }));
    }
  };

  const linkedVisit = form.linkedClinicVisitId ? ClinicVisitsRepository.getById(form.linkedClinicVisitId) : null;
  const linkedTest = form.linkedTestId ? TestingRepository.getById(form.linkedTestId) : null;

  const doSave = () => {
    clearDraft(draftKey);
    onSave(form);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 210 }} onClick={onClose}>
      <div style={{ background: T.bg, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: T.healthcareBlue, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 14px", flexShrink: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>{isNew ? "Add measurement" : "Edit measurement"}</span>
          <X size={20} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>
          <MeasurementTypeField value={form.type} onChange={setType} options={editableOptions}
            onAddNew={(v) => setTypeOptions(CustomOptionListsRepository.add("measurementType", v))} T={T} locked={!isNew && measurement.type === BLOOD_PRESSURE_TYPE} />
          <TextField label="Date" value={form.date} onChange={set("date")} T={T} type="date" />
          {isBP ? (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><TextField label="Systolic" value={form.systolic ?? ""} onChange={(v) => set("systolic")(v === "" ? null : Number(v))} T={T} type="number" placeholder="e.g. 120" /></div>
              <div style={{ flex: 1 }}><TextField label="Diastolic" value={form.diastolic ?? ""} onChange={(v) => set("diastolic")(v === "" ? null : Number(v))} T={T} type="number" placeholder="e.g. 80" /></div>
              <div style={{ width: 70 }}><TextField label="Unit" value={BLOOD_PRESSURE_UNIT} onChange={() => {}} T={T} readOnly /></div>
            </div>
          ) : (
            form.type && <ValueUnitFields type={form.type} value={form.value} unit={form.unit} onValueChange={set("value")} onUnitChange={set("unit")} T={T} />
          )}
          {(linkedVisit || linkedTest) && (
            <div style={{ padding: "8px 0" }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Linked to</div>
              <div style={{ fontSize: 13, color: T.textPrimary }}>
                {linkedVisit && `Clinic visit · ${formatDate(linkedVisit.date)}`}
                {linkedTest && `Test · ${formatDate(linkedTest.date)}`}
              </div>
            </div>
          )}
          <div style={{ padding: "8px 0 20px" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Notes</div>
            <textarea value={form.note} onChange={(e) => set("note")(e.target.value)} rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={() => canSave && doSave()} style={{ width: "100%", padding: 16, borderRadius: radius.full, border: "none", background: canSave ? T.healthcareBlue : T.textDisabled, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
            {isNew ? "Add measurement" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MeasurementDetail({ measurementId, onBack, onEdit, T, triggerDelete, refresh }) {
  const [m, setM] = useState(() => MeasurementRepository.getById(measurementId));
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!m) return null;
  const isBP = m.type === BLOOD_PRESSURE_TYPE;
  const linkedVisit = m.linkedClinicVisitId ? ClinicVisitsRepository.getById(m.linkedClinicVisitId) : null;
  const linkedTest = m.linkedTestId ? TestingRepository.getById(m.linkedTestId) : null;
  // Real transparency: if the entered unit differs from the stored
  // (converted) unit, show both — nothing is silently rewritten
  // without the user being able to see what they actually typed.
  const showsConversion = !isBP && m.enteredUnit && m.enteredUnit !== m.unit;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }} onClick={() => onEdit(measurementId)}>Edit</span>
          <Trash2 size={17} color={T.actionRed} style={{ cursor: "pointer" }} onClick={() => setConfirmDelete(true)} />
        </div>
      </div>
      {confirmDelete && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}11` }}>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
            This permanently deletes the record — unlike archiving, there's no getting it back.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { triggerDelete([m]); refresh(); onBack(); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.actionRed, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
          </div>
        </div>
      )}
      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: radius.full, background: T.healthcareBlue, display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{m.type}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 20 }}>{formatDate(m.date)}</div>

        <SectionCard title="Reading" T={T}>
          {isBP ? (
            <ReadRow label="Blood pressure" value={`${m.systolic}/${m.diastolic} mmHg`} T={T} />
          ) : (
            <>
              <ReadRow label="Value" value={m.value != null ? `${m.value} ${m.unit}` : ""} T={T} />
              {showsConversion && <ReadRow label="As entered" value={`${m.enteredValue} ${m.enteredUnit}`} T={T} />}
            </>
          )}
        </SectionCard>

        {(linkedVisit || linkedTest) && (
          <SectionCard title="Related records" T={T}>
            {linkedVisit && <ReadRow label="Clinic visit" value={formatDate(linkedVisit.date)} T={T} />}
            {linkedTest && <ReadRow label="Test" value={formatDate(linkedTest.date)} T={T} />}
          </SectionCard>
        )}

        <SectionCard title="Notes" T={T}>
          <ReadRow label="Notes" value={m.note} T={T} />
        </SectionCard>
        {m.updatedAt && (
          <div style={{ textAlign: "center", fontSize: 11, color: T.textDisabled, marginTop: 16 }}>
            Last updated {formatDate(m.updatedAt)}
          </div>
        )}
      </div>
    </div>
  );
}

function MeasurementsLanding({ onOpen, onAdd, onAddType, T, measurements, refresh, deleteToast, undoDelete, redoDelete, triggerDelete }) {
  const [query, setQuery] = useState("");
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? measurements.filter((m) => m.type.toLowerCase().includes(q)) : measurements;
    const byType = new Map();
    filtered.forEach((m) => {
      if (!byType.has(m.type)) byType.set(m.type, []);
      byType.get(m.type).push(m);
    });
    const groups = [...byType.entries()].map(([type, entries]) => ({
      type,
      entries: entries.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
    }));
    // Most-recently-logged type first, so whichever the user is
    // actively tracking right now surfaces at the top.
    groups.sort((a, b) => new Date(b.entries[0].date || 0) - new Date(a.entries[0].date || 0));
    return groups;
  }, [measurements, query]);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };
  const allVisibleIds = useMemo(() => grouped.flatMap((g) => g.entries.map((e) => e.id)), [grouped]);

  const readingLabel = (m) => m.type === BLOOD_PRESSURE_TYPE ? `${m.systolic}/${m.diastolic} mmHg` : (m.value != null ? `${m.value} ${m.unit}` : "—");

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ position: "sticky", top: 62, zIndex: 6, background: T.bg, padding: "10px 16px 4px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, textTransform: "uppercase", letterSpacing: 0.5 }}>Measurements</span>
        <span onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={{ fontSize: 11, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }}>
          {selectMode ? "Done" : "Select"}
        </span>
      </div>
      {selectMode && (
        <div style={{ background: "#1B1B1F", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600 }}>{selectedIds.length} selected</span>
          <div style={{ display: "flex", gap: 16 }}>
            <span onClick={() => setSelectedIds(selectedIds.length === allVisibleIds.length ? [] : allVisibleIds)}
              style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>
              {selectedIds.length === allVisibleIds.length ? "Deselect all" : "Select all"}
            </span>
            <span onClick={() => { if (selectedIds.length === 1) exportRecordAsFile("measurements", MeasurementRepository.getById(selectedIds[0])); }}
              style={{ fontSize: 13, color: selectedIds.length === 1 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length === 1 ? "pointer" : "default" }}>Export</span>
            <span onClick={() => { if (selectedIds.length > 0) { MeasurementRepository.bulkArchive(selectedIds); refresh(); exitSelectMode(); } }}
              style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Archive</span>
            <span onClick={() => {
              if (selectedIds.length === 0) return;
              if (window.confirm(`Delete ${selectedIds.length} measurement${selectedIds.length > 1 ? "s" : ""}? You'll have a few seconds to undo.`)) {
                const toRestore = MeasurementRepository.getAll().filter((m) => selectedIds.includes(m.id));
                triggerDelete(toRestore);
                refresh();
                exitSelectMode();
              }
            }} style={{ fontSize: 13, color: selectedIds.length > 0 ? DARK.actionRed : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
            <span onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
          </div>
        </div>
      )}
      <div style={{ padding: "8px 16px 0" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by type"
          style={{ width: "100%", padding: "8px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      </div>
      <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
        <div onClick={onAdd} style={{ width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", pointerEvents: "auto" }}>
          <Plus size={24} />
        </div>
      </div>
      <div style={{ padding: "12px 16px 100px" }}>
        {grouped.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>
            No measurements logged yet. Tap + to add one.
          </div>
        )}
        {grouped.map((group) => (
          <div key={group.type} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>{group.type}</span>
              {/* ADDED — real ask: "memory" quick-add, prefilling this
                  type (and its last-used unit, handled in the sheet
                  itself) so a recurring reading is one tap away. */}
              <span onClick={() => onAddType(group.type)} style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }}>+ Add another</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.entries.map((m) => {
                const isSelected = selectedIds.includes(m.id);
                return (
                  <div key={m.id} onClick={() => selectMode ? toggleSelected(m.id) : onOpen(m.id)}
                    style={{ background: isSelected ? `${T.healthcareBlue}10` : T.surface, border: `1px solid ${isSelected ? T.healthcareBlue : T.border}`, borderRadius: radius.md, padding: 12, cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
                    {selectMode && (
                      <div style={{ width: 20, height: 20, borderRadius: radius.full, border: `2px solid ${isSelected ? T.healthcareBlue : T.border}`, background: isSelected ? T.healthcareBlue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isSelected && <Check size={12} color="#FFFFFF" />}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{readingLabel(m)}</div>
                      <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{formatDate(m.date)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {deleteToast && (
        <div onClick={deleteToast.mode === "undo" ? undoDelete : redoDelete}
          style={{ position: "fixed", bottom: 90, left: 20, right: 20, maxWidth: 560, margin: "0 auto", background: "#1B1B1F", color: "#FFFFFF", padding: "12px 16px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", zIndex: 40, boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
          <span style={{ fontSize: 13 }}>
            {deleteToast.mode === "undo"
              ? `${deleteToast.records.length} measurement${deleteToast.records.length > 1 ? "s" : ""} deleted`
              : `${deleteToast.records.length} measurement${deleteToast.records.length > 1 ? "s" : ""} restored`}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue }}>
            {deleteToast.mode === "undo" ? "Tap to undo" : "Tap to redo"}
          </span>
        </div>
      )}
    </div>
  );
}

export default function MeasurementsModule({ openAddOnMount = false, onConsumedQuickAdd, openRecordId, onConsumedRecordOpen, onDataChanged, registerModuleBackHandler } = {}) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;
  const [screen, setScreen] = useState({ name: "list" });
  const [measurements, setMeasurements] = useState(() => MeasurementRepository.getAll().filter((m) => !m.isArchived));
  const refresh = () => { setMeasurements(MeasurementRepository.getAll().filter((m) => !m.isArchived)); onDataChanged?.(); };
  const [deleteToast, setDeleteToast] = useState(null);
  const undoTimerRef = useRef(null);
  const undoDelete = () => {
    if (!deleteToast) return;
    deleteToast.records.forEach((record) => MeasurementRepository.restore(record));
    refresh();
    clearTimeout(undoTimerRef.current);
    setDeleteToast({ mode: "redo", records: deleteToast.records });
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  const redoDelete = () => {
    if (!deleteToast) return;
    TrashRepository.add("measurements", deleteToast.records);
    deleteToast.records.forEach((r) => MeasurementRepository.delete(r.id));
    refresh();
    setDeleteToast(null);
    clearTimeout(undoTimerRef.current);
  };
  const triggerDelete = (records) => {
    TrashRepository.add("measurements", records);
    records.forEach((r) => MeasurementRepository.delete(r.id));
    setDeleteToast({ mode: "undo", records });
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  const editUndo = useEditUndo(MeasurementRepository);

  useEffect(() => {
    if (openAddOnMount) {
      setScreen({ name: "add" });
      onConsumedQuickAdd?.();
    }
    if (openRecordId) {
      setScreen({ name: "detail", id: openRecordId });
      onConsumedRecordOpen?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToList = () => setScreen({ name: "list" });

  useEffect(() => {
    if (!registerModuleBackHandler) return;
    registerModuleBackHandler(() => {
      if (screen.name === "add") { setScreen({ name: "list" }); return true; }
      if (screen.name === "edit") { setScreen({ name: "detail", id: screen.id }); return true; }
      if (screen.name === "detail") { setScreen({ name: "list" }); return true; }
      return false;
    });
    return () => registerModuleBackHandler(null);
  }, [screen, registerModuleBackHandler]);

  const createMeasurement = (data) => { MeasurementRepository.create(data); refresh(); backToList(); };
  const saveMeasurement = (data) => {
    editUndo.captureBeforeEdit(screen.id);
    MeasurementRepository.update(screen.id, data);
    editUndo.notifyEdited(screen.id);
    refresh();
    setScreen({ name: "detail", id: screen.id });
  };

  let content;
  if (screen.name === "list") content = <MeasurementsLanding T={T} onOpen={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "add" })} onAddType={(type) => setScreen({ name: "add", presetType: type })} measurements={measurements} refresh={refresh} deleteToast={deleteToast} undoDelete={undoDelete} redoDelete={redoDelete} triggerDelete={triggerDelete} />;
  else if (screen.name === "detail") content = <MeasurementDetail T={T} measurementId={screen.id} onBack={backToList} onEdit={(id) => setScreen({ name: "edit", id })} triggerDelete={triggerDelete} refresh={refresh} />;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: T.bg, minHeight: "100vh" }}>
      {editUndo.toast && (
        <div onClick={editUndo.toast.mode === "undo" ? editUndo.undo : editUndo.redo}
          style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", width: 340, background: editUndo.toast.mode === "undo" ? "#1B1B1F" : LIGHT.healthcareBlue, color: "#FFFFFF", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {editUndo.toast.mode === "undo" ? <Check size={14} /> : <RefreshCcw size={14} />}
          {editUndo.toast.mode === "undo" ? "Measurement updated — tap to undo" : "Undone — tap to redo"}
        </div>
      )}
      {content}
      {screen.name === "add" && <MeasurementSheet T={T} measurement={null} presetType={screen.presetType} onSave={createMeasurement} onClose={backToList} />}
      {screen.name === "edit" && <MeasurementSheet T={T} measurement={MeasurementRepository.getById(screen.id)} onSave={saveMeasurement} onClose={() => setScreen({ name: "detail", id: screen.id })} />}
    </div>
  );
}

// Exported for Clinic Visits/Testing's own inline "add measurement"
// entry points — same MeasurementSheet used everywhere, just opened
// directly with a preset link rather than through this module's own
// list/add/edit screen flow, per the "one room, three doors" design.
export function InlineMeasurementSheet({ presetLink, onClose, onSaved, T }) {
  const save = (data) => { MeasurementRepository.create(data); onSaved?.(); onClose(); };
  return <MeasurementSheet T={T} measurement={null} presetLink={presetLink} onSave={save} onClose={onClose} />;
}
