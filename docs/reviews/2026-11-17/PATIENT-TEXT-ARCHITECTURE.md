# Where patient-facing explanations should live — plan, challenge, brainstorm, challenge

**Status: DESIGN ONLY, 18 Nov 2026. Nothing built.** The owner deferred the self-care bank for now but asked for a considered plan first.

## Question
When the menstrual symptoms gain plain-language explanations, self-care suggestions and evidence links, where should those words live — without duplicating them across screens or breaking "enter once, access multiple"?

## First idea (and why it was questioned)
One **repository per condition** ("pamphlets"). Each symptom/condition gets its own stored record.

**Challenge 1 — this is mostly cost, not value:**
- A repository is not a text file. Each one would need backup export/import wiring, reset handling, migration, guards and tests. Fifteen repositories means fifteen times that surface for text that rarely changes.
- The words are reviewed, versioned, clinical-adjacent copy — not user data. Storing them as editable records invites drift and a liability question ("who edited this?"). Code-owned text is testable and ships with the app version.
- It recreates the very duplication it is meant to solve: the same explanation would sit in a condition repository *and* in a Resources entry *and* in a screen.
- The app already has a handover artefact: the Clinic Card PDF. If a printable "pamphlet" is genuinely wanted later, extending that is cheaper than a new storage family.

## Brainstorm of workable alternatives
1. **One local bank** (pure data module, like `measurementTypeBank.js`), keyed by symptom. Owns label, plain explanation, self-care options, "worth mentioning to a clinician sooner" flag, source + date.
2. **Existing ResourcesRepository** — already has a "Menstruation & menopause" category with the owner's verified links. Good for links; wrong shape for long copy shown *inside* a symptom log.
3. **Existing Glossary/JargonNote** — designed for short, keyed definitions rendered through an info dot with strict prop-chain guards. Good for one-line explanations; not for suggestion lists.
4. **Inline text per screen** — fastest, but duplicates the same words in two or three places; fails the one-truth rule.
5. **Hybrid** — bank owns the words; info dot renders from the bank; Resources keeps links. One key, two views.

**Challenge 2 — against the hybrid:**
- A new note component would need `onOpenGlossary` threaded through every host, and the repo has strict guards for exactly that chain. Adding a second parallel mechanism is how those guards previously broke.
- If links live in Resources and words live in the bank, is that two truths? No — they are different facts: *where to read more* versus *what the app says now*. Both keyed by the same symptom id.

## Recommendation (not built)
- **No new repositories.** Keep Resources as the single home for **links** (it already holds the owner's verified URLs).
- Add **one** keyed module for **words** — plain label, short explanation, holistic self-care options, the neutral "worth mentioning to a clinician sooner" flag, source + date. Ship it as code, not editable data.
- Render through the **existing** info-dot mechanism (`JargonNote`/`InfoIcon` with `onOpenGlossary`) so the prop-chain guards keep covering it. Key names should be reused by any future Resources entry.
- If a printable handout is wanted later, extend the existing Clinic Card PDF rather than inventing per-condition repositories.
- "Enter once, access multiple": the symptom is entered once in Symptom Log; its explanation is derived from one key wherever it is shown; the link is fetched from one Resources entry with that same key.

## Wording decision already made
For symptoms that may need a conversation sooner, the neutral wording is **"worth mentioning to a clinician sooner"** — a time reference that implies a little more weight without an alarm word, no "urgent", no "referral", no diagnosis.

## Explicitly deferred
- Building the bank, adding the symptom vocabulary, and adding info dots. The owner chose to defer the whole bank; this document exists so that future work does not fork into per-condition repositories.
