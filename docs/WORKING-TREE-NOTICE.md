# NOTICE — for any session working in this working tree

**Written 28 Sep 2026. Please read before your next commit.**

## What happened

A second session added the Clinic Card PDF test and ran `git add -A src` before
committing. That swept up **862 lines of another session's uncommitted work** —
a reminder-suppression feature — and committed it under a message about the PDF
test instead.

**Nothing was lost or overwritten.** The other session's files were committed
intact, they build, and CI is green. Verified, not assumed:

```
359 tests across 30 files, 18 smoke flows, 90 assertions — ALL GATES PASSED
```

(The count is well up from the 295/26 of earlier in the day, because the
swept-up work included its own 86 tests and a new smoke flow. That is the
clearest evidence it landed intact.)

## What this means for you

1. **If you had uncommitted work, it is now committed** as `bc04295`, under a
   message that does not describe it. Your code is safe. The history is wrong.
2. **If you were about to commit the same files**, git will now tell you there
   is nothing to commit for them. That is not your work disappearing — it is
   already in `bc04295`.
3. **A follow-up commit will be added** recording what `bc04295` actually
   contains, so the history is self-explanatory without needing this notice.
4. **The fix is in `docs/CHANGE-PROCEDURE.md`**: do not use `git add -A` in a
   shared tree. Stage explicit paths and read `git status` first.

## The rule going forward

This repo has two sessions in one working tree by design. So:

- **Stage explicit paths**, e.g. `git add src/storage/clinicCardPdf.test.js`
- **Run `git status --short` and read it** before committing. If you see a file
  you did not touch, do not commit it.
- If `git status` shows someone else's work, leave it alone and tell them.
- `git add -A` is only safe when you are certain you are alone in the tree,
  and you are almost never alone here.

## One finding worth knowing, unrelated to the commit

The Clinic Card PDF **never rendered the `recentContacts` section**, although
`CLINIC_CARD_SECTIONS` exposes it as a user toggle and the on-screen card does
render it. `assembleClinicCardData` does not compute it at all.

The owner has since decided this should become a deliberate **opt-in** for the
export, limited to **name and age/DOB only** — the minimum a clinician needs,
without disclosing contact methods or anything else. That work is in progress
in the same commit stream; if you touch `clinicCardPdfService.js` or
`clinicCardVisibilityPreference.js`, expect those files to change.
