import { useState, useEffect } from "react";

// Real width-aware responsive primitive (#93, 15-16 Sep 2026) — the
// one place this app hooks a desktop-only UI branch into. A live,
// resize-aware `window.innerWidth >= 900` check, not a guessed pixel
// threshold. Originally built inside SHOS_Home_Prototype.jsx for the
// "Home shortcuts on desktop" round, promoted here once a second file
// (Settings' Guide/Glossary screens) needed the same check, per that
// item's own #93 design doc — relocating already-working code, no
// behavior change.
//
// Every consumer's own contract, non-negotiable given two prior
// zoom/transform-scale regressions that broke mobile: this hook only
// ever gates an ADDITIVE desktop-only branch. The mobile (< 900px)
// render path must stay byte-for-byte identical to what it was before
// a consumer started using this hook — never restyle the existing
// branch "for both," always add a new one.
export function useIsDesktopWidth() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 900);
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isDesktop;
}
