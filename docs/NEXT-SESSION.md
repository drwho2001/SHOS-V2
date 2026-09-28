# Handover — new session

Written 28 Sep 2026 at the end of a working session, for a session starting
with **no context at all**. Everything below is verifiable against the repo;
nothing here is from memory.

## Read these three things first

1. **`CLAUDE.md`** — architecture rules, current state, and a dated log of what
   shipped and why. It is the source of truth for *what is true right now*.
2. **`docs/CHANGE-PROCEDURE.md`** — the commit/push algorithm. It exists as a
   file precisely so that correctness does not depend on anyone remembering.
3. **This file** — where the work actually stands.

## The one most important thing to know

**CI is the real gate. The local loop is `npm run verify:fast`.**

`smoke-test.yml` runs `npm run verify` — the *same script* a developer runs
before committing — on every push, in ~12 minutes, with no local memory
pressure. It runs build, lint, unit tests, the encoding guard, the full 18-flow
Playwright suite, and the docs check.

Why this matters concretely: the machine this was developed on has 4 GB and
regularly drops to **~350 MB free**, at which point the Vite build dies with
`ENOMEM` and vitest's worker pool cannot spawn. That is a resource ceiling, not
a code fault. Do not kill the user's Chrome to fix it. Push and let CI verify.

**After pushing, read the gate's own reported verdict in the CI log, not the
exit code:**

```powershell
gh run list --branch main --limit 3
$id = (gh run list --branch main --workflow "SHOS Smoke Test" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $id --log | Select-String 'unit tests|smoke suite|docs in sync|ALL GATES'
```

## The second most important thing to know

**This project has hit "a gate measured nothing and still looked green" three
times.** Twice the bug was in the tooling, not the app. A passing result is not
evidence until you have read what it reported.

1. The docs gate diffed the working tree, which is *always* empty in CI — so it
   passed while checking nothing. Then again after `actions/checkout`'s default
   shallow clone made the commit range unresolvable. Both fixed; an
   unresolvable range is now a hard failure.
2. The smoke summary counted `[N/M]` lines, which only cover top-level flows. An
   inline helper silently ceasing to run left the count unchanged. It now also
   counts assertion lines.
3. A palette contrast scanner reported "the detector is proven working because
   the safe count is non-zero" while that count was **zero**.

Corollary: **a scan that finds nothing has usually found nothing for the wrong
reason.** Prove the detector fires before reporting a clean result.

## State: done

All of the following are shipped, committed, and green on `main`.

- **Sample data is disclosed and safely clearable.** A first-run Home banner
  states the real record count and that the data is not the user's;
  `clearSampleData()` removes exactly the seed ids and keeps everything the user
  added; Developer Tools has a separate clear beside a reset that is explicitly
  labelled as also destroying the user's records.
- **Onboarding accuracy.** It was sending first-time users to
  "Settings → Design", a screen that has not existed since the 16 Sep
  reorg (the row is "Colour scheme"). A `settingsPathReferences.test.js` guard
  now fails if a Settings row is renamed out from under onboarding/Guide copy.
- **The Guide no longer under-promises encryption.** At-rest encryption is
  *always* on; App Lock adds a gate in front of the key. Verified in source
  before any copy was written.
- **Search no longer claims "No matches" before it has searched.** The index
  fallback was an empty array, indistinguishable from a real empty result.
- **Every overlay is dismissible with Escape** — 27 components via
  `useEscapeToClose`, including the shared `ConfirmDeleteCard` and
  `MyProfileEditScreen`. Only the topmost overlay closes; registration order is
  tracked and cleaned up on unmount. Settings is hand-wired to share one
  `goBackOneLevel()` with its back button.
- **Search results can be got back to** (Phase 2b, the item that was #1 on
  the previous handover's list). A record opened from a result carries a
  visible "Back to search results" control, and the back chain returns there
  too. The origin is threaded through `navigateTo`'s third parameter, which
  defaults to `null` — so every *other* record link in the app clears it, and
  a stale button cannot follow the user around the session. The decisions live
  in `src/calculations/backNavigation.js` (pure, unit-tested); the wiring is
  guarded by `searchBackNavigationWiring.test.js`, because a unit test cannot
  see whether a function is reached. All mutations verified to turn the suite
  red.
- **The 18th smoke flow found a real bug in its own feature on its first CI
  run**, which is the single most useful thing in this batch and worth
  understanding rather than just noting. The clearing rule had been
  implemented in `navigateTo` only — and the bottom nav and quick-add call
  `setActive` directly, so tapping a different tab left the button on screen.
  Every unit test stayed green throughout, because all of them were examining
  the code that worked. `selectTab(tabKey)` is now the one way this file
  switches tab for a user-initiated navigation, and it clears the context.
  **If you add a tab switch, use `selectTab`, not `setActive`** — and note
  that `navigateTo` is a separate path (used by search results and deep
  links) which also clears.
- **Palette re-verified, no regressions.** `paletteContrast.test.js` names the
  four accents and self-checks its own maths against known WCAG pairs.
- CI/local unification, enforced docs gate, encoding pre-commit hook,
  `scripts/verify-changes.mjs`, Notion log current.

## Two things found while doing the item above, worth knowing

- **The back-handler effects' dependency arrays were already wrong, before
  this change.** `goBackOneLevel` reads `clinicCardReturnTab` and neither
  effect that re-registers the back listener listed it. It happened not to
  bite only because `markClinicCardReturn()` and `navigateToRecord()` batch
  into one commit, so `active` changed in the same tick and the effect
  re-registered anyway — correctness by coincidence of React batching, not by
  design. Fixed, and a test now pins that both effects declare the same list.
  If you add state to `goBackOneLevel`, add it there too; the `eslint-disable`
  on those effects will not tell you.
- **`recordNavigationWiring.test.js` fired on a legitimate change**, which is
  what a guard is for. It asserted the exact call `navigateTo(tabKey, subTab)`
  and the search-origin argument broke it. It was widened by one character
  class, with the intent-bearing assertion untouched. If you ever find yourself
  loosening one of these guards to get green, read it twice first — this repo
  has three "coverage" tests that could never have failed.
- **`insert_widget.txt` in the repo root is committed scratch.** A draft of a
  CLAUDE.md entry that got `git add`ed by accident back on 21 Sep. Harmless
  (no personal data in it) but it is clutter in a public repo and should just
  be deleted. Deliberately left out of the Phase 2b change rather than mixed
  into an unrelated diff.

## State: open, in the order you should take it

### 1. Phase 3 — retention (the largest remaining feature)

None of this exists yet. In rough priority order for a real user:

- Banner suppression — due-reminder banners currently reappear on every poll
  until acted on, which trains people to ignore them.
- Overdue deferral — an overdue item stays overdue with no way to defer.
- **"Since you were last here"** — the owner's own framing of retention. Build
  this *last*, and only after 1 and 2, because it is only meaningful once the
  banners stop nagging.
- App Lock grace — being locked straight out of the app is hostile on a daily
  medication app.
- Refill undo — marking a refill requested should be reversible.

### 2. Phase 2c — the inert `reveal-clinic` route

`src/calculations/deepLinkRoutes.js` maps `/reveal-clinic` to an action that
has no handler behind it. Small and self-contained, but genuinely low value: it
only affects a native home-screen widget on a secondary surface. Do it only
after 1.

## Notion — where things go

**Audits & Reviews** (page `3e913572-4f67-81f9-8184-ce5f5694a0fa`, child of
Development Index) is the single home for every audit, review, sweep and
re-measurement. It also catalogues the older audit pages that were previously
unindexed and therefore effectively lost.

**Write an audit there even when the result is "nothing found."** A verified
non-finding is a result, and it is the cheapest way to stop the same audit being
re-run from scratch — which is exactly what happened to the palette work.

The **Development Log** (`3b013572-4f67-80ab-b1a0-c665a828e241`) stays for what
was *shipped*, not for what was *found*. Found-but-unshipped belongs in Audits.

Both must be appended with `PATCH /v1/blocks/{page_id}/children` (`POST` is not
valid there, and Notion's error text for it reads exactly like an auth failure),
then verified by paginating to the end — a successful response is not proof the
write landed.

## Known facts worth not rediscovering

- **iOS has never been built.** There is no `ios/` directory. The user has
  always described iOS as secondary-but-real. It needs macOS/Xcode and an Apple
  Developer account, so it cannot be fixed from a dev machine. Record it, don't
  pretend it is covered.
- **Android `minSdkVersion = 24`** (Android 7.0) — a very wide device range,
  never compatibility-tested. Device-blocked.
- **Offline resilience is fine** — checked, both disclosed network calls
  (Nominatim, GitHub) fail with plain-language messages. Do not re-audit.
- **The singular "Encounter" label is deliberate**, not a typo. It is consistent
  across the bottom-nav tab, the screen `<h1>` and the Global Search group, and
  matches "Medication" and "Healthcare". Do not "fix" it.
- **Partner Notification is reachable only from a positive test.** That is a
  deliberate clinical gate. A discoverability shortcut would dilute the "no
  clutter or alarm on sensitive health data" decision.
- **The Glossary already defines** PrEP, PEP, DoxyPEP, Doxy, TOC, C&S, window
  period, BASHH, MGen, HSV, HPV. The jargon sweep is done.
- **`export const ACTION` spreads from `DEFAULT_ACTION_COLORS`.** Parsing the
  ACTION block for literal hexes returns nothing useful and `ACTION.red` comes
  back `undefined`. Read `DEFAULT_ACTION_COLORS`.
- **Per-module `T.*` tokens** come from each module's own `buildLight()`, not
  from `designTokens.js`. This is why automated contrast scanning of the source
  kept failing. The colours were measured by hand for that reason.
- **Notion Development Log**, page `3b013572-4f67-80ab-b1a0-c665a828e241`.
  Append with **`PATCH /v1/blocks/{page_id}/children`** (`POST` is not valid
  there and Notion's error text reads like an auth failure). Then paginate to
  the end and confirm — a successful response is not proof it landed. Current
  total: 1123 blocks.

## Waiting on the owner, not actionable by an agent

- **Device testing**: #68 safe-area gaps, Accessibility Item 7 (notch/status
  bar), Android 7–10 compatibility. All need the physical device.
- **Rotate the Notion token** — deliberately deferred by the owner.
- **Encoding-repair dry run on real data.** `scripts/repair-personal-data-encoding.cjs`
  is built and proven on synthetic data but has never touched real data. Dry run
  is read-only and safe; `--apply` dumps a **plaintext** backup that must be
  deleted afterwards. `backups/` is gitignored precisely because this is a
  public repo.
- **Play Store keystore.** Only needed for Play Store. The project has only a
  *debug* key, which Play rejects. Losing a release key means never being able
  to update the listing again, and it is a secret that must not be generated in
  a shared workspace. Worth asking whether Play Store is wanted at all — the app
  is private, encrypted and single-user, and GitHub Releases needs no key.

## Standing rules that are easy to break

- **Never regex over JSX attributes.** It has truncated `aria-label` closing
  braces and mangled labels. Anchor on component signatures, or edit by hand.
- **Never round-trip source through PowerShell `Get-Content`/`Set-Content`.**
  PS 5.1 is not UTF-8 and has damaged this codebase four times. Use the editor
  or a Node script.
- **A new repository must be wired into `backupService.js` in the same change.**
  This has been missed three separate times.
- **A new test must be proven able to fail.** Revert the fix and confirm it
  goes red. Three "coverage" tests here never could.
- **Icons are Phosphor**, never `lucide-react`. **Type/colour tokens live in
  `designTokens.js`**; raw hex is a bug.
- **Dates:** never `milliseconds / 86400000` for calendar arithmetic — it is
  wrong across DST. Use the helpers in `dateInputHelpers.js`. Stored datetimes
  are fake-UTC by design; see that file.
- **Do not kill the user's Chrome or unrelated apps** to free RAM. The phone
  connection and the server on port 4096 must stay up.

## Current git state

`main` is clean and pushed. All three workflows green: 321 unit tests across 28
files, 18 smoke flows, docs gate reporting a real measurement. The flow/assertion
counts CI prints are the ones to read — a green exit code alone has lied here
three times.
