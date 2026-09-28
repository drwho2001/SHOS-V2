// Guards the Clinic Card PDF export — the artefact a clinician actually reads,
// and until now the only substantive feature in the app with no test at all.
//
// WHY A SOURCE-LEVEL GUARD RATHER THAN A PDF-PARSING TEST: the property worth
// protecting is a WIRING property — that every section in the export is gated by
// the user's own visibility choice. That is expressible against the source, and
// it survives refactors of the layout code, which a test asserting on rendered
// PDF bytes or page counts would not. (pdf-lib also offers no text extraction,
// so asserting "this text is absent from the PDF" would mean asserting on
// internals rather than on the thing.)
//
// This is the same approach as recordNavigationWiring, settingsPathReferences
// and searchBackNavigationWiring elsewhere in this project.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PDF = readFileSync(path.join(ROOT, "src", "storage", "clinicCardPdfService.js"), "utf8");
const VIS = readFileSync(path.join(ROOT, "src", "calculations", "clinicCardVisibilityPreference.js"), "utf8");

/** The body of generateClinicCardPdf, i.e. the part that decides what renders. */
function renderBody() {
  const start = PDF.indexOf("export async function generateClinicCardPdf");
  expect(start, "generateClinicCardPdf not found").toBeGreaterThan(-1);
  return PDF.slice(start, PDF.indexOf("function uint8ArrayToBase64", start));
}

describe("Clinic Card PDF - section visibility is honoured", () => {
  it("the shared `section` helper skips anything the user switched off", () => {
    // This one line is the whole privacy control for the export. If it is
    // removed, every section a user deliberately hid would start appearing in
    // the file they hand to a clinic.
    expect(renderBody()).toMatch(
      /if \(visibility && visibility\[key\] === false\) return;/
    );
  });

  it("allergies is gated too - it is inlined rather than passed to `section`", () => {
    // Allergies is the one section written as an explicit `if` instead of going
    // through the helper, which is exactly the kind of divergence a helper is
    // supposed to prevent. Pin it so it cannot quietly lose its gate.
    expect(renderBody()).toMatch(/if \(!visibility \|\| visibility\.allergies !== false\)/);
  });

  it("every section in the visibility list is actually rendered, or deliberately excluded", () => {
    const keys = [...VIS.matchAll(/key:\s*"(\w+)"/g)].map((m) => m[1]);
    expect(keys.length, "failed to parse the section list - matcher is broken").toBeGreaterThan(8);
    const body = renderBody();

    // A key counts as rendered if EITHER form appears: `section("key", ...)`,
    // or an inline `visibility.key` gate. Allergies is the one section written
    // as an explicit `if` rather than going through the helper, so checking only
    // for the quoted form reports it as missing — which is exactly the false
    // positive that made this test's first version fail.
    const rendered = keys.filter((k) => body.includes(`"${k}"`) || body.includes(`visibility.${k}`));
    const missing = keys.filter((k) => !rendered.includes(k));

    // `recentContacts` is the known, deliberate exception - see its own test
    // below. Anything else missing is a genuine gap: a user could toggle a
    // section that then never appears in the export.
    for (const k of missing) {
      expect(k, `"${k}" is a user-togglable section but is never rendered in the PDF`).toBe("recentContacts");
    }
  });
});

describe("Clinic Card PDF - recent contacts is deliberately not exported", () => {
  it("is a real, user-togglable section on screen", () => {
    // Guards the premise of this test: if this ever stops being true, the
    // reasoning below no longer applies and the section should be re-examined.
    expect(VIS).toMatch(/key:\s*"recentContacts"/);
  });

  it("the export never assembles it", () => {
    expect(PDF, "recent contacts data should still be absent from the export").not.toMatch(/recentContacts/);
  });

  it("the on-screen card DOES render it, so the two genuinely differ", () => {
    // Not a test of a bug - a record of the divergence, so that the reason this
    // is deliberate is written down rather than living only in someone's head.
    const screen = readFileSync(path.join(ROOT, "src", "modules", "SHOS_ClinicCard_Prototype.jsx"), "utf8");
    expect(screen).toMatch(/recentContacts/);
  });
});

describe("Clinic Card PDF - clinical-safety footer", () => {
  it("every page carries the 'self-reported, not a clinical record' disclaimer", () => {
    // This is the one piece of text that stops a printed card being mistaken
    // for verified clinical documentation. It is applied in a forEach over all
    // pages, so losing it affects a multi-page card silently.
    const body = renderBody();
    expect(body).toMatch(/Self-reported — not a clinical record\./);
    expect(body).toMatch(/pages\.forEach\(/);
  });

  it("pages are numbered, so a printed multi-page card stays in order", () => {
    expect(renderBody()).toMatch(/\$\{i \+ 1\} \/ \$\{pages\.length\}/);
  });
});
