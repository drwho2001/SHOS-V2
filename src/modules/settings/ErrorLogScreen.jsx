// ErrorLogScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import ConfirmDeleteCard from "../../components/ConfirmDeleteCard";
import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
import { ACCENTS, ACTION, NEUTRAL, RADIUS, TYPE, resolveDarkAccent } from "../../calculations/designTokens";
import { useLoadedMemo, useLoadedState } from "../../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../../calculations/responsive";
import { exportTextFile } from "../../storage/fileExportHelper";
import { ErrorLogRepository } from "../../repositories/errorLogRepository";
import { AppPreferencesRepository } from "../../repositories/appPreferencesRepository";

export function ErrorLogScreen({ darkMode, onClose }) {
  // Local T-shaped object for the shared ConfirmDeleteCard — same
  // pattern as TrashScreen's own, this screen otherwise reads
  // NEUTRAL/DARK directly rather than a per-module T.
  const T = { ...(darkMode ? DARK : NEUTRAL), actionRed: darkMode ? resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") : ACTION.red };
  // ADDED — real audit finding (desktop full-width sweep): uneven
  // multi-line log entries — CSS multi-column flow, same as Trash/
  // Notification history. Only the entries list is columned; the
  // "Report a problem" card above it stays full-width.
  const isDesktopWidth = useIsDesktopWidth();
  const [entries, setEntries] = useLoadedState(() => ErrorLogRepository.getAll(), [], []);
  // CHANGED — real audit finding: this used to clear the whole log on
  // a direct tap, no confirmation, unlike every other permanent-delete
  // action in the app.
  const [confirmClear, setConfirmClear] = useState(false);
  const clear = async () => { await ErrorLogRepository.clear(); setEntries([]); setConfirmClear(false); };
  const [exportStatus, setExportStatus] = useState(null);
  // ADDED 11 Sep 2026 — real ask: a way to note a real problem that
  // isn't a JS crash (nothing here to auto-capture). Appends into the
  // same log/export/share path a real crash already uses.
  const [reportText, setReportText] = useState("");
  // ADDED 16 Sep 2026 — real ask: a genuine Send, not just a local
  // note — see appPreferencesRepository.js's own errorReportEndpoint
  // comment for the full reasoning (the disclosed-exception model,
  // "only what you write in the box"). Read once on mount; Settings'
  // own Data & network screen is where it's actually set.
  const endpoint = useLoadedMemo(() => AppPreferencesRepository.getPreferences().then((p) => p.errorReportEndpoint), [], "");
  const [sendStatus, setSendStatus] = useState(null);
  const submitReport = async () => {
    const trimmed = reportText.trim();
    if (!trimmed) return;
    setEntries(await ErrorLogRepository.recordUserReport(trimmed));
    setReportText("");
    setSendStatus(null);
    if (endpoint) {
      try {
        // Deliberately the ONLY thing in this body — no device info, no
        // app version, no timestamp beyond what the server itself sees
        // from the request — matching the user's own explicit "don't
        // need users info except what they write in box."
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });
        setSendStatus(res.ok ? { ok: true, msg: "Sent, and saved to this log." } : { ok: false, msg: "Saved here, but sending failed — try again later." });
      } catch {
        setSendStatus({ ok: false, msg: "Saved here, but sending failed — check your connection." });
      }
    }
  };
  const exportLog = async () => {
    const text = entries.map((e) =>
      `[${e.occurredAt}] ${e.source}\n${e.message}${e.stack ? `\n${e.stack}` : ""}`
    ).join("\n\n---\n\n");
    try {
      await exportTextFile(`shos-error-log-${new Date().toISOString().slice(0, 10)}.txt`, text || "No errors logged.");
      setExportStatus({ ok: true, msg: "Exported." });
    } catch {
      setExportStatus({ ok: false, msg: "Couldn't export — try again." });
    }
  };

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 225, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
          <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Error log</h1>
        </div>
        {entries.length > 0 && (
          <div style={{ display: "flex", gap: 14 }}>
            <span role="button" tabIndex={0} aria-label="Export error log" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={exportLog} style={{ fontSize: 12, fontWeight: 600, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, cursor: "pointer" }}>Export</span>
            <span role="button" tabIndex={0} aria-label="Clear error log" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setConfirmClear(true)} style={{ fontSize: 12, fontWeight: 600, color: ACTION.red, cursor: "pointer" }}>Clear</span>
          </div>
        )}
      </div>
      {confirmClear && (
        <ConfirmDeleteCard
          T={T}
          message="This clears the whole error log — there's no getting it back."
          confirmLabel="Clear"
          onCancel={() => setConfirmClear(false)}
          onConfirm={clear}
        />
      )}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 12 }}>
          On-device only — nothing here is ever sent anywhere automatically. Export produces a plain text file you can choose to share yourself, e.g. in a bug report.
        </div>
        <div style={{ marginBottom: 16, padding: 12, background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 6 }}>Report a problem</div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 8 }}>
            {endpoint
              ? "Not a crash, just something that seems off? Write it below and tap Send — it's saved here AND sent, just this text, to the address set in Settings > Data & network."
              : "Not a crash, just something that seems off? Note it here — it's added to this same log so it's not forgotten. Set an address in Settings > Data & network to also send it directly."}
          </div>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="What happened, and what did you expect instead?"
            rows={2}
            aria-label="Report a problem"
            style={{ width: "100%", boxSizing: "border-box", fontFamily: "'Inter', sans-serif", fontSize: 13, padding: 8, borderRadius: RADIUS.sm, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: darkMode ? DARK.bg : "#FFFFFF", color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, resize: "vertical" }}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={submitReport}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); submitReport(); } }}
            style={{ marginTop: 8, display: "inline-block", fontSize: 12, fontWeight: 700, color: reportText.trim() ? ACCENTS.home : (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled), cursor: reportText.trim() ? "pointer" : "default" }}
          >
            {endpoint ? "Send" : "Save note"}
          </div>
          {sendStatus && <div style={{ marginTop: 6, fontSize: 11, color: sendStatus.ok ? ACTION.green : ACTION.red }}>{sendStatus.msg}</div>}
        </div>
        {exportStatus && <div style={{ fontSize: 12, color: exportStatus.ok ? ACTION.green : ACTION.red, marginBottom: 12 }}>{exportStatus.msg}</div>}
        {entries.length === 0 ? (
          <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, textAlign: "center", padding: "40px 16px" }}>
            No errors logged. A real uncaught error or crash will show up here automatically.
          </div>
        ) : (
        <div style={isDesktopWidth ? { columnCount: 2, columnGap: 16 } : undefined}>
        {entries.map((e, i) => (
          <div key={i} style={isDesktopWidth ? { padding: "10px 0", breakInside: "avoid" } : { padding: "10px 0", borderBottom: i < entries.length - 1 ? ("1px solid " + (darkMode ? DARK.border : NEUTRAL.border)) : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>{e.source === "user-report" ? "Your note" : e.source}</span>
              <span style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, flexShrink: 0 }}>
                {new Date(e.occurredAt).toLocaleDateString([], { day: "numeric", month: "short" })}, {new Date(e.occurredAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2, wordBreak: "break-word" }}>{e.message}</div>
          </div>
        ))}
        </div>
        )}
      </div>
    </div>
  );
}

// REMOVED 16 Sep 2026 — real ask: audit whether global-Settings items
// would do better in each module's own settings. The global Units
// screen (a 3 Sep 2026 addition — Metric/Imperial toggle + per-type
// unit chips for Weight/Height/Temperature) is gone; that same
// preference (measurementPreferencesRepository.js) is now set from
// Measurements' own gear icon instead — see
// MeasurementPreferencesSheet's own comment, in that module's file.
// Its weekStartsOn control moved into CalendarScreen, the one screen
// it actually affects — see that function's own comment.

// ADDED 19 Aug 2026 — Preferences, real now. Deliberately small — one
// real, concrete setting (the user's own ask), not speculative toggles
// filling out a section just because it existed. More real
// Preferences items land here as they come up, same pattern as
// Privacy/Registries/Option lists getting built incrementally rather
// than all at once up front.
// ADDED — real ask: "scheduled auto-export" preset interval choices,
// same reasoning as everywhere else in this app that offers presets
// over free-form entry for a days-based setting — a fixed, sane set of
// options is faster to pick from and harder to get wrong than typing a
// number, and these four cover the realistic range (weekly for someone
// logging a lot, quarterly for someone who barely uses the app).

export default ErrorLogScreen;
