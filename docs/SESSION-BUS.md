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

## Credentials

The opencode server password lives in
`~/.shos-session-bus/credentials.json`, **outside the repository on purpose** —
this repo is the public alpha track and an agent-server credential must never be
commit-able. It is read at runtime and never logged or placed on a command line
by the script. `$SHOS_OC_PASSWORD` overrides it.

**If that password is ever pasted into a chat, a terminal, or a file that gets
committed, treat it as compromised and change it.** The server is bound to
`0.0.0.0` with mDNS, so it is reachable from the local network.
