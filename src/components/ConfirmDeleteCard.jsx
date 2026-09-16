import React, { useEffect, useId, useRef } from "react";
import { RADIUS } from "../calculations/designTokens";

// Shared delete-confirmation UI, extracted from a real live audit finding
// (10 Sep 2026): three different confirmation patterns had accumulated
// across modules for the exact same action — a native window.confirm()
// dialog (the majority, ~12 sites across 9 files), a custom inline card
// (independently built, near-identically, in both MenstrualHealth and
// Timeline — the strongest signal this shape was already the app's own
// right answer, just never centralised), and an inline Cancel/Delete
// button-swap (PartnerNotification). Standardised on the inline-card
// shape rather than a modal, since it's the one two different modules
// had already converged on independently, and it's less jarring than a
// full-screen overlay for what's usually a single-item action.
// `moduleColor` ties the card back to whichever module triggered it (a
// left accent stripe + the Cancel button's own colour) — the actual
// danger cues (border, background tint, Confirm button) stay a
// universal red regardless of module, since "this is destructive" is a
// safety signal that shouldn't vary by context.
export default function ConfirmDeleteCard({
  T,
  moduleColor,
  message = "This permanently deletes the record — unlike archiving, there's no getting it back.",
  confirmLabel = "Delete permanently",
  margin = "0 16px 12px",
  onCancel,
  onConfirm,
}) {
  const accent = moduleColor || T.actionRed;
  // ADDED — real gap found via a follow-up axe-core scan on a live
  // sheet interaction (16 Sep 2026): this card, used for every real
  // destructive delete across ~15 sites app-wide, had no dialog
  // semantics and never moved focus when it appeared — a keyboard or
  // screen-reader user got no signal a destructive confirmation had
  // just opened, unlike the undo/redo toasts an earlier pass already
  // fixed for the same class of gap. role="alertdialog" plus
  // aria-describedby (not aria-live alone) is the standard pattern for
  // a real Yes/No confirmation — it also solves "where am I now" by
  // moving focus onto Cancel (the safer default action) the moment
  // this mounts, not just announcing it. One fix here reaches every
  // call site automatically, since this is the app's one shared
  // delete-confirmation component.
  const cancelRef = useRef(null);
  // useId(), not a static string — this component is mounted at ~15
  // sites, and a static id would collide if two instances were ever
  // rendered at once (a bulk-toolbar delete alongside a single-item
  // one, for instance).
  const messageId = useId();
  useEffect(() => { cancelRef.current?.focus(); }, []);
  return (
    <div
      role="alertdialog"
      aria-label={confirmLabel}
      aria-describedby={messageId}
      style={{
        margin,
        padding: 14,
        borderRadius: RADIUS.md,
        border: `1px solid ${T.actionRed}`,
        borderLeft: `4px solid ${accent}`,
        background: `${T.actionRed}11`,
      }}
    >
      <div id={messageId} style={{ fontSize: 13, color: T.textPrimary, marginBottom: 10, lineHeight: 1.5 }}>{message}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          ref={cancelRef}
          onClick={onCancel}
          style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${accent}`, background: "transparent", color: accent, fontWeight: 600, cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.actionRed, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
