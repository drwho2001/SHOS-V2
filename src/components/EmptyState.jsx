// EmptyState.jsx
//
// C19 - list-level empty states were a single bare line of text, repeated at
// ~15 sites across the modules: same padding, same colour, same font size,
// typed out fresh each time, and none of them had the icon + sentence +
// optional action the manual (§10.5) asks for.
//
// SCOPE, stated so this does not overreach: this is for LIST-LEVEL empty
// states (no contacts, no encounters, no visits logged). Field-level
// placeholders - "No notes yet" inside a form section - are a different
// category and deliberately stay as they are; an icon there would be noise.
//
// It reads `T` (the active theme) as a prop rather than hooking a theme
// itself, matching SectionCard and every caller in this codebase. `icon`
// takes a Phosphor element because the modules own their own icon imports
// and aliases; this component must not add a second import convention.
//
// Defaults reproduce the exact geometry the old inline divs used
// (padding 40/20, 13px, textDisabled), and a neutral Tray glyph is shown
// when no `icon` is passed - so a migrated site gains an icon but keeps its
// previous spacing, colour and size. Pass `icon={null}` to render no glyph.

import React from "react";
import { FONT_FAMILY, RADIUS, TYPE } from "../calculations/designTokens.js";
import { TrayIcon as Tray } from "@phosphor-icons/react";

export default function EmptyState({ T, icon, message, actionLabel, onAction, padding = "40px 20px" }) {
  const hasAction = Boolean(actionLabel && onAction);
  const glyph = icon === undefined ? <Tray size={32} /> : icon;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding,
        fontFamily: FONT_FAMILY,
      }}
    >
      {glyph ? (
        <div style={{ marginBottom: 10, color: T.textDisabled, display: "flex" }} aria-hidden="true">
          {glyph}
        </div>
      ) : null}
      <div style={{ ...TYPE.caption, fontSize: 13, color: T.textDisabled, maxWidth: 420 }}>{message}</div>
      {hasAction ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 12,
            padding: "8px 14px",
            minHeight: 44,
            borderRadius: RADIUS.sm,
            border: `1px solid ${T.border}`,
            background: T.surfaceVariant,
            color: T.textPrimary,
            fontFamily: FONT_FAMILY,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
