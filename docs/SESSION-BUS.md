# Session bridge — working with a second AI session in this tree

## Why this exists

The owner routinely runs **two AI sessions against this one working tree**, and
until now the only path between them was the owner relaying messages by hand.
That path has already produced a real error: a block of text was pasted back
with one session's analysis attributed to the other, so a review appeared to have
independently validated a proposal that was in fact just an echo of the same
words. Anything that depends on the owner noticing and forwarding has a human as
its most failure-prone component.

This is the durable part of that problem. It is **not** a live channel, and the
difference matters — see "What does not work" below.

## Scope: the rule, not the partition

A file-ownership partition between two specific sessions is meaningless within a
week and rots into a lie. What is permanent is this:

> Two sessions may share this tree. Announce what you are working on. Never
> `git add -A`. Never rewrite the other session's commits.

**Set your identity once per shell**, or every claim is recorded as
`unknown`:

```powershell
$env:SHOS_SESSION_NAME = "A"     # or "B", or anything meaningful
```

## Solo work needs none of this

Everything below is for *joint* work. Working alone on your own files, ignoring
this file entirely, is completely fine.

## Commands

All of these are `node scripts/session-bridge.mjs <command>`.

| Command | Purpose |
|---|---|
| `claim <file...>` | Record that you own these files. Warns and **exits 3** if another session already holds one. |
| `claims` | Show the claim table. A file held by two sessions is flagged `CONFLICT`. |
| `claim release <file...>` | Drop *your* hold, leaving any other session's. |
| `notice <text>` | Leave a message for the other session. |
| `inbox` | Show notices and task folders since **your last** check. Cursor-based, so nothing repeats. |
| `task new <slug> [brief]` | Start a joint task. |
| `task write <slug> <NN-file.md> <text>` | Write a numbered doc into the task. |
| `task read <slug> [file]` | Read one doc, or list the folder. |
| `task list` | List all tasks. |
| `list [N]` / `read <sessionID> [N]` | Inspect the other session's opencode transcript. |
| `peer set <sessionID>` | Pin the other session's id, so `inbox`-style commands can default to it. |

## The joint-work protocol

The transport carries messages; the **task folder carries the actual work**.
That split is deliberate — a message is ephemeral, a numbered document is the
durable artefact, and two sessions reading the same file is what makes them
"working together" rather than merely talking past each other.

```
~/.shos-session-bus/tasks/<slug>/
  00-brief.md      the owner's prompt, verbatim
  10-proposal.md   the driver session's approach
  11-review.md     the other session's critique
  20-proposal-v2.md  ...iterations...
  30-plan.md       CONVERGED — both sessions agree
  40-report.md     the single unified report the owner reads
  50-proof.md      the other session proofs 40 before the owner sees it
```

Rules that make this work, each of which exists because its absence causes a
specific failure:

- **The driver's role goes to whoever picks the task up first.** Stated once, so
  neither session waits for the other to go first.
- **Only the driver ever waits on the other session.** If both block on each
  other they deadlock. The reviewer responds when asked and never blocks.
- **Never write the same filename from two sessions.** `task write` refuses to
  overwrite a file another session authored (exit 2) and tells you to use
  `-v2`. One mutable file written by two writers is a silent clobber; versioned
  names make that impossible, and the numbering doubles as the review history.
- **The owner reads one document: `40-report.md`.** Not two chat summaries,
  which is how answers diverge in the first place.
- **The reviewer's `50-proof.md` is written before the owner reads `40`.** That
  is what "proof-read the other session's response" means here.

## What does not work, and why

Both of these were **measured on 28 Sep 2026 against a real second session**,
not inferred from docs. Recorded so nobody re-derives them, and so the
`scripts/` comments are not mistaken for speculation.

**`ask` — queueing a prompt into another session — delivers nothing.**
`POST /api/session/{id}/prompt` returns `200` and the bridge reported
"queued", but the peer's `time.updated` never moved, `/session/status` and
`/api/session/active` both stayed empty, and no reply appeared after 55
seconds. An interactive TUI session does not consume a server-side queued
prompt. The command is kept only because it may work for a headless session,
and it now prints that it is unverified rather than claiming success. **Use
`notice` + `inbox` instead** — that is the supported path.

**`tuiask` — typing into a live terminal — cannot be targeted.** opencode's TUI
endpoints (`/tui/append-prompt`, `/tui/submit-prompt`, `/tui/show-toast`) are
addressed by `?directory=`, **not by session**. With two TUI sessions in one
directory there is no API-level way to say which window receives the text, and
when it was tried the text landed in the *calling* session's own input box. It
is gated behind `--yes-i-know` for that reason and should stay gated.

### What would make it work

**One directory per session** — i.e. a git worktree per session. Then
`?directory=` addresses unambiguously, and the live channel becomes possible.
It also permanently removes the shared-tree class of accident that produced the
`bc04295` incident. It is *not* done here because it costs a branch and a merge
step, which is a workflow decision rather than a technical one.

Storage is not the obstacle: a worktree is ~5 MB of tracked files and shares
`.git` entirely; `node_modules` can be a directory junction for ~0 cost.

## The gate lock — why two sessions must not run `verify` at once

`verify-changes.mjs` now takes an exclusive lock for the whole run, so a second
session **queues** rather than cancelling, breaking, or turning the run red.

The reason is not gate ordering. It is two concrete writes to `dist/`:

- `npm run build` (gate 1) writes the whole of `dist/`.
- the smoke suite's service-worker flow **writes `dist/sw.js` twice** — at
  `smoke-test.cjs:1241` with a deliberately bumped `CACHE_NAME`, then again at
  `:1265` to restore the original it read at `:1188`.

So if B's build lands inside A's flow-14 window, A writes a **stale** `sw.js`
into B's freshly built `dist/`. Silent, survives the run, and is miserable to
diagnose later. The lock is therefore **whole-run, not per-gate** — per-gate
locking would be strictly worse, because it would permit exactly the
build-while-smoke-reads pairing that causes this.

Behaviour:

- Waits, printing the holder, their PID, their current gate, and how long they
  have held it. Reprints on each gate change, plus a 30s heartbeat so a long
  silent gate does not look like a hang.
- **A dead PID is stale** and the lock is taken over — the ordinary
  crashed-session case.
- A **live PID is waited on**, however nonsensical its timestamp. This was
  originally backwards: an uninterpretable or negative `startedAt` triggered
  takeover. Taking over is the dangerous action, because it is the one that lets
  two runs touch `dist/` at once. Waiting is the safe failure, and the deadline
  stops it hanging forever.
- A live process past `SHOS_LOCK_MAX_AGE_MS` (45 min) counts as wedged and is
  taken over.
- Bounded by `SHOS_LOCK_WAIT_MS` (20 min). On giving up it exits **4** — distinct
  from 1 (a gate failed) and 2 (warnings), so "blocked, nothing ran" is
  distinguishable from "ran and went red".
- `--no-lock` overrides. Locking is skipped entirely in CI.
- The lock lives in `~/.shos-session-bus/`, keyed by a hash of the working-tree
  path, so it is never committable and two separate clones do not falsely
  serialise against each other.

Set `$env:SHOS_SESSION_NAME` so the message names who is holding it.

## Timestamps

**Machine-to-machine, this tool uses UTC everywhere.** Stored values are UTC
ISO-8601, and they are *displayed* as UTC by default, with the zone printed.
That is deliberate: it is a channel between two sessions, and one shared clock
removes a whole class of "was that before or after?" argument. It also means the
timestamps sort correctly as plain strings.

The cost is that a human reading the terminal has to convert, so `--local` is
available on any command and changes display only:

```
node scripts/session-bridge.mjs list           # 2026-09-28 23:46:46Z  (UTC)
node scripts/session-bridge.mjs list --local   # 29 Sept, 00:46        (local)
```

**Human-facing documents are the opposite** — `CLAUDE.md`, the Notion logs and
`docs/*.md` prose are written in local UK time, because those are read by the
owner, not parsed by a session. So the rule is: UTC for the bridge, local time
for anything a person reads. Do not mix them in one file without labelling.

## Doing other work while you wait for the lock

The gate lock makes a second session *wait*. Waiting is the safe failure, but a
session blocked on a full `verify` run can still be doing something useful. The
work pool is how: a queue of tasks the owner has **approved**, which a session
can pull when it is otherwise idle.

```powershell
node scripts/session-bridge.mjs pool propose "Widen the Global Search index"   # inert
node scripts/session-bridge.mjs pool approve t001                              # owner's call
node scripts/session-bridge.mjs pool take                                       # pull one
node scripts/session-bridge.mjs pool list
node scripts/session-bridge.mjs pool done t001
```

**The approval gate is the entire design.** `propose` creates a task that is
*inert* — `pool take` will not return it, and says so. Only `approved` tasks are
handed out. Without that gate the tool is a machine assigning itself objectives,
which is how a small task becomes a large unrequested refactor.

`pool take` also refuses a task whose files another session already claims, and
names the reason. So pulling work cannot manufacture the collision the claim
table exists to prevent — a session cannot pull the task it was just told not to
touch.

### What it does not do

**It does not make an idle session autonomous.** A session only pulls work when
it is running, which means when you prompt it. The realistic pattern is: prompt a
session, and it starts by checking the pool. The gate lock plus the pool together
mean one session can be mid-verify while the other gets on with a different
approved task — but a session you never prompt still does nothing.

### Concurrency is best-effort, and said so

Two sessions calling `pool take` in the same instant can both read the same
approved task. There is no OS-level lock here, so it uses an optimistic
read-claim-write-reread: whichever claim is still present on re-read keeps it,
the other backs off and says it lost the race. The window is milliseconds and the
failure mode is a duplicated task, not a corrupted file. That is a deliberate
trade — the thing that genuinely needs real mutual exclusion is the `dist/`
write, and that has it.

## Allocation is recorded before any work starts

The owner's requirement, and the sharpest thing about the pool: a session must
record that it has taken a task — **with a timestamp and the files involved** —
*before* it starts working, so the other session sees the allocation rather than
discovering duplicated work afterwards.

So `pool take` and `pool allocate` both route through one `allocate()` function
that, in a single action:

1. sets status `doing`, owner, and a UTC timestamp,
2. **claims the task's files into the shared claim table**,
3. appends to the task's history.

Step 2 is the part that was missing. The pool used to say "A has it" while the
file table still read as free for B — two sources of truth that can drift, which
is the exact failure class this tool keeps hitting. They now agree.

```powershell
node scripts/session-bridge.mjs pool allocate t001   # exits 3 if B already has it
node scripts\session-bridge.mjs pool take            # pull the next available
node scripts\session-bridge.mjs claims               # see every held file, with times
```

### Staleness is a lease, not a process check

The first version stored the allocating PID and used it to decide whether a task
had been abandoned. **That was wrong, and only a real run exposed it:** this is a
CLI, so the recorded pid belongs to a `node session-bridge.mjs` process that
exits milliseconds later. Every allocation read as abandoned the moment it was
made, and `pool reap` would have handed back tasks that were actively being
worked on — causing precisely the duplicated work the pool exists to prevent.

Staleness is therefore a time-based **lease**: an allocation is fresh for four
hours (`SHOS_POOL_LEASE_MS`), and `pool touch <id>` extends it for genuinely long
work. That is honest about what can be observed from a command line.

## Sessions do not wake each other

Worth stating plainly, because it is the thing most likely to be assumed:

**Prompting session A does not prompt session B.** Both must be prompted by the
owner. This was measured, not assumed — see *What does not work* above. There is
no mechanism by which work started in one appears in the other, and pretending
otherwise would produce two sessions confidently diverging.

What exists instead is that each session can *look* at shared state on demand, and
— with the instruction at the top of `CLAUDE.md` — does so unprompted at the
start of its turn.

## Getting a second opinion: `consult.mjs`

The blocker for the owner vision — two sessions cross-checking each other — was
always that **opencode cannot wake an idle session**. `consult.mjs` sidesteps
that entirely: it never touches a session, it calls a *different model* through
its own public API and writes the exchange where the other session already
looks.

```powershell
node scripts/consult.mjs gemini "should this be a hook or a script?" --task=my-task
```

The answer is written to `tasks/<slug>/90-<provider>-consult.md` and to a
machine-readable `exchanges.jsonl`, so the other session reads it on its next
turn. That is the whole mechanism — **no session is woken, and none needs to
be.** The trade is real and worth stating: the second opinion is a model with no
memory of this repo, so it is genuinely an *outside* opinion rather than a
collaborator with context. Use it to challenge an approach, not to hold state.

### Cost policy, and the ladder

The owner's rule is: **cheapest option first, and prefer what a subscription
already covers.** So each provider is an ordered ladder, walked automatically
when the current model is rate- or capacity-limited:

| Provider | Ladder | Policy |
|---|---|---|
| `gemini` | `flash-latest` → `flash-lite-latest` → `2.5-flash-lite` → `3.1-flash-lite` | free tier — preferred |
| `openai` | `gpt-4.1-nano` → `gpt-4.1-mini` → `gpt-5.4-mini` | paid, **last resort** |
| `anthropic` | `claude-sonnet-4-5` | paid, workspace-scoped key — last resort |

The free tier is contended enough to matter. Observed live: `gemini-flash-latest`
returned `503 high demand`, and the tool retried once, then stepped down to
`gemini-flash-lite-latest` and was served by `gemini-3.5-flash-lite`. Without
the ladder that call simply fails.

`--model` pins one model and will **not** silently substitute another.

### Credential status, as measured on 29 Sep 2026

Keys live in environment variables, never files, and are never logged or placed
on a command line by the tool.

- **Gemini — works.** Free tier. `GEMINI_API_KEY`.
- **OpenAI — no credits.** `HTTP 429 "no credits remaining"`. Treated as a
  hard failure, not walked, because a second model would fail identically.
- **Anthropic — key is not a console API key.** Returns
  `400 not scoped to a workspace`. Set `ANTHROPIC_WORKSPACE_ID` and it should
  work; until then it is last resort and unavailable.

Model naming is not guessable from documentation: `gemini-2.5-flash` and
`gemini-2.0-flash` are both still **listed** by the API yet return `404 no
longer available`. The catalogue is not a promise that a model is callable, which
is why the free models are addressed by alias (`gemini-flash-latest`) rather than
a version number.

### What Gemini said when asked — and testing it changed the answer

Asked what single invariant most prevents two agents corrupting each other's
work in one tree, the answer was **full mutual exclusion on all tree mutations**,
with a clean committed state between turns, on the grounds that `.git/index` and
`HEAD` are shared and two concurrent `git add` commands collide on the index lock.

**Tested rather than adopted, and it does not hold up as stated.** Git's
`index.lock` is designed for exactly this, and it fails *safe and loud*:

```
fatal: Unable to create '.../.git/index.lock': File exists.
       Another git process seems to be running in this repository, or the
       lock file may be stale
```

Forced deliberately, the index was left completely untouched and the error named
its own cause. Six genuinely concurrent `git add` calls produced **zero**
collisions, because the lock is held for microseconds. So this is a nuisance that
announces itself, not a corruption risk — and adding a second lock around git
would be worse than the problem, because a stale lock of *ours* would block every
git operation in the repo.

The part of Gemini's reasoning that **is** right, and which the original finding
framed loosely, is that the real danger is not the lock at all — it is
`git add -A` sweeping up the other session's in-flight work. That is already
covered, by the explicit-path rule in `docs/CHANGE-PROCEDURE.md` and the
incident that produced it (`bc04295`, 799 lines).

So: no git lock. Recorded because the finding looked compelling and would have
produced redundant machinery, which is the second time in this work that an
outside opinion needed testing rather than adoption.

## The second-opinion protocol — a deliberately low threshold

The rule, from the owner: on **multiple fails, stalls, retries, reworks, or
anything genuinely unknown**, stop grinding and ask the free model.

```powershell
node scripts\session-bridge.mjs stuck my-task "make two sessions wake each other" "POST prompt returned 200, nothing happened"
```

Attempt 1 only records. **Attempt 2 automatically calls Gemini**, and the prompt
is assembled from *every* failed attempt, not just the latest:

```
GOAL: make two sessions wake each other

ATTEMPTS (all failed):
1. POST /api/session/{id}/prompt -> 200, B's timestamp never moved
2. /tui/append-prompt -> typed into my own terminal

Give me the most likely root cause I am missing, and the one thing to try next.
```

That assembly is the whole reason for counting rather than just calling. "It's
broken" gets a generic answer; "these two things failed this way" gets a real
one — and it is free.

- Threshold is **2**, overridable via `SHOS_STUCK_THRESHOLD`.
- `--no-consult` records without calling.
- It delegates to `consult.mjs`, so the cost ladder, retry policy and key
  handling are not duplicated. A free-tier `503` during an auto-consult is
  handled by stepping down the ladder, not by failing the workflow.
- Every attempt is persisted in `tasks/<slug>/_friction.json`, so a later
  session can see that something was already ground on before trying it again.

### It has already paid for itself

Recording the two measured dead ends above auto-consulted Gemini, which replied:

> You are confusing the OpenCode *control plane* (HTTP API / TUI automation) with
> the *event loop* of the target process… the API endpoint you called merely
> appended text to a buffer without sending the "Run" signal… you manipulated the
> **active terminal's stdin**, which routed straight back to your current session.

That is an independent confirmation of the finding, from a model with no access
to this repo, arrived without being prompted to agree. Which is the honest
argument for having the tool: the value is not that it is right, it is that it
is a genuinely separate opinion, and it will sometimes disagree.

The same mechanism caught the **over-stated** half of its own earlier advice —
`consult.mjs` finding it. See *What Gemini said when asked* below.

## Credentials

The opencode server password lives in
`~/.shos-session-bus/credentials.json`, **outside the repository on purpose** —
this repo is the public alpha track and an agent-server credential must never be
commit-able. It is read at runtime and never logged or placed on a command line
by the script. `$SHOS_OC_PASSWORD` overrides it.

**If that password is ever pasted into a chat, a terminal, or a file that gets
committed, treat it as compromised and change it.** The server is bound to
`0.0.0.0` with mDNS, so it is reachable from the local network.
