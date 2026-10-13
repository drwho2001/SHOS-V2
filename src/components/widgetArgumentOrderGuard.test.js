// widgetArgumentOrderGuard.test.js
//
// NEW GUARD, 13 Oct 2026 (t060). Every assertion here corresponds to a LIVE BUG
// that was shipping in the public alpha APK, not to a hypothetical.
//
// THE BUG CLASS: a provider's `public static void updateX(...)` DECLARATION and
// the `WidgetBridgePlugin` CALL SITE disagreed about parameter order. Every one of
// these parameters is a String (or a long next to Strings), so the Java compiler
// could not see it, `build-apk` stayed green, and the unit suite stayed green.
//
// TWO OF SEVEN PROVIDERS WERE AFFECTED:
//
//  1. AppointmentWidgetProvider.updateAppointment - live since t088, 10 Oct.
//     declared (nextAppt, redactedText, apptTime, apptLocation)
//     passed   (nextAppt, nextApptTime, nextApptLocation, redactedText)
//     -> the widget's TIME line rendered the clinic LOCATION; and the "is this
//     Redacted?" check read the slot holding the appointment TIME. So a user who
//     had chosen the Redacted tier was NOT redacted whenever the appointment had
//     no time, and a Full-tier user with a timed appointment saw the widget
//     collapse to the redacted line. That is a privacy control not being honoured.
//
//  2. DoxyPEPWidgetProvider.updateDoxyPEP - live since t093, 9 Oct.
//     `redactedText` and `evidenceAt` were swapped. `evidenceAt` is dropped at the
//     Redacted tier by default-deny, so the slot was empty and a Redacted-tier
//     DoxyPEP user saw the FULL STATUS on their home screen.
//
// WHY THIS GUARD IS NOT REDUNDANT WITH widgetRedactedRender.test.js
// ----------------------------------------------------------------
// That guard asserts `redactedText` is the LAST ARGUMENT AT THE CALL SITE. Both
// bugs satisfied it perfectly - the call sites were correct. What was wrong was
// the DECLARATION the arguments were being matched against, which nothing read.
// So the check that was already there could not see this class of bug at all.
// That gap is the actual lesson, and closing it is the point of this file.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const JAVA_DIR = "android/app/src/main/java/com/shos/app/widget";
const PLUGIN = "android/app/src/main/java/com/shos/app/WidgetBridgePlugin.java";

/** Strip comments before parsing: Java comments here are full of commas and parens. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * Split a Java argument list on TOP-LEVEL commas only.
 *
 * `call.getLong("expiryMs", 0L)` is one argument, not two - splitting naively on
 * every comma silently truncates that call and produces a comparison that looks
 * like a mismatch while actually being a parser bug. Getting this wrong here
 * would make the guard report nonsense rather than fail safely.
 */
function splitArgs(src) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of src) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * The bridge key an argument expression reads, or null if it reads nothing.
 *
 * Handles all three shapes the plugin uses: opt(call, "x"), call.getInt("x", 0)
 * and call.getLong("x", 0L).
 */
function bridgeKeyOf(expr) {
  const m = expr.match(/(?:opt|call\.get\w+)\(\s*call\s*,\s*"([^"]+)"/);
  return m ? m[1] : null;
}

/**
 * Declared parameter names, minus the ones that are not bridged values:
 * the Context and a bare int (the count, passed positionally via getInt).
 */
function declaredParams(src, methodName) {
  const clean = stripComments(src);
  const m = clean.match(
    new RegExp(`public\\s+static\\s+void\\s+${methodName}\\s*\\(([\\s\\S]*?)\\)\\s*\\{`)
  );
  if (!m) return null;
  return splitArgs(m[1])
    .filter((p) => !/^Context\b/.test(p) && !/^int\s/.test(p))
    .map((p) => p.replace(/^\w+\s+/, ""));
}

/** Argument expressions at the call site, minus getContext() and getInt("count"). */
function passedArgs(pluginSrc, className, methodName) {
  const clean = stripComments(pluginSrc);
  const m = clean.match(
    new RegExp(`${className}\\.${methodName}\\s*\\(([\\s\\S]*?)\\)\\s*\\)`)
  );
  if (!m) return null;
  return splitArgs(m[1]).filter((p) => !/^getContext\(\)/.test(p) && !/^call\.getInt\(/.test(p));
}

const pluginSrc = fs.readFileSync(PLUGIN, "utf8");
const providers = fs.readdirSync(JAVA_DIR).filter((f) => f.endsWith("WidgetProvider.java"));

// Every public static void update* on a data-bearing provider, as
// { className, methodName, declared, passed }.
const updaters = [];
for (const f of providers) {
  if (f.startsWith("QuickAdd")) continue; // launch intents, no bridge method
  const src = fs.readFileSync(path.join(JAVA_DIR, f), "utf8");
  for (const m of stripComments(src).matchAll(/public\s+static\s+void\s+(\w+)\s*\(/g)) {
    const declared = declaredParams(src, m[1]);
    if (!declared) continue;
    updaters.push({
      className: f.replace(/\.java$/, ""),
      methodName: m[1],
      declared,
      passed: passedArgs(pluginSrc, f.replace(/\.java$/, ""), m[1]),
    });
  }
}

const named = (u) => `${u.className}.${u.methodName}`;

describe("widget bridge argument order (live bug: two providers declared the wrong order)", () => {
  it("finds the providers - otherwise every check below is vacuous", () => {
    // Same anti-vacuity rule widgetTapAndFallbackGuard uses: a guard that matches
    // zero files passes every assertion it makes.
    expect(updaters.length, "no widget update methods discovered").toBe(7);
    for (const u of updaters) {
      expect(u.passed, `no call site found for ${named(u)}`).not.toBeNull();
    }
  });

  it("declares the SAME NUMBER of parameters as the call site passes", () => {
    for (const u of updaters) {
      expect(
        u.declared.length,
        `${named(u)} declares ${u.declared.length} bridged parameters ` +
          `(${u.declared.join(", ")}) but the call site passes ${u.passed.length} ` +
          `(${u.passed.join(", ")}). Java will still compile this if the types line up.`
      ).toBe(u.passed.length);
    }
  });

  it("declares redactedText LAST, so the tier cannot be silently swapped for another field", () => {
    // This is the invariant whose violation WAS both live bugs. It is stated
    // positionally and checked independently of the per-position comparison
    // below, because it is the one property that must never regress: a slot
    // that should hold the Redacted line is what decides whether the tier is
    // honoured at all.
    for (const u of updaters) {
      expect(
        u.declared[u.declared.length - 1],
        `${named(u)}: the LAST declared parameter must be redactedText. ` +
          `It is "${u.declared[u.declared.length - 1]}" - the call site passes the ` +
          `redacted line into this position, so this provider decides whether to ` +
          `redact by reading an unrelated field. That is how a Redacted-tier user ` +
          `saw full widget detail (Appointments, DoxyPEP).`
      ).toBe("redactedText");
    }
  });

  it("passes the redacted line as the last argument at every call site", () => {
    // The check widgetRedactedRender already makes. Repeated here on purpose: it
    // is one half of a PAIR, and the bug was that only one half existed. Kept
    // adjacent to the declaration check above so the two are read together.
    for (const u of updaters) {
      const last = u.passed[u.passed.length - 1];
      expect(
        bridgeKeyOf(last),
        `${named(u)}: the last argument must be opt(call, "redactedText"), found: ${last}`
      ).toBe("redactedText");
    }
  });

  it("matches each declared parameter to the bridge key at the SAME position", () => {
    // Substring in EITHER direction, rather than a hand-maintained alias table:
    // "nextRefillMed" vs "nextRefill" and "apptTime" vs "nextApptTime" are both
    // legitimate naming differences, and a list of allowed aliases is exactly the
    // hand-maintained inventory that goes stale in this repo. A genuine shuffle
    // has no substring relationship at that position, so it still fails.
    for (const u of updaters) {
      u.declared.forEach((declared, i) => {
        const key = bridgeKeyOf(u.passed[i]);
        if (key === null) return; // a positional value like a literal; nothing to match
        const a = declared.toLowerCase();
        const b = key.toLowerCase();
        expect(
          a.includes(b) || b.includes(a),
          `${named(u)}: position ${i + 1} passes bridge key "${key}" into declared ` +
            `parameter "${declared}". Every one of these is a String, so the build ` +
            `stays green and the values simply land in the wrong widget fields.`
        ).toBe(true);
      });
    }
  });
});