// NotificationHistoryScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import ConfirmDeleteCard from "../../components/ConfirmDeleteCard";
import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
import { ACTION, NEUTRAL, TYPE, resolveDarkAccent } from "../../calculations/designTokens";
import { useLoadedState } from "../../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../../calculations/responsive";
import { NotificationHistoryRepository } from "../../repositories/notificationHistoryRepository";

export function NotificationHistoryScreen({ darkMode, onClose }) {
  // Local T-shaped object for the shared ConfirmDeleteCard — same
  // pattern as TrashScreen's own, this screen otherwise reads
  // NEUTRAL/DARK directly rather than a per-module T.
  const T = { ...(darkMode ? DARK : NEUTRAL), actionRed: darkMode ? resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") : ACTION.red };
  // ADDED — real audit finding (desktop full-width sweep): uneven
  // multi-line log entries — CSS multi-column flow, same as Trash.
  const isDesktopWidth = useIsDesktopWidth();
  const [entries, setEntries] = useLoadedState(() => NotificationHistoryRepository.getAll(), [], []);
  // CHANGED — real audit finding: this used to clear the whole log on
  // a direct tap, no confirmation, unlike every other permanent-delete
  // action in the app.
  const [confirmClear, setConfirmClear] = useState(false);
  const clear = async () => { await NotificationHistoryRepository.clear(); setEntries([]); setConfirmClear(false); };

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 225, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
          <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Notification history</h1>
        </div>
        {entries.length > 0 && (
          <span role="button" tabIndex={0} aria-label="Clear notification history" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setConfirmClear(true)} style={{ fontSize: 12, fontWeight: 600, color: ACTION.red, cursor: "pointer" }}>Clear</span>
        )}
      </div>
      {confirmClear && (
        <ConfirmDeleteCard
          T={T}
          message="This clears the whole notification history — there's no getting it back."
          confirmLabel="Clear"
          onCancel={() => setConfirmClear(false)}
          onConfirm={clear}
        />
      )}
      <div style={{ padding: 16 }}>
        {entries.length === 0 ? (
          <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, textAlign: "center", padding: "40px 16px" }}>
            Nothing's fired yet. Real reminders (and the test notification) show up here the moment they actually deliver.
          </div>
        ) : (
        <div style={isDesktopWidth ? { columnCount: 2, columnGap: 16 } : undefined}>
        {entries.map((e, i) => (
          <div key={i} style={isDesktopWidth ? { padding: "10px 0", breakInside: "avoid" } : { padding: "10px 0", borderBottom: i < entries.length - 1 ? ("1px solid " + (darkMode ? DARK.border : NEUTRAL.border)) : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{e.title}</span>
              <span style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, flexShrink: 0 }}>
                {new Date(e.firedAt).toLocaleDateString([], { day: "numeric", month: "short" })}, {new Date(e.firedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            {e.body && <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2 }}>{e.body}</div>}
          </div>
        ))}
        </div>
        )}
      </div>
    </div>
  );
}

// ADDED 10 Sep 2026 — real ask: "allow error reporting." Same shape as
// NotificationHistoryScreen just above — a plain, capped local log,
// viewable and clearable — plus a real Export action (same
// exportTextFile() every other export in this app already uses),
// since the whole point of an on-device-only log is that the owner
// himself decides if and when to share it, e.g. pasting it into a bug
// report — nothing here ever leaves the device on its own.

export default NotificationHistoryScreen;
