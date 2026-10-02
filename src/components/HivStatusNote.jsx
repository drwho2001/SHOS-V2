// HivStatusNote.jsx
//
// ONE component for the U=U note, so the three rules that make it safe are
// structural rather than a convention each screen has to remember.
//
// THE THREE RULES.
//
// 1. It appears on EVERY record, whatever the status. A note that appeared only
//    where the status was positive-undetectable would itself disclose: its
//    presence would flag who is HIV-positive. Uniformity is the privacy
//    mechanism, not a cosmetic choice. There is deliberately no `status` prop for
//    a caller to gate on.
//
// 2. It reads as "U=U", NOT as a claim about whoever the row belongs to. The
//    underline is the affordance that says "this is a link"; the info bubble
//    beside it says "there is a sentence here too". Keeping it to four
//    characters is what makes rule 1 cheap enough to obey everywhere.
//
// 3. The sentence is NOT permanently visible. An earlier version rendered the
//    whole line — "An undetectable viral load (below 50 copies/mL) prevents
//    sexual transmission of HIV." — on every record, which is a wall of text
//    beside a field the reader did not ask about. Tapping the bubble reveals
//    it. The fuller explanation and the citations live in the Glossary, which
//    is what the underlined "U=U" opens: clinical evidence belongs in the place
//    people look it up, not inside a row control.
//
// It attaches to the HIV Status LABEL rather than floating under the value,
// because a note sitting beneath a value reads as a property of that value.
//
// It is UI, not data: the text lives in hivStatusCalculations.js and is NOT
// carried inside an exported profile, so there is one copy and exports cannot
// carry a stale duplicate.
import { useState } from "react";
import { U_U_SHORT } from "../calculations/hivStatusCalculations";
import { InfoIcon } from "@phosphor-icons/react";

/**
 * @param {object} T theme tokens
 * @param {string} label the field's own label, so the note reads as being about
 *   that field rather than floating unattached
 * @param {() => void} onOpen opens the Glossary's U=U entry, which carries the
 *   full explanation and the sourced citations
 */
export function HivStatusNote({ T, label = "HIV status", onOpen }) {
  const [showSentence, setShowSentence] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "2px 0 6px" }}>
      {/* The bubble: reveals the one-sentence statement. aria-expanded because it
          is a disclosure, not a button that navigates. */}
      <span
        role="button"
        tabIndex={0}
        aria-expanded={showSentence}
        aria-label={`About ${label}: what undetectable means.`}
        onClick={() => setShowSentence((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setShowSentence((v) => !v);
          }
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
          cursor: "pointer",
          color: showSentence ? T.textSecondary : T.textDisabled,
          lineHeight: 1.2,
        }}
      >
        <InfoIcon size={12} color={showSentence ? T.textSecondary : T.textDisabled} />
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Underlined because it IS the link. Not a button that happens to look
            like one — it opens the Glossary entry, same as any other link here. */}
        <button
          type="button"
          onClick={onOpen}
          aria-label="U=U (undetectable equals untransmittable). Opens the full explanation and its sources."
          style={{
            background: "none",
            border: "none",
            padding: 0,
            margin: 0,
            font: "inherit",
            fontSize: 11,
            lineHeight: 1.35,
            color: T.textSecondary,
            textDecoration: "underline",
            textUnderlineOffset: 2,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          U=U
        </button>

        {showSentence && (
          <span style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.35 }}>{U_U_SHORT}</span>
        )}
      </div>
    </div>
  );
}

export default HivStatusNote;