// JargonNote.jsx
//
// A tap-to-reveal explanation for one piece of jargon, for use at the POINT OF
// USE. It exists because the Glossary defines these terms properly and the forms
// still used them bare - a PrEP dropdown offering "Event-based (2-1-1)" and a
// role chip set offering "Vers" with no definition within reach of the tap.
//
// THE THREE RULES, EACH EARNED BY A FAILURE SOMEWHERE ELSE IN THIS REPO.
//
// 1. It is a DISCLOSURE, not a button that navigates. aria-expanded, not a link.
//    HivStatusNote.jsx already solves this shape for U=U and the same rules hold:
//    the fuller entry and its citations live in the Glossary, and this component
//    is what makes that arrangement reachable from a form.
//
// 2. It is NEVER PERMANENTLY VISIBLE. The U=U note once rendered its whole
//    paragraph on every record and was reverted; a note that is always on is a
//    note nobody reads, and five of them turn a form into prose. Hence the
//    bubble, hence the one-sentence bound enforced by jargonNoteCoverage.test.js.
//
// 3. It is UNCONDITIONAL AND CARRIES NO STATE. Nothing here is gated on a value,
//    and no note text refers to a particular record. A conditional explanation
//    would disclose by its own presence - the same argument that makes the U=U
//    note appear on every row rather than only on the rows it describes.
//
// WHY NOT A TITLE ATTRIBUTE. medicationCalculations.js records that a `title`
// tooltip only shows on hover, and this app targets touchscreens. The icon-only
// audit rule in CLAUDE.md says the same. A bubble is the affordance that exists
// on a phone, so the bubble is the affordance here.
//
// WHY THE PROP IS `theme` AND NOT `T`, when every other themed component in this
// repo takes `T`. jsxComponentBindingGuard.test.js treats a capitalised JSX name
// as a component reference, so `T={...}` is only legal where a `T` is also
// destructured from props - which is true of every module except Home, and false
// of Home. The first version of this passed `T` and the guard rejected it, which
// is the guard working: the alternative was to add a name to that guard's
// allowlist to accommodate one new call site. Lowercase `theme` is not a
// component reference, so the collision disappears and no shared guard changes.
import { useState } from "react";
import { InfoIcon } from "@phosphor-icons/react";
import { JARGON_NOTES } from "../calculations/jargonNotes";

/**
 * @param {object} theme designTokens, light or dark
 * @param {string} noteKey key into JARGON_NOTES - a component takes no free text,
 *   so every explanation is the shared copy in jargonNotes.js rather than a
 *   re-worded per-screen copy
 * @param {string} label the field or value the note sits beside, used in the
 *   accessible name so a screen reader says what it is about
 * @param {() => void} onOpen opens the Glossary entry carrying the full text and
 *   its sources; optional, and the note is still useful without it
 */
export function JargonNote({ theme, noteKey, label, onOpen }) {
  const [open, setOpen] = useState(false);
  const note = JARGON_NOTES[noteKey];

  // An unknown key is a programming error, not a rendering condition. Returning
  // the raw key would put "prep-2-1-1" on screen, so this fails loudly instead -
  // and jargonNoteCoverage.test.js asserts every key passed by a screen exists.
  if (!note) throw new Error(`JargonNote: unknown noteKey "${noteKey}"`);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "0 0 4px" }}>
      <span
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`What does "${label}" mean?`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
          cursor: "pointer",
          color: open ? theme.textSecondary : theme.textDisabled,
          lineHeight: 1.2,
          // A 20px hit target. The icon is 12px, which on its own is below the
          // threshold a fingertip can reliably land on.
          padding: 4,
          margin: "-4px 0 0 -4px",
        }}
      >
        <InfoIcon size={12} color={open ? theme.textSecondary : theme.textDisabled} />
      </span>

      <span style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.35 }}>
        {open && note}
        {/* The Glossary link appears only once the sentence is showing, so a
            collapsed note is one quiet icon rather than icon-plus-link. */}
        {open && onOpen && (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open the Glossary entry for ${label}.`}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              margin: "0 0 0 4px",
              font: "inherit",
              fontSize: 11,
              lineHeight: 1.35,
              color: theme.textSecondary,
              textDecoration: "underline",
              textUnderlineOffset: 2,
              cursor: "pointer",
            }}
          >
            Glossary
          </button>
        )}
      </span>
    </div>
  );
}

export default JargonNote;