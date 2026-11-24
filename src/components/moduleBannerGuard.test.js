// moduleBannerGuard.test.js — BACKLOG 0b (24 Nov 2026).
//
// The audit found the Medication banner was already the standard, but the
// structure lived as a copy in that one file. This guard locks the shared
// component's contract so the next module cannot quietly reintroduce a
// local banner with a different icon order or a missing safe-area pair:
//
//   Search -> Select -> module-specific actions -> Settings -> Quick Exit
//
// It also asserts the two modules migrated in the first staged pass really
// use it, and that the shared per-tab header takes its offset from the one
// STICKY_SUBHEADING_TOP token rather than retyping it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel) => readFileSync(path.join(process.cwd(), rel), "utf8");
const BANNER = read("src/components/ModuleBanner.jsx");
const TABS = read("src/components/TabStickyHeader.jsx");
const MED = read("src/modules/SHOS_Medication_Dashboard_Prototype.jsx");
const CONTACTS = read("src/modules/SHOS_Contacts_Prototype.jsx");
const ENCOUNTERS = read("src/modules/SHOS_Encounters_Prototype.jsx");

describe("BACKLOG 0b shared module banner", () => {
  it("owns the icon order: Search, Select, module extras, Settings, Quick Exit", () => {
    const at = (token) => {
      const i = BANNER.indexOf(token);
      expect(i, `missing ${token}`).toBeGreaterThan(-1);
      return i;
    };
    expect(at("{onSearch && ("))
      .toBeLessThan(at("{select}"));
    expect(at("{select}"))
      .toBeLessThan(at("{extras}"));
    expect(at("{extras}"))
      .toBeLessThan(at("{settings}"));
    expect(at("{settings}"))
      .toBeLessThan(at("{onQuickExit && <QuickExitButton"));
  });

  it("gives the banner Search a real button contract, not a decorative icon", () => {
    expect(BANNER).toMatch(/role="button"/);
    expect(BANNER).toMatch(/tabIndex=\{0\}/);
    expect(BANNER).toMatch(/aria-label=\{searchLabel\}/);
    expect(BANNER).toMatch(/onKeyDown=\{\(e\) =>/);
    expect(BANNER).toMatch(/e\.key === "Enter" \|\| e\.key === " "/);
  });

  it("keeps the tab row inside the same sticky wrapper when supplied", () => {
    expect(BANNER).toMatch(/\{children && <div style=\{\{ background: bg/);
    expect(MED).toMatch(/<ModuleBanner[\s\S]*?role="tablist"[\s\S]*?<\/ModuleBanner>/);
  });

  it("converted modules render the shared banner with their own accents", () => {
    for (const [src, accent] of [
      [MED, "accent={T.medsBlue}"],
      [CONTACTS, "accent={T.contactsBanner}"],
      [ENCOUNTERS, "accent={T.encountersPink}"],
    ]) {
      expect(src).toMatch(/import ModuleBanner/);
      expect(src).toMatch(/<ModuleBanner\b/);
      expect(src.includes(accent)).toBe(true);
      expect(src).toMatch(/onSearch=/);
      expect(src).toMatch(/onQuickExit=\{onQuickExit\}/);
    }
  });

  it("converted modules' banner Search focuses the real field, not a duplicate", () => {
    for (const [src, ref, placeholder] of [
      [CONTACTS, "contactSearchInputRef", 'placeholder="Search contacts"'],
      [ENCOUNTERS, "encounterSearchInputRef", 'placeholder="Search encounters"'],
    ]) {
      expect(src).toMatch(new RegExp(`const ${ref} = useRef\\(null\\)`));
      expect(src).toMatch(new RegExp(`${ref}\\.current\\?\\.focus\\(\\)`));
      expect(src).toMatch(new RegExp(`<input ref=\\{${ref}\\}`));
      expect(src).toMatch(new RegExp(placeholder.replace(/"/g, '\\"')));
    }
  });

  it("Encounters migrated its action bar into the shared TabStickyHeader", () => {
    expect(ENCOUNTERS).toMatch(/import TabStickyHeader/);
    expect(ENCOUNTERS).toMatch(/<TabStickyHeader\b/);
    expect(ENCOUNTERS).toMatch(/<\/TabStickyHeader>/);
    // The detail header is deliberately not a module banner: it keeps its
    // own in-flow shape and must not be converted to ModuleBanner.
    expect(ENCOUNTERS.match(/<ModuleBanner\b/g) || []).toHaveLength(1);
  });

  it("TabStickyHeader takes its offset from the one shared token", () => {
    expect(TABS).toMatch(/import \{ STICKY_SUBHEADING_TOP \} from "\.\.\/calculations\/designTokens"/);
    expect(TABS).toMatch(/top: `calc\(var\(--shos-top-banner-h, 0px\) \+ \$\{STICKY_SUBHEADING_TOP\}\)`/);
    expect(TABS).not.toMatch(/\+ 58px/);
    expect(TABS).toMatch(/padding = "10px 16px 4px"/);
  });
});
