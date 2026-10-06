// sessionBridge.test.js - the coordination tool's own test suite.
//
// WHY THIS EXISTS. session-bridge.mjs is how two concurrent sessions avoid
// editing the same file. It is the one piece of tooling whose own failure is
// silent and whose failure mode is two people confidently disagreeing about who
// holds what. And in one session it produced FIVE separate bugs, every one of
// them found by using it and looking at the result:
//
//   1. `pool take <id>` ignored the id entirely and allocated the first takeable
//      task, claiming the WRONG task's files while reporting success.
//   2. process.exit() inside the pool lock skipped the `finally` that deletes
//      pool.lock, so every refusal locked the other session out for 10s.
//   3. The fix for (2) corrected exactly one call site and left 11 others.
//   4. `pool edit --files=` claimed files on ANNOTATION, stopping the other
//      session from taking the task at all.
//   5. `pool done`/`block`/`release` never released claims, so completed tasks
//      froze their files and the pool locked itself shut one file at a time.
//
// None of these were found by reading the code. The common cause is that there
// was no way to run the tool twice in a test and assert on the outcome - so
// everything was verified by hand, one bug at a time, forever.
//
// Each test below drives the real CLI as a SUBPROCESS against a temporary
// SHOS_BUS_HOME. Subprocess rather than import because the tool's whole contract
// is process-level: exit codes, stdout, and the lock file on disk are the
// observable behaviour, and an in-process call would not exercise any of it.
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { execFileSync, spawnSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BRIDGE = join(process.cwd(), "scripts", "session-bridge.mjs");
const roots = [];

// Budget for any test that spawns several bridge subprocesses. This suite's
// observable behaviour IS process-level - exit codes, stdout, pool.lock on disk -
// so `bus()` is a real `node` launch, not a function call, and a test issuing a
// dozen of them is paying a dozen process startups.
//
// Under full-suite load that exceeded vitest's 5s default and presented as a
// TIMEOUT on a test that was entirely correct: "never issues a duplicate id,
// even after deletions leave gaps" (13 spawns, 7.7s of test time in isolation)
// failed under `npm run verify:fast` and passed standalone.
//
// Same class as the eight AST guards given explicit budgets elsewhere in this
// repo, and the same rule: a test must never depend on how fast the machine is.
// Applied to every test with >=4 spawns rather than only the one observed to
// fail, because scoping a fix to the symptom that happened to surface is how a
// sibling fails on the next loaded run. Add-only - it cannot turn a correct test
// red, and cannot turn a failing one green.
const SUBPROCESS_BUDGET_MS = 30_000;

/** Run the CLI as a session, against an isolated state dir. */
function bus(session, home, ...args) {
  const r = spawnSync(process.execPath, [BRIDGE, ...args], {
    encoding: "utf8",
    env: { ...process.env, SHOS_BUS_HOME: home, SHOS_SESSION_NAME: session },
  });
  return { code: r.status, out: r.stdout || "", err: r.stderr || "" };
}

function fresh() {
  const home = mkdtempSync(join(tmpdir(), "shos-bus-"));
  mkdirSync(join(home, "state"), { recursive: true });
  roots.push(home);
  return home;
}

const poolOf = (home) => JSON.parse(readFileSync(join(home, "state", "pool.json"), "utf8"));
// claims.json does not exist until something is actually claimed - it is not
// seeded empty. Reading it unconditionally threw ENOENT in three tests, which
// is the harness lying about the tool rather than the other way round.
const claimsOf = (home) => {
  const p = join(home, "state", "claims.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
};
const lockExists = (home) => existsSync(join(home, "state", "pool.lock"));
const filesClaimedBy = (home, who) =>
  Object.entries(claimsOf(home))
    .filter(([, v]) => (v.holders || []).some((h) => h.by === who))
    .map(([f]) => f);

/**
 * Wait without blocking the thread.
 *
 * Two wrong versions of this, both instructive. The first spawned
 * `node -e "setTimeout(...)"` per poll, adding a process per iteration on top of
 * the writers being waited for. The second used Atomics.wait, which blocks the
 * thread outright - and a blocked thread cannot answer vitest's worker RPC, so
 * the run died with "Timeout calling onTaskUpdate" and a NON-ZERO EXIT while
 * all 17 tests had passed. Green suite, red gate, caused entirely by the thing
 * that waits. An async timer keeps the event loop alive.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const add = (home, title, files) =>
  bus("A", home, "pool", "add", title, ...(files ? [`--files=${files}`] : []));

describe("a stale lease is described honestly", () => {
  // The bug this pins. `pool list` labelled an expired task as
  // "ABANDONED, owner process gone", which is a claim the tool cannot make:
  // liveness is a wall-clock LEASE, because the recorded PID belongs to a
  // `node session-bridge.mjs` process that exited milliseconds after allocation
  // and is deliberately never consulted. A session that had been working
  // normally for longer than the lease was therefore described as dead, and
  // `pool reap` would have handed its files to whoever asked next - which is
  // the duplicated work the pool exists to prevent. The message also said
  // "process gone" while doing no process check at all, so a reader could
  // reasonably trust it and act on it.
  const withShortLease = (home) => {
    const r = spawnSync(process.execPath, [BRIDGE, "pool", "add", "leased"], {
      encoding: "utf8",
      env: { ...process.env, SHOS_BUS_HOME: home, SHOS_SESSION_NAME: "A" },
    });
    expect(r.status).toBe(0);
  };

  it("does not claim a process is gone when it has not checked for one", () => {
    const home = fresh();
    withShortLease(home);
    // Expire the lease by hand rather than by waiting four hours.
    const p = join(home, "state", "pool.json");
    const pool = JSON.parse(readFileSync(p, "utf8"));
    pool.tasks[0].status = "doing";
    pool.tasks[0].owner = "B";
    pool.tasks[0].touchedAt = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    writeFileSync(p, JSON.stringify(pool));

    const { out } = bus("A", home, "pool", "list");
    expect(out).not.toMatch(/ABANDONED/i);
    expect(out).not.toMatch(/process gone/i);
    // And it must say what is actually true, plus the way out.
    expect(out).toMatch(/UNTOUCHED/i);
    expect(out).toMatch(/pool touch/);
  });

  it("touch extends a lease, so long-running work is not reaped mid-flight", () => {
    const home = fresh();
    withShortLease(home);
    const p = join(home, "state", "pool.json");
    const pool = JSON.parse(readFileSync(p, "utf8"));
    const staleAt = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    pool.tasks[0].status = "doing";
    pool.tasks[0].owner = "B";
    pool.tasks[0].touchedAt = staleAt;
    writeFileSync(p, JSON.stringify(pool));

    const { code, out } = bus("B", home, "pool", "touch", pool.tasks[0].id);
    expect(code).toBe(0);
    expect(out).toMatch(/lease extended/i);
    expect(poolOf(home).tasks[0].touchedAt).not.toBe(staleAt);
  });
});

afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

describe("the pool lock", () => {
  it("is released after a success", () => {
    const home = fresh();
    add(home, "one");
    expect(lockExists(home)).toBe(false);
  });

  it("is released after EVERY refusal, not just the first one fixed", () => {
    // This is the regression test for bug 2 and, more importantly, for bug 3 -
    // the fix corrected one call site and left eleven, so this deliberately
    // exercises six DIFFERENT refusal verbs rather than the one that was fixed.
    const home = fresh();
    add(home, "seed", "src/seed.js");
    for (const verb of ["take", "done", "block", "release", "touch", "edit"]) {
      // `take` with no id is NOT a refusal when something is available - it
      // allocates. An unknown id is a refusal, so every verb below is driven
      // into its refusal path deliberately.
      const args = verb === "take" ? ["pool", "take", "t999"] : ["pool", verb];
      const r = bus("A", home, ...args);
      expect(r.code, `${verb} should refuse`).toBe(2);
      expect(lockExists(home), `${verb} leaked pool.lock`).toBe(false);
    }
  }, 30000);

it("serialises concurrent writers without losing an update", async () => {
      // Bug 1's sibling: every pool verb is a read-modify-write of the whole file,
      // so two sessions mutating at once used to mean one silently vanished.
      // Four writers rather than eight: still enough to overlap and prove the
      // lock serialises them, without doubling the wall time on a machine this
      // project already treats as memory-constrained.
      const home = fresh();
      add(home, "seed");
      const kids = Array.from({ length: 4 }, (_, i) =>
        spawn(process.execPath, [BRIDGE, "pool", "add", `c${i}`], {
          env: { ...process.env, SHOS_BUS_HOME: home, SHOS_SESSION_NAME: i % 2 ? "A" : "B" },
          stdio: "ignore",
        })
      );
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline && kids.some((k) => k.exitCode === null && k.signalCode === null)) {
        await sleep(100);
      }
      expect(poolOf(home).tasks.length, "4 concurrent adds + 1 seed should all survive").toBe(5);
      expect(lockExists(home)).toBe(false);
    }, 90000);
});

describe("pool take honours the id it is given", () => {
  it("allocates the NAMED task, not the first available one", () => {
    // Bug 1. `take t002` used to return t001, claim t001's files, and report
    // success - so a session believed it held one job while holding another's.
    const home = fresh();
    add(home, "first", "src/a.js");
    add(home, "second", "src/b.js");
    const ids = poolOf(home).tasks.map((t) => t.id);
    const second = ids[1];
    const r = bus("A", home, "pool", "take", second);
    expect(r.out).toContain(second);
    expect(r.out).not.toContain(ids[0]);
    expect(filesClaimedBy(home, "A")).toEqual(["src/b.js"]);
  }, SUBPROCESS_BUDGET_MS);

  it("refuses an unknown id rather than substituting one", () => {
    const home = fresh();
    add(home, "only", "src/a.js");
    const r = bus("A", home, "pool", "take", "t999");
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/no such task/i);
    expect(filesClaimedBy(home, "A")).toEqual([]);
  });

  it("refuses a task another session already holds", () => {
    const home = fresh();
    add(home, "shared", "src/a.js");
    const id = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", id);
    const r = bus("B", home, "pool", "take", id);
    expect(r.code).toBe(2);
    // The refusal must name the file, so the other session can see WHY.
    expect(r.err).toMatch(/src\/a\.js/);
  }, SUBPROCESS_BUDGET_MS);
});

describe("claims follow allocation, not annotation", () => {
  it("editing the file list of an APPROVED task claims nothing", () => {
    // Bug 4. Recording a scope used to lock the files, which stopped the other
    // session taking the task at all - a plan change silently became an
    // allocation.
    const home = fresh();
    add(home, "scoped", "src/a.js");
    const id = poolOf(home).tasks[0].id;
    const r = bus("A", home, "pool", "edit", id, "--files=src/b.js");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/plan only/i);
    expect(filesClaimedBy(home, "A")).toEqual([]);
    // And the other session must still be able to take it.
    expect(bus("B", home, "pool", "take", id).code).toBe(0);
  }, SUBPROCESS_BUDGET_MS);

  it("editing the file list of a task I am WORKING ON moves the claim", () => {
    const home = fresh();
    add(home, "in flight", "src/a.js");
    const id = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", id);
    expect(filesClaimedBy(home, "A")).toEqual(["src/a.js"]);
    bus("A", home, "pool", "edit", id, "--files=src/c.js");
    expect(filesClaimedBy(home, "A")).toEqual(["src/c.js"]);
  }, SUBPROCESS_BUDGET_MS);
});

describe("claims are released when work stops", () => {
  it.each(["done", "block", "release"])("%s releases the files", (verb) => {
    // Bug 5. A finished task kept its files, so follow-up work in the same area
    // was impossible for the other session - a slow, quiet failure that froze
    // the pool one file at a time.
    const home = fresh();
    add(home, "task", "src/a.js");
    const id = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", id);
    expect(filesClaimedBy(home, "A")).toEqual(["src/a.js"]);
    bus("A", home, "pool", verb, id);
    expect(filesClaimedBy(home, "A"), `${verb} should have released src/a.js`).toEqual([]);
  });

  it("a completed task does not block the other session from the same file", () => {
    const home = fresh();
    add(home, "task", "src/shared.js");
    const id = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", id);
    bus("A", home, "pool", "done", id);
    add(home, "follow up", "src/shared.js");
    const next = poolOf(home).tasks[1].id;
    expect(bus("B", home, "pool", "take", next).code, "B should be able to take it").toBe(0);
  }, SUBPROCESS_BUDGET_MS);
});

describe("releasing another session's claim (authorised takeover)", () => {
  // The regression test for L-070. A session's file claim outlived the session,
  // `pool take` refused on it, `help` did not document that `claim release`
  // existed, the existing `claim release` could only ever drop ME's own claims,
  // and `pool take`'s refusal pointed at `pool block` - which is a different
  // operation. So the documented answer was wrong twice over and the only way
  // forward was to file a file-less workaround task. Every test here is one of
  // those four facts, pinned.
  it("frees a stale foreign claim so the other session can work on the file", () => {
    const home = fresh();
    add(home, "first", "src/a.js");
    const t1 = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", t1);
    add(home, "follow up", "src/a.js");
    const t2 = poolOf(home).tasks[1].id;
    // The dead end: B is refused, and this refusal is the whole problem.
    expect(bus("B", home, "pool", "take", t2).code).toBe(2);
    // The remedy.
    const rel = bus("B", home, "claim", "release", "src/a.js", "--from=A", "--reason=owner authorised takeover");
    expect(rel.code, rel.err).toBe(0);
    expect(filesClaimedBy(home, "A")).toEqual([]);
    expect(bus("B", home, "pool", "take", t2).code, "B should now get the task").toBe(0);
  }, SUBPROCESS_BUDGET_MS);

  it("refuses without a reason, and changes nothing", () => {
    // An override nobody can explain afterwards is how two sessions end up
    // editing one file, so the reason is required rather than merely encouraged.
    const home = fresh();
    add(home, "task", "src/a.js");
    const id = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", id);
    const r = bus("B", home, "claim", "release", "src/a.js", "--from=A");
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/--reason/);
    expect(filesClaimedBy(home, "A")).toEqual(["src/a.js"]);
  });

  it("refuses when the named session does not hold the file, changing nothing", () => {
    // Guards the typo, and guards the worse case: releasing by session NAME must
    // never release a different holder's claim just because the name was wrong.
    const home = fresh();
    add(home, "task", "src/a.js");
    const id = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", id);
    const r = bus("B", home, "claim", "release", "src/a.js", "--from=C", "--reason=typo in the name");
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/not held by C/);
    expect(filesClaimedBy(home, "A")).toEqual(["src/a.js"]);
  });

  it("is all-or-nothing: one unheld filename releases nothing at all", () => {
    // A partial release is worse than none - the other session would see some of
    // its files free, could not tell which, and would either idle or start editing
    // a file still held. So validation runs across every file before any write.
    const home = fresh();
    add(home, "task", "src/a.js,src/b.js");
    const id = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", id);
    const r = bus("B", home, "claim", "release", "src/a.js", "src/nope.js", "--from=A", "--reason=mixed batch");
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/nothing was changed/i);
    expect(filesClaimedBy(home, "A").sort()).toEqual(["src/a.js", "src/b.js"]);
  }, SUBPROCESS_BUDGET_MS);

  it("records the takeover where the returning session will actually find it", () => {
    const home = fresh();
    add(home, "task", "src/a.js");
    const id = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", id);
    bus("B", home, "claim", "release", "src/a.js", "--from=A", "--reason=session finished and pushed");
    // Two audiences, not belt-and-braces: `inbox` is what a returning session
    // runs first, the backlog is what a session reading state cold finds.
    const notices = readFileSync(join(home, "notices.jsonl"), "utf8");
    expect(notices).toMatch(/CLAIM TAKEOVER/);
    expect(notices).toMatch(/session finished and pushed/);
    expect(readFileSync(join(home, "backlog.md"), "utf8")).toMatch(/Claim takeover/);
  }, SUBPROCESS_BUDGET_MS);

  it("a plain release still cannot strip another session's claim", () => {
    // The asymmetry is deliberate, and it is the whole safety property: reaching
    // someone else's claim must require naming it on purpose and justifying it.
    const home = fresh();
    add(home, "task", "src/a.js");
    const id = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", id);
    const r = bus("B", home, "claim", "release", "src/a.js");
    expect(r.code, "must not report success for a no-op").toBe(2);
    expect(r.out).toMatch(/left alone/i);
    expect(filesClaimedBy(home, "A")).toEqual(["src/a.js"]);
  }, SUBPROCESS_BUDGET_MS);

  it("a flag is never mistaken for a filename", () => {
    // The old file list filtered only the literal "release", so `claim --x` wrote
    // a real claim entry for a file literally named "--x" - permanently held, and
    // releasable by nobody.
    const home = fresh();
    bus("A", home, "claim", "src/a.js", "--from=B");
    expect(Object.keys(claimsOf(home))).toEqual(["src/a.js"]);
  });
});

describe("help documents the release modes", () => {
  it("names `claim release`, and the takeover form", () => {
    // L-070's actual cause: `claim release` had existed all along and was absent
    // from `help`, so a session reading the tool's own instructions concluded it
    // did not exist and filed a workaround instead. This is the guard for that,
    // and it is cheap precisely because the failure was documentation-shaped.
    const home = fresh();
    const out = bus("A", home, "help").out;
    // Each form asserted SEPARATELY, not as one `/claim release/` substring. The
    // first version did the latter, and mutation testing showed why that is
    // worthless: deleting the plain-release line left the takeover line's
    // "claim release" still matching, so the guard stayed green with half the
    // documentation gone. A substring check cannot tell "documented" from
    // "mentioned somewhere in the same block".
    expect(out, "help must document releasing your own claims").toMatch(
      /claim release <file\.\.\.>\s+release YOUR OWN/
    );
    expect(out, "help must document the takeover form").toMatch(
      /claim release <file\.\.\.> --from=<session> --reason=/
    );
    expect(out, "help must document lease extension for long work").toMatch(/pool touch/);
  });
});

describe("claims reports which claims have no task behind them", () => {
  it("marks an orphan claim and names the remedy", () => {
    // The shape that blocks a takeover is invisible until someone tries to take a
    // task touching the same file - at which point the only visible facts are a
    // session name and a timestamp. The table now says so.
    const home = fresh();
    bus("A", home, "claim", "src/a.js");
    const out = bus("B", home, "claims").out;
    expect(out).toMatch(/no task in flight/);
    expect(out).toMatch(/--from=A/);
  });

  it("does not mark a claim whose task really is in flight", () => {
    // Non-vacuity, and the reason it matters: a marker that is always on is
    // decoration, and would train the next session to ignore the word.
    const home = fresh();
    add(home, "task", "src/a.js");
    const id = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", id);
    expect(bus("B", home, "claims").out).not.toMatch(/no task in flight/);
  }, SUBPROCESS_BUDGET_MS);

  it("does not call a claim abandoned or stale - it cannot know that", () => {
    // Same honesty rule the pool half already follows: this tool cannot observe
    // liveness (the recorded pid belongs to a process that exited milliseconds
    // later), and a session may hold a file with no pool task at all.
    const home = fresh();
    bus("A", home, "claim", "src/a.js");
    const out = bus("B", home, "claims").out.toLowerCase();
    expect(out).not.toMatch(/abandoned|owner process gone|is dead/);
  });
});

describe("a refusal says what to do next", () => {
  it("names the holding session and both real remedies", () => {
    // `pool take` used to name the files but not the holder, and point only at
    // `pool block` - the wrong action when the holder is dead and you are its
    // successor. The one command a stuck session reads pointed it away from the
    // command that unblocks it.
    const home = fresh();
    add(home, "first", "src/a.js");
    const t1 = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", t1);
    add(home, "follow up", "src/a.js");
    const t2 = poolOf(home).tasks[1].id;
    const r = bus("B", home, "pool", "take", t2);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/held by A/);
    expect(r.err).toMatch(/claim release/);
    expect(r.err).toMatch(/pool block/);
  }, SUBPROCESS_BUDGET_MS);
});

describe("task identity", () => {
  it("never issues a duplicate id, even after deletions leave gaps", () => {
    // A duplicate id makes two tasks unmarkable, unhittable and jointly
    // destructible (`rm` filters EVERY task carrying the id) in a file whose
    // entire purpose is stopping two sessions picking the same work.
    const home = fresh();
    add(home, "a");
    add(home, "b");
    add(home, "c");
    const ids = poolOf(home).tasks.map((t) => t.id);
    bus("A", home, "pool", "rm", ids[1]);
    add(home, "d");
    const after = poolOf(home).tasks.map((t) => t.id);
    expect(new Set(after).size, `duplicate id issued: ${after.join(",")}`).toBe(after.length);
    // Budget, not a fix. This test spawns five real `node` subprocesses (four adds
    // plus an rm), and each spawn is a full process launch rather than a function
    // call. Under full-suite load that can exceed vitest's 5s default and present
    // as a timeout on a test that is entirely correct.
    //
    // The SAME class of problem as the eight AST guards given explicit budgets
    // elsewhere in this repo, and the same rule applies: a test must never depend
    // on how fast the machine is. Verified passing in isolation at 7.7s of test
    // time against a 30s budget, which is ~4x headroom.
  }, 30_000);

  it("rm removes exactly one task, not every task sharing its id", () => {
    const home = fresh();
    add(home, "a");
    add(home, "b");
    const ids = poolOf(home).tasks.map((t) => t.id);
    bus("A", home, "pool", "rm", ids[0]);
    expect(poolOf(home).tasks).toHaveLength(1);
    expect(poolOf(home).tasks[0].id).toBe(ids[1]);
  }, SUBPROCESS_BUDGET_MS);

  it("rm says so when the id does not exist, rather than reporting success", () => {
    const home = fresh();
    add(home, "a");
    const r = bus("A", home, "pool", "rm", "t999");
    expect(r.out).toMatch(/not found|nothing to remove/i);
  });
});

describe("the harness itself", () => {
  it("SHOS_BUS_HOME isolates state, and the default is unchanged", () => {
    // If this ever stops isolating, every test below is writing to the real
    // two-session pool - which is the failure this harness was built to avoid.
    const home = fresh();
    add(home, "isolated");
    const real = join(process.env.USERPROFILE || process.env.HOME, ".shos-session-bus", "state", "pool.json");
    const src = readFileSync(join(process.cwd(), "scripts", "session-bridge.mjs"), "utf8");
    expect(src).toMatch(/process\.env\.SHOS_BUS_HOME\s*\|\|\s*join\(homedir\(\)/);
    // The real pool must not have gained this task.
    if (existsSync(real)) {
      const titles = JSON.parse(readFileSync(real, "utf8")).tasks.map((t) => t.title);
      expect(titles).not.toContain("isolated");
    }
  });

  it("every refusal path in the source is a thrown sentinel, not process.exit", () => {
    // The structural half of bug 3: process.exit inside the lock skips its
    // `finally`. Asserted on the source because the runtime behaviour is
    // covered above, and this catches the NEXT one being added.
    const src = readFileSync(BRIDGE, "utf8");
    const handler = src.slice(src.indexOf("function poolHandler"));
    const end = handler.indexOf("commands.stuck") > 0 ? handler.indexOf("commands.stuck") : handler.length;
    const body = handler.slice(0, end);
    const exits = body.match(/process\.exit\(\d+\)/g) || [];
    expect(exits, `process.exit() still used inside poolHandler: ${exits.length}`).toHaveLength(0);
  });
});
