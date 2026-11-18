// pregnancyTestProjection.js — F2 (18 Nov)
// Testing owns pregnancy test records; Pregnancy shows a READ-ONLY projection
// of the same fact. Pure so the list, detail and edit sheet cannot disagree.
export function projectPregnancyTest(test, resultNameById = new Map()) {
  if (!test) return null;
  const resultLabel = (test.resultIds || [])
    .map((id) => resultNameById.get(id))
    .find(Boolean) || null;
  const notes = test.notes || "";
  const serum = notes.match(/Serum hCG[^\n]*/)?.[0] || null;
  const brand = notes.match(/Brand:[^\n]*/)?.[0] || null;
  return {
    id: test.id,
    title: test.title || "Pregnancy test",
    date: test.date || null,
    resultLabel,
    sampleLabel: (test.sampleType || []).join(", ") || null,
    hcg: serum,
    brand,
    testingFor: test.testingFor || [],
  };
}

/** All Testing records that are pregnancy tests, newest first. */
export function pregnancyTests(tests = []) {
  return tests
    .filter((t) => (t.testingFor || []).includes("Pregnancy"))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}
