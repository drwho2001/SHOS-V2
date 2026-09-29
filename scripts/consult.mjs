// consult.mjs — ask a SECOND model a question, and record the exchange.
//
// WHY THIS EXISTS
//
// The owner wants two sessions working the same project and cross-checking each
// other. The blocker for that was always the same: opencode cannot wake an idle
// session. `POST /api/session/{id}/prompt` returns 200 and does nothing to a
// TUI session (measured), and the TUI endpoints are directory-scoped rather than
// session-scoped (measured - they typed into the caller's own terminal).
//
// This sidesteps that entirely. It does not wake a session at all: it calls a
// DIFFERENT model through its own public API and writes the exchange to the same
// shared state the other session already reads. So "A asks Gemini a question, B
// reads the answer" works, without either session being able to wake the other.
// The cost is that the second opinion is a model, not a live session - it has no
// memory of this repo, so it is genuinely an outside opinion rather than a
// collaborator with context.
//
// KEYS
//
// Read from the environment only (GEMINI_API_KEY / OPENAI_API_KEY /
// ANTHROPIC_API_KEY). Never written anywhere, never logged, never passed on a
// command line. Nothing this script produces goes near the repository's own
// credentials, which live outside it precisely because this is the public
// alpha track.
//
// MODELS
//
// Defaults are chosen to be cheap or free. Gemini's alias is used rather than a
// version number on purpose: `gemini-2.5-flash` and `gemini-2.0-flash` are both
// still LISTED by the API but return 404 "no longer available", so the catalogue
// is not a promise that a model is callable. The `gemini-flash-latest` alias
// resolved to gemini-3.8-flash when checked, and an alias tracks the current
// release instead of ageing into a 404.

import { appendFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BUS = join(homedir(), ".shos-session-bus");
const EXCHANGE_LOG = join(BUS, "exchanges.jsonl");
const ME = process.env.SHOS_SESSION_NAME || "unknown";

// The free tier is heavily contended, and the owner's instruction is to fall
// back to an older/quieter free model when the current one is rate- or
// capacity-limited, and to always prefer the cheapest option that is included in
// a subscription. So each provider is a LADDER, not a single model, and the
// ladders are ordered by that policy rather than by capability:
//
//   subscription/free first (opencode, Google Flash), paid APIs last resort
//
// Google is first because the Flash tier is free and there are several
// generations of it; walking the ladder spreads the request across differently
// contended pools rather than retrying the same busy one. A non-contention
// error (a 400, a bad key, no credits) does NOT walk the ladder - retrying it on
// a different model would just fail the same way and waste the owner's time.
const PROVIDERS = {
  gemini: {
    policy: "free tier - preferred",
    ladder: [
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
      "gemini-2.5-flash-lite",
      "gemini-3.1-flash-lite",
    ],
    async call(model, prompt) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": requireEnv("GEMINI_API_KEY"), "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192 },
          }),
        }
      );
      const j = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${JSON.stringify(j).slice(0, 300)}`);
      return {
        text: (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim(),
        servedBy: j.modelVersion || model,
      };
    },
  },
  openai: {
    policy: "paid, no credits on the current key - last resort",
    ladder: ["gpt-4.1-nano", "gpt-4.1-mini", "gpt-5.4-mini"],
    async call(model, prompt) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 4000 }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${JSON.stringify(j).slice(0, 300)}`);
      return { text: (j.choices?.[0]?.message?.content || "").trim(), servedBy: j.model || model };
    },
  },
  anthropic: {
    policy: "paid, workspace-scoped key - last resort",
    ladder: ["claude-sonnet-4-5"],
    async call(model, prompt) {
      const headers = {
        "x-api-key": requireEnv("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      };
      // This key is NOT a plain console API key: it returns 400 "not scoped to
      // a workspace" without this header, which is what a workspace/team key
      // requires. Read from the environment so the ID is never committed.
      if (process.env.ANTHROPIC_WORKSPACE_ID) {
        headers["anthropic-workspace-id"] = process.env.ANTHROPIC_WORKSPACE_ID;
      }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
      });
      const j = await res.json();
      if (!res.ok) {
        const msg = j?.error?.message || JSON.stringify(j).slice(0, 300);
        if (/workspace/i.test(msg)) {
          throw new Error(`HTTP ${res.status}: key is not scoped to a workspace - set ANTHROPIC_WORKSPACE_ID`);
        }
        throw new Error(`HTTP ${res.status} ${msg}`);
      }
      return { text: (j.content || []).map((c) => c.text || "").join("").trim(), servedBy: j.model || model };
    },
  },
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set in this shell. It is an environment variable, not a file - ` +
        `set it in your user environment, or pass it for this command only.`
    );
  }
  return v;
}

// Free-tier models are heavily contended and return 429/503 routinely - a bare
// "please try again later". A consult that fails on the first transient blip is
// useless in the workflow this is for, so contention is handled twice over:
// a short backoff on the same model, then a step DOWN THE LADDER to a different
// (usually older, quieter, cheaper) model. 4xx other than 429 is NOT retried and
// does not walk the ladder: a 400 is a real problem with the request or the key,
// and retrying it on a different model just fails the same way.
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

function statusOf(message) {
  return Number((message.match(/HTTP (\d+)/) || [])[1] || 0);
}

/**
 * Call the provider, walking its ladder on contention.
 * @returns {{text: string, servedBy: string, askedModel: string, attempts: string[]}}
 */
async function callWithLadder(provider, prompt, explicitModel) {
  const p = PROVIDERS[provider];
  // An explicit --model is a hard instruction: use it, retry it, but do not
  // silently substitute a different model behind the owner's back.
  const ladder = explicitModel ? [explicitModel] : p.ladder;
  const attempts = [];
  for (let idx = 0; idx < ladder.length; idx += 1) {
    const model = ladder[idx];
    for (let tryNo = 1; tryNo <= 2; tryNo += 1) {
      try {
        const r = await p.call(model, prompt);
        attempts.push(`${model} ok`);
        return { ...r, askedModel: model, attempts };
      } catch (err) {
        attempts.push(`${model} ${err.message.slice(0, 60)}`);
        if (!RETRYABLE.has(statusOf(err.message))) throw err;
        if (tryNo === 1) {
          const wait = 1200;
          process.stdout.write(`  [${provider}] HTTP ${statusOf(err.message)} on ${model}, retrying in ${wait}ms\n`);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }
    if (idx < ladder.length - 1) {
      process.stdout.write(`  [${provider}] still contended, stepping down to ${ladder[idx + 1]}\n`);
    }
  }
  throw new Error(`all ${ladder.length} model(s) contended. tried: ${attempts.join(" | ")}`);
}

const [, , provider, ...rest] = process.argv;
const flag = (name) => {
  const f = rest.find((a) => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
};
const positional = rest.filter((a) => !a.startsWith("--"));
const prompt = positional.join(" ");
const model = flag("model") || null;
const slug = flag("task") || null;

if (!provider || provider === "help" || !prompt) {
  console.log(`consult — ask a second model a question, and record the exchange

  node scripts/consult.mjs <provider> "<question>" [--model=X] [--task=slug]

  providers and ladders (cheapest / subscription-friendly first):
${Object.entries(PROVIDERS).map(([k, v]) => `    ${k.padEnd(10)} ${v.policy}\n               ${v.ladder.join(" -> ")}`).join("\n")}

  On a rate/capacity error the ladder steps DOWN automatically to a quieter,
  usually older and cheaper model. --model pins one model and will not substitute.

  --task=slug   also append the exchange to tasks/<slug>/<NN>-<provider>.md,
                so the other session reads it as part of the joint-work protocol.
  keys come from the environment only.`);
  process.exit(provider ? 0 : 2);
}

const p = PROVIDERS[provider];
if (!p) {
  console.error(`Unknown provider "${provider}". Known: ${Object.keys(PROVIDERS).join(", ")}`);
  process.exit(2);
}

try {
  const used = model || p.defaultModel;
  process.stdout.write(`consulting ${provider} (${model || "cheapest available"})... `);
  const { text, servedBy, askedModel, attempts } = await callWithLadder(provider, prompt, model);
  console.log(`asked ${askedModel}, answered by ${servedBy}\n  (attempts: ${attempts.join("; ")})\n`);
  if (!text) {
    console.error("(the model returned no text)");
    process.exit(1);
  }
  console.log(text);

  // Recorded so the OTHER session can read it on its next turn. This is the
  // whole point: no session is woken, the answer is simply left where the other
  // one already looks.
  const entry = {
    at: new Date().toISOString(),
    askedBy: ME,
    provider,
    model: askedModel,
    servedBy,
    prompt: prompt.slice(0, 400),
    replyChars: text.length,
  };
  mkdirSync(BUS, { recursive: true });
  appendFileSync(EXCHANGE_LOG, JSON.stringify(entry) + "\n", "utf8");

  if (slug) {
    const dir = join(BUS, "tasks", slug);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `90-${provider}-consult.md`);
    const header =
      `# ${provider} consulted by ${ME} at ${entry.at}\n\n` +
      `model: ${used} (served by ${servedBy})\n\n` +
      `## Question\n\n${prompt}\n\n## Answer\n\n${text}\n`;
    writeFileSync(file, header, "utf8");
    console.log(`\n--- recorded to tasks/${slug}/90-${provider}-consult.md (other session can read it) ---`);
  }
} catch (err) {
  console.error(`\nconsult failed: ${err.message}`);
  process.exit(1);
}
