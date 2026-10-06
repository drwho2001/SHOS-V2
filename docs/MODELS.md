# Models — what actually works on this machine

Written 6 Oct 2026. **Every "works" claim here was verified by executing a real
request, not by reading a config or trusting a model list.** Every "ineligible"
claim names the error that was actually returned.

This is the live source of truth for which models this repo's sessions may use.
`CLAUDE.md` points here rather than duplicating the list, because a model list
goes stale and a stale model list is worse than none.

## Re-measure before you trust this

Every figure below has a command that produced it. Models, pricing and
availability all move.

```powershell
# every model opencode can see, with context limits and cost
opencode models --verbose

# which credentials are actually visible (file + environment)
opencode auth list

# what is genuinely failing right now, by cause
Select-String -LiteralPath "$env:USERPROFILE\.local\share\opencode\log\opencode.log" `
  -Pattern 'message="stream error"' |
  ForEach-Object { if ($_.Line -match 'modelID=(\S+)') { $matches[1] } } |
  Group-Object | Sort-Object Count -Descending
```

The log is the single most useful file on this machine. A session that
"stops mid response" leaves its cause there, and the cause is almost never
the app or the repo.

## Accounts

| Account | Key | Status |
|---|---|---|
| **OpenCode Zen** | `OPENCODE_API_KEY` | Key is valid. **Paid models return `402 Insufficient account funds`.** Not subscribed — expected, not a fault. |
| **OpenCode Go** | `oc_sk_…` in `auth.json` | **Paid and working** (verified `qwen3.8-flash`). This is the paid account. |
| **Google** | `GEMINI_API_KEY` | Valid. See the env-var gotcha below. |
| GitHub Copilot | OAuth in `auth.json` | Connected. |
| OpenRouter | — | **No credential exists**, env or file. Every `openrouter/*` model is unusable. |
| Anthropic (direct) | `ANTHROPIC_API_KEY` | Present but **not workspace-scoped**, so every `anthropic/*` call needs an `anthropic-workspace-id` header. |

## The one that matters for this repo: free models are not equally private

This app holds sexual-health data. Zen's own privacy documentation puts the
free models in three different tiers, and the difference is not cosmetic:

- **`space-bunny-free`** and **`longcat-2.5-preview-free`** — zero-retention
  provider, **not used for training**. These are the only free models safe as
  a default for this repo.
- **`nemotron-3-ultra-free`**, `nemotron-3.5-lightning-free` — NVIDIA trial
  endpoints. Documented as *"Trial use only — do not submit personal or
  confidential data"*, and session data is logged.
- **`big-pickle`**, `fledge-alpha-free`, `mimo-v2.*-free`, `ling-3.*-free`,
  `muse-spark-1.3-contributor-free` — data **may be used to improve the
  model** during their free period.

Never set a training-on-free-tier model as this repo's default. Both defaults
were wrong until 6 Oct 2026 (see below).

## Eligible — 1M+ context and verified working

| Model | Context | Max out | Cost /1M | Notes |
|---|---|---|---|---|
| `opencode/space-bunny-free` | 1,048,576 | **524,288** | free | Zero-retention. **Best free option by a wide margin.** |
| `opencode-go/space-bunny-free` | 1,048,576 | 524,288 | free | Zero-retention. Same model, Go endpoint. |
| `opencode-go/longcat-2.5-preview-free` | 1,000,000 | 131,072 | free | Zero-retention. |
| `opencode-go/qwen3.8-flash` | 1,000,000 | 131,072 | $0.15 / $0.47 | Paid, cheapest verified 1M option. |
| `google/gemini-3.8-flash` | 1,048,576 | 65,536 | own key | Needs the env var below. |
| `google/gemini-3.7-flash` | 1,048,576 | 65,536 | own key | |
| `google/gemini-3.6-flash` | 1,048,576 | 65,536 | own key | |
| `google/gemini-3.5-flash-lite` | 1,048,576 | 65,536 | own key | Cheapest Gemini. First thing to reach for when quota is tight. |
| `google/gemini-flash-latest` | 1,048,576 | 65,536 | own key | Alias; tracks the current flash. |

137 of the 246 models opencode can see advertise 1M+ context. Only the nine
above were reachable with working credentials.

## Ineligible — with the error that was actually returned

| Model(s) | Error |
|---|---|
| `openrouter/*` (all) | No credential exists in env or `auth.json` |
| `opencode-go/muse-spark-1.3-contributor`, `opencode/muse-spark-1.3-contributor` | `This Go model trains on request data. Allow paid endpoints that train on request data in your workspace's Privacy settings` — a **workspace-level** toggle, off by default, only changeable in the opencode.ai dashboard. It cannot be enabled from a config file. |
| all paid `opencode/*` (Zen) | `402 Upstream request failed: Insufficient account funds` — expected, Zen is not subscribed |
| `anthropic/*` (direct) | `This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header` |
| `openai/gpt-5-nano` | `Request too large … on tokens per min (TPM)` then `You have no credits remaining` |
| `opencode/gpt-6-luna` (Zen) | `503 Inference routing is unavailable` |
| `google/gemini-2.5-flash` | `404` on this key, despite appearing in the model list |
| `google/gemini-3.1-pro-preview` | `429` quota at time of test; listed and callable in principle |

### Unverified, not disproven

`fledge-alpha-free`, `longcat-2.5-preview-free` (Zen endpoint),
`nemotron-3-ultra-free`, `nemotron-3.5-lightning-free`, `big-pickle`,
`mimo-v2.5-free`, `mimo-v2.6-flash-free`, `ling-3.0-flash-fin-free`,
`ling-3.1-flash-free`, `muse-spark-1.3-contributor-free`.

All return `403 "OpenCode's free tier can only be used from within OpenCode"`
to a direct HTTP request. That is a **client-identity gate, not proof the
model is broken** — `space-bunny-free` is also free and passed the same test,
so the gate is selective. Untestable from a script; test from `/models` in the
TUI. Until then treat as unknown rather than working.

## The Gemini env-var gotcha

`GEMINI_API_KEY` makes `opencode auth list` report Google as connected, but
every call still failed with:

```
AI_LoadAPIKeyError: Google Generative AI API key is missing.
Pass it using the 'apiKey' parameter or the GOOGLE_GENERATIVE_AI_API_KEY environment variable.
```

The AI SDK reads **`GOOGLE_GENERATIVE_AI_API_KEY`**. opencode recognises the
first name for its own credential listing and does not pass it to the
provider, so a model can look connected and still be unable to run — the most
misleading failure mode found in this whole investigation.

Fixed 6 Oct 2026 by setting `GOOGLE_GENERATIVE_AI_API_KEY` to the same value.
`GEMINI_API_KEY` is kept because `scripts/consult.mjs` reads that name directly
and sends `x-goog-api-key` itself.

**The OpenCode desktop app must be restarted** for this to take effect —
environment variables are read once at process start. If Gemini reports "no API
key" in a session that started before the restart, that is why.

Fallback if it still fails: `opencode auth login` → Google → paste the key.
That writes to `auth.json` and is immune to environment-inheritance problems.

## Default models pinned in this repo

Two files each pin a default, and both were wrong until 6 Oct 2026:

| File | Was | Problem |
|---|---|---|
| `.opencode/opencode.json` | `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` | **No OpenRouter credential exists**, so every new session in this repo started on a model that cannot authenticate |
| `opencode.json` | `opencode/nemotron-3-ultra-free` | Works, but NVIDIA's trial terms forbid submitting personal or confidential data — the wrong default for a sexual-health app |

Both are now `opencode/space-bunny-free`: free, 1M context, and documented
zero-retention.

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

**The free tier is shared across every concurrent session.** Two sessions on
`space-bunny-free` halve each other's throughput and both trip the limit. When
running two sessions, put them on *different* model families — that is the
single most effective thing to change.

Free memory on this 4 GB machine regularly drops to ~350 MB and does produce
false test failures, but it did **not** cause any of these: there is no
`ENOMEM` or crash anywhere in the log.
