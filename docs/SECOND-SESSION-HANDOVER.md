# Second Session Handover - DELEGATE

## Session name: DELEGATE

## Purpose
This session works on backlog items that are INDEPENDENT of the MAKER session's
current work. MAKER is actively working on bundle optimization, demo badges, and
healthcare lazy loading. Do NOT touch those files.

## Files to AVOID (MAKER owns these)
- src/modules/SHOS_Medication_Dashboard_Prototype.jsx
- src/modules/SHOS_Attachments_Prototype.jsx
- src/modules/SHOS_Healthcare_Prototype.jsx
- src/repositories/*.js (isDemo already done)
- src/modules/SHOS_MenstrualHealth_Prototype.jsx (MAKER may touch)
- scripts/smoke-test.cjs (coordinate before editing)

## Items to work on (pick any, in order of priority)

### 1. Accessibility audit (code-level)
- Check ARIA coverage: 612 aria attributes, 694 role attributes, 928 onClick handlers (~75%)
- Add missing aria-labels to interactive elements without them
- Ensure keyboard navigation works (tabIndex, onKeyDown)
- Check color contrast in dark mode
- Files: src/**/*.jsx (all modules)
- Guard: do NOT break existing tests

### 2. Internationalization (i18n)
- Set up i18n framework (react-i18next or similar)
- Extract user-facing strings into translation files
- Start with English only, structure for future languages
- Files: new src/i18n/ directory, wrap strings in modules
- Guard: do NOT change existing behavior, only wrap strings

### 3. Smoke test gaps (core CRUD flows)
- Add at least one core CRUD flow test (e.g., add contact, add encounter)
- Follow existing smoke test patterns in scripts/smoke-test.cjs
- Guard: coordinate with MAKER before editing smoke-test.cjs (MAKER may also edit)

### 4. contactMerge.js implementation
- Currently a stub with documented rationale
- Implement duplicate candidate detection for contacts
- Per-target-type (not generic) as documented
- Files: src/calculations/contactMerge.js
- Guard: preserve existing test structure

## Constraints
- Do NOT touch files MAKER owns (listed above)
- Run lint and tests before committing
- Commit and push to main
- Log to session bus with session name DELEGATE
- Update docs/NEXT-SESSION.md with progress

## How to claim work
1. Check session bus: node scripts/session-bridge.mjs list
2. Log your start: node scripts/session-bridge.mjs log "DELEGATE starting work on [item]" --kind=state
3. Work on one item at a time
4. Commit and push after each item
5. Log completion: node scripts/session-bridge.mjs log "DELEGATE completed [item]" --kind=state

## Device status
- Device is connected via USB
- App Lock off (as found)
- No switches turned on
- No encounters saved
- APK installed: latest
