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
  });

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
  });
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
  });

  it("editing the file list of a task I am WORKING ON moves the claim", () => {
    const home = fresh();
    add(home, "in flight", "src/a.js");
    const id = poolOf(home).tasks[0].id;
    bus("A", home, "pool", "take", id);
    expect(filesClaimedBy(home, "A")).toEqual(["src/a.js"]);
    bus("A", home, "pool", "edit", id, "--files=src/c.js");
    expect(filesClaimedBy(home, "A")).toEqual(["src/c.js"]);
  });
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
  });
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
  });

  it("rm removes exactly one task, not every task sharing its id", () => {
    const home = fresh();
    add(home, "a");
    add(home, "b");
    const ids = poolOf(home).tasks.map((t) => t.id);
    bus("A", home, "pool", "rm", ids[0]);
    expect(poolOf(home).tasks).toHaveLength(1);
    expect(poolOf(home).tasks[0].id).toBe(ids[1]);
  });

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
