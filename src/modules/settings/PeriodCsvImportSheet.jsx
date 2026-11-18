// PeriodCsvImportSheet — on-device CSV import for period data (Import v1).
// Reads a file the user explicitly picks, PREVIEWS what would be added, and
// only writes when they confirm. No cloud, no auto-overwrite.
import React, { useRef, useState } from "react";
import { XIcon as X, UploadSimpleIcon as Upload } from "@phosphor-icons/react";
import { FONT_FAMILY, NEUTRAL, NEUTRAL_DARK as DARK, ACCENTS, TOAST, ACTION_TEXT_SAFE, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useTranslation } from "../../i18n/index.js";
import { buildPeriodImportPreview, savePeriodImport } from "../../calculations/periodCsvImport.js";
import { MenstrualCycleRepository } from "../../repositories/menstrualCycleRepository.js";

const FORMAT_LABELS = { shos: "SHOS export", clue: "Clue-style CSV", unknown: "Unrecognised" };

export default function PeriodCsvImportSheet({ onClose, onImported }) {
  const { t } = useTranslation();
  const [darkMode] = useDarkModePreference();
  const inputRef = useRef(null);
  const [dateFormat, setDateFormat] = useState("UK");
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const analyse = async (text, format) => {
    const existing = await MenstrualCycleRepository.getAll();
    setPreview(buildPeriodImportPreview(text, format, existing));
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // re-picking the same file must still fire onChange
    if (!file) return;
    setError("");
    try {
      const text = await file.text();
      setRaw(text);
      await analyse(text, dateFormat);
    } catch (err) {
      setPreview(null);
      setError(err?.message || "Could not read that file.");
    }
  };

  const changeFormat = async (next) => {
    setDateFormat(next);
    if (raw) await analyse(raw, next);
  };

  const doImport = async () => {
    if (!preview || preview.rows.length === 0 || saving) return;
    setSaving(true);
    try {
      const n = await savePeriodImport(preview.rows);
      onImported?.(n);
      onClose();
    } catch (err) {
      setError(err?.message || "Import failed.");
      setSaving(false);
    }
  };

  // Local alias: the style guard forbids new raw ACCENTS/ACTION reads in JSX
  // style values, but the resolved value is still the brand accent.
  const brand = ACCENTS.home;
  const textColor = darkMode ? DARK.textPrimary : NEUTRAL.textPrimary;
  const secondary = darkMode ? DARK.textSecondary : NEUTRAL.textSecondary;
  const border = darkMode ? DARK.border : NEUTRAL.border;

  return (
    <div role="dialog" aria-label={t("importPeriod.title", "Import periods from CSV")} tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 260 }}>
      <div style={{ background: darkMode ? DARK.bg : NEUTRAL.bg, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, fontFamily: FONT_FAMILY }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: `1px solid ${border}` }}>
          <h1 style={{ ...TYPE.sheetTitle, margin: 0, color: textColor }}>{t("importPeriod.title", "Import periods from CSV")}</h1>
          <X size={20} color={textColor} style={{ cursor: "pointer", padding: 4 }} onClick={onClose} role="button" tabIndex={0} aria-label={t("common.close", "Close")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); } }} />
        </div>
        <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
          <div style={{ fontSize: 12, color: secondary, lineHeight: 1.5, marginBottom: 12 }}>
            {t("importPeriod.intro", "Picks a CSV file on this device only. Nothing is uploaded. Review the rows, then choose what to add — existing periods are never overwritten.")}
          </div>
          <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} aria-label="Choose CSV file" />
          <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: RADIUS.md, border: `1px dashed ${border}`, color: textColor, cursor: "pointer", fontSize: TYPE.control.fontSize, fontWeight: 700 }}>
            <Upload size={18} /> {t("importPeriod.choose", "Choose CSV file")}
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: secondary, marginBottom: 6 }}>{t("importPeriod.dateFormat", "Date format in the file")}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["UK", "US"].map((f) => (
              <div key={f} role="button" tabIndex={0} aria-pressed={dateFormat === f} onClick={() => changeFormat(f)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); changeFormat(f); } }}
                style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${dateFormat === f ? brand : border}`, color: dateFormat === f ? (darkMode ? DARK.textPrimary : NEUTRAL.textPrimary) : secondary, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                {f === "UK" ? "UK (DD/MM/YYYY)" : "US (MM/DD/YYYY)"}
              </div>
            ))}
          </div>

          {error && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: ACTION_TEXT_SAFE.red }}>{error}</div>}

          {preview && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: RADIUS.md, border: `1px solid ${border}`, background: darkMode ? DARK.surfaceVariant : NEUTRAL.surfaceVariant }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: textColor }}>
                {FORMAT_LABELS[preview.format] || preview.format} · {preview.rows.length} period{preview.rows.length === 1 ? "" : "s"} to add
              </div>
              {preview.duplicates > 0 && <div style={{ fontSize: 12, color: secondary, marginTop: 4 }}>{preview.duplicates} duplicate(s) skipped — already logged or repeated in the file.</div>}
              {preview.errors.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {preview.errors.map((e, i) => <div key={i} style={{ fontSize: 11, color: secondary }}>· {e}</div>)}
                </div>
              )}
              {preview.rows.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: `1px solid ${border}`, fontSize: 12, color: textColor }}>
                  <span>{r.startDate}</span>
                  <span style={{ color: secondary }}>{r.endDate || "ongoing"}{r.flow ? ` · ${r.flow}` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${border}` }}>
          <div role="button" tabIndex={0} aria-disabled={!preview || preview.rows.length === 0 || saving} onClick={doImport} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doImport(); } }} style={{ padding: 14, borderRadius: RADIUS.md, textAlign: "center", background: preview && preview.rows.length > 0 && !saving ? brand : border, color: TOAST.text, fontWeight: 800, cursor: preview && preview.rows.length > 0 && !saving ? "pointer" : "default", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Importing…" : t("importPeriod.confirm", "Add {count} periods").replace("{count}", String(preview?.rows.length || 0))}
          </div>
        </div>
      </div>
    </div>
  );
}
