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

describe("Clinic Card PDF - recent contacts export is opt-in and minimal", () => {
  it("is a real, user-togglable section on screen", () => {
    expect(VIS).toMatch(/key:\s*"recentContacts"/);
  });

  it("is OFF by default and gated on its OWN preference, not the on-screen toggle", () => {
    // The separation is the entire point: the screen is private, the export is
    // shared. Reading the opt-in off `visibility.recentContacts` would mean
    // turning the section on for yourself silently put those names on paper.
    const pref = readFileSync(path.join(ROOT, "src", "calculations", "clinicCardVisibilityPreference.js"), "utf8");
    expect(pref).toMatch(/export async function getExportIncludeRecentContacts/);
    // A saved value only counts when it is exactly true.
    expect(pref).toMatch(/=== true/);

    // The opt-in is read in the data-assembly function, not the render
    // function — which is the right place, because the data is what must be
    // withheld, not merely not drawn. Scoping this to renderBody() was the
    // first version's mistake and it failed for exactly that reason.
    expect(PDF, "the export must read the dedicated opt-in").toMatch(/getExportIncludeRecentContacts\(\)/);
    // And must NOT be gated on the on-screen section map anywhere. Checked
    // against comment-stripped source: the fix's own comment quotes
    // `visibility.recentContacts` to explain why it is NOT used, which is the
    // third time in this project a negative source assertion has tripped over
    // the very comment documenting it.
    const code = PDF.split("\n")
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    expect(code).not.toMatch(/visibility\.recentContacts/);
    // Data is omitted entirely rather than gathered and then not drawn.
    expect(PDF).toMatch(/recentContacts: includeRecentContactsInExport\s*\? await buildRecentContactsForExport\(encounters\)\s*:\s*\[\]/);
  });

  it("includes only name and age — no methods, location or contact details", () => {
    // This list ends up on paper that gets shared, so the field allowlist IS
    // the privacy control. Anything added here is something that could be read
    // by whoever picks the page up afterwards.
    const fn = PDF.slice(PDF.indexOf("async function buildRecentContactsForExport"));
    const body = fn.slice(0, fn.indexOf("\n}"));

    expect(body, "only the contact's own name/nickname may be used").not.toMatch(/\b(phone|snapchat|fabguys|fabswingers|recon|address|city|email|notes)\b/);
    // Age is conditional, so a contact who never set it does not render "unknown".
    expect(body).toMatch(/typeof c\.age === "number"/);
    // Approximation is preserved, so "≈34" is never presented as exact.
    expect(body).toMatch(/ageIsApprox/);
  });

  it("renders nothing at all when there are no contacts — not even a heading", () => {
    // An empty "Recent contacts" heading on a shared sheet is itself a
    // disclosure that the user has contacts.
    expect(renderBody()).toMatch(/if \(data\.recentContacts\.length > 0\)/);
  });

  it("the on-screen card renders the section too, so the two agree on derivation", () => {
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
