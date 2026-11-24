// TabStickyHeader.jsx
//
// BACKLOG 0b — the second band: the per-tab sticky header that sits below
// the module banner and holds Tab-specific actions (Add / Filter / Sort /
// Export) rather than module-wide ones.
//
// The 24 Nov audit found no module implemented this fully. The closest
// structural skeleton was SHOS_ClinicVisits_Prototype.jsx:1854 (banner +
// sticky-header offset, compact 10px/16px/4px padding) and the best
// action cluster was SHOS_Encounters_Prototype.jsx:1692. This component
// owns the shared geometry and the single offset token so those two
// cannot drift apart again; call sites supply their own controls in
// `children` and are migrated one module at a time.
//
// STICKY_SUBHEADING_TOP is imported, not retyped: stickySubheadingGuard
// walks all of src/ and fails a hardcoded safe-area offset.
import React from "react";
import { STICKY_SUBHEADING_TOP } from "../calculations/designTokens";

export function TabStickyHeader({ children, background, ariaLabel, zIndex = 6, padding = "10px 16px 4px" }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        position: "sticky",
        top: `calc(var(--shos-top-banner-h, 0px) + ${STICKY_SUBHEADING_TOP})`,
        zIndex,
        background: background || "transparent",
        padding,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {children}
    </div>
  );
}

export default TabStickyHeader;
