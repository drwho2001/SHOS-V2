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
| `claim release <file...>` | Drop *your* hold, leaving any other session's. Reports what it changed, and **exits 2** if it changed nothing. |
| `claim release <file...> --from=<session> --reason="..."` | Authorised **takeover**: free files held by a session that has finished or that you have taken over. Requires a reason, refuses if that session does not hold the file, changes nothing unless every file validates, and is recorded to the notice log and the backlog. See *When a file you need is claimed by a dead session*. |
| `notice <text>` | Leave a message for the other session. |
| `inbox` | Show notices and task folders since **your last** check. Cursor-based, so nothing repeats. |
| `task new <slug> [brief]` | Start a joint task. |
| `task write <slug> <NN-file.md> <text>` | Write a numbered doc into the task. |
| `task read <slug> [file]` | Read one doc, or list the folder. |
| `task list` | List all tasks. |
| `list [N]` / `read <sessionID> [N]` | Inspect the other session's opencode transcript. |
| `peer set <sessionID>` | Pin the other session's id, so `inbox`-style commands can default to it. |

### The pool commands

The pool is the allocation record and the primary work queue — it is what
stops two sessions picking the same task, so it is documented here rather than
left to `--help`, which until 29 Sep omitted `edit` and `rm` entirely.

| Command | Purpose |
|---|---|
| `pool list` | Show every task, its status and its files. |
| `pool add "<title>" [--files=a,b]` | Add an **owner-approved** task. |
| `pool propose "<title>" [--files=a,b]` | Propose one; `pool take` will not return it until `pool approve <id>`. |
| `pool approve <id>` | Owner approves a proposal. |
| `pool take [id]` | Take a task (the next available, or that one by id); **its files are claimed automatically**, before any work starts. |
| `pool allocate <id>` | Take one specific task by id. Does **not** check file claims — see below. |
| `pool done <id>` / `block <id>` / `release <id>` | Finish, park, or hand a task back. |
| `pool edit <id> [--title=…] [--files=…]` | Correct a task **in place**; id and history are immutable. |
| `pool rm <id[,id]> [--all-mine]` | Delete tasks. `--all-mine` takes only the ones you allocated. |
| `pool touch <id>` | Extend the lease. Run it **before and after each stage** of long work — see the table in *While you work*. |
| `pool reap` | Return lease-expired tasks to the pool. |

**Always pass `--files` when adding a task.** `claimFiles` is a no-op on an empty
file list, so a task with no files carries *no* duplicate protection at all —
and the claim is the only thing stopping two sessions editing one file at once.

**`pool allocate <id>` deliberately ignores file claims**, so it is the escape
route when a task's files are held by someone else and you have agreed to pair
up. `pool take` *does* honour file claims and skips such a task. The two
behaviours are not an inconsistency: `take` is the automatic path and should be
conservative; `allocate` is the deliberate, named override.

**Task ids are unique, and the generator derives from the highest existing id.**
It used to use `pool.tasks.length + 1`, which is only correct when ids run
1..N with no gaps. This pool starts at `t010`, so the eleventh task was issued
`t011` — silently duplicating an existing id. Every lookup resolves by first
match, and `rm` filters *every* task carrying the id, so one duplicate makes two
tasks unmarkable, unhittable and jointly destructible in the file whose whole
job is preventing duplicate work. The generator now refuses to create a
collision rather than working around one.

**Ids are reused after a `rm`.** A prose reference in a handover or notice to a
removed id will silently start pointing at a different task. Read ids live from
`pool list`; do not carry one forward from a document.

## Taking a task, working it, and giving it back

The point of the pool is that the other session never has to ask what you are
doing, and never has to wait to find out. Three things have to be true for that,
and each has a specific way to fail.

### Before you touch a file

1. Read shared state: `lessons`, `backlog`, `claims`, `inbox`, `pool list`.
2. Pick a task whose files do not clash with a current claim.
3. `pool take <id>` — allocation and file claim are the **same action**, recorded
   before any work starts.
4. Confirm with `claims`.

If `pool take` refuses, it names the holding session and both remedies. Do not
work around it silently: see *When a file you need is claimed by a dead session*.

### While you work: touch the pool at every stage change

`pool touch <id>` extends the lease (4 hours by default). Run it **before and
after each stage**, not once at the start:

| Stage | Why the touch matters there |
|---|---|
| picking up the task / starting to implement | the clock starts at allocation |
| running unit tests, then flow/smoke tests | often the longest single step |
| committing and pushing | staging and a build can both run long |
| updating `CLAUDE.md` / the Notion log | happens after the code work is done, and is easy to forget entirely |
| handing back, blocking, or going quiet for any reason | so the other session is not left guessing |

The reason this is about **efficiency** rather than ceremony: the lease is the
only liveness signal this tool has. A recorded pid belongs to a
`node session-bridge.mjs` process that exited milliseconds later and is
deliberately never consulted, so a long task that never touches its lease looks
identical to a dead one — and `pool reap` will hand its files to whoever asks
next. One command, no cost to anybody.

The reason it is still not a reason to *stall*: **never park a claimed file
silently.** If a stage is going to take a while, touch the lease, post a `notice`
or a `log` line saying what you are doing and until when, then carry on. The other
session's time is the scarce resource here; a claim held quietly for an hour is
worse than a slightly stale lease.

### Giving it back

| You are… | Command | Files |
|---|---|---|
| finished, verified, pushed, documented | `pool done <id>` | released |
| genuinely blocked, or parked deliberately | `pool block <id>` | released |
| abandoning it, or handing it to the other session | `pool release <id>` | released, back to `approved` |

All three release the file claims. That used to be missing, and it was a slow,
quiet failure: a completed task kept its files, so follow-up work in the same
area was impossible and the pool froze one file at a time with no error anywhere.

### When a file you need is claimed by a dead session

This is the case that used to have no answer at all. A session finishes, pushes,
and goes away without running its own `pool done`; its claims outlive it, and
`pool take` then refuses any task touching those files — forever, because the
claim was the only record of that work.

Do **not** edit `claims.json` by hand, and do not invent a file-less task to route
around it (that was the workaround, and it hid the real state). Use the takeover
form:

```powershell
node scripts\session-bridge.mjs claim release <file...> --from=<session> --reason="..."
```

It is deliberately hard to do by accident:

- **`--reason` is required.** This is the one command here that destroys another
  session's record of what it was doing, and a reason is the only thing that makes
  the release reviewable by whoever finds it later.
- **It refuses if the named session does not actually hold the file**, so a typo
  cannot silently release someone else's claim instead.
- **It is all-or-nothing.** Every file is validated before anything is written.
  A partial release is worse than none: the other session would see some files
  free, could not tell which, and would either idle or start editing a file still
  held.
- **It is recorded** to the notice log (which a returning session sees in
  `inbox`) and to the backlog (which a session reading state cold finds).
- A plain `claim release <file...>` still only ever drops **your own** claims, and
  now says so explicitly and exits non-zero if it changed nothing — a silent
  no-op reported as success is the failure mode this whole tool keeps hitting.

There is deliberately **no staleness timer** on this. The tool already learned
that a wall-clock threshold will reap live work, so whether a session is finished
is the owner's call, made explicitly, rather than a number's.

`claims` now marks any claim with **no task in flight** as an orphan and prints
the exact command above. It does *not* say "abandoned" or "stale": this tool
cannot observe liveness, and a session may legitimately hold a file with no pool
task at all.

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

## Roles — one input, routed (shipped 9 Oct 2026)

The A/B/C/D naming above was an ownership scheme, not a division of labour: it
recorded *who* held a file, and said nothing about *what kind of judgement* was
needed. Two sessions on the same task with the same prompt produce two similar
answers, which is the failure that motivated this whole document.

**The four roles live as opencode agent definitions in
`~/.config/opencode/agents/`** — `builder.md`, `challenger.md`, `docs.md`,
`tester.md` — and one script drives all of them:

```powershell
node scripts\shos-terminal.mjs "what should I do about the widget staleness?"
node scripts\shos-terminal.mjs --roles              # what exists, and on which model
node scripts\shos-terminal.mjs --role challenger "does this test actually fail without the fix?"
node scripts\shos-terminal.mjs --default "..."      # repo default model, no agent
```

| Role | Job | Model |
|---|---|---|
| **Builder** | implements, verifies, commits | `opencode/space-bunny-free` |
| **Challenger** | read-only second opinion; **cannot edit** | `opencode/longcat-2.5-preview-free` |
| **Docs** | keeps the written record true; `edit` scoped to Markdown | `opencode/longcat-2.5-preview-free` |
| **Tester** | runs the deterministic gate; **cannot edit** | `opencode/space-bunny-free` |

### Three decisions in that table, each with a reason

**Builder and Challenger are on different model families.** A challenger on the
same model is an echo, not a second opinion — the whole value is that it did
not arrive having agreed. Both are in opencode's zero-retention tier, so the
independence costs nothing in privacy.

**Tester has no `edit` permission, and does not fix reds.** A gatekeeper that
starts patching is no longer a gatekeeper: the thing it verified becomes the
thing it wrote, and the honest signal is gone. Green means commit and push; red
means hand it back.

**There is no fourth model that verifies everything.** Mechanical verification is
a deterministic script with no model context in it (`npm run verify`); judgement
verification is the Challenger, or the owner. A verifier model would read
*outputs* — commits, diffs, claims — not intent, and would duplicate the exact
context burden the role split exists to remove. Four roles, not five.

### What the roles do NOT change

**Sessions still cannot wake each other.** A role is a prompt and a permission
set; it is not a live channel. Delegation remains queue-based, because the
owner prompts each one. Every statement about `ask`, `tuiask` and prompting above
still applies unchanged.

Roles and the claim table are orthogonal: a role tells a session *how* to work,
a claim tells the other session *what it owns*. A role with no task must not
claim files, and the reverse also holds.

### The models are read, never hardcoded

`shos-terminal.mjs` reads each role's `model:` from its agent frontmatter. That
is deliberate — a model list written twice is a hand-maintained inventory, and
this repo has been bitten by that repeatedly. Repoint a role by editing its
`agent.md`.

`--roles` **exits non-zero and names any role whose agent config is missing.**
The first version skipped absent roles silently, so it printed a healthy table
for a terminal that could not route anywhere.

### The agents live outside the repository

`~/.config/opencode/agents/`, deliberately: this repo is the public alpha track
and these are machine-and-owner-specific workflow prompts. The cost is honest
and worth stating — **the claim table cannot cover them**, so two sessions
editing the same agent file cannot be detected by `session-bridge`. Treat those
four files as owner-only, and set `SHOS_SESSION_NAME` before touching them.

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

## Lessons — durable rules, not chronology

The backlog answers "what happened". This answers **"what must a future session
not do, and what to do instead"** — worthless in a transcript, valuable as a rule.
Kept separate on purpose: a chronological log grows without bound and gets
skimmed, whereas this stays short enough to read in full every session.

RULE: / DO: / EVIDENCE: rather than prose, because the reader is mostly an
AI and a labelled line is retrievable where a paragraph is not. **--evidence is
required and the tool refuses without it** — an unevidenced rule is a superstition,
and this repo has repeatedly found those ("fixed" bugs that were not bugs, gates
that measured nothing). If a rule's evidence expires, delete it; do not inherit it.

Nine seeded from the two-session work, including the four that cost something:

| Rule | Why it matters |
|---|---|
| Cannot wake another session | Shapes everything; saves re-measuring it |
| CRLF + PowerShell .Replace() is a silent no-op | Cost three false test rounds |
| Redact credentials by field-name match, not by eye | Leaked a real token |
| Lock takeover is the *dangerous* direction | Would have permitted the corruption it prevents |
| A listed model is not a callable model | Two 404s on "current" models |
| Shared state must be per-session or a list | Cursor and claims bugs |
| Don't generalise a partial test | I asserted a platform rule I'd only partly tested |
| Test outside advice before building for it | Gemini's git claim was wrong |
| Prose greps break on line wraps | 4th instance of a trap already recorded here |

## The conversation backlog — why a new session is a continuation

Every other piece of this tooling shares *state*. This one shares *reasoning*,
and it exists because of a plain gap: a new session inherits `CLAUDE.md` and the
shared state, but it has **no memory of any conversation that came before it**.
Without this, the next session re-derives context the last one already paid for.

```powershell
node scripts\session-bridge.mjs backlog          # read the recent tail — do this FIRST
node scripts\session-bridge.mjs log "<entry>" --kind=decision
```

Markdown at `~/.shos-session-bus/backlog.md`, not JSONL, because a human reads it
too — the point is that you or the next session can pick it up without a tool.

`--kind` is one of `decision`, `blocker`, `finding`, `question`, `state`, `done`,
`mistake`. **Log what is not already durable elsewhere**: a decision and its
reason, a dead end so nobody walks into it twice, a mistake worth not repeating,
the state of something still open. Commits are already in git, findings already
in `docs/`, tests in code — duplicating them here would only create a second
place for them to go stale, which is a failure mode this repo has hit repeatedly.

Each `log` also posts a one-line notice, so a session that only runs `inbox` still
notices something changed without needing to know the backlog exists.

### Reading it

`backlog` defaults to the **tail** — the most recent entries — because the file
only grows and burying current state under 200 entries is precisely how a
handover document quietly stops being read. `backlog --all` for everything, or
`backlog <n>` for a count.

**Seeded on 29 Sep 2026** with the state of the two-session work: the measured
session-waking blocker, the rejected git-lock advice, the UTC policy, the leaked
credential, and the five open items. So a session starting tomorrow inherits
that, not just a tool it does not know about.

## Credentials

The opencode server password lives in
`~/.shos-session-bus/credentials.json`, **outside the repository on purpose** —
this repo is the public alpha track and an agent-server credential must never be
commit-able. It is read at runtime and never logged or placed on a command line
by the script. `$SHOS_OC_PASSWORD` overrides it.

**If that password is ever pasted into a chat, a terminal, or a file that gets
committed, treat it as compromised and change it.** The server is bound to
`0.0.0.0` with mDNS, so it is reachable from the local network.
