import fs from "node:fs";
import { it, expect } from "vitest";

/**
 * t122: the Healthcare tab's "Calendar" shortcut, next to Attachments.
 *
 * WHY A STATIC GUARD, and what it is guarding. The shortcut is a link to the
 * Calendar screen, and the Calendar screen is owned by Settings
 * (src/modules/settings/CalendarScreen.jsx). Home already reaches it through
 * one handler - `openSettingsToCalendar` in App.jsx - which opens the Settings
 * overlay directly on the Calendar sub-screen. This shortcut deliberately
 * reuses that handler rather than mounting a second copy of the screen inside
 * Healthcare, because:
 *
 *   - ONE owner for the screen. A second copy would be a second place where
 *     the calendar's behaviour lives.
 *   - The hardware back button keeps working. Settings' own back chain
 *     (SHOS_Settings_Prototype.jsx) already knows how to step off the Calendar
 *     screen; a Healthcare-owned overlay would not be in that chain, which is
 *     the exact "level-skipping overlay" class the repo has been fixing
 *     (t129).
 *
 * The failure this guard exists to catch is the one this repo has shipped
 * several times: a prop that is passed nowhere, or passed but dropped by the
 * component's destructured signature, so the entry renders and does nothing.
 * Both halves are asserted here - the module ACCEPTS the prop, and App PASSES
 * it - because either one alone is a dead link.
 *
 * ANTI-VACUITY: the counts are exact, so a rename or a second Calendar entry
 * cannot make this pass by matching nothing.
 */
const HEALTHCARE = "src/modules/SHOS_Healthcare_Prototype.jsx";
const APP = "src/App.jsx";

/**
 * Strip comments before searching.
 *
 * MEASURED, not assumed: App.jsx mentions `<ActiveModule />` in a COMMENT at
 * line 1461 ("the active module is rendered as <ActiveModule /> from this
 * file"). A naive indexOf finds that comment first, and the first `/>` after
 * it is the comment's own - so the search returned a 14-character string and
 * the guard failed against a correct implementation. A guard that reads the
 * wrong text is a guard that reports confident nonsense, which is the failure
 * mode this repo keeps paying for.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

const healthcare = stripComments(fs.readFileSync(HEALTHCARE, "utf8"));
const app = stripComments(fs.readFileSync(APP, "utf8"));

/** The JSX props of the <ActiveModule ... /> element, which is how every tab
 *  module is rendered. Matched on the `key=` prop so a comment mentioning
 *  the tag cannot be picked up instead of the render site. */
function activeModuleProps(source) {
  const start = source.search(/<ActiveModule\s+key=/);
  expect(start, "App.jsx no longer renders <ActiveModule key=...> - this guard is stale").toBeGreaterThan(-1);
  const end = source.indexOf("/>", start);
  return source.slice(start, end);
}

it("the Healthcare module ACCEPTS the onOpenCalendar prop", () => {
  // The destructured signature. A prop that is rendered but not destructured
  // is the classic silent-dead-link: `onOpenCalendar` would be undefined and
  // the optional call would do nothing at all.
  const signature = healthcare.slice(
    healthcare.indexOf("function HealthcareScreen("),
    healthcare.indexOf(") {", healthcare.indexOf("function HealthcareScreen(")) + 3,
  );
  expect(signature, "HealthcareScreen's signature could not be read").toContain("function HealthcareScreen(");
  expect(signature).toMatch(/\bonOpenCalendar\b/);
});

it("the Healthcare module renders exactly one Calendar entry, next to Attachments", () => {
  const entries = healthcare.match(/aria-label="Calendar"/g) || [];
  expect(entries.length, "expected exactly one Calendar entry in Healthcare").toBe(1);

  // "Next to Attachments" is a positional claim, so it is checked
  // positionally: the Calendar entry must come after the Attachments entry
  // and before the Clinic Card entry in the shortcut row.
  const attachments = healthcare.indexOf('aria-label="Attachments"');
  const calendar = healthcare.indexOf('aria-label="Calendar"');
  const clinicCard = healthcare.indexOf('aria-label="Clinic Card"');
  expect(attachments).toBeGreaterThan(-1);
  expect(clinicCard).toBeGreaterThan(-1);
  expect(calendar, "the Calendar entry must sit after Attachments").toBeGreaterThan(attachments);
  expect(calendar, "the Calendar entry must sit before Clinic Card").toBeLessThan(clinicCard);
});

it("the Calendar entry calls the handler, and is reachable by keyboard", () => {
  const entry = healthcare.slice(
    healthcare.indexOf('aria-label="Calendar"') - 400,
    healthcare.indexOf('aria-label="Calendar"') + 400,
  );
  expect(entry, "the Calendar entry could not be read").toContain('aria-label="Calendar"');
  expect(entry).toMatch(/onClick=\{\(\) => onOpenCalendar\?\.\(\)\}/);
  // Keyboard reachability is a repo-wide requirement for these shortcut rows
  // (the row was audited for exactly this bug once), so the entry carries the
  // same contract as its two neighbours.
  expect(entry).toMatch(/role="button"/);
  expect(entry).toMatch(/tabIndex=\{0\}/);
  expect(entry).toMatch(/onKeyDown=/);
  expect(entry).toMatch(/e\.key === "Enter" \|\| e\.key === " "/);
});

it("App passes the SAME handler to Healthcare that it passes to Home", () => {
  const props = activeModuleProps(app);
  expect(props, "the <ActiveModule> props could not be read").toContain("<ActiveModule");
  expect(props).toContain("onOpenCalendar={openSettingsToCalendar}");

  // Home's own Calendar card must keep using the same handler, so the two
  // entry points cannot drift into opening different things.
  const homeStart = app.search(/<HomeScreen\s/);
  expect(homeStart, "App.jsx no longer renders <HomeScreen ...>").toBeGreaterThan(-1);
  const home = app.slice(homeStart, app.indexOf("/>", homeStart));
  expect(home).toContain("onOpenCalendar={openSettingsToCalendar}");

  // The handler itself must exist and open the Settings overlay on the
  // Calendar screen - not on the Settings menu.
  expect(app).toMatch(/const openSettingsToCalendar = \(\) => \{[^}]*setSettingsInitialScreen\("calendar"\)/);
});
