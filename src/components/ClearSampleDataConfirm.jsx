import React from "react";
import ConfirmDeleteCard from "./ConfirmDeleteCard";

/**
 * The confirmation for "Clear sample data" - the app's made-up example data.
 *
 * WHY IT EXISTS. Clearing the sample data is one tap, in a medical app, over
 * records the user may never have looked at closely - and until this, the
 * only thing on screen was a COUNT. A count says how much; a list says WHAT,
 * and WHAT is the thing a person can check: "is any of this mine?".
 *
 * WHY IT IS A SHARED COMPONENT rather than one copy in each of the two
 * surfaces that offer the action (Home's first-run banner and Settings ->
 * Support -> Developer tools). Both would render the same list from the same
 * data, and a copy that drifted - one showing names, one showing counts -
 * would be the kind of near-duplication this repo has been bitten by before.
 *
 * IT REUSES THE APP'S ONE SHARED DELETE-CONFIRMATION COMPONENT
 * (ConfirmDeleteCard), so the confirmation's semantics - role="alertdialog",
 * focus moved to Cancel on open, Escape maps to cancel - are the same
 * everywhere else in the app rather than a second pattern.
 *
 * THE LIST SCROLLS. There are around a hundred demo records on a fresh
 * install, and a list that pushes the Cancel button off the screen would be
 * a confirmation nobody can cancel.
 */
export default function ClearSampleDataConfirm({
  T,
  groups,
  total,
  onCancel,
  onConfirm,
  busy = false,
  moduleColor,
}) {
  const list = Array.isArray(groups) ? groups : [];
  return (
    <ConfirmDeleteCard
      T={T}
      moduleColor={moduleColor}
      confirmLabel={busy ? "Removing…" : `Remove these ${total} records`}
      onCancel={onCancel}
      onConfirm={onConfirm}
      message={
        <>
          <div>
            This removes the app&apos;s made-up example data — the records below, and nothing
            else. Anything you have added yourself is always kept.
          </div>
          <div
            style={{
              marginTop: 8,
              maxHeight: 210,
              overflowY: "auto",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "6px 8px",
              background: T.surface,
            }}
          >
            {list.map((group) => (
              <div key={group.name} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary }}>
                  {group.name} ({group.count})
                </div>
                <ul style={{ margin: "2px 0 0", paddingLeft: 16 }}>
                  {group.records.map((r) => (
                    <li key={r.id} style={{ fontSize: 12, color: T.textPrimary, lineHeight: 1.45 }}>
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      }
    />
  );
}
