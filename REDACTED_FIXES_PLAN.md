# Red-State Fixes Plan — Status (10 Nov 2026)

Scope: code-only improvements to `SHOS_Testing_Prototype.jsx` red-state UX.
Never touch the Healthcare card (in progress elsewhere). Never change
`useRegistryUsage`/`protectionBarrier` foundations.

## Done

- **Step 1 — pending result text vs age** (`d5b4053`). Recent pending tests
  showed the same dimmed `textDisabled` as older faded ones; now recent pending
  renders `textSecondary` with the same italic + opacity-fade pattern, older
  pending stays dimmed.
- **Step 3 — save button feedback + double-tap guard** (`c22b6a4`). TestEditSheet's
  save pill now guards re-entry (`if (isSaving) return`), wraps its body in
  try/finally to always release, and renders "Saving…" while busy; new fallback
  key `common.saving` added to `src/i18n/en.json` (`33ec22f`).
- Verified: `npx eslint "."` (only the 2 pre-existing `encountersList` warnings),
  `npm run build` → EXIT=0 (28.3s), key unit tests 26/26 (`registryUsage`,
  `protectionBarrier`). One earlier build crash (0xC0000409) was RAM starvation,
  not code — passes again once ≥ ~750 MB free.

## Deliberately not done

- **Dot-colour recency saturation** (old "Step 2"). Skipped: TestRow already fades
  the dot (`opacity: isOlder ? 0.5 : 1`), dims its text, and pills it ("Older
  test"). Extra dot styling would be visual churn without information gain.
- **No-result recorded footer** (old "Step 4"). Pending date passed with no
  result currently renders as healthcareBlue dot with no caption. A fix needs a
  new i18n string ("no result recorded"); do it when adding the i18n keys batch,
  not piecemeal.
- **Step 5 "pill consistency"** (verification only): consistent; no change.

## Remaining red-state lesson recorded

`L-141`-style: reuse existing pattern components rather than layering one more
visual cue onto an already-encoded state.
