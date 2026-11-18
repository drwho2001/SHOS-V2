# B1 investigation — `seed_contact_9008` in Developer tools (18 Nov 2026)

**Owner's ask (round 3):** "Developer tools shows `seed_contact_9008` instead of actual name/nickname — wrong surely?" Proposed action was "find the row and resolve id → name".
**Decision:** investigate first, do not auto-change. This document is the result. **No code change is warranted.**

## What the row actually is

`seed_contact_9008` is **not a mislabelled row title**. It is the *dangling target ID* inside the Developer tools → Broken references panel (`src/modules/settings/DeveloperToolsScreen.jsx`, `OrphanRow`). A real row reads:

> **Encounter: Morgan — first date**
> its `attendeeIds` points at a Contact that no longer exists (id: `seed_contact_9008`)

- `recordLabel` comes from the **referring record** (the encounter's own title), so a human-readable name is already shown where one exists.
- The raw ID appears only in the explanatory sentence, as the thing that **no longer resolves**. That is the whole point of the diagnostic — see `orphanReferenceCheck.js` lines 21–39: archived records resolve fine and are NOT flagged; only hard-deleted / never-existed IDs are.

## Why there is no name to resolve

`seed_contact_9008` **is** "Morgan" in the seed data (`src/repositories/contactRepository.js:470-474` — full name, city, phone, email), and `ContactRepository.getById()` resolves it regardless of archived state. So on a fresh install the checker does **not** flag it; the Developer tools comment (`DeveloperToolsScreen.jsx:78-80`) even notes the panel renders nothing because "this app's data never has one".

The beta tester's install genuinely had that contact missing while an encounter still named it in `attendeeIds`. The normal clear path does not cause this: `clearSampleData.js`'s `referencedSeedIds()` (lines 195–229) keeps any seed record a real record points at, and `attendeeIds` ends in `Ids` so it is followed. The likely cause is a **direct hard-delete of Morgan** (the case `orphanReferenceCheck.js` was written to catch — its header cites exactly "a hard-deleted Contact an old Encounter's attendeeIds still points at").

## Why "resolve id → name" cannot be done (and why the raw ID is correct)

For a true dangling reference there is no live record to look the name up from — that is what "dangling" means. Inventing a name from the seed fixture would be showing data that does not exist in the user's storage, which is worse than the honest ID. The panel already offers the two correct fixes: **Clear this reference** (remove the stale ID) or **Point it at which Contact?** (repoint to an existing record). Those are the repair, and they stay human-controlled.

## Verification
- `orphanRowRender.test.jsx` (10 tests) and `orphanReferenceCoverage.test.js` (17 tests) pass — the row renders the referring record's label plus the dangling ID, and the checker still covers the schema from both directions.
- `contactRepository.getById()` confirmed to resolve seed IDs and ignore only truly-absent ones.
- `clearSampleData.referencedSeedIds()` confirmed to protect seed contacts referenced by real records via `*Id`/`*Ids` fields.

## Conclusion / recommendation to owner
**Keep as-is.** The raw ID is correct diagnostic behaviour, not a mislabelled name. If this exact row reappears on a fresh install (rather than one with a hard-deleted contact), that would be a different bug worth re-opening — but the code path and tests say it cannot. No build action taken.
