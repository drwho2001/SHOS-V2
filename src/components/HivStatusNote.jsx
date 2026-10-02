// HivStatusNote.jsx
//
// ONE component for the U=U note, so the three rules that make it safe are
// structural rather than a convention each screen has to remember.
//
// THE THREE RULES.
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
// 3. It is TAPPABLE and opens the evidence, on every record, including the
//    expand/collapse itself. The owner asked for this on 2 Oct 2026: the
//    realistic audience for being told "undetectable = untransmittable" is often
//    someone who does not believe it, and the failure mode this app most needs to
//    survive is a clinician working from the 1990s framing. A bare assertion
//    invites argument; a reference invites a check.
//
// IT IS UI, NOT DATA: the text lives in hivStatusCalculations.js and is NOT
// carried inside an exported profile, so there is one copy and exports cannot
// carry a stale duplicate.
//
// WHY THE EXPAND IS INLINE RATHER THAN A LINK TO THE GLOSSARY: the `onOpen`
// prop for "go to the fuller explanation" was built on day one and has never
// been passed by any call site, because reaching the Glossary from inside a
// Contacts or My Profile sheet needs navigation threaded through both modules.
// Rather than ship a fourth rule that every new screen has to remember ("pass
// onOpen"), the component is self-sufficient: it always expands in place, and
// STILL honours `onOpen` for a caller that can navigate somewhere better.
import { useState } from "react";
import { U_U_SHORT, U_U_EXPLANATION, U_U_SOURCES } from "../calculations/hivStatusCalculations";
import { InfoIcon, CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";

/**
 * @param {object} T theme tokens
 * @param {string} label the field's own label, so the note reads as being about
 *   that field rather than floating unattached
 * @param {() => void} [onOpen] optional: called INSTEAD of expanding inline, for
 *   a caller that can navigate to the full Glossary entry
 */
export function HivStatusNote({ T, label = "HIV status", onOpen }) {
  const [open, setOpen] = useState(false);

  const summary = (
    <>
      <InfoIcon size={11} color={T.textDisabled} />
      {U_U_SHORT}
    </>
  );

  // A caller that can navigate gets that; otherwise expand here. Both paths are
  // reachable by keyboard and both are available on every record.
  const trigger = onOpen
    ? { role: "button", tabIndex: 0, onClick: onOpen }
    : {
        role: "button",
        tabIndex: 0,
        "aria-expanded": open,
        onClick: () => setOpen((v) => !v),
      };

  return (
    <div style={{ padding: "2px 0 6px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span
          {...trigger}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (onOpen) onOpen();
              else setOpen((v) => !v);
            }
          }}
          aria-label={
            onOpen
              ? `About ${label}: what undetectable means. Opens the full explanation.`
              : `About ${label}: what undetectable means. ${open ? "Hides" : "Shows"} the evidence and sources.`
          }
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
          {summary}
        </span>
        {!onOpen && (
          <span
            role="button"
            tabIndex={0}
            aria-hidden="true"
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen((v) => !v);
              }
            }}
            style={{ display: "inline-flex", alignItems: "center", color: T.textDisabled, cursor: "pointer", flexShrink: 0 }}
          >
            {open ? <CaretUpIcon size={10} color={T.textDisabled} /> : <CaretDownIcon size={10} color={T.textDisabled} />}
          </span>
        )}
      </div>

      {open && !onOpen && (
        <div
          style={{
            marginTop: 6,
            paddingLeft: 17,
            fontSize: 11,
            lineHeight: 1.45,
            color: T.textSecondary,
          }}
        >
          <div>{U_U_EXPLANATION}</div>
          <div style={{ marginTop: 6 }}>
            Sources, if you want to check this rather than take the app&apos;s word for it:
          </div>
          <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
            {U_U_SOURCES.map((s) => (
              <li key={s.url} style={{ marginBottom: 3 }}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: T.textSecondary, textDecoration: "underline", textUnderlineOffset: 2 }}
                >
                  {s.label}
                </a>{" "}
                <span style={{ color: T.textDisabled }}>({s.publisher})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default HivStatusNote;