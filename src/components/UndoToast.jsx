// UndoToast.jsx
//
// One implementation of the "N things deleted — Tap to undo" bar that every
// module with a bulk delete has been re-typing by hand: Contacts, Encounters,
// Clinic Visits, Measurements, Medication, Symptom Log, Testing, Vaccinations
// and Menstrual Health (Cycle / Contraception / Pregnancy). Nine copies, all
// byte-identical in their styling, which is exactly the signal the repo's own
// rule asks for: a shape repeated across modules is a shape that should be
// shared, not a coincidence.
//
// WHY THIS IS A COMPONENT AND NOT A COPY-PASTE NOTE. The nine hand-written
// copies had already drifted in ways nobody would ever spot by eye:
//
//   - Encounters' copy had lost `minHeight: 44`, so its undo bar was the only
//     one in the app that failed the 44px touch-target rule.
//   - The copies that had an `aria-label` set it to a bare "Undo delete" /
//     "Redo delete". An aria-label REPLACES the accessible name, so a screen
//     reader user was told "Undo delete" and never heard what was deleted or
//     how many. The two copies without an aria-label (Contacts, Medication)
//     behaved correctly, i.e. the "improvement" was the regression.
//   - The bar's own surface (`#1B1B1F`) was a raw literal at nine sites, so a
//     future toast-colour change would have had to find all nine.
//
// Deliberate choice: NO aria-label. The bar's visible text is the accessible
// name ("3 visits deleted, Tap to undo"), which is the useful sentence. The
// `aria-live="polite"` region announces it as it appears, which is the part
// the old copies got right and is kept.
//
// Props are resolved strings, not keys, because each module owns its own copy
// (and Testing owns translated ones) - this component must not acquire a
// second i18n convention on top of the one the modules already use.
import React from "react";
import { FONT_FAMILY, RADIUS, TOAST, TYPE } from "../calculations/designTokens";

export default function UndoToast({ mode = "undo", message, actionLabel, accentColor, onAction }) {
  if (!message) return null;
  const label = actionLabel || (mode === "undo" ? "Tap to undo" : "Tap to redo");
  return (
    <div
      onClick={onAction}
      role="button"
      tabIndex={0}
      aria-live="polite"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAction?.();
        }
      }}
      style={{
        position: "fixed",
        bottom: "calc(90px + env(safe-area-inset-bottom))",
        left: 20,
        right: 20,
        maxWidth: 560,
        margin: "0 auto",
        background: TOAST.surface,
        color: TOAST.text,
        padding: "12px 16px",
        borderRadius: RADIUS.md,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        // 44px floor: this is a real tap target, not a passive banner.
        minHeight: 44,
        zIndex: 40,
        boxShadow: "0 4px 16px rgba(0,0,0,.3)",
        fontFamily: FONT_FAMILY,
      }}
    >
      <span style={{ fontSize: TYPE.control.fontSize }}>{message}</span>
      <span style={{ fontSize: TYPE.control.fontSize, fontWeight: 700, color: accentColor, flexShrink: 0 }}>{label}</span>
    </div>
  );
}
