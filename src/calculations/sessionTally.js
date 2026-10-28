/**
 * Canonical derived facts for one live Session.
 *
 * Loads remain an explicit encounter fact. Fisting uses the more detailed
 * activity entry when one exists, and falls back to the older fistCount field
 * for records created before detail packs existed. This prevents the same act
 * being counted once in a detail pack and again in a legacy counter.
 */
export function sessionTally(encounters, { fistingKinkIds = [] } = {}) {
  const records = (Array.isArray(encounters) ? encounters : []).filter((encounter) => !encounter.isArchived);
  const fistingIds = new Set(fistingKinkIds);
  let fists = 0;
  let hasFistingDetails = false;

  for (const encounter of records) {
    for (const detail of encounter.activityDetails || []) {
      if (!fistingIds.has(detail.kinkId)) continue;
      hasFistingDetails = true;
      fists += Number(detail.count) || 0;
    }
  }

  if (!hasFistingDetails) {
    fists = records.reduce((sum, encounter) => sum + (Number(encounter.fistCount) || 0), 0);
  }

  return {
    activityCount: records.length,
    people: new Set(records.flatMap((encounter) => encounter.attendeeIds || [])).size,
    kinks: new Set(records.flatMap((encounter) => (encounter.kinksInvolved || []).map((entry) => entry.kinkId || entry))).size,
    loads: records.reduce((sum, encounter) => sum + (Number(encounter.loadsCount) || 0), 0),
    fists,
  };
}

export function chronologicalSessionEncounters(encounters) {
  return [...(Array.isArray(encounters) ? encounters : [])]
    .filter((encounter) => !encounter.isArchived)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}
