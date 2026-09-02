import React, { useState, useMemo, useEffect, useRef } from "react";
import { PlusIcon as Plus, CaretLeftIcon as ChevronLeft, CheckIcon as Check, ArrowsClockwiseIcon as RefreshCcw, TrashIcon as Trash2, XIcon as X } from "@phosphor-icons/react";
import { VaccinationRepository, DEFAULT_VACCINATION } from "../repositories/vaccinationRepository";
import { TrashRepository } from "../repositories/trashRepository";
import { exportRecordAsFile } from "../storage/recordExportService";
// ADDED 19 Aug 2026 — VACCINE_OPTIONS/REASON_OPTIONS/INJECTION_SITE_OPTIONS
// now live here, real in-app editable option lists.
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { fuzzyIncludes } from "../calculations/fuzzyMatch";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";
import { useEditUndo } from "../calculations/editUndoHelpers";
import { nowAsDateString } from "../calculations/dateInputHelpers";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS, resolveDarkAccent } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

// ADDED 19 Aug 2026 — Vaccinations, real live Notion schema. Same
// self-contained-module pattern, Healthcare blue, single Inter
// typeface throughout (JetBrains Mono retired 26 Aug 2026).
const LIGHT = {
  ...NEUTRAL,
  healthcareBlue: ACCENTS.healthcare, actionRed: ACTION.red,
};
// Dark mode, on Medication's DARK basis — see Contacts' own comment
// for the full reasoning.
// CHANGED — real architecture fix, same as Contacts' own comment:
// resolveDarkAccent() keeps today's exact behaviour by default, only
// brightening once a real colour override exists.
const DARK = {
  ...NEUTRAL_DARK,
  healthcareBlue: resolveDarkAccent("healthcare", ACCENTS.healthcare, "#5EDE9A"), actionRed: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E"),
};
const radius = RADIUS;

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function isOverdue(nextDue) {
  if (!nextDue) return false;
  return nextDue < new Date().toISOString().slice(0, 10);
}

function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, T, placeholder, type = "text" }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: T.textSecondary }}>{label}</div>
        {/* ADDED — real ask: "Now" quick-fill, device's real local date. */}
        {type === "date" && (
          <span onClick={() => onChange(nowAsDateString())} style={{ fontSize: 11, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }}>Now</span>
        )}
      </div>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, T }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }}>
        <option value="">—</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function MultiSelectChips({ label, value, onChange, options, T }) {
  const toggle = (opt) => { const has = value.includes(opt); onChange(has ? value.filter((v) => v !== opt) : [...value, opt]); };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <div key={opt} onClick={() => toggle(opt)}
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.healthcareBlue : T.border}`, color: active ? T.healthcareBlue : T.textSecondary, background: active ? `${T.healthcareBlue}15` : "transparent" }}>
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// CHANGED 1 Sep 2026 — real omission found in a broader audit: unlike
// the same-named component in Clinic Visits/Symptom Log (fixed earlier
// this session), this copy had no search at all — just a hard cap-8
// chip list with nothing beyond it reachable. Same fix: real search
// box (matches name or clinician), default suggestion count tightened
// to the 3 most recent.
function RelationPicker({ label, value, onChange, T, items, placeholder }) {
  const [query, setQuery] = useState("");
  const queryLower = query.trim().toLowerCase();
  const available = items.filter((i) => !value.includes(i.id));
  const visibleSuggestions = queryLower
    ? available.filter((i) => i.name.toLowerCase().includes(queryLower) || (i.searchText || "").includes(queryLower)).slice(0, 8)
    : available.slice(0, 3);
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
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or clinician…"
          style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 12, boxSizing: "border-box", marginBottom: 6 }} />
      )}
      {visibleSuggestions.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {visibleSuggestions.map((i) => (
            <div key={i.id} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { onChange([...value, i.id]); setQuery(""); }}
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

// CHANGED — real ask: "not an exhaustive vaccine name given, should be
// free/partially free text with recognition, so e.g. MENACWY can be
// added" — the underlying data already came from the editable option
// list, but the field itself was still a closed <select>, meaning
// typing a new one directly on this form wasn't actually possible.
// Same free-text-plus-suggestions pattern already proven for Clinician
// in Clinic Visits — genuinely typing a new value here also saves it
// to the real shared option list, so it's a real suggestion next time.
function VaccineField({ value, onChange, options, onAddNew, T }) {
  // CHANGED — same real ask as the other suggestion-chip fields this
  // session: narrow to real matches once typing begins, instead of
  // always showing the same static option list regardless of input —
  // also lowers the odds of "Hep B" and "Hepatitis B" both quietly
  // ending up as separate saved options.
  const typed = (value || "").trim();
  const visibleSuggestions = (typed ? options.filter((v) => fuzzyIncludes(v, typed)) : options)
    .filter((v) => v !== value).slice(0, 8);
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Vaccine</div>
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((v) => (
            <div key={v} onMouseDown={(ev) => ev.preventDefault()} onClick={() => onChange(v)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              {v}
            </div>
          ))}
        </div>
      )}
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        onBlur={() => { if (value && value.trim()) onAddNew(value.trim()); }}
        onKeyDown={(e) => { if (e.key === "Enter" && value && value.trim()) { e.preventDefault(); onAddNew(value.trim()); e.target.blur(); } }}
        placeholder="e.g. MENACWY"
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

function VaccinationSheet({ vaccination, onSave, onClose, T }) {
  const isNew = !vaccination;
  // ADDED 19 Aug 2026 — real in-app editable option lists.
  const [vaccineOptions, setVaccineOptions] = useState(() => CustomOptionListsRepository.get("vaccine"));
  const vaccinationReasonOptions = useMemo(() => CustomOptionListsRepository.get("vaccinationReason"), []);
  const injectionSiteOptions = useMemo(() => CustomOptionListsRepository.get("injectionSite"), []);
  const draftKey = `vaccination_${vaccination?.id || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    return vaccination ? { ...vaccination } : { ...DEFAULT_VACCINATION, date: new Date().toISOString().slice(0, 10) };
  });
  // CHANGED — real bug fix, same as Encounters: fired on the very
  // first render too, immediately autosaving the pristine, untouched
  // default form the instant this sheet opened — so just opening and
  // closing it with zero real edits left a draft behind, later shown
  // as a false "Restored unsaved changes" prompt. Skips the initial
  // mount with a ref, only saves once the form has genuinely changed.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    saveDraft(draftKey, form);
  }, [form]);
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const canSave = form.title.trim().length > 0;
  const symptoms = useMemo(() => SymptomsRegistry.getAll().filter((s) => !s.isArchived), []);
  // CHANGED 1 Sep 2026 — real omission found in a broader audit: this
  // had no .sort() at all (storage order = oldest first), the same
  // "old options listed first" bug already fixed elsewhere. Sorted
  // newest-first; searchText adds clinician name(s) as a second match
  // field, same "search by name or [relevant field]" pattern used
  // elsewhere (Encounters searches by attendee, this searches by
  // clinician — Vaccinations' nearest equivalent).
  const visits = useMemo(() => [...ClinicVisitsRepository.getAll()].filter((v) => !v.isArchived)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .map((v) => ({
      id: v.id,
      name: `${v.title || (v.reasonForVisit || []).join("/") || "Clinic visit"} · ${formatDate(v.date)}`,
      searchText: (v.clinician || []).join(" ").toLowerCase(),
    })), []);

  const doSave = () => {
    clearDraft(draftKey);
    onSave(form);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 210 }} onClick={onClose}>
      <div style={{ background: T.bg, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }} onClick={(e) => e.stopPropagation()}>
        {/* CHANGED 26 Aug 2026 — real ask: forms should also have the
            module banner title. Also added a real close button — this
            had no visible close control at all, only backdrop-tap. */}
        <div style={{ background: T.healthcareBlue, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 14px", flexShrink: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>{isNew ? "Log vaccination" : "Edit vaccination"}</span>
          <X size={20} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onClose} aria-label="Close" />
        </div>
        <div style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>
          <TextField label="Title" value={form.title} onChange={set("title")} T={T} placeholder="e.g. Hep B booster" />
          <VaccineField value={form.vaccine} onChange={set("vaccine")} options={vaccineOptions}
            onAddNew={(v) => setVaccineOptions(CustomOptionListsRepository.add("vaccine", v))} T={T} />
          <MultiSelectChips label="Reason" value={form.reason} onChange={set("reason")} options={vaccinationReasonOptions} T={T} />
          <TextField label="Dose number" value={form.doseNumber ?? ""} onChange={(v) => set("doseNumber")(v === "" ? null : Number(v))} T={T} type="number" />
          <TextField label="Date" value={form.date} onChange={set("date")} T={T} type="date" />
          <TextField label="Next due" value={form.nextDue} onChange={set("nextDue")} T={T} type="date" />
          <SelectField label="Injection site" value={form.injectionSite} onChange={set("injectionSite")} options={injectionSiteOptions} T={T} />
          <TextField label="Provider" value={form.provider} onChange={set("provider")} T={T} placeholder="e.g. Sexual Health Clinic" />
          {/* FIXED 1 Sep 2026 — real ask: "Vaccination log symptoms not
              correct type." MultiSelectChips is a plain string-toggle
              component fed symptom NAMES as its options, but symptomIds
              is documented (DEFAULT_VACCINATION's own comment) and
              named as real SymptomsRegistry IDs — every selection was
              storing a name string into a field meant to hold an ID,
              exactly like every other symptomIds/symptomTypeIds field
              in this app (Symptom Log, Clinic Visits) correctly does
              via RelationPicker, already used two lines below for
              Clinic visits but never for this field. Switched to the
              same real ID-backed picker. */}
          <RelationPicker label="Symptom" value={form.symptomIds} onChange={set("symptomIds")}
            T={T} items={symptoms} placeholder="No symptoms in registry" />
          <RelationPicker label="Clinic visits" value={form.clinicVisitIds} onChange={set("clinicVisitIds")} T={T} items={visits} placeholder="No clinic visits logged yet" />
          <div style={{ padding: "8px 0 20px" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Notes</div>
            <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={() => canSave && doSave()} style={{ width: "100%", padding: 16, borderRadius: radius.full, border: "none", background: canSave ? T.healthcareBlue : T.textDisabled, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
            {isNew ? "Add vaccination" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VaccinationDetail({ vaccinationId, onBack, onEdit, T, triggerDelete, refresh }) {
  const [v, setV] = useState(() => VaccinationRepository.getById(vaccinationId));
  // ADDED — real ask: real delete, with a confirmation step, same
  // pattern already proven for Testing.
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!v) return null;
  const overdue = isOverdue(v.nextDue);
  const visitNames = v.clinicVisitIds.map((id) => {
    const visit = ClinicVisitsRepository.getById(id);
    return visit ? `${visit.title || (visit.reasonForVisit || []).join("/") || "Clinic visit"} · ${formatDate(visit.date)}` : null;
  }).filter(Boolean);
  // FIXED 1 Sep 2026 — same real bug as the edit form's own picker:
  // symptomIds holds real SymptomsRegistry ids now, so displaying it
  // raw needs resolving to names first, same as visitNames just above
  // and ClinicVisits' own symptomTypeIds display.
  const symptomNames = v.symptomIds.map((id) => SymptomsRegistry.getById(id)?.name).filter(Boolean);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }} onClick={() => onEdit(vaccinationId)}>Edit</span>
          <Trash2 size={17} color={T.actionRed} style={{ cursor: "pointer" }} onClick={() => setConfirmDelete(true)} aria-label="Delete permanently" title="Delete permanently" />
        </div>
      </div>
      {confirmDelete && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}11` }}>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
            This permanently deletes the record — unlike archiving, there's no getting it back. Only use this for a genuinely wrong entry.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { triggerDelete([v]); refresh(); onBack(); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.actionRed, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
          </div>
        </div>
      )}
      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: radius.full, background: overdue ? T.actionRed : T.healthcareBlue, display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{v.title}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 20, fontFamily: "'Inter', sans-serif" }}>{formatDate(v.date)}</div>

        <SectionCard title="Overview" T={T}>
          <ReadRow label="Vaccine" value={v.vaccine} T={T} />
          <ReadRow label="Reason" value={v.reason} T={T} />
          <ReadRow label="Dose number" value={v.doseNumber} T={T} />
          <ReadRow label="Injection site" value={v.injectionSite} T={T} />
          <ReadRow label="Provider" value={v.provider} T={T} />
          <ReadRow label="Next due" value={v.nextDue ? formatDate(v.nextDue) : ""} T={T} alert={overdue} />
        </SectionCard>

        {(symptomNames.length > 0 || visitNames.length > 0) && (
          <SectionCard title="Related records" T={T}>
            <ReadRow label="Symptom" value={symptomNames} T={T} />
            <ReadRow label="Clinic visits" value={visitNames} T={T} />
          </SectionCard>
        )}

        <SectionCard title="Notes" T={T}>
          <ReadRow label="Notes" value={v.notes} T={T} />
        </SectionCard>
        {/* ADDED 26 Aug 2026 — real ask: last-updated indicator. */}
        {v.updatedAt && (
          <div style={{ textAlign: "center", fontSize: 11, color: T.textDisabled, marginTop: 16 }}>
            Last updated {formatDate(v.updatedAt)}
          </div>
        )}
      </div>
    </div>
  );
}

function VaccinationsLanding({ onOpen, onAdd, T, vaccinations, refresh, deleteToast, undoDelete, redoDelete, triggerDelete }) {
  const allSorted = useMemo(() => [...vaccinations].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [vaccinations]);
  const overdueCount = allSorted.filter((v) => isOverdue(v.nextDue)).length;
  // ADDED 26 Aug 2026 — real ask: search within module, rolled out to
  // every module that didn't already have it. Deliberately kept
  // separate from allSorted/overdueCount above — the overdue count
  // should always reflect everything, not just what's currently
  // search-filtered, otherwise it'd misleadingly change while typing.
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSorted;
    return allSorted.filter((v) => [v.title, v.vaccine].filter(Boolean).some((val) => val.toLowerCase().includes(q)));
  }, [allSorted, query]);
  // ADDED 26 Aug 2026 — real ask: long-press multi-select, rolled out
  // to every module.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };
  const pressTimer = useRef(null);
  // CHANGED — real ask: long-press for select/multiselect fired too
  // easily. 750ms (1.5x the original 500ms), same across every module
  // using this pattern.
  // ADDED — real bug the user flagged: resting a finger on a card
  // while scrolling (or scrolling slowly) still fired long-press — see
  // Contacts' own ContactCard for the full reasoning, same fix.
  const pressStartPos = useRef(null);
  const startPress = (id, evt) => {
    if (evt?.touches?.[0]) pressStartPos.current = { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    pressTimer.current = setTimeout(() => { setSelectMode(true); toggleSelected(id); }, 750);
  };
  const cancelPress = () => { clearTimeout(pressTimer.current); pressStartPos.current = null; };
  const handleTouchMove = (evt) => {
    if (!pressStartPos.current || !evt.touches?.[0]) return;
    const dx = evt.touches[0].clientX - pressStartPos.current.x;
    const dy = evt.touches[0].clientY - pressStartPos.current.y;
    if (Math.hypot(dx, dy) > 10) cancelPress();
  };
  // CHANGED 26 Aug 2026 — real gap found and fixed: vaccinations/
  // deletedRecent/undoDelete/triggerDelete lifted to
  // VaccinationsModule, shared with VaccinationDetail.

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* CHANGED 26 Aug 2026 — real ask: this had the same full
          prominence as Healthcare's own title banner right above it —
          redundant, since this is always a sub-tab within Healthcare
          (the sub-tab pills already show which section is active),
          never a standalone top-level screen. Shrunk to a small
          subordinate label instead of a duplicate full banner, same
          fix already applied to Testing. */}
      {/* CHANGED — real bug fix, same as Testing's own: this stuck at
          top:0, colliding with Healthcare's own banner (also top:0)
          in the same shared scroll container, instead of stacking
          beneath it. top:62 matches Contacts' own established offset
          for a second sticky bar under an identical banner shape. */}
      <div style={{ position: "sticky", top: 62, zIndex: 6, background: T.bg, padding: "10px 16px 4px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, textTransform: "uppercase", letterSpacing: 0.5 }}>Vaccinations</span>
        {/* ADDED 26 Aug 2026 — real ask: explicit Select toggle. */}
        <span onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={{ fontSize: 11, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }}>
          {selectMode ? "Done" : "Select"}
        </span>
      </div>
      {/* ADDED 26 Aug 2026 — real ask: bulk action toolbar. */}
      {selectMode && (
        <div style={{ background: "#1B1B1F", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600 }}>{selectedIds.length} selected</span>
          <div style={{ display: "flex", gap: 16 }}>
            {/* ADDED 1 Sep 2026 — real ask: "option to select all...
                rather than manual 1 by 1", scoped to whatever's
                currently visible under the active search/filters. */}
            <span onClick={() => setSelectedIds(selectedIds.length === sorted.length ? [] : sorted.map((v) => v.id))}
              style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>
              {selectedIds.length === sorted.length ? "Deselect all" : "Select all"}
            </span>
            {/* ADDED 26 Aug 2026 — real ask: export/print a single
                record, enabled only when exactly one is selected. */}
            <span onClick={() => { if (selectedIds.length === 1) exportRecordAsFile("vaccinations", VaccinationRepository.getById(selectedIds[0])); }}
              style={{ fontSize: 13, color: selectedIds.length === 1 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length === 1 ? "pointer" : "default" }}>Export</span>
            <span onClick={() => { if (selectedIds.length > 0) { VaccinationRepository.bulkArchive(selectedIds); refresh(); exitSelectMode(); } }}
              style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Archive</span>
            <span onClick={() => {
              if (selectedIds.length === 0) return;
              if (window.confirm(`Delete ${selectedIds.length} vaccination${selectedIds.length > 1 ? "s" : ""}? You'll have a few seconds to undo.`)) {
                const toRestore = VaccinationRepository.getAll().filter((v) => selectedIds.includes(v.id));
                triggerDelete(toRestore);
                refresh();
                exitSelectMode();
              }
            }} style={{ fontSize: 13, color: selectedIds.length > 0 ? DARK.actionRed : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
            <span onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
          </div>
        </div>
      )}
      {overdueCount > 0 && (
        <div style={{ margin: "8px 16px 0", fontSize: 12, color: T.actionRed, fontWeight: 600 }}>{overdueCount} overdue</div>
      )}
      {/* ADDED 26 Aug 2026 — real ask: search within module. */}
      <div style={{ padding: "8px 16px 0" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vaccinations"
          style={{ width: "100%", padding: "8px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      </div>
      {/* CHANGED — real ask: Add button now floats bottom-right, same
          fixed-position pattern as every other module, instead of an
          inline header icon that scrolled away with the rest of the
          page. CHANGED 26 Aug 2026 — real audit finding: wrapped for
          wide-viewport centering, matching Medication's own pattern. */}
      <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
        <div onClick={onAdd} style={{ width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", pointerEvents: "auto" }}>
          <Plus size={24} />
        </div>
      </div>
      <div style={{ padding: "12px 16px 100px", display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>
            No vaccinations logged yet. Tap + to add one.
          </div>
        )}
        {sorted.map((v) => {
          const overdue = isOverdue(v.nextDue);
          const isSelected = selectedIds.includes(v.id);
          return (
            <div key={v.id} onClick={() => selectMode ? toggleSelected(v.id) : onOpen(v.id)}
              onMouseDown={() => startPress(v.id)} onMouseUp={cancelPress} onMouseLeave={cancelPress} onTouchStart={(evt) => startPress(v.id, evt)} onTouchMove={handleTouchMove} onTouchEnd={cancelPress}
              style={{ background: isSelected ? `${T.healthcareBlue}10` : T.surface, border: `1px solid ${isSelected ? T.healthcareBlue : overdue ? T.actionRed : T.border}`, borderRadius: radius.md, padding: 14, cursor: "pointer", display: "flex", gap: 10 }}>
              {selectMode && (
                <div style={{ width: 22, height: 22, borderRadius: radius.full, border: `2px solid ${isSelected ? T.healthcareBlue : T.border}`, background: isSelected ? T.healthcareBlue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center" }}>
                  {isSelected && <Check size={13} color="#FFFFFF" />}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: radius.full, background: overdue ? T.actionRed : T.healthcareBlue, display: "inline-block" }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{v.title}</span>
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2, fontFamily: "'Inter', sans-serif" }}>{formatDate(v.date)}</div>
              {v.nextDue && (
                <div style={{ fontSize: 12, color: overdue ? T.actionRed : T.textSecondary, marginLeft: 16, marginTop: 2, fontWeight: overdue ? 700 : 400 }}>
                  {overdue ? "Overdue since" : "Next due"} {formatDate(v.nextDue)}
                </div>
              )}
              </div>
            </div>
          );
        })}
      </div>
      {/* ADDED 26 Aug 2026 — real ask: undo for delete. */}
      {deleteToast && (
        <div onClick={deleteToast.mode === "undo" ? undoDelete : redoDelete}
          style={{ position: "fixed", bottom: 90, left: 20, right: 20, maxWidth: 560, margin: "0 auto", background: "#1B1B1F", color: "#FFFFFF", padding: "12px 16px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", zIndex: 40, boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
          <span style={{ fontSize: 13 }}>
            {deleteToast.mode === "undo"
              ? `${deleteToast.records.length} vaccination${deleteToast.records.length > 1 ? "s" : ""} deleted`
              : `${deleteToast.records.length} vaccination${deleteToast.records.length > 1 ? "s" : ""} restored`}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue }}>
            {deleteToast.mode === "undo" ? "Tap to undo" : "Tap to redo"}
          </span>
        </div>
      )}
    </div>
  );
}

export default function VaccinationsModule({ openAddOnMount = false, onConsumedQuickAdd, openRecordId, onConsumedRecordOpen, onDataChanged, registerModuleBackHandler } = {}) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;
  const [screen, setScreen] = useState({ name: "list" });
  // CHANGED 26 Aug 2026 — real gap found and fixed: lifted from
  // VaccinationsLanding — vaccinations/deletedRecent/undoDelete/
  // triggerDelete now live at the real module level, shared with
  // VaccinationDetail.
  const [vaccinations, setVaccinations] = useState(() => VaccinationRepository.getAll().filter((v) => !v.isArchived));
  const refresh = () => setVaccinations(VaccinationRepository.getAll().filter((v) => !v.isArchived));
  // CHANGED 26 Aug 2026 — real ask, previously flagged low-priority and
  // now built: redo for delete, matching Contacts' reference
  // implementation.
  const [deleteToast, setDeleteToast] = useState(null); // { mode: "undo" | "redo", records }
  const undoTimerRef = useRef(null);
  const undoDelete = () => {
    if (!deleteToast) return;
    deleteToast.records.forEach((record) => VaccinationRepository.restore(record));
    refresh();
    clearTimeout(undoTimerRef.current);
    setDeleteToast({ mode: "redo", records: deleteToast.records });
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  const redoDelete = () => {
    if (!deleteToast) return;
    TrashRepository.add("vaccinations", deleteToast.records);
    deleteToast.records.forEach((r) => VaccinationRepository.delete(r.id));
    refresh();
    setDeleteToast(null);
    clearTimeout(undoTimerRef.current);
  };
  const triggerDelete = (records) => {
    TrashRepository.add("vaccinations", records);
    records.forEach((r) => VaccinationRepository.delete(r.id));
    setDeleteToast({ mode: "undo", records });
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  // ADDED 19 Aug 2026 — real undo/redo extension.
  const editUndo = useEditUndo(VaccinationRepository);

  useEffect(() => {
    if (openAddOnMount) {
      setScreen({ name: "add" });
      onConsumedQuickAdd?.();
    }
    // ADDED — real ask: Global Search deep-link, same pattern as Testing.
    if (openRecordId) {
      setScreen({ name: "detail", id: openRecordId });
      onConsumedRecordOpen?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToList = () => setScreen({ name: "list" });

  // ADDED 26 Aug 2026 — real ask: back should go one step within this
  // module. Same real screen shape as Symptom Log (list/detail/edit/
  // add).
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

  const createVaccination = (data) => { VaccinationRepository.create(data); onDataChanged?.(); backToList(); };
  const saveVaccination = (data) => {
    editUndo.captureBeforeEdit(screen.id);
    VaccinationRepository.update(screen.id, data);
    editUndo.notifyEdited(screen.id);
    onDataChanged?.();
    setScreen({ name: "detail", id: screen.id });
  };

  let content;
  if (screen.name === "list") content = <VaccinationsLanding T={T} onOpen={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "add" })} vaccinations={vaccinations} refresh={refresh} deleteToast={deleteToast} undoDelete={undoDelete} redoDelete={redoDelete} triggerDelete={triggerDelete} />;
  else if (screen.name === "detail") content = <VaccinationDetail T={T} vaccinationId={screen.id} onBack={backToList} onEdit={(id) => setScreen({ name: "edit", id })} triggerDelete={triggerDelete} refresh={refresh} />;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: T.bg, minHeight: "100vh" }}>
      {/* ADDED 19 Aug 2026 — real undo/redo toast, same pattern as
          every other module. */}
      {/* CHANGED — real ask: this sat at top:12, directly on top of
          the screen's own back button (a plain 16px-padding header is
          only ~54px tall) — the instinctive "do the edit, then tap
          back" motion hit the toast instead. top:64 clears every
          header shape in this app (plain back+title or a colored
          banner). */}
      {editUndo.toast && (
        <div onClick={editUndo.toast.mode === "undo" ? editUndo.undo : editUndo.redo}
          style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", width: 340, background: editUndo.toast.mode === "undo" ? "#1B1B1F" : LIGHT.healthcareBlue, color: "#FFFFFF", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {editUndo.toast.mode === "undo" ? <Check size={14} /> : <RefreshCcw size={14} />}
          {editUndo.toast.mode === "undo" ? "Vaccination updated — tap to undo" : "Undone — tap to redo"}
        </div>
      )}
      {content}
      {screen.name === "add" && <VaccinationSheet T={T} vaccination={null} onSave={createVaccination} onClose={backToList} />}
      {screen.name === "edit" && <VaccinationSheet T={T} vaccination={VaccinationRepository.getById(screen.id)} onSave={saveVaccination} onClose={() => setScreen({ name: "detail", id: screen.id })} />}
    </div>
  );
}
