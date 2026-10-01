// HivStatusNote.jsx
//
// ONE component for the U=U note, so the two rules that make it safe are
// structural rather than a convention each screen has to remember.
//
// THE TWO RULES.
//
// 1. It attaches to the HIV Status LABEL, never floats under the status value.
//    A note sitting directly beneath "Status: Unknown" reads as a claim about
//    that person ("why are you telling me this about someone whose status I
//    don't know?"). Attached to the label, it reads as reference material about
//    the field, which is what it is. That is a layout decision, and layouts are
//    the thing every screen gets differently - so it lives here once.
//
// 2. It appears on EVERY record, whatever the status. A note that appeared only
//    where the status was positive-undetectable would itself disclose: its
//    presence would flag who is HIV-positive. Uniformity is the privacy
//    mechanism, not a cosmetic choice. There is deliberately no `status` prop for
//    a caller to gate on.
//
// It is UI, not data: the text lives in hivStatusCalculations.js and is NOT
// carried inside an exported profile, so there is one copy and exports cannot
// carry a stale duplicate.
import { U_U_SHORT } from "../calculations/hivStatusCalculations";
import { InfoIcon } from "@phosphor-icons/react";

/**
 * @param {object} T theme tokens
 * @param {string} label the field's own label, so the note reads as being about
 *   that field rather than floating unattached
 * @param {() => void} [onOpen] opens the fuller explanation / Glossary
 */
export function HivStatusNote({ T, label = "HIV status", onOpen }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "2px 0 6px" }}>
      {onOpen ? (
        <span
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen();
            }
          }}
          aria-label={`About ${label}: what undetectable means. Opens the full explanation.`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            fontSize: 11,
            color: T.textSecondary,
            lineHeight: 1.35,
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          <InfoIcon size={11} color={T.textDisabled} />
          {U_U_SHORT}
        </span>
      ) : (
        // No handler (e.g. a PDF or a print-oriented surface): still shown, so
        // the rule that it appears everywhere is not quietly broken.
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: T.textSecondary, lineHeight: 1.35 }}>
          <InfoIcon size={11} color={T.textDisabled} />
          {U_U_SHORT}
        </span>
      )}
    </div>
  );
}

export default HivStatusNote;