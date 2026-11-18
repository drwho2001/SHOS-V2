// R2 (18 Nov) — contact platform icons 404'd on the GitHub Pages deploy because
// the path was hardcoded to the domain root, and the "email" entry has an icon
// component but no filename (so it requested /undefined.png). Source guard.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(
  path.join(process.cwd(), "src/modules/SHOS_Contacts_Prototype.jsx"),
  "utf8"
);

describe("contact platform icon paths", () => {
  it("is reading the real Contacts module", () => {
    expect(src.length).toBeGreaterThan(100_000);
    expect(src).toContain("function MethodBadge(");
  });

  it("uses Vite's BASE_URL so the deployed /SHOS-V2/ base resolves", () => {
    expect(src).toMatch(/const CONTACT_ICON_BASE = `\$\{import\.meta\.env\.BASE_URL\}contact-platform-icons\/`/);
    expect(src).not.toMatch(/const CONTACT_ICON_BASE = "\/contact-platform-icons\//);
  });

  it("never builds an img src from a platform with no file (email's icon entry)", () => {
    // Both render sites (MethodBadge + the TagInput chip) now guard on ?.file.
    expect((src.match(/platform\?\.file/g) || []).length).toBeGreaterThanOrEqual(2);
    // The old unguarded forms must be gone.
    expect(src).not.toMatch(/\{platform && <img src=\{`\$\{CONTACT_ICON_BASE\}/);
    expect(src).not.toMatch(/if \(platform\) \{\s*const style =/);
    // And no <img> is built from a bare `platform.file` without that guard.
    const bare = src.match(/<img src=\{`\$\{CONTACT_ICON_BASE\}\$\{platform\.file\}`\}/g) || [];
    const guarded = src.match(/(?:platform\?\.file && |if \(platform\?\.file\)[\s\S]*?<img src=\{`\$\{CONTACT_ICON_BASE\}\$\{platform\.file\}`\})/g) || [];
    expect(guarded.length).toBeGreaterThanOrEqual(bare.length);
  });
});
