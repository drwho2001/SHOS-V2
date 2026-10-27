import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const editSheets = [
  {
    file: "src/modules/SHOS_Encounters_Prototype.jsx",
    repository: "EncounterRepository",
    id: "encounterId",
  },
  {
    file: "src/modules/SHOS_ClinicVisits_Prototype.jsx",
    repository: "ClinicVisitsRepository",
    id: "visitId",
  },
  {
    file: "src/modules/SHOS_Testing_Prototype.jsx",
    repository: "TestingRepository",
    id: "testId",
  },
];

describe("edit sheets await an encrypted draft check before loading the record", () => {
  for (const { file, repository, id } of editSheets) {
    it(`${file} loads the saved record when there is no draft`, () => {
      const source = readFileSync(file, "utf8");

      expect(source).not.toContain("if (isNew || loadDraft(draftKey)) return;");
      expect(source).toContain("const draft = await loadDraft(draftKey);");
      expect(source).toContain("if (cancelled || draft) return;");
      expect(source).toContain(`const real = await ${repository}.getById(${id});`);
      expect(source).toContain("if (!cancelled && !isDirty.current && real) setForm(real);");
    });
  }
});
