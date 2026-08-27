// editUndoHelpers.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, the user's own example: edit an Encounter (change the date,
// change who was there), save it, realise it was wrong — should be
// able to undo back to what it was, and redo to reapply the edit if
// undo turns out to be the mistake. Same toast-based pattern already
// proven in Medication's dose-log undo — this is the SAME mechanism,
// generalized into one shared hook so Contacts, Encounters, and
// whatever else needs it later don't each reinvent it slightly
// differently.
//
// SCOPE, deliberately matching what's already built and what the user
// asked for — not expanded past it:
// - SINGLE-STEP only, same as Medication's own undo/redo. Not a full
//   multi-level history stack — that's real added complexity for a
//   benefit the user didn't ask for, and risks becoming exactly the kind
//   of over-built feature flagged earlier this session as worth
//   pushing back on.
// - Scoped to ONE module/page at a time, per the user's explicit
//   instruction ("undo redo should apply only within that module/
//   page"). Each module gets its OWN `useEditUndo()` call with its own
//   toast state — there is no shared, cross-module undo stack, and
//   this hook doesn't create one.
// - Covers EDITS to an existing record (the user's actual example — change
//   a field, save, undo). Does NOT cover undoing a brand-new record's
//   creation (that's what Archive already exists for) or a delete
//   (already staged via the existing archive/unarchive pattern
//   everywhere in this app, which IS already a form of undo).
//
// HOW IT WORKS: capture the record's state right BEFORE an edit is
// saved (`captureBeforeEdit`), then immediately after the save
// completes (`notifyEdited`) show an "undo" toast for a few seconds —
// tapping it restores the pre-edit snapshot via a normal update() call
// (a full-object merge, so every field goes back to exactly what it
// was). Once undone, a "redo" toast appears, restoring the post-edit
// version the same way. Nothing here is a new storage mechanism — it's
// just two React refs and two ordinary repository.update() calls.
import { useState, useRef } from "react";

export function useEditUndo(repository, onChanged) {
  const [toast, setToast] = useState(null); // { mode: "undo" | "redo", recordId }
  const preEditSnapshot = useRef(null);      // { id, data } — state right before the edit
  const postEditSnapshot = useRef(null);     // { id, data } — state right after the edit
  const timeoutRef = useRef(null);

  // Call this right before applying the edit (before repository.update()
  // runs), passing the record's id — captures what it looked like
  // BEFORE the change so undo has something real to restore.
  function captureBeforeEdit(id) {
    const current = repository.getById(id);
    preEditSnapshot.current = current ? { id, data: current } : null;
  }

  // Call this right after the edit has been saved. Shows the "tap to
  // undo" toast for 8 seconds — same window Medication's own undo
  // toast already uses, kept consistent rather than picking a new
  // number.
  function notifyEdited(id) {
    const after = repository.getById(id);
    postEditSnapshot.current = after ? { id, data: after } : null;
    setToast({ mode: "undo", recordId: id });
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setToast((t) => (t?.recordId === id && t.mode === "undo" ? null : t));
    }, 8000);
  }

  function undo() {
    if (!preEditSnapshot.current) return;
    const { id, data } = preEditSnapshot.current;
    repository.update(id, data);
    onChanged?.();
    clearTimeout(timeoutRef.current);
    setToast({ mode: "redo", recordId: id });
  }

  function redo() {
    if (!postEditSnapshot.current) return;
    const { id, data } = postEditSnapshot.current;
    repository.update(id, data);
    onChanged?.();
    setToast(null);
  }

  return { toast, captureBeforeEdit, notifyEdited, undo, redo };
}
