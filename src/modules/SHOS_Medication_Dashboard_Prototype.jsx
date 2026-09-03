import React, { useState, useMemo, useRef, useEffect } from "react";
import { PlusIcon as Plus, WarningIcon as AlertTriangle, CheckIcon as Check, ArrowsClockwiseIcon as RefreshCcw, PillIcon as Pill, MagnifyingGlassIcon as Search, GearIcon as SettingsIcon, GearSixIcon as Settings2, XIcon as X, MoonIcon as Moon, SunIcon as Sun, TrashIcon as Trash2, FireIcon as Flame, PaperPlaneTiltIcon as Send, ClockIcon as Clock, DotsThreeVerticalIcon as MoreVertical, ListChecksIcon as ListChecks, ArrowUpIcon as ArrowUp, ArrowDownIcon as ArrowDown, ArchiveIcon as Archive, ArrowUUpLeftIcon as ArchiveRestore, CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
// The dashboard no longer owns its own medication/log data — it reads and
// writes through these two repositories instead. Nothing about how the UI
// looks or behaves changes; this just moves WHERE the facts actually live.
import { MedicationRepository, DOSE_UNIT_OPTIONS } from "../repositories/medicationRepository";
import { findClosestMatch } from "../calculations/fuzzyMatch";
import { TrashRepository } from "../repositories/trashRepository";
import { exportRecordAsFile } from "../storage/recordExportService";
// ADDED 19 Aug 2026 — MEDICATION_TYPE_OPTIONS/ROUTE_OPTIONS now live
// here, real in-app editable option lists — see
// customOptionListsRepository.js for the full reasoning.
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { useEditUndo } from "../calculations/editUndoHelpers";
import { syncDoxyPepAlert } from "../calculations/doxyPepSync";
import { syncMedicationReminders } from "../calculations/medicationReminderSync";
import { syncRefillReminder } from "../calculations/refillReminderSync";
import { localStorageAdapter } from "../storage/storageAdapter";
import { useDarkModePreference } from "../calculations/darkModePreference";
import { MedicationPreferencesRepository } from "../repositories/medicationPreferencesRepository";
import { LogRepository, REASON_OPTIONS, SIDE_EFFECT_OPTIONS } from "../repositories/logRepository";
import { computeStock, computeAdherence, nextDoseEstimate, isDoseLockedOut, lockoutEndsEstimate, effectiveDoseIntervalHours } from "../calculations/medicationCalculations";
// ADDED — real ask: Correction Sheet needs to change WHEN a dose was
// logged, not just how much, for the "forgot to log at the time, adding
// it after" case. Same shared "Now" helper and plain-string-slicing
// safety already established by Encounters'/Clinic Visits' own
// DateTimeField — no Date-object round-trip, no silent BST/UTC shift.
import { nowAsDateTimeLocalString, nowAsStoredDateTime } from "../calculations/dateInputHelpers";
// ADDED 19 Aug 2026 — real ask: allergies visible "± medications at
// the top" too, not just on Clinic Card. Read-only here — Allergies
// itself is edited on My Profile, this is just a visibility surface.
import { MyProfileRepository } from "../repositories/myProfileRepository";
// CHANGED 20 Aug 2026 — real design-unification pass: LIGHT's neutral
// palette and semantic action colors now read from the shared
// designTokens.js source of truth instead of being retyped here.
// CHANGED — medsBlue/actionRed/actionGreen below now ALSO stay wired
// to those same shared, overridable tokens via resolveDarkAccent() —
// no longer separate literals with no way for a customised colour to
// ever reach them. goldText/streakGlow/navActive/fabBg/fabIcon remain
// genuinely hand-tuned per-value for dark-surface contrast/design
// intent, not derivable from LIGHT's tokens (fabBg/fabIcon are a
// deliberate light-on-dark inversion, not an accent at all).
import { NEUTRAL, ACCENTS, ACTION, RADIUS, TYPE, resolveDarkAccent } from "../calculations/designTokens";

const LIGHT = {
  // bg deepened from #FAFAFA — at that value it was nearly indistinguishable from surface (#FFFFFF),
  // so cards read as floating on the same white rather than visibly elevated. surfaceVariant
  // shifted slightly to stay a distinct third tone rather than collapsing into the new bg.
  ...NEUTRAL,
  medsBlue: ACCENTS.medication, actionRed: ACTION.red, actionGreen: ACTION.green,
  // Doc 2's Platforms gold (#E8A400) is tuned as a chip *fill* with dark text — used directly as
  // *text* on a light background it fails contrast (~2.1:1, needs 4.5:1). This is a separate,
  // darker gold specifically for foreground/text use — see Doc 5 §5 note on the Inventory status line.
  goldText: "#8A6100",
  // CHANGED — real find during the design-unification audit: this was
  // still the OLD pre-Tier-1 Medication blue (#3D63C9), stale since
  // the real color decision (ACCENTS.medication, #003B6F). Not
  // currently referenced anywhere in this file's own JSX (dead token,
  // no visible bug today) — fixed anyway, since a stale value sitting
  // in the shared theme object undermines "one source of truth" the
  // moment anything DOES start reading it.
  navActive: ACCENTS.medication, fabBg: ACCENTS.medication, fabIcon: "#FFFFFF",
  // Streak badge background — deliberately NOT actionRed/actionGreen
  // (those carry "needs attention" / "just completed" meaning
  // elsewhere). A streak is neither — it's ongoing positive reinforcement,
  // so it gets its own warm amber, purely decorative.
  streakGlow: "#F59E0B26",
};
const DARK = {
  bg: "#121214", surface: "#1C1C1F", surfaceVariant: "#26262A", border: "#3A3A3F",
  textPrimary: "#F2F2F4", textSecondary: "#B8B8BE", textDisabled: "#89898C",
  // CHANGED — real architecture fix: these three used to be separate
  // hand-picked literals, completely ignoring a customised colour
  // (ACCENTS.medication/ACTION.red/ACTION.green) the moment dark mode
  // was on. resolveDarkAccent() keeps these exact existing defaults
  // ("#5B85F5"/"#FF7A7E"/"#5FD9A4") unless the user actually
  // customises that colour — only then does dark mode switch to a
  // live-derived brightened variant of their real choice, rather than
  // silently ignoring it. See designTokens.js's own comment for the
  // full reasoning.
  medsBlue: resolveDarkAccent("medication", ACCENTS.medication, "#5B85F5"), actionRed: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E"), actionGreen: resolveDarkAccent("actionGreen", ACTION.green, "#5FD9A4"),
  goldText: "#FFD666", // dark mode's existing Platforms-gold dark accent already contrasts fine as text here
  // CHANGED — real gap found by the user: fabBg/fabIcon were a
  // deliberate light-on-dark inversion (a near-white circle, dark
  // icon), the one module out of step with the "same module, same
  // colour" rule the nav-bar fix above just established everywhere
  // else — Contacts and Encounters both already reuse their own
  // resolved accent for the FAB in dark mode, matching their header;
  // only Medication inverted. navActive stays "#A9C2FF" — confirmed
  // genuinely unused anywhere in this file's own JSX (dead token,
  // same as the light-mode value's own comment already noted), not
  // worth touching for a value nothing reads.
  navActive: "#A9C2FF", fabBg: resolveDarkAccent("medication", ACCENTS.medication, "#5B85F5"), fabIcon: "#FFFFFF",
  // More saturated than light mode's version, per the user's specific ask
  // ("dark mode streak... slightly more striking") — light mode wasn't
  // flagged as a problem, so it stays subtle; dark gets more pop.
  streakGlow: "#F59E0B40",
};
const radius = RADIUS;

// Days-remaining, dropping to hours/minutes under 1 day — same idea as the Next Dose estimate,
// applied here to remaining supply instead of dosing interval.
// Stock, adherence, and next-dose math now live in their own file
// (medicationCalculations.js) — this component no longer defines them
// itself, it just asks for the answer.

// CHANGED — real bug: this app's own stored dates are literal
// wall-clock digits with a fake "Z" suffix (see dateInputHelpers.js's
// own comment — "must never be shifted for BST/UTC/DST after the
// fact"), so reading them back via a plain, no-timeZone
// toLocaleTimeString() applies a REAL timezone conversion on top of an
// already-local value, silently shifting the displayed time by the
// local UTC offset (BST: 1 hour later than what was actually entered
// — exactly what was reported). timeZone: "UTC" here doesn't mean
// "show UTC" — it means "read the digits back literally, don't
// convert them", which is what correctly recovers the real local time
// that was typed or tapped "Now" for.
function formatLastDose(dateStr) {
  if (!dateStr) return "No doses logged";
  const d = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const dayLabel = diffDays <= 0 ? "Today" : diffDays === 1 ? "Yesterday" : `${diffDays}d ago`;
  return `${dayLabel} at ${time}`;
}
// CHANGED — same root bug as formatLastDose/timeLabel above: comparing
// via LOCAL setHours(0,0,0,0) on a fake-UTC date reads its digits as if
// they needed a real timezone conversion, which can shift a late-night
// dose onto the wrong calendar day (BST: a dose logged at 23:30 would
// misread as 00:30 the next day). Extracting the calendar day via the
// UTC getters instead recovers the literal date that was actually
// logged.
function dayLabel(dateStr) {
  const d = new Date(dateStr);
  const dDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const today = new Date();
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.floor((todayDay - dDay) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Date(dateStr).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
// Same fix as formatLastDose just above — timeZone: "UTC" recovers
// the literal wall-clock digits instead of re-shifting them.
function timeLabel(dateStr) { return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "UTC" }); }
function daysFromNow(dateStr) {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  return diffDays <= 0 ? "today" : diffDays === 1 ? "yesterday" : `${diffDays}d ago`;
}
// Builds the shape the UI has always expected — a medication with its own
// `logs` array attached — by combining the two repositories. This is now
// the ONLY place those two data sources get stitched together. Every other
// function below still just reads `med.logs` / `med.archived` exactly like
// before, so nothing else in this file had to change.
//
// (`isArchived` from the repository is mapped back to `archived` here,
// purely so none of the existing UI code below needs renaming.)
function loadMedications() {
  return MedicationRepository.getAll().map((med) => ({
    ...med,
    archived: med.isArchived,
    logs: LogRepository.getForMedication(med.id),
  }));
}

function HoldButton({ onStep, dir, children, style }) {
  const timeoutRef = useRef(null);
  const speedRef = useRef(350);
  const activeRef = useRef(false);
  const start = (e) => {
    e.preventDefault();
    if (activeRef.current) return;
    activeRef.current = true;
    onStep(dir);
    speedRef.current = 350;
    const tick = () => { onStep(dir); speedRef.current = Math.max(70, speedRef.current * 0.8); timeoutRef.current = setTimeout(tick, speedRef.current); };
    timeoutRef.current = setTimeout(tick, 550);
  };
  const stop = () => { activeRef.current = false; clearTimeout(timeoutRef.current); };
  return (
    <button onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} style={{ ...style, touchAction: "none" }}>
      {children}
    </button>
  );
}

function StatTile({ label, value, tint, subtitle, onClick, T }) {
  return (
    <div onClick={onClick} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.md, padding: "14px 16px", flex: "1 1 0", minWidth: 0, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 600, color: tint || T.textPrimary }}>{value}</div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{label}</div>
      {subtitle && <div style={{ fontSize: 11, color: tint || T.textSecondary, marginTop: 3, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
    </div>
  );
}

// Redesigned for more contrast per the user's ask: tinted background/border, fraction shown as the
// primary value with the percentage as a secondary line, per the user's "give absolute value" request.
function AdherencePill({ label, hit, expected, T }) {
  const pct = Math.round((hit / expected) * 100);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: T.medsBlue }}>{hit}/{expected}</div>
      <div style={{ fontSize: 10, color: T.textSecondary, fontWeight: 600, marginTop: 1 }}>{label} · {pct}%</div>
    </div>
  );
}

function MedicationCard({ med, onLogDose, onLogRefill, onLogWaste, onCorrectStock, onMarkRequested, onOpenCorrection, onEditMedication, onUpdateDose, onMoveUp, onMoveDown, onArchive, onDelete, isFirst, isLast, justCompleted, T, darkMode, cardRef, highlighted, searchHighlighted, menuOpen, onToggleMenu, snoozedUntil }) {
  // ADDED — real ask: local to this card, gated behind the menu
  // already being open for this specific medication — doesn't need
  // the app-wide single-open tracking `menuOpen` uses.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stock = computeStock(med);
  const adherence = computeAdherence(med);
  const lastDose = [...med.logs].filter((l) => l.type === "dose" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const requested = !!med.refillRequestedAt;
  const nextDose = lastDose ? nextDoseEstimate(med, lastDose.date) : null;
  const doseLocked = lastDose ? isDoseLockedOut(med, lastDose.date) : false;
  // ADDED 18 Aug 2026 — real feedback: a native `disabled` button blocks
  // the click entirely, so the `title` tooltip explaining the lockout
  // was the ONLY feedback — and title tooltips need hover, which
  // doesn't exist on a touchscreen. The user's ask: keep it tappable while
  // locked, show a brief message instead of nothing, no confirmation
  // needed. This local flash state does exactly that.
  // CHANGED 19 Aug 2026 — real ask: allow overriding the lockout if the
  // person genuinely wants to log anyway ("accepts the risk"). Kept as
  // a lightweight tap-again-to-confirm rather than a heavier modal —
  // matches the app's existing "tap to confirm" pattern elsewhere.
  // First tap while locked shows the flash with an explicit "tap again"
  // instruction; a second tap WHILE that flash is showing logs the dose
  // for real. The flash auto-clearing after a few seconds means an
  // accidental double-tap days apart can't accidentally trigger this —
  // only a genuine second tap within the window counts.
  const [lockFlash, setLockFlash] = useState(false);
  const handleLogTap = () => {
    if (doseLocked) {
      if (lockFlash) {
        setLockFlash(false);
        onLogDose(med.id);
        return;
      }
      setLockFlash(true);
      setTimeout(() => setLockFlash(false), 3000);
      return;
    }
    onLogDose(med.id);
  };

  return (
    <div ref={cardRef} style={{ position: "relative", background: T.surface, border: `1px solid ${highlighted ? T.actionRed : searchHighlighted ? T.medsBlue : T.border}`, borderRadius: radius.md, padding: 16, boxShadow: highlighted ? `0 0 0 3px ${T.actionRed}33` : searchHighlighted ? `0 0 0 3px ${T.medsBlue}33` : "0 1px 3px rgba(0,0,0,.06)", transition: "box-shadow 300ms ease, border-color 300ms ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: radius.full, background: T.medsBlue, display: "inline-block" }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: T.textPrimary }}>{med.name}</span>
        </div>
        <MoreVertical size={18} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={() => onToggleMenu(med.id)} />
      </div>

      {menuOpen && (
        <>
          <div onClick={() => onToggleMenu(null)} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", zIndex: 39 }} />
          <div style={{ position: "absolute", top: 40, right: 14, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.sm, boxShadow: "0 4px 16px rgba(0,0,0,.15)", zIndex: 40, minWidth: 190, overflow: "hidden" }}>
            <div onClick={() => { onEditMedication(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Settings2 size={14} color={T.textSecondary} /> Edit medication
            </div>
            {/* ADDED 26 Aug 2026 — real ask: dose changes (e.g.
                sertraline 150mg→300mg) as their own real action, not a
                silent field edit that would blur old/new dose history
                together. */}
            <div onClick={() => { onUpdateDose(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
              <ArrowUp size={14} color={T.textSecondary} /> Update dose
            </div>
            {stock.tracked && !requested && (
              <div onClick={() => { onMarkRequested(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                <Send size={14} color={T.textSecondary} /> Request refill early
              </div>
            )}
            {stock.tracked && (
              <div onClick={() => { onLogWaste(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                <Trash2 size={14} color={T.textSecondary} /> Log waste/lost
              </div>
            )}
            {stock.tracked && (
              <div onClick={() => { onCorrectStock(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                <RefreshCcw size={14} color={T.textSecondary} /> Correct stock level
              </div>
            )}
            {/* ADDED — real ask: "button to say course completed and
                archive, for short course meds" — same underlying
                archive action as the row below, just with wording that
                actually matches what happened for a course (like
                antibiotics) rather than an ongoing medication being
                stopped. Available on every medication rather than
                gated behind a new "is this a short course" field you'd
                have to declare upfront — you know at completion time
                which wording actually fits, not before. */}
            <div onClick={() => { onArchive(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
              <Check size={14} color={T.actionGreen} /> Course completed
            </div>
            <div onClick={() => { onArchive(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
              <Archive size={14} color={T.textSecondary} /> Archive medication
            </div>
            <div onClick={() => { setConfirmDelete(true); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.actionRed, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
              <Trash2 size={14} /> Delete permanently
            </div>
            {!isFirst && (
              <div onClick={() => { onMoveUp(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                <ArrowUp size={14} color={T.textSecondary} /> Move up
              </div>
            )}
            {!isLast && (
              <div onClick={() => { onMoveDown(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                <ArrowDown size={14} color={T.textSecondary} /> Move down
              </div>
            )}
          </div>
        </>
      )}

      {confirmDelete && (
        <div style={{ margin: "0 0 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}11` }}>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
            This permanently deletes {med.name} — unlike archiving, there's no getting it back. Only use this for a genuinely erroneous entry.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onDelete(med.id)} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.actionRed, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {stock.tracked ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 26, fontWeight: 600, color: stock.needsAction && !requested ? T.actionRed : T.textPrimary }}>{stock.currentStock}</span>
            <span style={{ fontSize: 12, color: T.textSecondary }}>{med.unit}s left</span>
          </div>
          <div style={{ height: 4, background: T.surfaceVariant, borderRadius: radius.full, marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${stock.barPct}%`, background: stock.needsAction && !requested ? T.actionRed : T.medsBlue, borderRadius: radius.full, transition: "width 200ms ease" }} />
          </div>

          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            {justCompleted === "logged" ? (
              <><Check size={14} color={T.actionGreen} /><span style={{ color: T.actionGreen, fontWeight: 600 }}>Logged</span></>
            ) : justCompleted === "requested" ? (
              <><Check size={14} color={T.medsBlue} /><span style={{ color: T.medsBlue, fontWeight: 600 }}>Marked as requested</span></>
            ) : requested ? (
              <><Clock size={14} color={T.textSecondary} /><span style={{ color: T.textSecondary, fontWeight: 600 }}>Requested {daysFromNow(med.refillRequestedAt)} — awaiting refill</span></>
            ) : stock.needsAction ? (
              <><AlertTriangle size={14} color={T.actionRed} /><span style={{ color: T.actionRed, fontWeight: 600 }}>{stock.currentStock <= 0 ? "Out of stock" : `Refill needed — ≤ ${med.refillThreshold} left`}</span></>
            ) : (
              <span style={{ color: T.textSecondary }}>{stock.supplementary}</span>
            )}
          </div>

          {stock.needsAction && !requested && (
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>
              {med.usualSupplier && <>Usually filled at: {med.usualSupplier} · </>}
              <span onClick={() => onMarkRequested(med.id)} style={{ color: T.medsBlue, fontWeight: 600, cursor: "pointer" }}>Mark as requested</span>
            </div>
          )}

          <div onClick={() => lastDose && onOpenCorrection(med.id, lastDose)} style={{ fontSize: 12, color: T.textSecondary, marginTop: 6, cursor: lastDose ? "pointer" : "default", width: "fit-content" }}>
            <span style={{ textDecoration: lastDose ? "underline dotted" : "none", textUnderlineOffset: 3 }}>Last dose: {formatLastDose(lastDose?.date)}</span>
            {nextDose && <span> · Next dose {nextDose}</span>}
          </div>
          {snoozedUntil && new Date(snoozedUntil) > new Date() && (
            <div style={{ fontSize: 11, color: T.medsBlue, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> Snoozed until {new Date(snoozedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
          )}
          {/* ADDED — real bug fix: notes now genuinely shown on the
              card, not just editable — see the `notes` field comment in
              MedicationEditSheet for the full story. Unconditional on
              stock/refill state, unlike "Usually filled at" above,
              since a note is relevant regardless of whether a refill's
              currently needed. */}
          {med.notes && (
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, fontStyle: "italic" }}>{med.notes}</div>
          )}

          {adherence && (
            // CHANGED 19 Aug 2026 — real ask: "the streak colour
            // background in night mode should speak across the entire
            // three values/whole button" — previously the amber only
            // wrapped the streak digit itself, while the outer box
            // stayed the same blue tint every time regardless of mode.
            // Now the WHOLE box carries the streak amber in dark mode
            // specifically (light mode was never flagged as an issue,
            // stays exactly as it was). The inner streak-only pill is
            // removed since it's now redundant — the Flame icon alone
            // carries the visual distinction once the whole box is
            // already amber-toned.
            // CHANGED — real ask: this box always read as a flat, muddy
            // amber block regardless of how adherence was actually
            // going — no real "praise" signal for doing well, and
            // amber read as a warning color even when nothing was
            // wrong. Now amber is reserved for when 7-day adherence is
            // genuinely below 80% (a real "needs attention" cue); at or
            // above that, it switches to the same green used for
            // "completed/on track" everywhere else in this module —
            // actual positive reinforcement, not just decoration.
            (() => {
              const sevenDayGood = adherence.sevenDay.expected > 0 && (adherence.sevenDay.hit / adherence.sevenDay.expected) >= 0.8;
              const glowBg = sevenDayGood ? (darkMode ? "#5FD9A440" : "#1B9E7715") : (darkMode ? T.streakGlow : `${T.medsBlue}15`);
              const glowBorder = sevenDayGood ? (darkMode ? "#5FD9A466" : "#1B9E7740") : (darkMode ? "#F59E0B66" : `${T.medsBlue}40`);
              return (
            <div style={{ display: "flex", justifyContent: "space-around", background: glowBg, border: `1px solid ${glowBorder}`, borderRadius: radius.sm, padding: "9px 4px", marginTop: 10 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: T.medsBlue, display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}><Flame size={13} color={T.actionRed} />{adherence.streak}d</div>
                <div style={{ fontSize: 10, color: T.textSecondary, fontWeight: 600, marginTop: 1 }}>streak</div>
              </div>
              <AdherencePill T={T} label="7-day" hit={adherence.sevenDay.hit} expected={adherence.sevenDay.expected} />
              <AdherencePill T={T} label="this refill" hit={adherence.sinceRefill.hit} expected={adherence.sinceRefill.expected} />
            </div>
              );
            })()
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: T.textSecondary }}>
          <span onClick={() => lastDose && onOpenCorrection(med.id, lastDose)} style={{ cursor: lastDose ? "pointer" : "default", textDecoration: lastDose ? "underline dotted" : "none", textUnderlineOffset: 3 }}>
            Last dose: {formatLastDose(lastDose?.date)}
          </span>
          {nextDose && <span> · Next dose {nextDose}</span>}
          <div style={{ fontSize: 11, color: T.textDisabled, fontStyle: "italic", marginTop: 2 }}>Not inventory-tracked</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12, position: "relative" }}>
        <button onClick={handleLogTap}
          style={{ ...btnStyle(T.medsBlue, "outline"), opacity: doseLocked ? 0.5 : 1 }}>
          <Pill size={14} /> {doseLocked ? "Already logged" : "Log dose"}
        </button>
        {stock.tracked && <button onClick={() => onLogRefill(med.id)} style={btnStyle(T.medsBlue, "filled")}><RefreshCcw size={14} /> Log refill</button>}
        {lockFlash && (
          <div onClick={handleLogTap} style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 6, padding: "6px 10px", background: T.textPrimary, color: T.bg, fontSize: 11, fontWeight: 600, borderRadius: radius.sm, textAlign: "center", cursor: "pointer" }}>
            Locked until {lockoutEndsEstimate(med, lastDose?.date)} — tap again to log anyway
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle(color, variant) {
  return { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: radius.full, fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", border: variant === "outline" ? `1px solid ${color}` : "none", background: variant === "filled" ? color : "transparent", color: variant === "filled" ? "#FFFFFF" : color };
}

// ADDED — real ask: "an option... for medication to update each stock
// level manually." Deliberately a SEPARATE sheet from QuantitySheet
// above, not a new mode bolted onto it — refill/waste are relative
// deltas ("add 30", "remove 2"), this is an absolute correction
// ("I counted and there's actually 47 left"), a genuinely different
// mental model that would confuse the existing UI if merged in.
// Still respects "store facts, derive state" — this doesn't overwrite
// stock directly, it computes and logs whatever real delta makes the
// derived total match what was actually counted, same as every other
// stock-affecting action in this app.
function StockCorrectionSheet({ med, currentStock, onConfirm, onClose, T }) {
  const [actualStock, setActualStock] = useState(currentStock);
  const delta = actualStock - currentStock;
  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: T.surface, width: "100%", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>Correct stock level — {med.name}</span>
          <X size={18} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} aria-label="Close" />
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 14 }}>App currently shows {currentStock} left. Enter what you've actually counted.</div>
        <input type="number" value={actualStock} onChange={(e) => setActualStock(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ width: "100%", padding: "12px 14px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, textAlign: "center", boxSizing: "border-box", marginBottom: 8 }} />
        {actualStock !== "" && delta !== 0 && (
          <div style={{ fontSize: 12, color: T.textSecondary, textAlign: "center", marginBottom: 14 }}>
            {delta > 0 ? `Logged as a +${delta} correction` : `Logged as a ${delta} correction`}
          </div>
        )}
        <button onClick={() => actualStock !== "" && onConfirm(delta)} disabled={actualStock === "" || delta === 0}
          style={{ width: "100%", padding: 14, borderRadius: radius.full, border: "none", background: (actualStock === "" || delta === 0) ? T.border : T.medsBlue, color: "#FFFFFF", fontWeight: 700, fontSize: 15, cursor: (actualStock === "" || delta === 0) ? "default" : "pointer" }}>
          Save corrected stock
        </button>
      </div>
    </div>
  );
}

function QuantitySheet({ med, mode, onConfirm, onClose, T }) {
  const isRefill = mode === "refill";
  const [unitMode, setUnitMode] = useState(med.unitsPerContainer ? "container" : "unit");
  const [amount, setAmount] = useState(1);
  const finalUnits = isRefill && unitMode === "container" ? amount * med.unitsPerContainer : amount;
  const step = (dir) => setAmount((a) => Math.max(1, a + dir));
  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: T.surface, width: "100%", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>{isRefill ? "Log refill" : "Log waste/lost"} — {med.name}</span>
          <X size={18} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} aria-label="Close" />
        </div>
        {/* Duplicated from the Registry card, not moved — useful right at the point of logging too */}
        {isRefill && med.usualSupplier && <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 14 }}>Usually filled at: {med.usualSupplier}</div>}
        {isRefill && med.unitsPerContainer && (
          <div style={{ display: "flex", background: T.surfaceVariant, borderRadius: radius.full, padding: 3, marginBottom: 18 }}>
            {["container", "unit"].map((m) => (
              <div key={m} onClick={() => { setUnitMode(m); setAmount(1); }} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: radius.full, cursor: "pointer", fontSize: 13, fontWeight: 600, background: unitMode === m ? T.surface : "transparent", color: unitMode === m ? T.medsBlue : T.textSecondary }}>
                {m === "container" ? "Containers" : "Units"}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 8 }}>
          {amount > 1 ? <HoldButton onStep={step} dir={-1} style={stepperBtn(T)}>−</HoldButton> : <div style={{ width: 44, height: 44 }} />}
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
            style={{ fontFamily: "'Inter', sans-serif", fontSize: 28, fontWeight: 600, width: 70, textAlign: "center", color: T.textPrimary, border: `1px solid ${T.border}`, borderRadius: radius.sm, background: T.surfaceVariant, padding: "4px 2px" }} />
          <HoldButton onStep={step} dir={1} style={stepperBtn(T)}>+</HoldButton>
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: T.textSecondary, marginBottom: 18 }}>
          {isRefill && unitMode === "container" ? `= ${finalUnits} ${med.unit}s` : "Type a number, or hold either button to speed up"}
        </div>
        <button onClick={() => onConfirm(finalUnits)} style={{ ...btnStyle(isRefill ? T.medsBlue : T.actionRed, "filled"), width: "100%", padding: 12 }}>
          {isRefill ? "Confirm refill" : "Confirm waste/lost"}
        </button>
      </div>
    </div>
  );
}

const stepperBtn = (T) => ({ width: 44, height: 44, borderRadius: radius.full, border: `1px solid ${T.border}`, background: T.surface, fontSize: 20, cursor: "pointer", color: T.medsBlue, userSelect: "none" });

// Same DateTimeField as Encounters/Clinic Visits — plain string
// slicing both directions, no Date object round-trip, so a typed time
// is never silently shifted by BST/UTC/DST.
function DateTimeField({ label, value, onChange, T }) {
  const inputVal = value ? value.slice(0, 16) : "";
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: T.textSecondary }}>{label}</div>
        <span onClick={() => onChange(`${nowAsDateTimeLocalString()}:00.000Z`)} style={{ fontSize: 11, fontWeight: 700, color: T.medsBlue, cursor: "pointer" }}>Now</span>
      </div>
      <input type="datetime-local" value={inputVal}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:00.000Z` : "")}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

function CorrectionSheet({ med, entry, onSave, onVoid, onClose, T }) {
  const [amount, setAmount] = useState(Math.abs(entry.delta));
  const [date, setDate] = useState(entry.date);
  const [confirmVoid, setConfirmVoid] = useState(false);
  // ADDED — real gap found in a full-app audit: LogRepository already
  // modeled `reason` and `sideEffects` per entry (real ask from the
  // Notion-vs-app audit, confirmed wanted), but nothing anywhere ever
  // let a user set or see either — the fields existed with no UI.
  // Editing them here, on the same sheet that already edits an
  // existing entry, rather than on the one-tap "Take" action, which
  // needs to stay one-tap.
  const [reason, setReason] = useState(entry.reason || []);
  const [sideEffects, setSideEffects] = useState(entry.sideEffects || []);
  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const step = (dir) => setAmount((a) => Math.max(1, a + dir));
  const typeLabel = entry.type === "dose" ? "Dose taken" : entry.type === "refill" ? "Refill" : "Waste/lost";
  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: T.surface, width: "100%", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>Edit entry — {med.name}</span>
          <X size={18} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} aria-label="Close" />
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{typeLabel}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: confirmVoid ? 18 : 4 }}>
          {!confirmVoid && amount > 1 ? <HoldButton onStep={step} dir={-1} style={stepperBtn(T)}>−</HoldButton> : <div style={{ width: 44, height: 44 }} />}
          {/* CHANGED 18 Aug 2026 — real bug the user flagged: this stayed
              showing the original amount (e.g. "1") even after clicking
              "void it", which doesn't reflect what voiding actually does
              — the entry's effect goes to zero. Now shows 0, disabled,
              struck through, once in confirm-void mode. */}
          <input type="number" inputMode="decimal" value={confirmVoid ? 0 : amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
            disabled={confirmVoid}
            style={{ fontFamily: "'Inter', sans-serif", fontSize: 28, fontWeight: 600, width: 70, textAlign: "center", color: confirmVoid ? T.actionRed : T.textPrimary, textDecoration: confirmVoid ? "line-through" : "none", border: `1px solid ${T.border}`, borderRadius: radius.sm, background: T.surfaceVariant, padding: "4px 2px" }} />
          {!confirmVoid && <HoldButton onStep={step} dir={1} style={stepperBtn(T)}>+</HoldButton>}
        </div>
        {/* ADDED — real ask: option to change WHEN the dose happened, not
            just how much — the "forgot to log it at the time, adding it
            retroactively" case, where the actual dose time isn't "now". */}
        {!confirmVoid && <DateTimeField label="Date & time" value={date} onChange={setDate} T={T} />}
        {!confirmVoid && (entry.type === "dose" || entry.type === "waste") && (
          <>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 10, marginBottom: 4 }}>Reason (optional)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              {REASON_OPTIONS.map((r) => (
                <div key={r} onClick={() => toggle(reason, setReason, r)} role="button" tabIndex={0} aria-pressed={reason.includes(r)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(reason, setReason, r); } }}
                  style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${T.medsBlue}`, color: reason.includes(r) ? T.surface : T.medsBlue, background: reason.includes(r) ? T.medsBlue : "transparent" }}>
                  {r}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Side effects (optional)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              {SIDE_EFFECT_OPTIONS.map((s) => (
                <div key={s} onClick={() => toggle(sideEffects, setSideEffects, s)} role="button" tabIndex={0} aria-pressed={sideEffects.includes(s)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(sideEffects, setSideEffects, s); } }}
                  style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${T.actionRed}`, color: sideEffects.includes(s) ? T.surface : T.actionRed, background: sideEffects.includes(s) ? T.actionRed : "transparent" }}>
                  {s}
                </div>
              ))}
            </div>
          </>
        )}
        {!confirmVoid && (
          <button onClick={() => onSave(amount, date, reason, sideEffects)} style={{ ...btnStyle(T.medsBlue, "filled"), width: "100%", padding: 12, marginTop: 10, marginBottom: 10 }}>Save correction</button>
        )}
        {!confirmVoid ? (
          <div onClick={() => setConfirmVoid(true)} style={{ textAlign: "center", fontSize: 13, color: T.actionRed, fontWeight: 600, cursor: "pointer", padding: 6 }}>This entry was a mistake — void it</div>
        ) : (
          <div style={{ textAlign: "center", padding: 6 }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>Voided entries are kept, not deleted — same as anywhere else in SHOS.</div>
            <button onClick={onVoid} style={{ ...btnStyle(T.actionRed, "filled"), padding: "8px 20px" }}>Confirm void</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Log tab: grouped by day, and by exact timestamp within a day — entries logged together
// (e.g. via "Log all daily doses") collapse under one time subheading instead of repeating.
//
// CHANGED 18 Aug 2026 (the user): voided entries used to be filtered out of
// this list entirely — you'd correct/void a mistake and it would just
// vanish, with no record it ever happened. Doc 5 §5 always said voided
// entries are "kept, not deleted", but the Log tab wasn't actually
// honoring that. Now they stay visible with a strikethrough, and a
// toggle lets you hide them if the list gets cluttered — defaults to
// showing them, since "kept" should mean visible by default, not just
// technically-not-deleted. ──
function LogTab({ meds, T, onOpenCorrection }) {
  const [showVoided, setShowVoided] = useState(true);
  // CHANGED — real perf fix: this whole block (flatten every med's
  // logs, sort, group by day then by exact timestamp) used to run
  // directly in the render body on every re-render of this tab — not
  // just when `meds` or `showVoided` actually changed. Dose logs are
  // append-only and accumulate over months of real use, so this is the
  // one dataset in the app most likely to actually grow large. Now
  // only recomputes when its real inputs change.
  const { anyVoided, byDay } = useMemo(() => {
    const allEntries = meds.flatMap((m) => m.logs.map((l) => ({ ...l, med: m })));
    const anyVoided = allEntries.some((l) => l.voided);
    const rows = (showVoided ? allEntries : allEntries.filter((l) => !l.voided)).sort((a, b) => new Date(b.date) - new Date(a.date));
    const byDay = [];
    rows.forEach((r) => {
      const key = dayLabel(r.date);
      let dayGroup = byDay.find((g) => g.key === key);
      if (!dayGroup) { dayGroup = { key, timeGroups: [] }; byDay.push(dayGroup); }
      let timeGroup = dayGroup.timeGroups.find((g) => g.time === r.date);
      if (!timeGroup) { timeGroup = { time: r.date, entries: [] }; dayGroup.timeGroups.push(timeGroup); }
      timeGroup.entries.push(r);
    });
    return { anyVoided, byDay };
  }, [meds, showVoided]);
  // Waste keeps its own red — that's still meaningful for an active
  // entry. Once voided, the strikethrough + dimmed color carries the
  // "this was undone" meaning instead, so voided overrides type color
  // rather than competing with it.
  const typeColor = (r) => (r.voided ? T.textDisabled : r.type === "refill" ? T.medsBlue : r.type === "waste" ? T.actionRed : T.textPrimary);

  const GAP_HOURS = 4; // a bigger visual break for gaps larger than this, within the same day

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "0 16px 100px" }}>
      {anyVoided && (
        <div onClick={() => setShowVoided((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 0 4px", fontSize: 12, color: T.textSecondary, fontWeight: 600 }}>
          {showVoided ? "Hide voided entries" : "Show voided entries"}
        </div>
      )}
      {byDay.map((g, gi) => (
        <div key={g.key}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginTop: gi === 0 ? 4 : 24, marginBottom: 8,
          }}>
            <span style={{ ...TYPE.sectionLabel, color: T.textPrimary, whiteSpace: "nowrap" }}>{g.key}</span>
            <span style={{ flex: 1, height: 1, background: T.border }} />
          </div>
          {g.timeGroups.map((tg, ti) => {
            const prevTime = ti > 0 ? new Date(g.timeGroups[ti - 1].time) : null;
            const gapHours = prevTime ? (prevTime.getTime() - new Date(tg.time).getTime()) / 3600000 : 0;
            const bigGap = gapHours >= GAP_HOURS;
            return (
              <div key={tg.time} style={{ marginBottom: 4, marginTop: bigGap ? 14 : 0, paddingTop: bigGap ? 10 : 0, borderTop: bigGap ? `1px dashed ${T.border}` : "none" }}>
                {tg.entries.length > 1 && (
                  <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 8, marginBottom: 2 }}>{timeLabel(tg.time)} · logged together</div>
                )}
                {tg.entries.map((r, i) => (
                  <div key={i} onClick={() => onOpenCorrection(r.med.id, r)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer", opacity: r.voided ? 0.6 : 1 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: r.voided ? T.textDisabled : T.textPrimary, textDecoration: r.voided ? "line-through" : "none" }}>{r.med.name}</div>
                      {tg.entries.length === 1 && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{timeLabel(r.date)}{r.voided ? " · voided" : ""}</div>}
                      {/* ADDED — see CorrectionSheet's comment: reason/sideEffects
                          now have somewhere to actually show up once set. */}
                      {!r.voided && ((r.reason && r.reason.length > 0) || (r.sideEffects && r.sideEffects.length > 0)) && (
                        <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 2 }}>
                          {[...(r.reason || []), ...(r.sideEffects || [])].join(" · ")}
                        </div>
                      )}
                    </div>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: typeColor(r), textDecoration: r.voided ? "line-through" : "none" }}>{r.delta > 0 ? "+" : ""}{r.delta}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Inventory tab: cross-medication rollup. "Usually filled at" duplicated here too — natural
// place for it alongside stock levels, without removing it from the Registry card. ──
// Edit affordance duplicated here per the user's ask — stock/refill-related settings (threshold,
// container size, default refill qty) feel more at home being editable from Inventory too,
// not instead of the Registry card's overflow menu, alongside it.
// CHANGED — real ask: Correct stock level was only reachable from each
// card's overflow menu on the Registry tab, not from Inventory itself
// despite being the dedicated inventory screen -- every other
// inventory-related command (refill status, edit) already lived here.
function InventoryTab({ meds, T, onEditMedication, onCorrectStock }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "0 16px 100px" }}>
      {meds.map((m) => {
        const s = computeStock(m);
        const requested = !!m.refillRequestedAt;
        return (
          <div key={m.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: radius.full, background: T.medsBlue }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{m.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: s.tracked && s.needsAction && !requested ? T.actionRed : T.textPrimary }}>
                  {s.tracked ? `${s.currentStock} ${m.unit}s` : "—"}
                </span>
                {s.tracked && <RefreshCcw size={15} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={() => onCorrectStock(m.id)} title="Correct stock level" />}
                <Settings2 size={15} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={() => onEditMedication(m.id)} />
              </div>
            </div>

            {s.tracked && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, marginLeft: 16, fontSize: 11, fontWeight: 600 }}>
                {requested ? (
                  <><Clock size={11} color={T.goldText} /><span style={{ color: T.goldText }}>Refill requested {daysFromNow(m.refillRequestedAt)}</span></>
                ) : s.needsAction ? (
                  <><AlertTriangle size={11} color={T.actionRed} /><span style={{ color: T.actionRed }}>Refill needed, not yet requested</span></>
                ) : (() => {
                  // CHANGED 19 Aug 2026 — generalized via
                  // effectiveDoseIntervalHours() so custom (every-N-days)
                  // meds get a real "refill expected in ~Xd" estimate
                  // too, not just daily ones (previously fell through to
                  // a generic "Not needed yet" with no timeframe).
                  const intervalHours = effectiveDoseIntervalHours(m);
                  const dailyConsumption = intervalHours ? (m.unitsPerDose * 24) / intervalHours : 0;
                  return m.usagePattern !== "prn" && dailyConsumption > 0 ? (
                    <><Check size={11} color={T.actionGreen} /><span style={{ color: T.actionGreen }}>Refill expected in ~{Math.floor((s.currentStock - m.refillThreshold) / dailyConsumption)}d</span></>
                  ) : (
                    <><Check size={11} color={T.actionGreen} /><span style={{ color: T.actionGreen }}>Not needed yet</span></>
                  );
                })()}
              </div>
            )}
            {m.usualSupplier && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2, marginLeft: 16 }}>Usually filled at: {m.usualSupplier}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Doc 4 §4b, built: editing the Medicines Registry entry itself — dosesPerDay, unitsPerDose,
// refillThreshold, usualSupplier. This is registry metadata, not a ledger fact — it doesn't
// create a log entry, it changes how future stock/adherence math is computed. ──
function NumberField({ label, value, onChange, min = 0, step = 1, T }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 13, color: T.textPrimary }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <HoldButton onStep={(dir) => onChange(Math.max(min, +(value + dir * step).toFixed(2)))} dir={-1} style={{ ...stepperBtn(T), width: 32, height: 32, fontSize: 16 }}>−</HoldButton>
        <input
          type="number" inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Math.max(min, Number(e.target.value)))}
          style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, width: 44, textAlign: "center", color: T.textPrimary, border: `1px solid ${T.border}`, borderRadius: radius.sm, background: T.surfaceVariant, padding: "3px 2px" }}
        />
        <HoldButton onStep={(dir) => onChange(Math.max(min, +(value + dir * step).toFixed(2)))} dir={1} style={{ ...stepperBtn(T), width: 32, height: 32, fontSize: 16 }}>+</HoldButton>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange, T }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 13, color: T.textPrimary }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{ width: 40, height: 24, borderRadius: radius.full, background: value ? T.medsBlue : T.surfaceVariant, position: "relative", cursor: "pointer", transition: "background 150ms ease" }}>
        <div style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 20, height: 20, borderRadius: radius.full, background: "#FFFFFF", transition: "left 150ms ease", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — for Route, a real gap found in the Notion-vs-app
// audit. No select component existed in this file yet (NumberField/
// ToggleRow cover number/boolean fields only) — this is the plain
// text-field pattern used elsewhere in this sheet, adapted to a
// <select>, same visual language.
function SelectRow({ label, value, onChange, options, T }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }}>
        <option value="">—</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

// ADDED 19 Aug 2026 — real gap: Category, matching Notion's Medicines
// Registry exactly (multi-select — a medication can genuinely be more
// than one category). Same tap-to-toggle chip pattern already used
// elsewhere in this app (Clinic Visits' Reason for visit, etc.), built
// fresh here since this module never needed a multi-select field
// before now.
// CHANGED — real ask: Category was a closed chip set with "Other" as
// the only escape hatch — no way to actually name what "Other" meant.
// onAddNew is optional (only Category passes it; a plain MultiSelectRow
// without it behaves exactly as before) — persists the new value into
// the same in-app-editable option list every other custom list here
// already uses, then selects it, matching the add-new pattern already
// established in Vaccinations' VaccineField.
function MultiSelectRow({ label, value, onChange, options, T, onAddNew }) {
  const [newValue, setNewValue] = useState("");
  const toggle = (opt) => {
    const has = value.includes(opt);
    onChange(has ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  const addNew = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    onAddNew?.(trimmed);
    if (!value.includes(trimmed)) onChange([...value, trimmed]);
    setNewValue("");
  };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: onAddNew ? 8 : 0 }}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <div key={opt} onClick={() => toggle(opt)} role="button" tabIndex={0} aria-pressed={active}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(opt); } }}
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.medsBlue : T.border}`, color: active ? T.medsBlue : T.textSecondary, background: active ? `${T.medsBlue}15` : "transparent" }}>
              {opt}
            </div>
          );
        })}
      </div>
      {onAddNew && (
        <div style={{ display: "flex", gap: 6 }}>
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNew(); } }}
            placeholder="Add your own…"
            style={{ flex: 1, padding: "7px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 12, boxSizing: "border-box" }} />
          <div onClick={addNew} style={{ padding: "7px 12px", borderRadius: radius.sm, background: T.medsBlue, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center" }}>Add</div>
        </div>
      )}
    </div>
  );
}

// ADDED 19 Aug 2026 — real fix, the user's ask: dose strength used to be
// one free-text field ("245mg", easy to typo the unit). Number + a
// real dropdown (see DOSE_UNIT_OPTIONS) instead — µg renders correctly
// now too, not the "ug" approximation free text tended toward.
function DoseStrengthField({ value, unit, onChangeValue, onChangeUnit, T }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>Dose strength</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={value} onChange={(e) => onChangeValue(e.target.value)} placeholder="e.g. 245" inputMode="decimal"
          style={{ flex: 1, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
        <select value={unit} onChange={(e) => onChangeUnit(e.target.value)}
          style={{ width: 90, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }}>
          <option value="">—</option>
          {DOSE_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: dose change as its own real action.
// Reuses DoseStrengthField above (same input, no new pattern
// invented) and the same real LogRepository stock-adjustment pattern
// already proven in correctStock() — "update stock at that point" is
// optional, off by default, only writes a log entry if actually used.
function UpdateDoseSheet({ med, onConfirm, onClose, T }) {
  const [doseStrengthValue, setDoseStrengthValue] = useState(med.doseStrengthValue || "");
  const [doseStrengthUnit, setDoseStrengthUnit] = useState(med.doseStrengthUnit || "");
  const [unitsPerDose, setUnitsPerDose] = useState(med.unitsPerDose || 1);
  const [updateStockToo, setUpdateStockToo] = useState(false);
  const [stockDelta, setStockDelta] = useState("");
  const [note, setNote] = useState("");

  const doseActuallyChanged = String(doseStrengthValue) !== String(med.doseStrengthValue) || doseStrengthUnit !== med.doseStrengthUnit || Number(unitsPerDose) !== med.unitsPerDose;

  const confirm = () => {
    if (!doseActuallyChanged) { onClose(); return; }
    onConfirm({
      doseStrengthValue, doseStrengthUnit, unitsPerDose: Number(unitsPerDose) || 1, note,
      stockDelta: updateStockToo && stockDelta !== "" ? Number(stockDelta) : null,
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 210 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg, width: "100%", maxHeight: "85vh", overflowY: "auto", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, display: "flex", flexDirection: "column" }}>
        <div style={{ background: T.medsBlue, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 14px", flexShrink: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>Update dose — {med.name}</span>
          <X size={20} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onClose} aria-label="Close" />
        </div>
        <div style={{ padding: "8px 20px 20px" }}>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
            This stays the same medication/course — the old dose ({med.doseStrengthValue ? med.doseStrengthValue * (med.unitsPerDose || 1) : "—"}{med.doseStrengthUnit}) is kept in this record's dose history, not lost or split into a separate entry.
          </div>
          <DoseStrengthField value={doseStrengthValue} unit={doseStrengthUnit} onChangeValue={setDoseStrengthValue} onChangeUnit={setDoseStrengthUnit} T={T} />
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>Units per dose</div>
            <input type="number" min="1" value={unitsPerDose} onChange={(e) => setUnitsPerDose(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>Note (optional — e.g. "GP increased dose")</div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for the change"
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
          </div>
          {/* ADDED 26 Aug 2026 — real ask: option to update stock at
              the same time as the dose change (e.g. new prescription
              with a different pack size arrived alongside the dose
              increase). Off by default — only writes a log entry if
              actually used. */}
          <div onClick={() => setUpdateStockToo((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", cursor: "pointer" }}>
            <div style={{ width: 20, height: 20, borderRadius: radius.sm, border: `2px solid ${updateStockToo ? T.medsBlue : T.border}`, background: updateStockToo ? T.medsBlue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {updateStockToo && <Check size={12} color="#FFFFFF" />}
            </div>
            <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>Also update stock now</span>
          </div>
          {updateStockToo && (
            <div style={{ padding: "4px 0 8px" }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>Stock change (+ for adding, − for removing)</div>
              <input type="number" value={stockDelta} onChange={(e) => setStockDelta(e.target.value)} placeholder="e.g. 30 or -5"
                style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
            </div>
          )}
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={confirm} disabled={!doseActuallyChanged}
            style={{ ...btnStyle(T.medsBlue, "filled"), width: "100%", padding: 16, fontSize: 16, fontWeight: 700, opacity: doseActuallyChanged ? 1 : 0.5 }}>
            {doseActuallyChanged ? "Confirm dose update" : "Change the dose to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MedicationEditSheet({ med, onSave, onClose, T }) {
  // ADDED 19 Aug 2026 — real in-app editable option lists.
  const medicationTypeOptions = useMemo(() => CustomOptionListsRepository.get("medicationType"), []);
  const routeOptions = useMemo(() => CustomOptionListsRepository.get("route"), []);
  const [categoryOptions, setCategoryOptions] = useState(() => CustomOptionListsRepository.get("medicationCategory"));
  const [form, setForm] = useState({
    name: med.name, route: med.route || "", medicationType: med.medicationType || "",
    category: med.category || [],
    doseStrengthValue: med.doseStrengthValue || "", doseStrengthUnit: med.doseStrengthUnit || "",
    usagePattern: med.usagePattern, scheduleIntervalDays: med.scheduleIntervalDays || 2,
    dosesPerDay: med.dosesPerDay || 1, unitsPerDose: med.unitsPerDose, refillThreshold: med.refillThreshold,
    unitsPerContainer: med.unitsPerContainer || 0,
    // Default refill qty is edited in containers, stored in units — the user's ask, matches how
    // people actually think about a refill ("one box"), not a raw unit count.
    defaultRefillContainers: med.unitsPerContainer ? Math.round((med.defaultRefillQuantity || 0) / med.unitsPerContainer) : 1,
    inventoryTracked: med.inventoryTracked, usualSupplier: med.usualSupplier || "",
    // ADDED — real bug found: some real medications (e.g. PrEP) already
    // carried a `notes` value visible in a raw backup export, but this
    // form never read or wrote that field at all, and the card never
    // displayed it either — a real note existed with no UI surface
    // anywhere. Genuinely wired up now, not just carried through.
    notes: med.notes || "",
  });
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const save = () => {
    const { defaultRefillContainers, ...rest } = form;
    onSave({ ...rest, defaultRefillQuantity: defaultRefillContainers * (form.unitsPerContainer || 0) });
  };
  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={onClose}>
      {/* CHANGED 19 Aug 2026 — same fix Contacts got: Save was buried at
          the end of scrollable content, so once the sheet grew past one
          screenful (Route/Dose/Reason fields added it further this
          session) Save could scroll out of view entirely rather than
          just be covered. Restructured into header / scrollable middle /
          sticky bottom action bar, matching Contacts' ContactEditSheet
          exactly — same full-width, accent-colored, large button. */}
      <div style={{ background: T.surface, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>Edit medication</span>
          <X size={18} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} aria-label="Close" />
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, padding: "0 20px 12px", flexShrink: 0 }}>Changes how stock/adherence are calculated going forward — doesn't touch past log entries.</div>

        <div style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>
        <div style={{ padding: "6px 0 10px" }}>
          <input value={form.name} onChange={(e) => set("name")(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, boxSizing: "border-box" }} />
        </div>

        {/* REORDERED 19 Aug 2026 — same reasoning as Add medication:
            identity facts before dosing mechanics. */}
        <SelectRow T={T} label="Medication type" value={form.medicationType} onChange={set("medicationType")} options={medicationTypeOptions} />
        <MultiSelectRow T={T} label="Category" value={form.category} onChange={set("category")} options={categoryOptions}
          onAddNew={(v) => setCategoryOptions(CustomOptionListsRepository.add("medicationCategory", v))} />
        <DoseStrengthField T={T} value={form.doseStrengthValue} unit={form.doseStrengthUnit} onChangeValue={set("doseStrengthValue")} onChangeUnit={set("doseStrengthUnit")} />
        <SelectRow T={T} label="Route" value={form.route} onChange={set("route")} options={routeOptions} />

        {/* CHANGED 19 Aug 2026 — real custom-scheduling support: Custom
            is now a genuine, reachable third option, not just a stubbed
            seed-data value with no way in. "Every N days" only, per
            the user's explicit scope call — no day-of-week complexity. */}
        <div style={{ display: "flex", background: T.surfaceVariant, borderRadius: radius.full, padding: 3, marginBottom: 12 }}>
          {["daily", "custom", "prn"].map((p) => (
            <div key={p} onClick={() => set("usagePattern")(p)} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: radius.full, cursor: "pointer", fontSize: 13, fontWeight: 600, background: form.usagePattern === p ? T.surface : "transparent", color: form.usagePattern === p ? T.medsBlue : T.textSecondary }}>
              {p === "daily" ? "Daily" : p === "custom" ? "Custom" : "PRN"}
            </div>
          ))}
        </div>
        {form.usagePattern === "custom" && (
          <NumberField T={T} label="Every how many days?" value={form.scheduleIntervalDays} onChange={set("scheduleIntervalDays")} min={2} />
        )}

        {/* REORDERED 1 Sep 2026 — real ask: "medication settings order
            feels haphazard." The Inventory-tracked toggle used to sit
            BEFORE Doses per day/Units per dose, interrupting the
            dosing-mechanics group (how you take it) with an inventory
            concern, then circling back to more inventory fields later.
            Real hierarchy now: identity (above) → dosing mechanics
            (schedule pattern/interval, doses per day, units per dose)
            → inventory (tracked toggle + its own dependent fields,
            grouped together) → supplier → notes. */}
        {form.usagePattern === "daily" && <NumberField T={T} label="Doses per day" value={form.dosesPerDay} onChange={set("dosesPerDay")} min={1} />}
        <NumberField T={T} label={`Units per dose (${med.unit}s)`} value={form.unitsPerDose} onChange={set("unitsPerDose")} min={1} />
        <ToggleRow T={T} label="Inventory tracked" value={form.inventoryTracked} onChange={set("inventoryTracked")} />
        {form.inventoryTracked && (
          <>
            <NumberField T={T} label={`Units per container (${med.unit}s)`} value={form.unitsPerContainer} onChange={set("unitsPerContainer")} min={0} />
            <NumberField T={T} label={`Refill threshold (${med.unit}s)`} value={form.refillThreshold} onChange={set("refillThreshold")} min={0} />
            <NumberField T={T} label="Default refill qty (containers)" value={form.defaultRefillContainers} onChange={set("defaultRefillContainers")} min={0} />
          </>
        )}

        <div style={{ padding: "10px 0" }}>
          <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>Usual supplier</div>
          <input value={form.usualSupplier} onChange={(e) => set("usualSupplier")(e.target.value)} placeholder="e.g. Boots Pharmacy"
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
        </div>
        {/* ADDED — real bug fix: a real Notes field, genuinely wired to
            edit/save/card display — see the `notes` field comment above
            for why this was missing despite already existing in some
            real records' raw data. */}
        <div style={{ padding: "10px 0" }}>
          <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>Notes</div>
          <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Anything else worth noting about this medication" rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
        </div>
        {/* ADDED 26 Aug 2026 — real ask: dose history display, showing
            the real embedded history built by updateDose() — the same
            "same med/course" continuity, visible, not just stored. */}
        {med?.doseHistory?.length > 0 && (
          <div style={{ padding: "10px 0", borderTop: `1px solid ${T.border}`, marginTop: 8 }}>
            <div style={{ ...TYPE.sectionLabel, color: T.textSecondary, marginBottom: 8 }}>Dose history</div>
            {[...med.doseHistory].reverse().map((h, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: i < med.doseHistory.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>{h.doseStrengthValue ? h.doseStrengthValue * (h.unitsPerDose || 1) : "—"}{h.doseStrengthUnit}</div>
                <div style={{ fontSize: 11, color: T.textDisabled }}>
                  Until {new Date(h.supersededAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  {h.note ? ` · ${h.note}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* ADDED 26 Aug 2026 — real ask: last-updated indicator. No
            dedicated detail screen exists for Medication (a disclosed
            limitation from earlier this session), so this edit form
            is the closest equivalent place to show it. */}
        {med?.updatedAt && (
          <div style={{ textAlign: "center", fontSize: 11, color: T.textDisabled, marginTop: 10 }}>
            Last updated {new Date(med.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </div>
        )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={save} style={{ ...btnStyle(T.medsBlue, "filled"), width: "100%", padding: 16, fontSize: 16, fontWeight: 700 }}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

// ── New medication creation — this is what the FAB should have opened all along; it had no
// handler before. Daily/PRN only for now — Custom Schedule exists in the data model (Doc 5 §5)
// but there's no schedule-builder UI yet, so it's not offered here rather than half-supported. ──
function AddMedicationSheet({ onCreate, onClose, T }) {
  const medicationTypeOptions = useMemo(() => CustomOptionListsRepository.get("medicationType"), []);
  const routeOptions = useMemo(() => CustomOptionListsRepository.get("route"), []);
  const [categoryOptions, setCategoryOptions] = useState(() => CustomOptionListsRepository.get("medicationCategory"));
  const [form, setForm] = useState({
    name: "", route: "", medicationType: "", category: [], doseStrengthValue: "", doseStrengthUnit: "",
    usagePattern: "daily", scheduleIntervalDays: 2, unitsPerDose: 1, dosesPerDay: 1,
    inventoryTracked: true, unitsPerContainer: 30, refillThreshold: 7, defaultRefillContainers: 1, usualSupplier: "",
    notes: "",
  });
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const canCreate = form.name.trim().length > 0;
  const create = () => {
    const { defaultRefillContainers, ...rest } = form;
    onCreate({ ...rest, defaultRefillQuantity: defaultRefillContainers * (form.unitsPerContainer || 0) });
  };

  // ADDED 1 Sep 2026 — real ask: a dedupe nudge on the name field, same
  // spirit as the fuzzy "did you mean" checks elsewhere this session,
  // but deliberately NOT that same accept/reject mechanism here — the
  // user's own explicit caution: this must never discourage tracking
  // the same active ingredient as separate entries for different
  // strengths or courses (e.g. treatment-dose Doxycycline vs ongoing
  // DoxyPEP). So this only ever informs, it never blocks or offers to
  // "use the existing one instead" — Add medication stays exactly as
  // capable as before, just with a heads-up when it's worth a second
  // look. Checked only against ACTIVE medications — a re-add of a
  // long-archived one is a deliberate restart, not a live duplicate.
  const existingNames = useMemo(() => MedicationRepository.getAll().filter((m) => !m.isArchived).map((m) => m.name), []);
  const trimmedName = form.name.trim();
  // CHANGED — real perf fix: findClosestMatch runs Levenshtein against
  // every active medication name — was recomputing on every render,
  // i.e. every keystroke in the name field, even though existingNames
  // itself was already memoized. Small dataset today, but the same
  // missing-memoization pattern is worth closing here too.
  const { exactNameMatch, closeNameMatch } = useMemo(() => {
    const exactNameMatch = trimmedName && existingNames.some((n) => n.toLowerCase() === trimmedName.toLowerCase());
    const closeNameMatch = trimmedName && !exactNameMatch ? findClosestMatch(existingNames, trimmedName) : null;
    return { exactNameMatch, closeNameMatch };
  }, [trimmedName, existingNames]);

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={onClose}>
      {/* CHANGED 19 Aug 2026 — same sticky-bottom-bar restructure as
          MedicationEditSheet/Contacts' ContactEditSheet — see that
          sheet's comment for the full reasoning. */}
      <div style={{ background: T.surface, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }} onClick={(e) => e.stopPropagation()}>
        {/* CHANGED 26 Aug 2026 — real ask: forms should also have the
            module banner title. */}
        <div style={{ background: T.medsBlue, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 14px", flexShrink: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>Add medication</span>
          <X size={20} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onClose} aria-label="Close" />
        </div>

        <div style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>
        <div style={{ padding: "6px 0 10px" }}>
          <input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Medication name" autoFocus
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
          {exactNameMatch && (
            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 5, lineHeight: 1.4 }}>
              You already track a medication called "{trimmedName}" — this adds a separate entry (e.g. a new course), it won't merge with the existing one.
            </div>
          )}
          {closeNameMatch && (
            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 5, lineHeight: 1.4 }}>
              Similar to your existing "{closeNameMatch}" — worth a check for a typo. If it's meant to be different (a different strength or course), this still adds it as its own separate entry.
            </div>
          )}
        </div>

        {/* REORDERED 19 Aug 2026 — identity facts right after the name:
            what it is, how strong, how taken — before the dosing-
            pattern/inventory mechanics below. */}
        <SelectRow T={T} label="Medication type" value={form.medicationType} onChange={set("medicationType")} options={medicationTypeOptions} />
        <MultiSelectRow T={T} label="Category" value={form.category} onChange={set("category")} options={categoryOptions}
          onAddNew={(v) => setCategoryOptions(CustomOptionListsRepository.add("medicationCategory", v))} />
        <DoseStrengthField T={T} value={form.doseStrengthValue} unit={form.doseStrengthUnit} onChangeValue={set("doseStrengthValue")} onChangeUnit={set("doseStrengthUnit")} />
        <SelectRow T={T} label="Route" value={form.route} onChange={set("route")} options={routeOptions} />

        <div style={{ display: "flex", background: T.surfaceVariant, borderRadius: radius.full, padding: 3, marginBottom: 12 }}>
          {["daily", "custom", "prn"].map((p) => (
            <div key={p} onClick={() => set("usagePattern")(p)} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: radius.full, cursor: "pointer", fontSize: 13, fontWeight: 600, background: form.usagePattern === p ? T.surface : "transparent", color: form.usagePattern === p ? T.medsBlue : T.textSecondary }}>
              {p === "daily" ? "Daily" : p === "custom" ? "Custom" : "PRN"}
            </div>
          ))}
        </div>
        {form.usagePattern === "custom" && (
          <NumberField T={T} label="Every how many days?" value={form.scheduleIntervalDays} onChange={set("scheduleIntervalDays")} min={2} />
        )}

        {/* REORDERED 1 Sep 2026 — real ask: "medication settings order
            feels haphazard." Same fix as the Edit sheet's own comment
            on this exact block: dosing mechanics (doses per day, units
            per dose) grouped together and settled before Inventory
            tracked's own toggle + dependent fields, instead of the
            toggle interrupting the dosing group partway through. */}
        {form.usagePattern === "daily" && <NumberField T={T} label="Doses per day" value={form.dosesPerDay} onChange={set("dosesPerDay")} min={1} />}
        <NumberField T={T} label="Units per dose" value={form.unitsPerDose} onChange={set("unitsPerDose")} min={1} />
        <ToggleRow T={T} label="Inventory tracked" value={form.inventoryTracked} onChange={set("inventoryTracked")} />
        {form.inventoryTracked && (
          <>
            <NumberField T={T} label="Units per container" value={form.unitsPerContainer} onChange={set("unitsPerContainer")} min={0} />
            <NumberField T={T} label="Refill threshold" value={form.refillThreshold} onChange={set("refillThreshold")} min={0} />
            <NumberField T={T} label="Default refill qty (containers)" value={form.defaultRefillContainers} onChange={set("defaultRefillContainers")} min={0} />
          </>
        )}

        <div style={{ padding: "10px 0" }}>
          <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>Usual supplier</div>
          <input value={form.usualSupplier} onChange={(e) => set("usualSupplier")(e.target.value)} placeholder="e.g. Boots Pharmacy"
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
        </div>
        <div style={{ padding: "10px 0" }}>
          <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>Notes</div>
          <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Anything else worth noting about this medication" rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
        </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={() => canCreate && create()} style={{ ...btnStyle(canCreate ? T.medsBlue : T.textDisabled, "filled"), width: "100%", padding: 16, fontSize: 16, fontWeight: 700, cursor: canCreate ? "pointer" : "default" }}>
            Add medication
          </button>
        </div>
      </div>
    </div>
  );
}

function DoseReminderBanner({ med, onTake, onSnooze, onSkip, T }) {
  return (
    <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", width: 358, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.md, boxShadow: "0 8px 24px rgba(0,0,0,.18)", padding: 16, zIndex: 220 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Pill size={16} color={T.medsBlue} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 14, color: T.textPrimary }}>Time for {med.name}</span>
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12 }}>Demo notification — real delivery needs native scheduling (Doc 5 §9)</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onTake} style={{ ...btnStyle(T.medsBlue, "filled"), padding: "8px 6px" }}>Take</button>
        <button onClick={onSnooze} style={{ ...btnStyle(T.medsBlue, "outline"), padding: "8px 6px" }}>Snooze 30m</button>
        <button onClick={onSkip} style={{ ...btnStyle(T.textSecondary, "outline"), padding: "8px 6px" }}>Skip</button>
      </div>
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: Medication's own settings screen, now
// that real content exists to put behind it. Ends with a link back to
// general/app Settings, per the user's standing rule for any per-module
// settings screen. Toggle UI matches the same pattern as Settings →
// Design's dark mode toggle, for visual consistency across the app's
// two settings surfaces.
function MedicationSettingsScreen({ onClose, onOpenGeneralSettings, T }) {
  const [prefs, setPrefs] = useState(() => MedicationPreferencesRepository.getPreferences());
  const toggleReminders = () => {
    const updated = MedicationPreferencesRepository.updatePreferences({ doseRemindersEnabled: !prefs.doseRemindersEnabled });
    setPrefs(updated);
    syncMedicationReminders();
  };
  // ADDED 26 Aug 2026 — real ask: customizable settings, not just
  // on/off. Snooze length matches TakeYourPills/Medisafe's own
  // default (30 min, confirmed via their store listings).
  const setSnoozeMinutes = (mins) => setPrefs(MedicationPreferencesRepository.updatePreferences({ snoozeMinutes: mins }));

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Medication settings</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
            <div>
              <div style={{ fontSize: 14, color: T.textPrimary, fontWeight: 500 }}>Dose reminders</div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>Notify when a daily medication is due</div>
            </div>
            <div onClick={toggleReminders} role="switch" tabIndex={0} aria-checked={prefs.doseRemindersEnabled} aria-label="Dose reminders"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleReminders(); } }}
              style={{ width: 44, height: 26, borderRadius: 999, background: prefs.doseRemindersEnabled ? T.medsBlue : T.border, position: "relative", cursor: "pointer", flexShrink: 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", position: "absolute", top: 3, left: prefs.doseRemindersEnabled ? 21 : 3, transition: "left 0.15s" }} />
            </div>
          </div>
          {prefs.doseRemindersEnabled && (
            <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.textSecondary, margin: "10px 0 6px" }}>"Remind in..." duration</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[15, 30, 60].map((mins) => (
                  <div key={mins} onClick={() => setSnoozeMinutes(mins)}
                    style={{ padding: "6px 14px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${prefs.snoozeMinutes === mins ? T.medsBlue : T.border}`, color: prefs.snoozeMinutes === mins ? T.medsBlue : T.textSecondary, background: prefs.snoozeMinutes === mins ? `${T.medsBlue}15` : "transparent" }}>
                    {mins} min
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 10 }}>
                Notifications show Take all / Remind in {prefs.snoozeMinutes} min / Skip until tomorrow — based on your daily medications' due times.
              </div>
            </div>
          )}
        </div>
        {/* CHANGED 26 Aug 2026 — real ask: every per-module settings
            screen ends with a link back to general/app Settings. */}
        <div onClick={onOpenGeneralSettings} style={{ textAlign: "center", fontSize: 13, color: T.textSecondary, textDecoration: "underline", cursor: "pointer", padding: "12px 0" }}>
          Go to general app settings
        </div>
      </div>
    </div>
  );
}

export default function MedicationDashboard({ openAddOnMount = false, onConsumedQuickAdd, openRecordId, onConsumedRecordOpen, onOpenSettings, registerModuleBackHandler } = {}) {
  const [meds, setMeds] = useState(() => loadMedications());
  // ADDED 19 Aug 2026 — real undo/redo for editing a medication's own
  // record (name/dose/route/etc.) — see editUndoHelpers.js. Separate
  // from the dose-log undo/redo just below (lastLoggedEntry/
  // redoAvailable), which covers a different action entirely.
  const editUndo = useEditUndo(MedicationRepository);
  // ADDED 19 Aug 2026 — read once on mount, same pattern as every other
  // module's read-only cross-repository reference (e.g. Contacts'
  // Timeline reading EncounterRepository). Allergies is edited on My
  // Profile, not here.
  const allergies = useMemo(() => MyProfileRepository.getProfile().allergies, []);
  // Called after every write to either repository — re-reads both and
  // rebuilds the merged view so the screen reflects what's now actually
  // stored, the same way setMeds always used to trigger a re-render.
  const refreshMeds = () => setMeds(loadMedications());
  const [sheet, setSheet] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [editingMed, setEditingMed] = useState(null);
  // ADDED 26 Aug 2026 — real ask: dose change as its own real action.
  const [updatingDose, setUpdatingDose] = useState(null);
  const [addingMed, setAddingMed] = useState(false);
  // ADDED 26 Aug 2026 — real ask: Medication's own settings screen,
  // now that real content exists (dose reminders) to justify it.
  const [showMedicationSettings, setShowMedicationSettings] = useState(false);
  // ADDED 26 Aug 2026 — real ask: back should go one step within this
  // module. Medication has the most overlay states of any module —
  // checked in priority order, whatever's currently on top closes
  // first. These overlays aren't normally stacked simultaneously in
  // real use, but checking all of them defensively costs nothing and
  // avoids a real bug if that assumption is ever wrong.
  useEffect(() => {
    if (!registerModuleBackHandler) return;
    registerModuleBackHandler(() => {
      if (showMedicationSettings) { setShowMedicationSettings(false); return true; }
      if (sheet) { setSheet(null); return true; }
      if (correction) { setCorrection(null); return true; }
      if (updatingDose) { setUpdatingDose(null); return true; }
      if (editingMed) { setEditingMed(null); return true; }
      if (addingMed) { setAddingMed(false); return true; }
      return false;
    });
    return () => registerModuleBackHandler(null);
  }, [showMedicationSettings, sheet, correction, editingMed, addingMed, updatingDose, registerModuleBackHandler]);
  // ADDED 26 Aug 2026 — real ask: multi-select rolled out to every
  // module. Uses an explicit "Select" toggle here instead of the
  // long-press pattern every other module uses — this card already
  // has dose-logging buttons, move up/down, and its own per-card menu
  // competing for touch events, so long-press risked firing during
  // one of those instead of a genuine hold-to-select gesture.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };
  // ADDED 26 Aug 2026 — real ask: undo for delete, not just archive.
  // CHANGED 26 Aug 2026 — real ask, previously flagged low-priority and
  // now built: redo for delete, matching Contacts' reference
  // implementation.
  const [deleteToast, setDeleteToast] = useState(null); // { mode: "undo" | "redo", records }
  const undoTimerRef = useRef(null);
  const undoDelete = () => {
    if (!deleteToast) return;
    deleteToast.records.forEach((record) => MedicationRepository.restore(record));
    refreshMeds();
    clearTimeout(undoTimerRef.current);
    setDeleteToast({ mode: "redo", records: deleteToast.records });
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  const redoDelete = () => {
    if (!deleteToast) return;
    TrashRepository.add("medications", deleteToast.records);
    deleteToast.records.forEach((r) => MedicationRepository.delete(r.id));
    refreshMeds();
    setDeleteToast(null);
    clearTimeout(undoTimerRef.current);
  };
  const triggerDelete = (records) => {
    TrashRepository.add("medications", records);
    records.forEach((r) => MedicationRepository.delete(r.id));
    setDeleteToast({ mode: "undo", records });
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  // ADDED 19 Aug 2026 — same Dashboard quick-add pattern as Contacts/
  // Encounters; see SHOS_Contacts_Prototype.jsx for the fuller reasoning.
  useEffect(() => {
    if (openAddOnMount) {
      setAddingMed(true);
      onConsumedQuickAdd?.();
    }
    // ADDED — real ask: Global Search deep-link. Same real scroll-to
    // mechanism as scrollToProblem() below, just triggered from a
    // different real source and using the neutral highlight instead
    // of the red "needs attention" one.
    if (openRecordId) {
      setTab("Registry");
      setTimeout(() => {
        cardRefs.current[openRecordId]?.scrollIntoView({ behavior: "smooth", block: "center" });
        setSearchHighlightedId(openRecordId);
        setTimeout(() => setSearchHighlightedId(null), 1600);
      }, 50);
      onConsumedRecordOpen?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [justCompleted, setJustCompleted] = useState(null);
  const [dueReminder, setDueReminder] = useState(null);
  const [snoozedUntil, setSnoozedUntil] = useState({});
  const [bulkFlash, setBulkFlash] = useState(false);
  // ADDED 18 Aug 2026 — same "keep it visible, flash instead of nothing"
  // fix as the individual card, applied to the bulk button.
  const [bulkLockFlash, setBulkLockFlash] = useState(false);
  // CHANGED 19 Aug 2026 — now uses the real shared hook
  // (darkModePreference.js) instead of duplicating this logic
  // in-module — same behavior, now genuinely reusable.
  const [darkMode, setDarkMode] = useDarkModePreference();
  const [highlightedId, setHighlightedId] = useState(null);
  // ADDED — real ask: Global Search results should open the actual
  // medication, not just switch to the Medication tab. Medication has
  // no separate detail screen (unlike every other module) — its own
  // card IS the detail view — so "open" here means scroll-to +
  // highlight, reusing scrollToProblem's exact mechanism below. A
  // SEPARATE state from highlightedId, deliberately — that one means
  // "needs attention" (red), this means "here's what you searched
  // for" (neutral blue) — conflating the two would make a perfectly
  // fine medication look like it urgently needs action.
  const [searchHighlightedId, setSearchHighlightedId] = useState(null);
  const [tab, setTab] = useState("Registry");
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const T = darkMode ? DARK : LIGHT;
  const cardRefs = useRef({});
  // ADDED 1 Sep 2026 — real fix: "Meds search toast does nothing." The
  // header Search icon (next to the working Settings gear) had no
  // onClick at all — purely decorative, even though it visually reads
  // as tappable right next to a real button. The actual search input
  // already exists inline on the Registry tab; this just makes the
  // icon jump there and focus it, including from Log/Inventory where
  // there was previously no way to reach search at all.
  const medSearchInputRef = useRef(null);
  const openMedSearch = () => {
    setTab("Registry");
    setTimeout(() => medSearchInputRef.current?.focus(), 50);
  };

  const flashComplete = (id, type = "logged") => { setJustCompleted({ id, type }); setTimeout(() => setJustCompleted(null), 2000); };
  // ADDED 19 Aug 2026 — real ask: an immediate "undo" right after
  // logging, for the accidental-tap case specifically — separate from
  // the standalone Correction/Void flow (still there for anything
  // spotted later). Tracks the single most-recently-logged entry only;
  // tapping a DIFFERENT medication's log button clears this, so undo
  // only ever targets the actual last action, never something stale.
  //
  // CHANGED 19 Aug 2026 — real Redo added, the counterpart to Undo.
  // The user's explicit scope call: this stays scoped to THIS module/page
  // only — reversing the one void that just happened, not a cross-app
  // action history. `redoAvailable` tracks whether the entry we just
  // voided can still be un-voided (cleared the moment anything else
  // happens to that entry, so Redo never targets something stale).
  const [lastLoggedEntry, setLastLoggedEntry] = useState(null);
  const [redoAvailable, setRedoAvailable] = useState(null);
  const undoLastLog = () => {
    if (!lastLoggedEntry) return;
    LogRepository.void(lastLoggedEntry.id);
    setRedoAvailable(lastLoggedEntry.id);
    setLastLoggedEntry(null);
    refreshMeds();
  };
  const redoLastUndo = () => {
    if (!redoAvailable) return;
    LogRepository.unvoid(redoAvailable);
    setRedoAvailable(null);
    refreshMeds();
  };
  const logDose = (id) => {
    const med = MedicationRepository.getById(id);
    if (!med) return;
    const entry = LogRepository.create({ medicationId: id, type: "dose", delta: -med.unitsPerDose, date: nowAsStoredDateTime() });
    setLastLoggedEntry(entry);
    setRedoAvailable(null);
    setTimeout(() => setLastLoggedEntry((current) => (current?.id === entry.id ? null : current)), 8000);
    // ADDED 26 Aug 2026 — real ask: DoxyPEP 72h notification. Cheap,
    // idempotent no-op if this dose wasn't DoxyPEP — but if it was,
    // this is what promptly cancels a pending alert rather than
    // leaving it scheduled until the next app open.
    syncDoxyPepAlert();
    syncMedicationReminders();
    syncRefillReminder();
    refreshMeds();
  };

  // Bulk-log — all Daily-pattern medications at once, sharing one timestamp so they group
  // together in the Log tab automatically.
  const logAllDaily = () => {
    if (dueDailyMeds.length === 0) {
      setBulkLockFlash(true);
      setTimeout(() => setBulkLockFlash(false), 1800);
      return;
    }
    const timestamp = nowAsStoredDateTime();
    dueDailyMeds.forEach((m) => LogRepository.create({ medicationId: m.id, type: "dose", delta: -m.unitsPerDose, date: timestamp }));
    syncDoxyPepAlert();
    syncMedicationReminders();
    syncRefillReminder();
    refreshMeds();
    setBulkFlash(true);
    setTimeout(() => setBulkFlash(false), 2000);
  };

  const logQuantity = (units) => {
    const isRefill = sheet.mode === "refill";
    const delta = isRefill ? units : -units;
    const type = isRefill ? "refill" : "waste";
    LogRepository.create({ medicationId: sheet.med.id, type, delta, date: nowAsStoredDateTime() });
    // Logging a real refill clears any pending "requested" flag — matches
    // the original behavior, which only cleared it on the refill branch.
    if (isRefill) MedicationRepository.update(sheet.med.id, { refillRequestedAt: null });
    syncRefillReminder();
    refreshMeds();
    flashComplete(sheet.med.id);
    setSheet(null);
  };
  const correctStock = (delta) => {
    LogRepository.create({ medicationId: sheet.med.id, type: delta > 0 ? "refill" : "waste", delta, date: nowAsStoredDateTime(), notes: "Manual stock correction" });
    syncRefillReminder();
    refreshMeds();
    flashComplete(sheet.med.id);
    setSheet(null);
  };
  // ADDED 26 Aug 2026 — real ask: dose change as its own real action.
  const confirmDoseUpdate = ({ doseStrengthValue, doseStrengthUnit, unitsPerDose, note, stockDelta }) => {
    MedicationRepository.updateDose(updatingDose.id, { doseStrengthValue, doseStrengthUnit, unitsPerDose, note });
    if (stockDelta !== null && stockDelta !== 0) {
      LogRepository.create({ medicationId: updatingDose.id, type: stockDelta > 0 ? "refill" : "waste", delta: stockDelta, date: nowAsStoredDateTime(), notes: `Stock update alongside dose change${note ? `: ${note}` : ""}` });
    }
    syncRefillReminder();
    refreshMeds();
    flashComplete(updatingDose.id);
    setUpdatingDose(null);
  };
  const markRequested = (id) => {
    MedicationRepository.update(id, { refillRequestedAt: new Date().toISOString() });
    syncRefillReminder();
    refreshMeds();
    flashComplete(id, "requested");
  };
  const saveCorrection = (newAmount, newDate, reason, sideEffects) => {
    const sign = correction.entry.delta < 0 ? -1 : 1;
    LogRepository.update(correction.entry.id, { delta: sign * newAmount, date: newDate, reason, sideEffects });
    refreshMeds();
    setCorrection(null);
  };
  const voidCorrection = () => {
    LogRepository.void(correction.entry.id);
    refreshMeds();
    setCorrection(null);
  };
  const saveMedication = (form) => {
    // ADDED 19 Aug 2026 — real undo/redo extension: Medication's dose-
    // LOG undo/redo already existed (LogRepository.unvoid), this is
    // the separate, previously-missing piece — undo/redo for editing
    // the medication RECORD itself (renaming it, changing its dose),
    // same shared mechanism as Encounters/Contacts.
    editUndo.captureBeforeEdit(editingMed.id);
    MedicationRepository.update(editingMed.id, form);
    editUndo.notifyEdited(editingMed.id);
    refreshMeds();
    setEditingMed(null);
  };
  const createMedication = (form) => {
    // MedicationRepository.create assigns the real id (med_006, med_007, ...)
    // — no more `med_${Date.now()}`, matching the project's standing rule
    // that ids are opaque and sequential, never timestamp- or name-derived.
    const newMed = MedicationRepository.create({
      name: form.name.trim(), unit: "unit",
      usagePattern: form.usagePattern, unitsPerDose: form.unitsPerDose, dosesPerDay: form.dosesPerDay,
      unitsPerContainer: form.unitsPerContainer, refillThreshold: form.refillThreshold, defaultRefillQuantity: form.defaultRefillQuantity,
      inventoryTracked: form.inventoryTracked, usualSupplier: form.usualSupplier,
    });
    // Initial stock is just the first Refill-type log entry (Doc 5 §5) —
    // no separate Opening Stock field, same rule as everywhere else.
    if (form.inventoryTracked) {
      LogRepository.create({ medicationId: newMed.id, type: "refill", delta: form.defaultRefillQuantity || 0, date: nowAsStoredDateTime() });
    }
    refreshMeds();
    setAddingMed(false);
  };

  // Manual reordering — a medication's position in Registry is its priority, user-controlled
  // rather than auto-sorted. Simple move up/down rather than full drag-and-drop, for reliability.
  // The active-only, archived-meds-don't-count logic now lives inside
  // MedicationRepository.reorder itself (it owns sortOrder), so this is
  // just a thin translation from the UI's -1/+1 direction to "up"/"down".
  const moveMedication = (id, dir) => {
    MedicationRepository.reorder(id, dir < 0 ? "up" : "down");
    refreshMeds();
  };

  // Archive/retire — for a finished acute course you might need again (the user's example), not a
  // permanent delete. History (Log tab) stays visible regardless; only Registry/Inventory hide it.
  const archiveMedication = (id) => { MedicationRepository.archive(id); refreshMeds(); };
  const unarchiveMedication = (id) => { MedicationRepository.unarchive(id); refreshMeds(); };
  // ADDED — real ask: real delete, with a confirmation step, same
  // pattern already proven across every other module this session.
  const deleteMedication = (id) => { const med = MedicationRepository.getById(id); if (med) { triggerDelete([med]); refreshMeds(); } };

  const takeReminder = () => { logDose(dueReminder.id); flashComplete(dueReminder.id, "logged"); setDueReminder(null); };
  const snoozeReminder = () => { setSnoozedUntil((prev) => ({ ...prev, [dueReminder.id]: new Date(Date.now() + 30 * 60000).toISOString() })); setDueReminder(null); };
  const skipReminder = () => setDueReminder(null);

  // BUG FIX (18 Aug 2026): this only filtered before, never sorted — so
  // MedicationRepository.reorder() was correctly swapping sortOrder
  // values the whole time, but nothing ever read that field to decide
  // display order. The list just showed creation order regardless of
  // how many times Move up/down was clicked. Sorting by sortOrder here
  // is the actual fix — reorder() itself was already correct.
  // CHANGED 19 Aug 2026 — the user's ask: Daily-pattern meds should always
  // list before PRN, with manual reordering still respected WITHIN each
  // group rather than overriding it entirely. "custom" (rarely used)
  // placed between the two — reasonable default, not explicitly
  // specified by the user, flagged here rather than silently assumed.
  const PATTERN_ORDER = { daily: 0, custom: 1, prn: 2 };
  // CHANGED — real ask: "show non inventory tracked with a visual
  // separator with tracked meds above". Adds inventoryTracked as the
  // PRIMARY sort key, ahead of the existing daily/custom/PRN grouping
  // — tracked meds first, non-tracked below, with the pattern grouping
  // and manual sortOrder still respected WITHIN each of those two
  // groups exactly as they already were within pattern groups. Safe to
  // extend the same three-level comparator this way: reorder() only
  // ever swaps adjacent sortOrder values, and since render order is
  // always re-derived from this sort, a med can never render outside
  // its real tracked/non-tracked group regardless of what sortOrder it
  // carries.
  const activeMeds = useMemo(() => meds.filter((m) => !m.archived).sort((a, b) => {
    const trackedDiff = (b.inventoryTracked ? 1 : 0) - (a.inventoryTracked ? 1 : 0);
    if (trackedDiff !== 0) return trackedDiff;
    const patternDiff = (PATTERN_ORDER[a.usagePattern] ?? 1) - (PATTERN_ORDER[b.usagePattern] ?? 1);
    return patternDiff !== 0 ? patternDiff : a.sortOrder - b.sortOrder;
  }), [meds]);
  const archivedMeds = useMemo(() => meds.filter((m) => m.archived), [meds]);
  const needsActionMeds = useMemo(() => activeMeds.filter((m) => { const s = computeStock(m); return s.tracked && s.needsAction && !m.refillRequestedAt; }), [activeMeds]);
  // ADDED 26 Aug 2026 — real ask: search within module. Deliberately
  // NOT pre-filtering activeMeds itself — that array's real index
  // drives isFirst/isLast for the move-up/down reorder buttons, and
  // reordering within a filtered subset wouldn't map correctly back to
  // the real stock order. Filtering happens inline in the render map
  // instead (returns null for non-matches), so idx stays accurate.
  const [medQuery, setMedQuery] = useState("");
  const matchesMedSearch = (m) => {
    const q = medQuery.trim().toLowerCase();
    if (!q) return true;
    return [m.name, m.medicationType, m.route].filter(Boolean).some((v) => v.toLowerCase().includes(q));
  };

  // CHANGED 18 Aug 2026 — real feedback: the button used to disappear
  // entirely once everything was logged, which is the same "silently
  // vanish instead of showing feedback" pattern flagged for the
  // individual card's own button. Now it stays visible whenever any
  // daily med exists at all (`allDailyMeds`), and `dueDailyMeds` (still
  // computed exactly as before) is what decides whether tapping it logs
  // doses or shows a "locked" flash instead — see logAllDaily() above.
  const allDailyMeds = useMemo(() => activeMeds.filter((m) => m.usagePattern === "daily"), [activeMeds]);
  const dueDailyMeds = useMemo(() => activeMeds.filter((m) => {
    if (m.usagePattern !== "daily") return false;
    const lastDose = [...m.logs].filter((l) => l.type === "dose" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return !lastDose || !isDoseLockedOut(m, lastDose.date);
  }), [activeMeds]);

  // For the bulk lock flash message — the earliest unlock time across
  // whichever daily meds are currently locked, so the message is
  // meaningful even when several meds are on different schedules.
  const earliestBulkUnlock = useMemo(() => {
    const locked = allDailyMeds.filter((m) => !dueDailyMeds.includes(m));
    if (locked.length === 0) return null;
    const estimates = locked.map((m) => {
      const lastDose = [...m.logs].filter((l) => l.type === "dose" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      return lastDose ? lockoutEndsEstimate(m, lastDose.date) : null;
    }).filter(Boolean);
    return estimates[0] || null;
  }, [allDailyMeds, dueDailyMeds]);

  const scrollToProblem = () => {
    if (tab !== "Registry") setTab("Registry");
    if (needsActionMeds.length === 0) return;
    const target = needsActionMeds[0];
    setTimeout(() => {
      cardRefs.current[target.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(target.id);
      setTimeout(() => setHighlightedId(null), 1600);
    }, 50);
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: T.bg, minHeight: "100vh", display: "flex", justifyContent: "center", transition: "background 200ms ease" }}>
      {/* CHANGED — real ask: "Medications module is the only one
          designed like a phone screen — not full width on laptop."
          Was a fixed 390px regardless of viewport; now genuinely
          responsive — fills the screen on mobile, caps at a real
          desktop-appropriate width rather than stretching single-
          column cards absurdly wide (per the wider design review's
          own explicit caution against just stretching mobile layouts). */}
      <div style={{ width: "100%", maxWidth: 600, background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column", borderLeft: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}` }}>
        {/* ADDED 26 Aug 2026 — real ask: page title on a sticky banner
            filled with the module's own colour, same pattern applied
            across every module. Was missed in the first banner pass. */}
        {/* CHANGED 26 Aug 2026 — real ask: icons moved into the
            banner, matching Contacts' treatment. */}
        <div style={{ position: "sticky", top: 0, zIndex: 6, background: T.medsBlue, borderBottom: "2px solid rgba(0,0,0,0.15)", padding: "16px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ ...TYPE.screenTitle, color: "#FFFFFF" }}>Medication</span>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {/* ADDED 26 Aug 2026 — real ask: explicit Select toggle,
                not long-press (see the selectMode state comment above
                for why). */}
            <span onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", cursor: "pointer" }}>
              {selectMode ? "Done" : "Select"}
            </span>
            <Search size={20} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={openMedSearch} />
            {/* CHANGED 26 Aug 2026 — real content now exists (dose
                reminders), so this is wired up for real — was
                deliberately a visual-only stub until this existed. */}
            <SettingsIcon size={20} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={() => setShowMedicationSettings(true)} />
          </div>
        </div>
        {/* ADDED 26 Aug 2026 — real ask: bulk action toolbar. */}
        {selectMode && (
          <div style={{ background: "#1B1B1F", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600 }}>{selectedIds.length} selected</span>
            <div style={{ display: "flex", gap: 16 }}>
              {/* ADDED 1 Sep 2026 — real ask: "option to select all...
                  rather than manual 1 by 1", scoped to whatever's
                  currently visible under the active search filter. */}
              <span onClick={() => { const visible = activeMeds.filter(matchesMedSearch).map((m) => m.id); setSelectedIds(selectedIds.length === visible.length ? [] : visible); }}
                style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>
                {selectedIds.length === activeMeds.filter(matchesMedSearch).length ? "Deselect all" : "Select all"}
              </span>
              {/* ADDED 26 Aug 2026 — real ask: export/print a single
                  record, enabled only when exactly one is selected. */}
              <span onClick={() => { if (selectedIds.length === 1) exportRecordAsFile("medications", MedicationRepository.getById(selectedIds[0])); }}
                style={{ fontSize: 13, color: selectedIds.length === 1 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length === 1 ? "pointer" : "default" }}>Export</span>
              <span onClick={() => { if (selectedIds.length > 0) { MedicationRepository.bulkArchive(selectedIds); refreshMeds(); exitSelectMode(); } }}
                style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Archive</span>
              <span onClick={() => {
                if (selectedIds.length === 0) return;
                if (window.confirm(`Delete ${selectedIds.length} medication${selectedIds.length > 1 ? "s" : ""}? You'll have a few seconds to undo.`)) {
                  const toRestore = MedicationRepository.getAll().filter((m) => selectedIds.includes(m.id));
                  triggerDelete(toRestore);
                  refreshMeds();
                  exitSelectMode();
                }
              }} style={{ fontSize: 13, color: selectedIds.length > 0 ? DARK.actionRed : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
              <span onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
            </div>
          </div>
        )}

        {/* ADDED 19 Aug 2026 — real ask: allergies visible here too, not
            just on Clinic Card, since it's directly relevant while
            adding/reviewing medications. Read-only banner — editing
            still happens on My Profile, this is a visibility surface
            only, and stays silent entirely when nothing's recorded
            rather than showing an empty/permanent row. */}
        {/* FIXED — real follow-up: the previous fix only addressed the
            gap BELOW this banner (double-counted against the stat row).
            This banner's own top margin was still a flat 0, sitting
            completely flush against the sticky module header above it
            — no breathing room at all, which is very likely what
            still read as "off" after that first fix. 12px top now,
            matching the same 12px this banner already uses on every
            other side. */}
        {allergies.length > 0 && (
          <div style={{ margin: "12px 16px 12px", padding: "10px 14px", borderRadius: radius.md, background: `${T.actionRed}14`, border: `1px solid ${T.actionRed}40`, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={15} color={T.actionRed} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: T.actionRed, fontWeight: 600 }}>Allergies: {allergies.join(", ")}</span>
          </div>
        )}

        {/* ADDED 19 Aug 2026 — real ask: an immediate way to undo the
            most recent dose log, specifically for the accidental-tap
            case. See logDose() above for how lastLoggedEntry is tracked
            and cleared. */}
        {/* CHANGED — real ask: this sat at top:12, directly on top of
            the banner's own back/nav controls — the instinctive "log
            the dose, then tap away" motion hit the toast instead.
            top:64 clears the banner. */}
        {lastLoggedEntry && (
          <div onClick={undoLastLog}
            style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", width: 358, background: T.textPrimary, color: T.bg, borderRadius: radius.full, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Check size={14} /> Dose logged — tap to undo
          </div>
        )}
        {/* ADDED 19 Aug 2026 — real Redo: appears right after an Undo,
            scoped to Medication only per the user's explicit call ("undo
            redo should apply only within that module/page"). Cleared
            the moment a new dose is logged (see logDose above), so
            Redo never targets something stale. */}
        {!lastLoggedEntry && redoAvailable && (
          <div onClick={redoLastUndo}
            style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", width: 358, background: T.medsBlue, color: "#FFFFFF", borderRadius: radius.full, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <RefreshCcw size={14} /> Undone — tap to redo
          </div>
        )}

        {/* ADDED 19 Aug 2026 — real undo/redo for editing the
            medication RECORD (not a dose log) — separate action, only
            shown when there's no dose-log toast currently competing
            for the same screen space. */}
        {!lastLoggedEntry && !redoAvailable && editUndo.toast && (
          <div onClick={editUndo.toast.mode === "undo" ? editUndo.undo : editUndo.redo}
            style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", width: 358, background: editUndo.toast.mode === "undo" ? "#1B1B1F" : T.medsBlue, color: "#FFFFFF", borderRadius: radius.full, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {editUndo.toast.mode === "undo" ? <Check size={14} /> : <RefreshCcw size={14} />}
            {editUndo.toast.mode === "undo" ? "Medication updated — tap to undo" : "Undone — tap to redo"}
          </div>
        )}

        {/* REMOVED 26 Aug 2026 — real ask: demo simulate-notification
            button removed. The real Take/Snooze/Skip banner UI it used
            to trigger (driven by dueReminder state) is left in place,
            dormant until real dose-reminder notifications get wired to
            it — a natural next use of notificationService.js, flagged
            separately, not done here. */}

        {/* CHANGED — real ask: no gap at all between the banner and
            this row when none of the conditional banners above it
            (select toolbar/allergies/undo toast) are showing — every
            other module with a stat/summary row directly under its
            banner (Healthcare, Encounters) has some top breathing
            room, this was the one at a flat 0. */}
        {/* FIXED — real ask: "spacing after allergies added" — the flat
            12px top padding above double-counted for anyone with
            allergies recorded, since the Allergies banner right above
            (when it's showing) already carries its own 12px bottom
            margin — the undo/redo toasts are `position: fixed` overlays
            that never affect layout, only Allergies actually does. */}
        <div style={{ display: "flex", gap: 10, padding: `${allergies.length > 0 ? 0 : 12}px 16px 16px` }}>
          <StatTile T={T} label="Active medications" value={activeMeds.length} tint={T.medsBlue} />
          <StatTile T={T} label="Needs action" value={needsActionMeds.length} tint={needsActionMeds.length > 0 ? T.actionRed : T.textPrimary}
            subtitle={needsActionMeds.length > 0 ? needsActionMeds.map((m) => m.name.split(" (")[0]).join(", ") : null}
            onClick={needsActionMeds.length > 0 ? scrollToProblem : undefined} />
        </div>

        <div style={{ display: "flex", gap: 20, padding: "0 16px", borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
          {["Registry", "Log", "Inventory"].map((t) => (
            <div key={t} onClick={() => setTab(t)} style={{ paddingBottom: 10, fontSize: 14, fontWeight: 600, color: tab === t ? T.medsBlue : T.textSecondary, borderBottom: tab === t ? `2px solid ${T.medsBlue}` : "2px solid transparent", cursor: "pointer" }}>{t}</div>
          ))}
        </div>

        {tab === "Registry" && (
          <>
            {/* ADDED 26 Aug 2026 — real ask: search within module. */}
            <div style={{ padding: "0 16px 8px" }}>
              <input ref={medSearchInputRef} value={medQuery} onChange={(e) => setMedQuery(e.target.value)} placeholder="Search medications"
                style={{ width: "100%", padding: "8px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            {allDailyMeds.length > 0 && (
              <div style={{ padding: "0 16px 12px", position: "relative" }}>
                <button onClick={logAllDaily} style={{ ...btnStyle(T.medsBlue, "outline"), width: "100%", padding: 10, opacity: dueDailyMeds.length === 0 ? 0.5 : 1 }}>
                  {bulkFlash ? <><Check size={14} /> Logged all daily meds</> : <><ListChecks size={14} /> {dueDailyMeds.length === 0 ? "All daily meds logged" : "Log all daily meds"}</>}
                </button>
                <div style={{ fontSize: 11, color: T.textDisabled, textAlign: "center", marginTop: 4 }}>
                  {dueDailyMeds.length > 0 ? `Includes: ${dueDailyMeds.map((m) => m.name.split(" (")[0]).join(", ")}` : "Nothing due right now"}
                </div>
                {bulkLockFlash && (
                  <div style={{ position: "absolute", bottom: "100%", left: 16, right: 16, marginBottom: 6, padding: "6px 10px", background: T.textPrimary, color: T.bg, fontSize: 11, fontWeight: 600, borderRadius: radius.sm, textAlign: "center" }}>
                    Locked{earliestBulkUnlock ? ` until ${earliestBulkUnlock}` : ""}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px 100px" }}>
              {activeMeds.map((med, idx) => {
                if (!matchesMedSearch(med)) return null;
                return (
                <div key={med.id} style={{ position: "relative", display: "flex", gap: 10 }}>
                  {selectMode && (
                    <div aria-hidden="true"
                      style={{ width: 22, height: 22, borderRadius: radius.full, border: `2px solid ${selectedIds.includes(med.id) ? T.medsBlue : T.border}`, background: selectedIds.includes(med.id) ? T.medsBlue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "flex-start", marginTop: 14, cursor: "pointer" }}>
                      {selectedIds.includes(med.id) && <Check size={13} color="#FFFFFF" />}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                    {/* Transparent overlay intercepts the tap while in
                        select mode, so the card's own dose-log/menu/
                        move buttons underneath never fire — the card
                        itself is completely untouched. This overlay is
                        also the one keyboard/screen-reader target for
                        the whole row in select mode — the decorative
                        circle above it is aria-hidden to avoid
                        announcing the same checkbox twice. */}
                    {selectMode && (
                      <div onClick={() => toggleSelected(med.id)} role="checkbox" aria-checked={selectedIds.includes(med.id)} aria-label={med.name} tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSelected(med.id); } }}
                        style={{ position: "absolute", inset: 0, zIndex: 5, cursor: "pointer" }} />
                    )}
                    <MedicationCard med={med} T={T} darkMode={darkMode} justCompleted={justCompleted?.id === med.id ? justCompleted.type : null} highlighted={highlightedId === med.id} searchHighlighted={searchHighlightedId === med.id}
                      cardRef={(el) => (cardRefs.current[med.id] = el)}
                      menuOpen={menuOpenId === med.id}
                      snoozedUntil={snoozedUntil[med.id]}
                      isFirst={idx === 0}
                      isLast={idx === activeMeds.length - 1}
                      onMoveUp={(id) => moveMedication(id, -1)}
                      onMoveDown={(id) => moveMedication(id, 1)}
                      onArchive={archiveMedication}
                      onDelete={deleteMedication}
                      onToggleMenu={(id) => setMenuOpenId((cur) => (cur === id ? null : id))}
                      onLogDose={logDose}
                      onLogRefill={(id) => setSheet({ med: meds.find((m) => m.id === id), mode: "refill" })}
                      onLogWaste={(id) => setSheet({ med: meds.find((m) => m.id === id), mode: "waste" })}
                      onCorrectStock={(id) => setSheet({ med: meds.find((m) => m.id === id), mode: "correct" })}
                      onMarkRequested={markRequested}
                      onOpenCorrection={(id, entry) => setCorrection({ med: meds.find((m) => m.id === id), entry })}
                      onEditMedication={(id) => setEditingMed(meds.find((m) => m.id === id))}
                      onUpdateDose={(id) => setUpdatingDose(meds.find((m) => m.id === id))}
                    />
                  </div>
                </div>
                );
              })}

              {archivedMeds.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div onClick={() => setShowArchived((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 0", fontSize: 13, color: T.textSecondary, fontWeight: 600 }}>
                    <Archive size={14} /> {showArchived ? "Hide" : "Show"} archived ({archivedMeds.length})
                  </div>
                  {showArchived && archivedMeds.map((med) => (
                    <div key={med.id} style={{ background: T.surfaceVariant, border: `1px solid ${T.border}`, borderRadius: radius.md, padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.textSecondary }}>{med.name}</div>
                        <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 2 }}>Archived — history kept in Log tab</div>
                      </div>
                      <div onClick={() => unarchiveMedication(med.id)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: T.medsBlue, cursor: "pointer" }}>
                        <ArchiveRestore size={14} /> Restore
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {tab === "Log" && <LogTab meds={meds} T={T} onOpenCorrection={(id, entry) => setCorrection({ med: meds.find((m) => m.id === id), entry })} />}
        {tab === "Inventory" && <InventoryTab meds={activeMeds} T={T} onEditMedication={(id) => setEditingMed(meds.find((m) => m.id === id))} onCorrectStock={(id) => setSheet({ med: meds.find((m) => m.id === id), mode: "correct" })} />}

        {sheet && sheet.mode !== "correct" && <QuantitySheet med={sheet.med} mode={sheet.mode} onConfirm={logQuantity} onClose={() => setSheet(null)} T={T} />}
        {sheet && sheet.mode === "correct" && (
          <StockCorrectionSheet med={sheet.med} currentStock={computeStock(sheet.med).currentStock} onConfirm={correctStock} onClose={() => setSheet(null)} T={T} />
        )}
        {correction && <CorrectionSheet med={correction.med} entry={correction.entry} onSave={saveCorrection} onVoid={voidCorrection} onClose={() => setCorrection(null)} T={T} />}
        {editingMed && <MedicationEditSheet med={editingMed} onSave={saveMedication} onClose={() => setEditingMed(null)} T={T} />}
        {/* ADDED 26 Aug 2026 — real ask: dose change as its own real action. */}
        {updatingDose && <UpdateDoseSheet med={updatingDose} onConfirm={confirmDoseUpdate} onClose={() => setUpdatingDose(null)} T={T} />}
        {addingMed && <AddMedicationSheet onCreate={createMedication} onClose={() => setAddingMed(false)} T={T} />}
        {dueReminder && <DoseReminderBanner med={dueReminder} onTake={takeReminder} onSnooze={snoozeReminder} onSkip={skipReminder} T={T} />}

        {/* CHANGED — same real width fix as the content column above.
            This box is `position: fixed` (relative to the viewport,
            not its parent), so it needs to independently center itself
            the same way — a fixed 390px would leave the FAB stranded
            at the old width's right edge once the content column
            itself can go wider than that. */}
        <div style={{ position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom))", left: 0, right: 0, maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
          <div onClick={() => setAddingMed(true)} style={{ width: 56, height: 56, borderRadius: radius.full, background: T.fabBg, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto", boxShadow: "0 2px 8px rgba(0,0,0,.25)", cursor: "pointer" }}><Plus size={24} color={T.fabIcon} /></div>
        </div>

        {/* CHANGED 18 Aug 2026 — removed this module's own static, non-
            functional bottom bar (it only ever showed "Medication" as
            active, regardless of which module was actually on screen —
            the exact inconsistency the user flagged: this bar existed here
            but not on Contacts/Activity, so it never persisted across
            switching). The real persistent nav now lives once, in
            App.jsx, shared across every module — its visual design
            (Home/Contacts/Activity/Medication/Healthcare) is exactly
            what this mockup already showed, just made functional. */}
      </div>

      {showMedicationSettings && (
        <MedicationSettingsScreen T={T} onClose={() => setShowMedicationSettings(false)} onOpenGeneralSettings={() => { setShowMedicationSettings(false); onOpenSettings?.(); }} />
      )}
      {/* ADDED 26 Aug 2026 — real ask: undo for delete. */}
      {deleteToast && (
        <div onClick={deleteToast.mode === "undo" ? undoDelete : redoDelete}
          style={{ position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom))", left: 20, right: 20, maxWidth: 560, margin: "0 auto", background: "#1B1B1F", color: "#FFFFFF", padding: "12px 16px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", zIndex: 40, boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
          <span style={{ fontSize: 13 }}>
            {deleteToast.mode === "undo"
              ? `${deleteToast.records.length} medication${deleteToast.records.length > 1 ? "s" : ""} deleted`
              : `${deleteToast.records.length} medication${deleteToast.records.length > 1 ? "s" : ""} restored`}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.medsBlue }}>
            {deleteToast.mode === "undo" ? "Tap to undo" : "Tap to redo"}
          </span>
        </div>
      )}
    </div>
  );
}
