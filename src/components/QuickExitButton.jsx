// QuickExitButton.jsx
//
// BACKLOG 0b — one owner for the Quick Exit control's treatment.
//
// The audit line "Home 4 icons vs Encounter 2 vs Healthcare 1" was challenged
// and rejected as a defect: those screens genuinely have different actions
// (Home has search/profile/settings, Encounter has Select), and inventing
// matching icons would be dishonest decoration. What WAS genuinely broken is
// the one action every top bar shares — Quick Exit, a SAFETY control — which
// had drifted into five different renders: bold/regular weight, 32px vs 44px
// hit targets, a hover title on only some, and a hardcoded English label on
// most. A safety affordance must look and behave identically everywhere.
//
// This component owns: size, weight, a 44px touch target, role/tabIndex/keyboard,
// a translated label used for BOTH aria-label and title, and the tour hook.
// Only `color` varies by call site, because Home's header is unfilled (dark
// text) while the module banners are filled (white text) — a real constraint,
// not drift. No raw colour literals, so styleColourGuard needs no baseline.
import { SignOutIcon as SignOut } from "@phosphor-icons/react";
import { useTranslation } from "../i18n/index.js";

export function QuickExitButton({ onQuickExit, color, tourId }) {
  const { t } = useTranslation();
  const label = t("home.quickExit", "Quick exit");
  return (
    <SignOut
      data-tour={tourId}
      size={24}
      weight="bold"
      color={color}
      role="button"
      tabIndex={0}
      title={label}
      aria-label={label}
      onClick={onQuickExit}
      // padding 10 + a 24px glyph = a 44px touch target, the minimum for a
      // control someone may need to hit fast under stress. The negative margin
      // keeps that extra padding from changing the banner's visual height.
      style={{ cursor: "pointer", padding: 10, margin: "-10px 0" }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onQuickExit();
        }
      }}
    />
  );
}

export default QuickExitButton;
