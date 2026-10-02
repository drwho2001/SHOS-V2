// Guards the "returned bare Capacitor plugin proxy" bug class, found on a REAL
// device on 30 Sep 2026.
//
// The bug: a Capacitor plugin proxy is a catch-all Proxy, so `proxy.then` is a
// function and the proxy therefore looks *thenable*. Returning one from an async
// function makes the JS engine unwrap it by invoking `.then()`, and Capacitor
// rejects that as "WidgetBridge.then() is not implemented on android". Every
// widget update threw before it ever reached the plugin, so the home-screen
// widgets had never once updated despite the bridge being fully built and
// registered.
//
// This is the SAME class as the earlier ScreenSecurity.then() failure, which was
// fixed in one file. That fix did not propagate, and six copies of the mistake
// shipped. These tests therefore assert the property over EVERY file rather than
// one named file, because a per-file assertion is exactly what let the class
// survive the first fix.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const ALL = walk(SRC);
const FILES_WITH_BRIDGE = ALL.filter((f) => /registerPlugin\(\s*["']WidgetBridge["']\s*\)/.test(readFileSync(f, "utf8")));

// Strip comments so a negative assertion cannot be satisfied by the very comment
// documenting the fix. This repo has repeatedly shipped guards that matched their
// own explanatory comment.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("Capacitor plugin proxies are never returned bare from an async function", () => {
  it("finds the files that register the widget bridge (guard against the list silently emptying)", () => {
    // Without this precondition the whole file could pass by finding nothing.
    expect(
      FILES_WITH_BRIDGE.length,
      "expected several files to register WidgetBridge; if this is 0 the guard below is vacuous",
    ).toBeGreaterThanOrEqual(6);
  });

  it("no async helper returns the raw proxy - it must be wrapped in a plain object", () => {
    const offenders = [];
    for (const file of FILES_WITH_BRIDGE) {
      const src = stripComments(readFileSync(file, "utf8"));
      // A bare `return WidgetBridge;` or `return WidgetBridge || null;` from
      // inside an async helper hands the catch-all proxy straight to the
      // promise machinery, which then calls .then() on it.
      if (/return\s+WidgetBridge\s*(;|\|\|\s*null\s*;)/.test(src)) {
        offenders.push(file.replace(SRC, "src"));
      }
    }
    expect(
      offenders,
      "these return the bare Capacitor proxy from an async function; wrap it as { plugin }",
    ).toEqual([]);
  });

  it("every widget bridge method call goes through the wrapper", () => {
    const METHODS = "updateNextDose|updateRefill|updateTest|updateAppointment|updateClinicCard|updateDoxyPEP|updateCycle";
    const offenders = [];
    for (const file of FILES_WITH_BRIDGE) {
      const src = stripComments(readFileSync(file, "utf8"));
      const bare = src.match(new RegExp(`bridge\\.(?:${METHODS})`, "g"));
      if (bare) offenders.push(`${file.replace(SRC, "src")}: ${bare.join(", ")}`);
    }
    expect(offenders, "call the plugin through bridge.plugin.* so it is the wrapper that is returned").toEqual([]);
  });
});

describe("the mechanism, demonstrated rather than asserted in prose", () => {
  it("an async function returning a catch-all proxy makes the engine invoke .then() on it", async () => {
    // This is the actual failure mode, reproduced in isolation. If this ever
    // stops being true the guard above is protecting against nothing, so the
    // test asserts it still holds.
    let thenCalls = 0;
    const proxy = new Proxy(
      {},
      {
        get(_t, key) {
          if (key === "then") return function (resolve) { thenCalls++; return resolve({ viaThen: true }); };
          return function stub() {};
        },
      },
    );

    const result = await (async () => proxy)();
    expect(thenCalls, "engine should have unwrapped the proxy via .then()").toBe(1);
    expect(result).toEqual({ viaThen: true });
  });

  it("wrapping the proxy in a plain object prevents the unwrap entirely", async () => {
    let thenCalls = 0;
    const proxy = new Proxy(
      {},
      {
        get(_t, key) {
          if (key === "then") return function (resolve) { thenCalls++; return resolve({ viaThen: true }); };
          return function stub() {};
        },
      },
    );

    const wrapped = await (async () => ({ plugin: proxy }))();
    expect(thenCalls, "a plain wrapper object must not be treated as thenable").toBe(0);
    expect(Object.keys(wrapped)).toEqual(["plugin"]);
  });
});

describe("the native side the JS depends on actually exists", () => {
  const javaPath = join(
    process.cwd(),
    "android/app/src/main/java/com/shos/app/WidgetBridgePlugin.java",
  );

  it("WidgetBridgePlugin.java exists and is registered in MainActivity", () => {
    // Without the registerPlugin call the JS proxy resolves to nothing useful and
    // every method below is unreachable - which is exactly the state the app
    // shipped in before, so this asserts the wiring rather than trusting it.
    expect(existsSync(javaPath), "WidgetBridgePlugin.java should exist").toBe(true);
    const main = readFileSync(
      join(process.cwd(), "android/app/src/main/java/com/shos/app/MainActivity.java"),
      "utf8",
    );
    expect(main).toMatch(/registerPlugin\(\s*WidgetBridgePlugin\.class\s*\)/);
  });

  it("implements every method the JS calls", () => {
    // A JS call to a method the native plugin does not implement rejects with
    // "WidgetBridge.<method>() is not implemented on android" - the SAME shape of
    // error as the bug above, so a green JS-side guard alone would not catch it.
    const java = readFileSync(javaPath, "utf8");
    const called = new Set();
    for (const file of FILES_WITH_BRIDGE) {
      const s = stripComments(readFileSync(file, "utf8"));
      for (const m of s.matchAll(/bridge\.plugin\.(\w+)\s*\(/g)) called.add(m[1]);
    }
    // WIDENED 2 Oct 2026. The widget calls moved into sendWidgetUpdate, which
  // dispatches dynamically (`bridge[method](...)`) so that every one of them is
  // filtered by the same tier rule. A dynamic call cannot be enumerated by a
  // regex looking for `bridge.plugin.name(`, so this non-vacuity check found
  // zero methods and failed - correctly, because it is the thing standing
  // between "the guard matched nothing" and "the guard proved something".
  //
  // The second pattern is the literal method name as passed to the helper.
  // Kept deliberately narrow: it would match the string anywhere, so the
  // "Java declares it" assertion below is what makes a false match harmless.
  for (const file of FILES_WITH_BRIDGE) {
    const s = stripComments(readFileSync(file, "utf8"));
    for (const m of s.matchAll(/sendWidgetUpdate\([^,]+,[^,]+,\s*"(update\w+)"/g)) called.add(m[1]);
  }
  expect(called.size, "expected the JS to call several bridge methods").toBeGreaterThan(4);
    for (const method of called) {
      expect(
        java.includes(`public void ${method}(`),
        `WidgetBridgePlugin.java is missing ${method}, which the JS calls`,
      ).toBe(true);
    }
  });
});
