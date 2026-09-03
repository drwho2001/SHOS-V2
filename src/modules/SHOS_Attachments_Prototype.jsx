import React, { useState, useMemo, useEffect } from "react";
import { CaretLeftIcon as ChevronLeft, TrashIcon as Trash2, FileTextIcon as FileText } from "@phosphor-icons/react";
import { TestingRepository } from "../repositories/testingRepository";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here. See designTokens.js.
import { NEUTRAL, NEUTRAL_DARK, ACCENTS } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

const TYPE_OPTIONS = ["Test result", "Prescription", "ID", "Photo", "Other"];

// ADDED 19 Aug 2026 — Attachments, per the user's priority order (low, but
// still queued). Real live Notion schema already checked this session
// (Attachment Title/Date/Document-Photo/Type/Linked visit/Linked Item)
// — Type's 5 options (Test result/Prescription/ID/Photo/Other) already
// match exactly what Testing/Clinic Visits' own attachment pickers use,
// confirmed by reading those files directly, not assumed.
//
// DELIBERATE DESIGN CALL: this does NOT move attachments into a new
// repository. They stay exactly where they already live — embedded on
// each Test/Clinic Visit record, same as before. This screen is a
// DERIVED, read-and-manage VIEW across both, same "store facts, derive
// state" principle used everywhere else in the app (e.g. Contact's
// Encounter Count is computed from Encounters, never duplicated onto
// Contact). A real data-model migration (attachments as their own
// repository with formal relations, matching Notion's own separate
// Attachments database) would be a bigger, riskier change than "low
// priority, cross-linked feed" calls for — this delivers the real ask
// (one place to see/manage every attachment) without that risk.
//
// Delete-from-here calls straight through to the SAME
// addAttachment/removeAttachment methods Testing/Clinic Visits' own
// screens already use — no new deletion logic, no duplicate source of
// truth.
function loadAllAttachments() {
  const fromTests = TestingRepository.getAll().filter((t) => !t.isArchived).flatMap((t) =>
    (t.attachments || []).map((a) => ({ ...a, sourceType: "test", sourceId: t.id, sourceTitle: t.title || (t.testingFor || []).join("/") || "Test" }))
  );
  const fromVisits = ClinicVisitsRepository.getAll().filter((v) => !v.isArchived).flatMap((v) =>
    (v.attachments || []).map((a) => ({ ...a, sourceType: "clinicVisit", sourceId: v.id, sourceTitle: v.title || (v.reasonForVisit || []).join("/") || "Clinic visit" }))
  );
  return [...fromTests, ...fromVisits].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function isImage(dataUrl) {
  return typeof dataUrl === "string" && dataUrl.startsWith("data:image/");
}

export default function AttachmentsScreen({ onClose, onNavigateToSource, registerModuleBackHandler }) {
  const [darkMode] = useDarkModePreference();
  const T = { ...(darkMode ? NEUTRAL_DARK : NEUTRAL), healthcareBlue: ACCENTS.healthcare };
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterType, setFilterType] = useState("");

  // ADDED — real ask: back should close Attachments (a flat, single-
  // screen overlay — no internal navigation depth to step back
  // through), matching the pattern every other module uses.
  useEffect(() => {
    if (!registerModuleBackHandler) return;
    registerModuleBackHandler(() => { onClose?.(); return true; });
    return () => registerModuleBackHandler(null);
  }, [registerModuleBackHandler, onClose]);
  const all = useMemo(() => loadAllAttachments(), [refreshKey]);
  const filtered = filterType ? all.filter((a) => a.type === filterType) : all;

  const handleDelete = (a) => {
    if (a.sourceType === "test") TestingRepository.removeAttachment(a.sourceId, a.id);
    else ClinicVisitsRepository.removeAttachment(a.sourceId, a.id);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Attachments</span>
      </div>
      <div style={{ padding: "10px 16px 0", fontSize: 12, color: T.textSecondary }}>
        Everything attached to a Test or Clinic Visit, in one place. Files still live on their original record — deleting here removes it from there too.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "12px 16px" }}>
        <div onClick={() => setFilterType("")}
          style={{ padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${filterType === "" ? T.healthcareBlue : T.border}`, color: filterType === "" ? T.healthcareBlue : T.textSecondary, background: filterType === "" ? `${T.healthcareBlue}15` : "transparent" }}>
          All
        </div>
        {TYPE_OPTIONS.map((t) => (
          <div key={t} onClick={() => setFilterType(t)}
            style={{ padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${filterType === t ? T.healthcareBlue : T.border}`, color: filterType === t ? T.healthcareBlue : T.textSecondary, background: filterType === t ? `${T.healthcareBlue}15` : "transparent" }}>
            {t}
          </div>
        ))}
      </div>

      <div style={{ padding: "0 16px 24px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>
            {all.length === 0 ? "No attachments yet — add one from a Test or Clinic Visit." : "Nothing matches this filter."}
          </div>
        ) : filtered.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
            {isImage(a.fileDataUrl) ? (
              <img src={a.fileDataUrl} alt={a.title} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 8, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={18} color={T.textSecondary} />
              </div>
            )}
            <div onClick={() => onNavigateToSource?.(a.sourceType, a.sourceId)} style={{ flex: 1, minWidth: 0, cursor: onNavigateToSource ? "pointer" : "default" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
              <div style={{ fontSize: 11, color: T.textSecondary }}>{a.type} · {formatDate(a.date)} · {a.sourceTitle}</div>
            </div>
            <Trash2 size={15} color={T.textDisabled} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => handleDelete(a)} aria-label="Remove attachment" title="Remove attachment" />
          </div>
        ))}
      </div>
    </div>
  );
}
