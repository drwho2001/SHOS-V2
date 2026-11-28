// FhirImportSheet — import v2 second slice, on-device only. A real FHIR
// Bundle (Synthea patient JSON) is previewed as medications + vaccinations;
// nothing is written until the user confirms. No cloud, no auto-save.
import React, { useRef, useState } from "react";
import { XIcon as X, UploadSimpleIcon as Upload } from "@phosphor-icons/react";
import { FONT_FAMILY, NEUTRAL, NEUTRAL_DARK as DARK, ACCENTS, TOAST, ACTION_TEXT_SAFE, RADIUS, SCRIM, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useTranslation } from "../../i18n/index.js";
import { useEscapeToClose } from "../../components/useEscapeToClose";
import { useOverlayBackHandler } from "../../components/useOverlayBackHandler";
import { buildFhirImportPreview, saveFhirImport, MAX_FHIR_BYTES } from "../../calculations/fhirImport.js";
import { MedicationRepository } from "../../repositories/medicationRepository.js";
import { VaccinationRepository } from "../../repositories/vaccinationRepository.js";

export default function FhirImportSheet({ onClose, onImported, onBusyChange }) {
  const { t } = useTranslation();
  const [darkMode] = useDarkModePreference();
  const inputRef = useRef(null);
  // Kept in a ref, not React state: the whole bundle can be megabytes, and it
  // is only needed once more — to re-check the preview at confirm time.
  const rawRef = useRef("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  useEscapeToClose(onClose, !saving && !reading);
  // Hardware Back must not unmount a sheet mid-read or mid-write either; the
  // handler returns true while busy so the parent screen stays put.
  useOverlayBackHandler(() => { if (saving || reading) return true; onClose?.(); return true; });

  const analyse = async (text) => {
    const [meds, vaccines] = await Promise.all([MedicationRepository.getAll(), VaccinationRepository.getAll()]);
    setPreview(buildFhirImportPreview(text, meds, vaccines));
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setPreview(null);
    if (file.size > MAX_FHIR_BYTES) {
      setError(t("importFhir.tooLarge", "This file is too large. Export a narrower date range and try again."));
      return;
    }
    setReading(true);
    onBusyChange?.(true);
    try {
      const text = await file.text();
      rawRef.current = text;
      await analyse(text);
    } catch (err) {
      setError(err?.message || "Could not read that file.");
    } finally {
      setReading(false);
      onBusyChange?.(false);
    }
  };

  const doImport = async () => {
    if (!preview || (!preview.meds.length && !preview.vaccines.length) || preview.error || saving || reading) return;
    // Recheck against current repositories at confirm time. A second tab (or
    // a partially completed earlier attempt) can make the shown preview stale.
    if (rawRef.current) {
      const [meds, vax] = await Promise.all([MedicationRepository.getAll(), VaccinationRepository.getAll()]);
      const fresh = buildFhirImportPreview(rawRef.current, meds, vax);
      if (fresh.error || fresh.meds.length !== preview.meds.length || fresh.vaccines.length !== preview.vaccines.length) {
        setPreview(fresh);
        setError(t("importFhir.changed", "The data changed since this preview. Review the updated list before importing."));
        return;
      }
    }
    setSaving(true);
    onBusyChange?.(true);
    try {
      const counts = await saveFhirImport(preview);
      onBusyChange?.(false);
      onImported?.(counts);
      onClose();
    } catch (err) {
      // A write can fail partway. Clearing the preview stops a second tap from
      // appending the same rows again without another explicit review.
      setPreview(null);
      rawRef.current = "";
      setError(err?.message || "Import failed. Some records may already have been added; review the file again before retrying.");
      setSaving(false);
      onBusyChange?.(false);
    }
  };

  const brand = ACCENTS.home;
  const textColor = darkMode ? DARK.textPrimary : NEUTRAL.textPrimary;
  const secondary = darkMode ? DARK.textSecondary : NEUTRAL.textSecondary;
  const border = darkMode ? DARK.border : NEUTRAL.border;
  const canImport = Boolean(preview && (preview.meds.length || preview.vaccines.length)) && !preview.error && !saving && !reading;
  const close = () => { if (!saving && !reading) onClose(); };

  return (
    <div role="dialog" aria-label={t("importFhir.title", "Import from a FHIR bundle")} tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: SCRIM, display: "flex", alignItems: "flex-end", zIndex: 260 }}>
      <div style={{ background: darkMode ? DARK.bg : NEUTRAL.bg, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, fontFamily: FONT_FAMILY }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: `1px solid ${border}` }}>
          <h1 style={{ ...TYPE.sheetTitle, margin: 0, color: textColor }}>{t("importFhir.title", "Import from a FHIR bundle")}</h1>
          <X size={20} color={textColor} style={{ cursor: saving || reading ? "default" : "pointer", padding: 4, opacity: saving || reading ? 0.5 : 1 }} onClick={close} role="button" tabIndex={0} aria-disabled={saving || reading} aria-label={t("common.close", "Close")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); close(); } }} />
        </div>
        <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
          <div style={{ fontSize: 12, color: secondary, lineHeight: 1.5, marginBottom: 12 }}>
            {t("importFhir.intro", "Picks a FHIR Bundle JSON file on this device only. Nothing is uploaded. Only medication requests and immunizations are mapped; every other resource type is counted but left alone. All imported prescriptions are archived so no historical regimen creates a reminder. Existing records are never overwritten.")}
          </div>
          <input ref={inputRef} type="file" accept=".json,application/json" onChange={onFile} style={{ display: "none" }} aria-label={t("importFhir.choose", "Choose FHIR Bundle JSON file")} />
          <div role="button" tabIndex={0} aria-disabled={reading || saving} onClick={() => { if (!reading && !saving) inputRef.current?.click(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!reading && !saving) inputRef.current?.click(); } }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: RADIUS.md, border: `1px dashed ${border}`, color: textColor, cursor: reading || saving ? "default" : "pointer", fontSize: TYPE.control.fontSize, fontWeight: 700 }}>
            <Upload size={18} /> {reading ? t("common.loading", "Loading...") : t("importFhir.choose", "Choose FHIR Bundle JSON file")}
          </div>

          {error && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: ACTION_TEXT_SAFE.red }}>{error}</div>}
          {preview?.error && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: ACTION_TEXT_SAFE.red }}>{preview.error}</div>}

          {preview && !preview.error && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: RADIUS.md, border: `1px solid ${border}`, background: darkMode ? DARK.surfaceVariant : NEUTRAL.surfaceVariant }}>
              <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 700, color: textColor }}>
                {preview.meds.length} {t("importFhir.medsLabel", "medication(s)")} · {preview.vaccines.length} {t("importFhir.vaxLabel", "vaccination(s)")}
              </div>
              <div style={{ fontSize: 12, color: secondary, marginTop: 4 }}>{t("importFhir.archivedNote", "Every medication is imported archived. Its original status and dose notes are kept; reactivate anything that is genuinely current.")}</div>
              {preview.unrelated.length > 0 && <div style={{ fontSize: 12, color: secondary, marginTop: 4 }}>{preview.unrelated.map((u) => `${u.count} ${u.type}`).join(", ")} — {t("importFhir.leftAlone", "left alone.")}</div>}
              {preview.skipped.length > 0 && <div style={{ fontSize: 12, color: secondary, marginTop: 4 }}>{preview.skipped.length} {t("importFhir.skipped", "entry(ies) skipped — unsupported, duplicate or missing data.")}</div>}
              {preview.truncated && <div style={{ fontSize: 12, color: secondary, marginTop: 4 }}>{t("importFhir.truncated", "Preview capped at 2,000 rows. Export a narrower date range to import more.")}</div>}
              {preview.meds.slice(0, 20).map((r, i) => (
                <div key={`m${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: `1px solid ${border}`, fontSize: 12, color: textColor }}>
                  <span>{r.name}</span>
                  <span style={{ color: secondary }}>{r.usagePattern} · {r.dosesPerDay ?? "–"}/day</span>
                </div>
              ))}
              {preview.vaccines.slice(0, 20).map((r, i) => (
                <div key={`v${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: `1px solid ${border}`, fontSize: 12, color: textColor }}>
                  <span>{r.title}</span>
                  <span style={{ color: secondary }}>{String(r.date).slice(0, 10)}</span>
                </div>
              ))}
              {(preview.meds.length + preview.vaccines.length) > 40 && <div style={{ fontSize: 11, color: secondary, marginTop: 6 }}>… more</div>}
            </div>
          )}
        </div>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${border}` }}>
          <div role="button" tabIndex={0} aria-disabled={!canImport} onClick={doImport} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doImport(); } }} style={{ padding: 14, borderRadius: RADIUS.md, textAlign: "center", background: canImport ? brand : border, color: TOAST.text, fontWeight: 800, cursor: canImport ? "pointer" : "default", opacity: saving ? 0.6 : 1 }}>
            {saving ? t("common.importing", "Importing…") : t("importFhir.confirm", "Add {count} records").replace("{count}", String((preview?.meds?.length || 0) + (preview?.vaccines?.length || 0)))}
          </div>
        </div>
      </div>
    </div>
  );
}
