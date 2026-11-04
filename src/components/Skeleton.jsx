// Skeleton.jsx
//
// C20 - loading states rendered a bare "Loading..." string, which does not
// preserve the final layout shape the manual (§10.5) asks for.
//
// Deliberately small: a SkeletonRow matches ONE list row (the shape most of
// these screens actually load), and SkeletonBlock is the escape hatch for a
// card. Both are presentational, theme-aware through `T` (same convention as
// SectionCard/EmptyState), and respect reduced motion by dropping the pulse.
//
// The pulse is an inline @keyframes injected once, because this codebase has
// no CSS file to add a class to and inline <style> is the only option that
// works in the APK WebView and the PWA alike.

import React from "react";
import { RADIUS } from "../calculations/designTokens.js";

const PULSE_STYLE_ID = "shos-skeleton-pulse";

function usePulse() {
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(PULSE_STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = PULSE_STYLE_ID;
    el.textContent =
      "@keyframes shosSkeletonPulse{0%,100%{opacity:1}50%{opacity:.55}}";
    document.head.appendChild(el);
  }, []);
}

export function SkeletonRow({ T, reducedMotion, width = "100%", height = 14 }) {
  usePulse();
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: RADIUS.sm,
        background: T.surfaceVariant,
        animation: reducedMotion ? "none" : "shosSkeletonPulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

export function SkeletonList({ T, reducedMotion, rows = 4, gap = 12, rowHeight = 14 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, padding: "12px 16px" }} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow
          key={i}
          T={T}
          reducedMotion={reducedMotion}
          height={rowHeight}
          width={i === rows - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}

export default SkeletonList;
