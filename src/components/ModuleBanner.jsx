// ModuleBanner.jsx
//
// BACKLOG 0b — one owner for the module title banner.
//
// The 24 Nov audit found SHOS_Medication_Dashboard_Prototype.jsx:2472-2489
// was already the standard every other module was drifting away from:
// a sticky band at --shos-top-banner-h, the safe-area inset moved into
// the band's own top padding (with a matching bottom margin so the next
// row keeps its layout position), a module-colour fill, and one icon
// cluster in a fixed order. Contacts had six controls and an inline
// search, Encounters and Healthcare had no banner search at all.
//
// This component owns that structure and the order:
//   Search -> Select -> module-specific actions -> Settings -> Quick Exit
// Quick Exit stays the LAST control: it is a safety affordance and must
// be in the same place on every screen. Colour is the only thing a call
// site varies (each module has its own accent).
//
// `children` is the optional second band (the per-tab tablist) inside the
// same sticky wrapper, so the banner and tabs never separate on scroll.
import React from "react";
import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react";
import QuickExitButton from "./QuickExitButton";
import { TYPE } from "../calculations/designTokens";

export function ModuleBanner({
  title,
  accent,
  bg,
  onSearch,
  searchLabel,
  select,
  extras,
  settings,
  onQuickExit,
  children,
}) {
  return (
    <div style={{
      position: "sticky",
      top: "var(--shos-top-banner-h, 0px)",
      zIndex: 6,
      background: bg,
      borderBottom: "1px solid rgba(0,0,0,0.08)",
      borderRadius: "0 0 16px 16px",
      overflow: "hidden",
      marginTop: "calc(-1 * env(safe-area-inset-top))",
      marginBottom: "env(safe-area-inset-top)",
    }}>
      <div style={{
        background: accent,
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        borderRadius: "0 0 16px 16px",
        padding: "calc(16px + env(safe-area-inset-top)) 16px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <h1 style={{ ...TYPE.screenTitle, margin: 0, color: "#FFFFFF" }}>{title}</h1>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {onSearch && (
            <Search
              size={24}
              color="#FFFFFF"
              style={{ cursor: "pointer", padding: 10, boxSizing: "content-box", marginTop: -10, marginRight: -10, marginBottom: -10, marginLeft: -10 }}
              onClick={onSearch}
              role="button"
              tabIndex={0}
              aria-label={searchLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSearch();
                }
              }}
            />
          )}
          {select}
          {extras}
          {settings}
          {onQuickExit && <QuickExitButton onQuickExit={onQuickExit} color="#FFFFFF" />}
        </div>
      </div>
      {children && <div style={{ background: bg, padding: "6px 16px 0" }}>{children}</div>}
    </div>
  );
}

export default ModuleBanner;
