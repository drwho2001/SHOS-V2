# Models — what actually works on this machine

Written 6 Oct 2026. **Re-measured 9 Oct 2026** after the API backend on this
box was rebuilt. Every "works" claim is a model that returned real prose to a
real request; every "dead" claim names the error string that came back.

This is the live source of truth for which models this repo's sessions may use.
`CLAUDE.md` points here rather than duplicating the list, because a model list
goes stale and a stale model list is worse than none.

## Re-measure before you trust this

Every figure below has a command that produced it. Models, credentials,
quotas and privacy terms all move, and the 9 Oct rebuild moved several at once.

```powershell
# every model opencode can see
opencode models

# which credentials are actually visible, and where (file + environment)
opencode auth list

# what is genuinely failing right now, by cause
Select-String -LiteralPath "$env:USERPROFILE\.local\share\opencode\log\opencode.log" `
  -Pattern 'message="stream error"' |
  ForEach-Object { if ($_.Line -match 'modelID=(\S+)') { $matches[1] } } |
  Group-Object | Sort-Object Count -Descending
```

The log is the single most useful file on this machine. A session that "stops
mid response" leaves its cause there, and the cause is almost never the app or
the repo.

**A 200 is not a reply.** opencode's own HTTP server returns `200` with the
failure inside the JSON body. See L-078: 13 of 18 models screened on 8 Oct
returned `200` carrying `info.error = 403 "Model access is disabled"`. Read
`parts[].text` **and** the error body, or you are reading your own optimism.

## The privacy rule this repo is bound by

This app holds sexual-health data. opencode hosts every model in the US and
states a zero-retention, no-training policy **with named exceptions**. Read the
table below as a hard gate, not a preference: `docs/MODELS.md` used to record
that rule, and HEAD's repo default (`opencode/ling-3.1-flash-free`) was on the
wrong side of it until 9 Oct.

| Tier | Models | Verdict for this repo |
|---|---|---|
| **Zero-retention, not used for training** | `space-bunny-free`, `longcat-2.5-preview-free`, `step-5-preview-free` | **Safe.** The only three that may see this repo's data. |
| Collected data **may be used to improve the model** during the free period | `big-pickle`, `mimo-v2.6-flash-free`, `mimo-v2.5-free`, `ling-3.1-flash-free`, `ling-3.0-flash-fin-free` | **Not permitted.** Usable for throwaway work; never for this repo's code, seed data or session bus. |
| **NVIDIA trial endpoints** — use logged for security and product improvement | `nemotron-3-ultra-free`, `nemotron-3.5-lightning-free` | **Not permitted.** Upstream terms say *"Trial use only — do not submit personal or confidential data."* |
| **Trains future Meta models** | `muse-spark-1.3-contributor-free` | **Not permitted.** It trades prompt/completion rights for discounted pricing. |
| Paid Zen models | — | **`402 Insufficient account funds`.** Zen is not subscribed. Expected, not a fault. |

`step-5-preview-free` sits in the safe tier because it is absent from the
documented exception list — not because it is permanently free. It is a
one-week preview offer, so it may vanish without notice. The two durable
choices are `space-bunny-free` and `longcat-2.5-preview-free`.

## Measured 9 Oct 2026 — the eight free models that actually reply

Each row is one `opencode run --model <model> "Reply with exactly: OK" --format
json`, run **sequentially** (the free tier is contended, so parallel calls would
contaminate the measurement), with `parts[].text` and the error body both
read.

| Model | Verdict | Latency | Tier |
|---|---|---|---|
| `opencode/space-bunny-free` | **REPLIES** — `OK` | 45s | zero-retention |
| `opencode/longcat-2.5-preview-free` | **REPLIES** — `OK` | 34s | zero-retention |
| `opencode/step-5-preview-free` | **REPLIES** — `OK` | 44s | zero-retention (ephemeral) |
| `opencode/ling-3.1-flash-free` | REPLIES — `OK` | 79s | training-on |
| `opencode/mimo-v2.6-flash-free` | REPLIES — `OK` | 47s | training-on |
| `opencode/nemotron-3.5-lightning-free` | REPLIES — `OK` | 29s | NVIDIA trial |
| `opencode/nemotron-3-ultra-free` | REPLIES — `OK` | 49s | NVIDIA trial |
| `opencode/muse-spark-1.3-contributor-free` | REPLIES — `OK` | 35s | Meta training |
| `opencode/exo-free` | **DEAD** — `Model exo-free has been deprecated.` | 33s | — |
| `opencode/ling-3.0-flash-fin-free` | **DEAD** — `Upstream request failed: Model is unavailable.` | 100s | training-on |

So **8 of the 10 free models opencode advertises are callable**, and both
zero-retention choices are among them. The two dead ones are dead upstream, not
misconfigured: the error names the model, not the credential.

## Credentials, measured 9 Oct 2026

`opencode auth list` reports **0 credentials in the file**. Everything below is
supplied by environment variable, which means it is only present to processes
inherited from the shell that set it.

| Credential | Env var | Status |
|---|---|---|
| **OpenCode subscription** | `OPENCODE_API_KEY` (`oc_sk_…`) | **The only working credential.** Every `opencode/*` call in the table above went through it. Note it is *not* in `auth.json` — the earlier version of this file said it was, and that was wrong. |
| **OpenRouter** | `OPENROUTER_API_KEY` (`sk-or-v1-2…`) | Credential **exists** (this file previously said none did). **But the free tier is exhausted**: a live probe returns `429`, and the log carries `AI_RetryError: … Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day`. It is a paid-provision problem, not a key problem. |
| **Google** | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` — all the **same** `AQ.Ab8…` string | **Works.** Measured 9 Oct: `gemini-flash-latest` → 200 `OK`, `gemini-3.8-flash` → 200 `OK`, `gemini-3.5-flash-lite` → 200 `OK`. This key is an `AQ.` authorization key and it authenticates against `generativelanguage.googleapis.com` normally. **Correction to an entry below this table — an earlier version of this file claimed it could not.** |
| **Groq** | `GROQ_API_KEY` | **Works.** Measured 9 Oct: `openai/gpt-oss-20b` → 200. |
| **Anthropic** | `ANTHROPIC_API_KEY` | Not re-measured on 9 Oct. The last measurement was `not scoped to a workspace`, which is why `anthropic-workspace-id` was needed. |
| **OpenAI** | `OPENAI_API_KEY` | Byte-identical to `OPENROUTER_API_KEY` (`sk-or-v1-2…`). Not an OpenAI key. |

### Gemini, measured properly this time

```
gemini-flash-latest    -> HTTP 200  "OK"
gemini-3.8-flash       -> HTTP 200  "OK"
gemini-3.5-flash-lite  -> HTTP 200  "OK"
gemini-2.5-flash       -> HTTP 404  "This model models/gemini-2.5-flash is
                                       no longer available to new users."
```

So the `AQ.` key is fine and `scripts/consult.mjs` works with it. The only dead
thing is a **model name**: `gemini-2.5-flash` and `gemini-2.0-flash` are still
listed by the API and return `404` for *new users*. That is why this ladder
addresses models by **alias** (`gemini-flash-latest`) rather than by version
number — the catalogue is not a promise that a model is callable, and a version
number ages into a 404.

`gemini-flash-latest` currently resolves to `gemini-3.8-flash`.

> **A 404 is not evidence about the endpoint.** For one commit this repo recorded
> that the Google key could not authenticate, on the strength of a `404` against
> `gemini-2.5-flash` plus a `403` against `aiplatform` sent with the literal
> placeholder `PROJECT` in the path. Both were the wrong inference: the first
> was a dead *model*, the second was a placeholder. The error **message** names
> the cause in both cases and neither message said anything about the key. Read
> the body, not the status code — see L-080.

### Privacy note on the Gemini leg

Google's free tier is a different privacy proposition from opencode's, and
`consult.mjs` is the only path to it. That is the right shape **as long as the
question carries no repo content**: consult is for challenging an approach with
a question written from scratch, not for holding state, not for reading a diff,
and never for sexual-health data. The Challenger role reads the diff, so it
stays on a zero-retention opencode model; consult stays generic and cheap.

### The `openai` / `openrouter` footgun

`OPENAI_API_KEY` is byte-identical to `OPENROUTER_API_KEY`, both `sk-or-v1-2…`.

At one point the global config remapped `provider.openai.options.baseURL` to
`https://openrouter.ai/api/v1`, which was a **correct and load-bearing**
correction — without it, any `openai/*` model would send an OpenRouter token to
`api.openai.com` and fail as a bad key. **That remap is not currently present**,
so `openai/*` would indeed misroute today. Nothing in this repo uses `openai/*`,
so it costs nothing as it stands; restore the remap if that ever changes.

Either way the lesson is unchanged: **`openai/*` and `openrouter/*` are one
credential and one quota, not two providers.** Two sessions picking "different
providers" that way halve each other's rate limit.

## Defaults pinned in this repo and on this machine

All three now read the same model, chosen because it is measured-working **and**
in the zero-retention tier:

| File | Model |
|---|---|
| `SHOS-V2/opencode.json` | `opencode/space-bunny-free` |
| `SHOS-V2/.opencode/opencode.json` | `opencode/space-bunny-free` |
| `~/.config/opencode/opencode.json` | `opencode/space-bunny-free` |

Two earlier defaults were wrong in two different directions, and both are worth
keeping as precedent:

- `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` and
  `opencode/nemotron-3-ultra-free` — the first on a **dead** provider, the
  second on an **NVIDIA trial tier whose terms forbid confidential data**.
- `google/gemini-3.8-flash` (session E, 8 Oct) — reported dead by `f49a447` on
  the strength of a **misread 404**. The key was fine; `gemini-2.5-flash` is a
  dead model name. See L-080.
- `openrouter/cohere/north-mini-code:free` (9 Oct) — a **dead quota**, which is
  a different fault from a dead key and looks like a config error until measured.

The role definitions in `~/.config/opencode/agents/` each pin their own model in
frontmatter, and `scripts/shos-terminal.mjs` reads it from there rather than
hardcoding — repointing a role is a one-line edit in the agent file. That is
deliberate: a model list hardcoded in two places is the hand-maintained
inventory that has gone stale in this repo repeatedly.

## Why sessions stop mid-response

Not the app, not the repo, and not usually the machine. Causes measured across
the log, 18 Sep – 6 Oct:

| Cause | Count |
|---|---|
| `Rate limit exceeded` on the shared free tier | 99 |
| TPM caps on `gpt-5-nano` / `gpt-5.5` | 39 |
| Provider header timeout, socket closed, DNS failure | 32 |
| `Endpoint is unavailable` / internal server error | 34 |
| Gemini free-tier quota | 12 |

**The free tier is shared across every concurrent session.** Two sessions on the
same model halve each other's throughput and both trip the limit. When running
two sessions, put them on **different model families** — that is the single most
effective thing to change, and it is why the Builder and the Challenger roles
are pinned to different models rather than the same one on two settings.

Two ceilings on top of that, both measured 9 Oct:

- **OpenRouter's free models are capped per day, not per minute.**
  `free-models-per-day` needs 10 credits to raise. It will stay red until then.
- **Only ~5 of the 84 `opencode/*` models opencode advertises are enabled on
  this subscription.** Every named premium model (`gemini-*`, `claude-*`,
  `gpt-*`, `qwen`, `kimi`) is either `403 Model access is disabled` or
  `402 Insufficient account funds`. This is also what the older "premium models
  timed out at 47s" symptom really was: they were never timing out, they were
  failing fast inside a 200.

Free memory on this 4 GB machine regularly drops to ~350 MB and does produce
false test failures, but it did **not** cause any of these: there is no
`ENOMEM` or crash anywhere in the log.