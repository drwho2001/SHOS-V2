// AppleHealthImportSheet — import v2 first slice, on-device only.
// Picks a real Apple Health XML export, PREVIEWS the measurement rows that
// would be added, and only writes on explicit confirmation. No cloud, no
// auto-save, no silent unit conversions.
import React, { useRef, useState } from "react";
import { XIcon as X, UploadSimpleIcon as Upload } from "@phosphor-icons/react";
import { FONT_FAMILY, NEUTRAL, NEUTRAL_DARK as DARK, ACCENTS, TOAST, ACTION_TEXT_SAFE, RADIUS, SCRIM, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useTranslation } from "../../i18n/index.js";
import { useEscapeToClose } from "../../components/useEscapeToClose";
import { useOverlayBackHandler } from "../../components/useOverlayBackHandler";
import { buildMeasurementPreview, saveMeasurementImport, MAX_IMPORT_BYTES } from "../../calculations/appleHealthImport.js";
import { MeasurementRepository } from "../../repositories/measurementRepository.js";

export default function AppleHealthImportSheet({ onClose, onImported, onBusyChange }) {
  const { t } = useTranslation();
  const [darkMode] = useDarkModePreference();
  const inputRef = useRef(null);
  const rawRef = useRef("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  // The parent holds the only other Escape listener while this sheet is
  // mounted. While a write is in flight neither side may dismiss the sheet.
  useEscapeToClose(onClose, !saving && !reading);
  useOverlayBackHandler(() => { if (saving || reading) return true; onClose?.(); return true; });

  const analyse = async (text) => {
    const existing = await MeasurementRepository.getAll();
    setPreview(buildMeasurementPreview(text, existing));
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // re-picking the same file must still fire onChange
    if (!file) return;
    setError("");
    // Clear the old preview before reading: otherwise the confirm action
    // stays live against file A's rows while file B is being read.
    setPreview(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setError(t("importHealth.tooLarge", "This file is too large. Export a narrower date range from Apple Health and try again."));
      return;
    }
    setReading(true);
    onBusyChange?.(true);
    try {
      const text = await file.text();
      rawRef.current = text;
      // Do not keep the whole export in React state: even a permitted 25 MB
      // file is a large string to hold for the lifetime of the sheet.
      await analyse(text);
    } catch (err) {
      setError(err?.message || "Could not read that file.");
    } finally {
      setReading(false);
      onBusyChange?.(false);
    }
  };

  const doImport = async () => {
    if (!preview?.rows?.length || preview.error || saving || reading) return;
    if (rawRef.current) {
      const existing = await MeasurementRepository.getAll();
      const fresh = buildMeasurementPreview(rawRef.current, existing);
      if (fresh.error || fresh.rows.length !== preview.rows.length) {
        setPreview(fresh);
        setError(t("importHealth.changed", "The data changed since this preview. Review the updated list before importing."));
        return;
      }
    }
    setSaving(true);
    onBusyChange?.(true);
    try {
      const n = await saveMeasurementImport(preview.rows);
      onBusyChange?.(false);
      onImported?.(n);
      onClose();
    } catch (err) {
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
  const canImport = Boolean(preview?.rows?.length) && !preview.error && !saving && !reading;
  const close = () => { if (!saving && !reading) onClose(); };

  return (
    <div role="dialog" aria-label={t("importHealth.title", "Import measurements from Apple Health")} tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: SCRIM, display: "flex", alignItems: "flex-end", zIndex: 260 }}>
      <div style={{ background: darkMode ? DARK.bg : NEUTRAL.bg, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, fontFamily: FONT_FAMILY }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: `1px solid ${border}` }}>
          <h1 style={{ ...TYPE.sheetTitle, margin: 0, color: textColor }}>{t("importHealth.title", "Import measurements from Apple Health")}</h1>
          <X size={20} color={textColor} style={{ cursor: saving || reading ? "default" : "pointer", padding: 4, opacity: saving || reading ? 0.5 : 1 }} onClick={close} role="button" tabIndex={0} aria-disabled={saving || reading} aria-label={t("common.close", "Close")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); close(); } }} />
        </div>
        <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
          <div style={{ fontSize: 12, color: secondary, lineHeight: 1.5, marginBottom: 12 }}>
            {t("importHealth.intro", "Picks an Apple Health XML export on this device only. Nothing is uploaded. Only step count and walking/running distance Record samples are imported; other elements are left alone. Existing measurements are never overwritten.")}
          </div>
          <input ref={inputRef} type="file" accept=".xml,text/xml,application/xml" onChange={onFile} style={{ display: "none" }} aria-label={t("importHealth.choose", "Choose Apple Health XML file")} />
          <div role="button" tabIndex={0} aria-disabled={reading || saving} onClick={() => { if (!reading && !saving) inputRef.current?.click(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!reading && !saving) inputRef.current?.click(); } }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: RADIUS.md, border: `1px dashed ${border}`, color: textColor, cursor: reading || saving ? "default" : "pointer", fontSize: TYPE.control.fontSize, fontWeight: 700 }}>
            <Upload size={18} /> {reading ? t("common.loading", "Loading...") : t("importHealth.choose", "Choose Apple Health XML file")}
          </div>

          {error && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: ACTION_TEXT_SAFE.red }}>{error}</div>}

          {preview?.error && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: ACTION_TEXT_SAFE.red }}>{preview.error}</div>}

          {preview && !preview.error && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: RADIUS.md, border: `1px solid ${border}`, background: darkMode ? DARK.surfaceVariant : NEUTRAL.surfaceVariant }}>
              <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 700, color: textColor }}>
                {preview.rows.length} {t("importHealth.rowsLabel", "measurement(s) to add")}
              </div>
              {preview.truncated && <div style={{ fontSize: 12, color: secondary, marginTop: 4 }}>{t("importHealth.truncated", "Preview capped at the first 2,000 rows. Export a narrower date range to import more.")}</div>}
              {preview.skipped.length > 0 && <div style={{ fontSize: 12, color: secondary, marginTop: 4 }}>{preview.skipped.length} {t("importHealth.skipped", "Record samples skipped — no SHOS mapping, unit mismatch, duplicate or unreadable value.")}</div>}
              {preview.rows.slice(0, 40).map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: `1px solid ${border}`, fontSize: 12, color: textColor }}>
                  <span>{r.type}</span>
                  <span style={{ color: secondary }}>{r.date} · {r.value} {r.unit}</span>
                </div>
              ))}
              {preview.rows.length > 40 && <div style={{ fontSize: 11, color: secondary, marginTop: 6 }}>… {preview.rows.length - 40} more</div>}
            </div>
          )}
        </div>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${border}` }}>
          <div role="button" tabIndex={0} aria-disabled={!canImport} onClick={doImport} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doImport(); } }} style={{ padding: 14, borderRadius: RADIUS.md, textAlign: "center", background: canImport ? brand : border, color: TOAST.text, fontWeight: 800, cursor: canImport ? "pointer" : "default", opacity: saving ? 0.6 : 1 }}>
            {saving ? t("common.importing", "Importing…") : t("importHealth.confirm", "Add {count} measurements").replace("{count}", String(preview?.rows?.length || 0))}
          </div>
        </div>
      </div>
    </div>
  );
}
