import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/modules/SHOS_Testing_Prototype.jsx", "utf8");
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
  .replace(/\/\/.*$/gm, (comment) => comment.replace(/[^\n]/g, " "));
const code = stripComments(source);
const rowStart = code.indexOf("function TestRow(");
const rowEnd = code.indexOf("export default function TestingModule", rowStart);
const testRow = rowStart >= 0 && rowEnd > rowStart ? code.slice(rowStart, rowEnd) : "";

describe("older Testing results remain explicit", () => {
  it("marks an old row explicitly rather than relying on faded text alone", () => {
    expect(testRow).toMatch(/isOlder\s*&&\s*<span[^>]*>Older test<\/span>/);
  });

  it("keeps the result's positive/negative colour at full opacity", () => {
    const resultBlock = testRow.match(/resultNames\.length > 0 && \([\s\S]*?\{resultNames\.join\(", "\)\}<\/div>/)?.[0];
    expect(resultBlock, "could not find the visible TestRow result block").toBeTruthy();
    expect(resultBlock).toMatch(/color:\s*isPositive\s*\?\s*T\.actionRed/);
    expect(resultBlock).not.toMatch(/opacity\s*:/);
  });

  it("strips explanatory comments but preserves the code being guarded", () => {
    const probe = "const visible = true; // Older test\nconst result = 1;";
    expect(stripComments(probe)).toContain("const visible = true;");
    expect(stripComments(probe)).toContain("const result = 1;");
    expect(stripComments(probe)).not.toContain("Older test");
    expect(testRow).not.toBe("");
  });
});
