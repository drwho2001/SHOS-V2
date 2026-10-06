// seedDivergence.js
//
// WHY THIS FILE EXISTS
// --------------------
// The rule that decides whether a record on a demo-data id is still demo data.
//
// It cannot be id membership. That is the 1 Oct data-loss incident: the owner
// RENAMED seeded records in place, which destroyed the only signal the feature
// had, and "Clear sample data" deleted 74 of their own records - 16 contacts,
// 18 encounters, 7 tests, 14 dose logs. Three times now, in fact.
//
// It cannot be the `isSeed` flag alone either. `isSeed === false` is stamped on
// EDIT, so it is authoritative and is still checked first - but a record the
// user edited OUTSIDE the app (a backup from before the stamp existed, or data
// restored from a lost device) carries no flag at all. Judging those purely by
// id is what makes 3e inject demo records into real data, and what makes the
// old installed build offer to delete 51 real records.
//
// So there is a THIRD source of truth, and this file owns it: a FROZEN snapshot
// of the seed definitions exactly as they shipped, under their original legacy
// ids. A flagless record that still matches its snapshot row is untouched demo
// data. A flagless record that has DIVERGED from it is the user's own data -
// somebody changed it, and the only reason we cannot see who is that this app
// has no history.
//
// WHY IT LIVES IN src/calculations/
// ---------------------------
// clearSampleData.js is in src/repositories/. seedIdMigration.js already
// imports the repositories. Putting this rule in src/storage/ and importing it
// back into clearSampleData.js would close a repositories -> storage ->
// repositories cycle. Here it is pure - record in, boolean out, no I/O - so
// both chokepoints can import it and neither can drift from the other.
//
// WHY THE SNAPSHOT IS FROZEN AND INLINE
// ------------------------------------
// It must never change: it is a record of what shipped, not current intent. If
// it drifted, every unedited demo record would suddenly read as "diverged" and
// become undeletable. Inline rather than generated per-run so there is nothing
// to regenerate and nothing to forget; it sits beside LEGACY_SEED_ID_MAP's
// counterpart in seedIdMigration.js, and the round-trip test proves the two
// agree in both directions.
//
// It covers BOTH id spaces. 3a re-keyed the live seeds to seed_*_9001 while
// this snapshot holds the legacy contact_001 form, so normaliseLegacyId() maps
// seed_contact_9003 and contact_003 onto the same key. That is what lets one
// snapshot serve an install before AND after the re-key, and why reference
// arrays can be compared rather than ignored - see the note on
// `demoComparable`.

/**
 * Map any seed id, in either id space, onto one canonical legacy key.
 *
 *   seed_contact_9003 -> contact_003
 *   contact_003       -> contact_003
 *   seed_med_9001     -> med_001
 *   med_001           -> med_001
 *
 * An id in neither space is returned unchanged, so an unknown id simply finds
 * no snapshot row and is treated as the user's own data - the safe direction.
 */
export function normaliseLegacyId(id) {
  if (typeof id !== "string") return id;
  const bare = id.startsWith("seed_") ? id.slice(5) : id;
  const m = /^([A-Za-z]+)_(\d{4})$/.exec(bare);
  if (!m) return bare;
  const [, prefix, digits] = m;
  const n = Number(digits);
  if (n < 9000 || n > 9999) return bare;
  return `${prefix}_${String(n - 9000).padStart(3, "0")}`;
}

/** The frozen rows, by collection. The snapshot itself; see isDemoData(). */
export const RAW_LEGACY_SEED_ARRAYS = {
  "Contacts": [
    {
      "name": "Alex",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": null,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [],
      "city": "",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "Met through mutual friends.",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_001",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Jordan",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": null,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "",
      "snapchat": "jordan_snap",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Snapchat"
      ],
      "city": "Leeds",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": true,
      "carDetails": "Blue Ford Focus",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_002",
      "createdAt": "2026-07-15T09:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Sam",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": null,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "07700 900123",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Phone/WhatsApp"
      ],
      "city": "Manchester",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "Prefers texting only.",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_003",
      "createdAt": "2026-08-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Riley",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": null,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [],
      "city": "",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_004",
      "createdAt": "2026-06-01T09:00:00.000Z",
      "isArchived": true
    },
    {
      "name": "F. Mercury",
      "nickname": "",
      "pronouns": "He/him",
      "gender": "Male",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 34,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "07700 900456",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Phone/WhatsApp"
      ],
      "city": "London",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "Met on a night out in Soho.",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_005",
      "createdAt": "2026-08-27T08:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Sylvie J.",
      "nickname": "",
      "pronouns": "She/her",
      "gender": "Trans-female",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 29,
      "ageIsApprox": true,
      "profilePicture": "",
      "phone": "",
      "snapchat": "sylvie_ldn",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Snapchat"
      ],
      "city": "London",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_006",
      "createdAt": "2026-09-12T08:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Grace J.",
      "nickname": "",
      "pronouns": "She/her",
      "gender": "Female",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 26,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "07700 900789",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Phone/WhatsApp"
      ],
      "city": "London",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_007",
      "createdAt": "2026-09-27T08:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Morgan",
      "nickname": "",
      "pronouns": "She/her",
      "gender": "Female",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 31,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "07700 900321",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Phone/WhatsApp"
      ],
      "city": "London",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [
        "Partner"
      ],
      "howDidWeMeet": [
        "Dating app"
      ],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_008",
      "createdAt": "2026-06-16T08:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Priya",
      "nickname": "",
      "pronouns": "They/them",
      "gender": "Non-binary",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 24,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "",
      "snapchat": "priya_bm",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Snapchat"
      ],
      "city": "Birmingham",
      "address": "",
      "hosts": "Sometimes",
      "travels": "Yes",
      "travelMode": [
        "Public transport"
      ],
      "availability": [
        "Weekends",
        "Nights"
      ],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [
        {
          "kinkId": "kink_037",
          "role": null
        },
        {
          "kinkId": "kink_058",
          "role": null
        }
      ],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [
        "sub"
      ],
      "sexualPosition": [
        "Vers"
      ],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "😊 Happy",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_009",
      "createdAt": "2026-09-30T08:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Sam T.",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": null,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "07700 900123",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Phone/WhatsApp"
      ],
      "city": "Manchester",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_010",
      "createdAt": "2026-10-03T08:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Devon",
      "nickname": "",
      "pronouns": "He/him",
      "gender": "Trans-male",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 38,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "07700 900654",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Phone/WhatsApp"
      ],
      "city": "Bristol",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [
        "Friend with benefits"
      ],
      "howDidWeMeet": [
        "App"
      ],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [
        "Testosterone"
      ],
      "knownPrepDoxy": [
        "PrEP"
      ],
      "lastTestedDate": "",
      "notes": "",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_011",
      "createdAt": "2026-07-28T08:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Kai",
      "nickname": "",
      "pronouns": "He/they",
      "gender": "Male",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 45,
      "ageIsApprox": true,
      "profilePicture": "",
      "phone": "",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [],
      "city": "Leeds",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [
        {
          "kinkId": "kink_016",
          "role": null
        },
        {
          "kinkId": "kink_029",
          "role": null
        }
      ],
      "limits": [
        {
          "kinkId": "kink_040",
          "role": null
        }
      ],
      "knownChems": [],
      "bdsmRole": [
        "Dom"
      ],
      "sexualPosition": [
        "Top"
      ],
      "length": "",
      "thickness": "",
      "foreskin": "Uncircumcised",
      "foreskinDetail": "Average",
      "chastityStatus": "Caged",
      "cummer": [
        "Multiple loads",
        "Big load"
      ],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_012",
      "createdAt": "2026-03-20T09:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Ash",
      "nickname": "",
      "pronouns": "She/they",
      "gender": "Non-binary",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 27,
      "ageIsApprox": true,
      "profilePicture": "",
      "phone": "",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [],
      "city": "London",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": true,
      "carDetails": "Red Mini Cooper",
      "carRegistration": "AB12 CDE",
      "relationshipType": [
        "Regular"
      ],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "😍 Love",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": true,
      "id": "contact_013",
      "createdAt": "2026-09-21T08:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Anonymous — sauna",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": null,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [],
      "city": "",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "One-off, sauna encounter, no contact details exchanged.",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": true,
      "markedComplete": true,
      "favourited": false,
      "id": "contact_014",
      "createdAt": "2026-10-04T08:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Jamie",
      "nickname": "",
      "pronouns": "He/him",
      "gender": "Male",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": null,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [],
      "city": "Manchester",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "Unavailable foreseeably",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "No",
      "dontMeetAgainReason": "Relocated",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "",
      "thickness": "",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "Moved away, unlikely to meet again.",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_015",
      "createdAt": "2025-12-10T09:00:00.000Z",
      "isArchived": true
    },
    {
      "name": "Nat",
      "nickname": "",
      "pronouns": "She/her",
      "gender": "Female",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 33,
      "ageIsApprox": false,
      "profilePicture": "",
      "phone": "",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [],
      "city": "Cardiff",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "drives": false,
      "carDetails": "",
      "carRegistration": "",
      "relationshipType": [],
      "howDidWeMeet": [],
      "meetAgain": "",
      "dontMeetAgainReason": "",
      "statedKinks": [],
      "limits": [],
      "knownChems": [],
      "bdsmRole": [],
      "sexualPosition": [],
      "length": "Long",
      "thickness": "Thick",
      "foreskin": "",
      "foreskinDetail": "",
      "chastityStatus": "N/A",
      "cummer": [],
      "contraception": [
        "Implant"
      ],
      "knownPrepDoxy": [],
      "lastTestedDate": "",
      "notes": "",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "😐 Meh",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_016",
      "createdAt": "2026-08-22T08:00:00.000Z",
      "isArchived": false
    }
  ],
  "Encounters": [
    {
      "title": "Alex — coffee then back to his",
      "date": "2026-07-20T19:30:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Date/Chill",
      "attendeeIds": [
        "seed_contact_9001"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "Switch",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [],
      "followUpNeeded": false,
      "notes": "Second time meeting up.",
      "enjoymentRating": 85,
      "symptomsNoted": [],
      "id": "encounter_001",
      "createdAt": "2026-07-20T21:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Sauna trip",
      "date": "2026-08-02T15:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Sauna",
      "attendeeIds": [
        "seed_contact_9002",
        "seed_contact_9003"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "Dom, Switch",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "",
      "protectionUsed": [],
      "followUpNeeded": false,
      "notes": "",
      "enjoymentRating": 70,
      "symptomsNoted": [],
      "id": "encounter_002",
      "createdAt": "2026-08-02T18:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "F. Mercury — his place",
      "date": "2026-09-22T21:30:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Hookup",
      "attendeeIds": [
        "seed_contact_9005"
      ],
      "locationId": "",
      "myPosition": [
        "Oral - giving",
        "Anal - receiving"
      ],
      "kinksInvolved": [],
      "myRole": "sub",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "Indicated - taken",
      "myPrepCoverage": "Adequate - daily (≥4/week)",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [],
      "followUpNeeded": false,
      "notes": "",
      "enjoymentRating": 90,
      "symptomsNoted": [],
      "id": "encounter_003",
      "createdAt": "2026-09-22T22:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Sylvie — drinks then hers",
      "date": "2026-09-30T20:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Date/Chill",
      "attendeeIds": [
        "seed_contact_9006"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "Switch",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "Not indicated",
      "myPrepCoverage": "Adequate - daily (≥4/week)",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [
        "protection_001"
      ],
      "followUpNeeded": false,
      "notes": "",
      "enjoymentRating": 80,
      "symptomsNoted": [],
      "id": "encounter_004",
      "createdAt": "2026-09-30T21:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Grace — first date",
      "date": "2026-10-04T18:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Date/Chill",
      "attendeeIds": [
        "seed_contact_9007"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [],
      "followUpNeeded": false,
      "notes": "Good first date, meeting again next week.",
      "enjoymentRating": 75,
      "symptomsNoted": [],
      "id": "encounter_005",
      "createdAt": "2026-10-04T20:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Morgan — first date",
      "date": "2026-06-17T18:30:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Date/Chill",
      "attendeeIds": [
        "seed_contact_9008"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "Switch",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [
        "protection_001"
      ],
      "followUpNeeded": false,
      "notes": "Really clicked — seeing her again.",
      "enjoymentRating": 88,
      "symptomsNoted": [],
      "id": "encounter_006",
      "createdAt": "2026-06-17T21:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Morgan — hers, exclusive now",
      "date": "2026-07-02T19:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Date/Chill",
      "attendeeIds": [
        "seed_contact_9008"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "Switch",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [],
      "followUpNeeded": false,
      "notes": "Decided to be exclusive — stopping the pill, not using condoms going forward.",
      "enjoymentRating": 92,
      "symptomsNoted": [],
      "id": "encounter_007",
      "createdAt": "2026-07-02T21:30:00.000Z",
      "isArchived": false
    },
    {
      "title": "Morgan — weekend away",
      "date": "2026-07-16T17:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Date/Chill",
      "attendeeIds": [
        "seed_contact_9008"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "Switch",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [],
      "followUpNeeded": false,
      "notes": "",
      "enjoymentRating": 95,
      "symptomsNoted": [],
      "id": "encounter_008",
      "createdAt": "2026-07-16T22:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Morgan — hers",
      "date": "2026-09-03T19:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Date/Chill",
      "attendeeIds": [
        "seed_contact_9008"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "Switch",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [],
      "followUpNeeded": false,
      "notes": "First time together again since the miscarriage — took it slow.",
      "enjoymentRating": 80,
      "symptomsNoted": [],
      "id": "encounter_009",
      "createdAt": "2026-09-03T21:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Morgan — mine",
      "date": "2026-09-25T19:30:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Date/Chill",
      "attendeeIds": [
        "seed_contact_9008"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "Switch",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [],
      "followUpNeeded": false,
      "notes": "",
      "enjoymentRating": 90,
      "symptomsNoted": [],
      "id": "encounter_010",
      "createdAt": "2026-09-25T21:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Jordan — his place",
      "date": "2026-07-28T20:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Hookup",
      "attendeeIds": [
        "seed_contact_9002"
      ],
      "locationId": "",
      "myPosition": [
        "Anal - giving"
      ],
      "kinksInvolved": [],
      "myRole": "Dom",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "Not indicated",
      "myPrepCoverage": "Adequate - daily (≥4/week)",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [
        "protection_001"
      ],
      "followUpNeeded": false,
      "notes": "",
      "enjoymentRating": 85,
      "symptomsNoted": [],
      "id": "encounter_011",
      "createdAt": "2026-07-28T22:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Sauna trip",
      "date": "2026-08-22T15:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Sauna",
      "attendeeIds": [
        "seed_contact_9003"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "Switch",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "Not indicated",
      "myPrepCoverage": "Adequate - daily (≥4/week)",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "",
      "protectionUsed": [
        "protection_001"
      ],
      "followUpNeeded": false,
      "notes": "",
      "enjoymentRating": 72,
      "symptomsNoted": [],
      "id": "encounter_012",
      "createdAt": "2026-08-22T17:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Priya — birthday drinks then mine",
      "date": "2026-10-01T21:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Hookup",
      "attendeeIds": [
        "seed_contact_9009"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [
        {
          "kinkId": "kink_037",
          "role": null
        },
        {
          "kinkId": "kink_058",
          "role": null
        }
      ],
      "myRole": "Dom",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [
        "protection_001"
      ],
      "followUpNeeded": false,
      "notes": "",
      "enjoymentRating": 88,
      "symptomsNoted": [],
      "id": "encounter_013",
      "createdAt": "2026-10-01T22:30:00.000Z",
      "isArchived": false
    },
    {
      "title": "Devon — app hookup, his place",
      "date": "2026-08-02T19:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Hookup",
      "attendeeIds": [
        "seed_contact_9011"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "Indicated - taken",
      "myPrepCoverage": "Adequate - daily (≥4/week)",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Maybe",
      "protectionUsed": [],
      "followUpNeeded": false,
      "notes": "",
      "enjoymentRating": 78,
      "symptomsNoted": [],
      "id": "encounter_014",
      "createdAt": "2026-08-02T21:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Kai — his flat",
      "date": "2026-03-25T21:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Hookup",
      "attendeeIds": [
        "seed_contact_9012"
      ],
      "locationId": "",
      "myPosition": [
        "Anal - receiving"
      ],
      "kinksInvolved": [
        {
          "kinkId": "kink_016",
          "role": null
        }
      ],
      "myRole": "sub",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "No",
      "protectionUsed": [
        "protection_004"
      ],
      "followUpNeeded": false,
      "notes": "Not really my thing, won't repeat.",
      "enjoymentRating": 60,
      "symptomsNoted": [],
      "id": "encounter_015",
      "createdAt": "2026-03-25T23:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Ash — mine, regular thing",
      "date": "2026-09-26T19:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Date/Chill",
      "attendeeIds": [
        "seed_contact_9013"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "Switch",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Fuck YES 💖",
      "protectionUsed": [
        "protection_002"
      ],
      "followUpNeeded": false,
      "notes": "",
      "enjoymentRating": 93,
      "symptomsNoted": [],
      "id": "encounter_016",
      "createdAt": "2026-09-26T21:30:00.000Z",
      "isArchived": false
    },
    {
      "title": "Nat — coffee date",
      "date": "2026-08-27T14:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Date/Chill",
      "attendeeIds": [
        "seed_contact_9016"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [],
      "myRole": "",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Maybe",
      "protectionUsed": [],
      "followUpNeeded": false,
      "notes": "",
      "enjoymentRating": 65,
      "symptomsNoted": [],
      "id": "encounter_017",
      "createdAt": "2026-08-27T16:00:00.000Z",
      "isArchived": false
    },
    {
      "title": "Birthday party afters",
      "date": "2026-09-16T22:00:00.000Z",
      "dateEnd": "",
      "isDateTime": true,
      "encounterType": "Group",
      "attendeeIds": [
        "seed_contact_9009",
        "seed_contact_9013",
        "seed_contact_9016"
      ],
      "locationId": "",
      "myPosition": [],
      "kinksInvolved": [
        {
          "kinkId": "kink_029",
          "role": null
        }
      ],
      "myRole": "",
      "whereICame": [],
      "whereHeCame": [],
      "myDoxyPepStatus": "",
      "myPrepCoverage": "",
      "chemsAlcoholUsed": [],
      "wouldMeetAgain": "Yes",
      "protectionUsed": [],
      "followUpNeeded": false,
      "notes": "Ended up back at Ash's after the party.",
      "enjoymentRating": 82,
      "symptomsNoted": [],
      "id": "encounter_018",
      "createdAt": "2026-09-16T22:45:00.000Z",
      "isArchived": false
    }
  ],
  "Tests": [
    {
      "title": "Symptomatic screen — Gonorrhoea positive",
      "date": "2026-09-27T09:00:00.000Z",
      "resultDate": "2026-09-29T09:00:00.000Z",
      "setting": "🏥🤢 Clinic - Symptomatic",
      "sampleType": [
        "Urine",
        "Rectal swab"
      ],
      "testingFor": [
        "Gonorrhoea",
        "Chlamydia",
        "HIV",
        "Syphilis"
      ],
      "organismIds": [
        "organism_002"
      ],
      "resultIds": [
        "result_001"
      ],
      "mostRecent": false,
      "followUpActionedDate": "2026-09-28T09:00:00.000Z",
      "writtenPlan": "",
      "notes": "Discharge + discomfort a few days after an encounter. Positive for Gonorrhoea, negative for everything else screened.",
      "trackingInfo": "",
      "kitCodePk": "",
      "kitCodeSk": "",
      "kitAccessKey": "",
      "attachments": [],
      "clinicVisitIds": [
        "seed_visit_9001"
      ],
      "isArchived": false,
      "id": "test_001"
    },
    {
      "title": "Test of cure — Gonorrhoea",
      "date": "2026-10-04T09:00:00.000Z",
      "resultDate": "2026-10-05T09:00:00.000Z",
      "setting": "🏥😎 Clinic - Routine",
      "sampleType": [
        "Urine",
        "Rectal swab"
      ],
      "testingFor": [
        "Gonorrhoea"
      ],
      "organismIds": [],
      "resultIds": [
        "result_002"
      ],
      "mostRecent": true,
      "followUpActionedDate": null,
      "writtenPlan": "",
      "notes": "Test of cure, 2 weeks after treatment — confirms it's cleared.",
      "trackingInfo": "",
      "kitCodePk": "",
      "kitCodeSk": "",
      "kitAccessKey": "",
      "attachments": [],
      "clinicVisitIds": [
        "seed_visit_9001"
      ],
      "isArchived": false,
      "id": "test_002"
    },
    {
      "title": "Routine PrEP monitoring screen",
      "date": "2026-06-28T09:00:00.000Z",
      "resultDate": "2026-07-01T09:00:00.000Z",
      "setting": "🏥😎 Clinic - Routine",
      "sampleType": [
        "Blood",
        "Urine"
      ],
      "testingFor": [
        "HIV",
        "Chlamydia",
        "Gonorrhoea",
        "Syphilis"
      ],
      "organismIds": [],
      "resultIds": [
        "result_002"
      ],
      "mostRecent": false,
      "followUpActionedDate": null,
      "writtenPlan": "",
      "notes": "Quarterly PrEP bloods and STI screen — all clear.",
      "trackingInfo": "",
      "kitCodePk": "",
      "kitCodeSk": "",
      "kitAccessKey": "",
      "attachments": [],
      "clinicVisitIds": [],
      "isArchived": false,
      "id": "test_003"
    },
    {
      "title": "Pre-relationship screen",
      "date": "2026-06-15T09:00:00.000Z",
      "resultDate": "2026-06-18T09:00:00.000Z",
      "setting": "🏥😎 Clinic - Routine",
      "sampleType": [
        "Blood",
        "Urine"
      ],
      "testingFor": [
        "HIV",
        "Chlamydia",
        "Gonorrhoea",
        "Syphilis"
      ],
      "organismIds": [],
      "resultIds": [
        "result_002"
      ],
      "mostRecent": false,
      "followUpActionedDate": null,
      "writtenPlan": "",
      "notes": "Screen before going condom-free with Morgan — all clear.",
      "trackingInfo": "",
      "kitCodePk": "",
      "kitCodeSk": "",
      "kitAccessKey": "",
      "attachments": [],
      "clinicVisitIds": [],
      "isArchived": false,
      "id": "test_004"
    },
    {
      "title": "Home kit STI screen",
      "date": "2026-10-03T09:00:00.000Z",
      "resultDate": null,
      "setting": "🏠 Home",
      "sampleType": [
        "Urine",
        "Blood"
      ],
      "testingFor": [
        "HIV",
        "Chlamydia",
        "Gonorrhoea",
        "Syphilis"
      ],
      "organismIds": [],
      "resultIds": [
        "result_003"
      ],
      "mostRecent": false,
      "followUpActionedDate": null,
      "writtenPlan": "",
      "notes": "SH:24 kit posted, awaiting result.",
      "trackingInfo": "",
      "kitCodePk": "PK-48291",
      "kitCodeSk": "SK-77016",
      "kitAccessKey": "AXQ-93K1",
      "attachments": [],
      "clinicVisitIds": [],
      "isArchived": false,
      "id": "test_005"
    },
    {
      "title": "Symptomatic screen — Chlamydia positive",
      "date": "2026-03-24T10:00:00.000Z",
      "resultDate": "2026-03-27T10:00:00.000Z",
      "setting": "🏥🤢 Clinic - Symptomatic",
      "sampleType": [
        "Urine"
      ],
      "testingFor": [
        "Chlamydia",
        "Gonorrhoea",
        "HIV",
        "Syphilis"
      ],
      "organismIds": [
        "organism_001"
      ],
      "resultIds": [
        "result_001"
      ],
      "mostRecent": false,
      "followUpActionedDate": null,
      "writtenPlan": "Doxycycline course, test of cure in 3 weeks.",
      "notes": "Mild discharge after a hookup — positive for Chlamydia, negative for everything else screened.",
      "trackingInfo": "",
      "kitCodePk": "",
      "kitCodeSk": "",
      "kitAccessKey": "",
      "attachments": [],
      "clinicVisitIds": [
        "seed_visit_9004"
      ],
      "isArchived": false,
      "id": "test_006"
    },
    {
      "title": "Routine annual screen",
      "date": "2026-04-29T09:00:00.000Z",
      "resultDate": "2026-05-04T09:00:00.000Z",
      "setting": "🏥😎 Clinic - Routine",
      "sampleType": [
        "Blood",
        "Urine",
        "Rectal swab"
      ],
      "testingFor": [
        "HIV",
        "Chlamydia",
        "Gonorrhoea",
        "Syphilis",
        "Hepatitis B",
        "Hepatitis C"
      ],
      "organismIds": [],
      "resultIds": [
        "result_002"
      ],
      "mostRecent": false,
      "followUpActionedDate": null,
      "writtenPlan": "",
      "notes": "",
      "trackingInfo": "",
      "kitCodePk": "",
      "kitCodeSk": "",
      "kitAccessKey": "",
      "attachments": [],
      "clinicVisitIds": [
        "seed_visit_9005"
      ],
      "isArchived": false,
      "id": "test_007"
    }
  ],
  "Medications": [
    {
      "name": "PrEP (Descovy)",
      "unit": "tablet",
      "usagePattern": "daily",
      "dosesPerDay": 1,
      "unitsPerDose": 1,
      "scheduleIntervalDays": null,
      "inventoryTracked": true,
      "unitsPerContainer": 30,
      "refillThreshold": 7,
      "defaultRefillQuantity": 30,
      "usualSupplier": "Sexual Health Clinic",
      "refillRequestedAt": null,
      "refillCancelledAt": null,
      "isArchived": false,
      "sortOrder": 0,
      "route": "",
      "medicationType": "",
      "doseComponents": [],
      "category": [],
      "notes": "",
      "doseHistory": [],
      "scheduledTimes": [],
      "id": "med_001"
    },
    {
      "name": "DoxyPEP (Doxycycline)",
      "unit": "capsule",
      "usagePattern": "prn",
      "dosesPerDay": null,
      "unitsPerDose": 2,
      "scheduleIntervalDays": null,
      "inventoryTracked": true,
      "unitsPerContainer": 8,
      "refillThreshold": 8,
      "defaultRefillQuantity": 8,
      "usualSupplier": "Sexual Health Clinic",
      "refillRequestedAt": null,
      "refillCancelledAt": null,
      "isArchived": false,
      "sortOrder": 1,
      "route": "",
      "medicationType": "",
      "doseComponents": [],
      "category": [],
      "notes": "",
      "doseHistory": [],
      "scheduledTimes": [],
      "id": "med_002"
    },
    {
      "name": "Vitamin D3",
      "unit": "tablet",
      "usagePattern": "daily",
      "dosesPerDay": 1,
      "unitsPerDose": 1,
      "scheduleIntervalDays": null,
      "inventoryTracked": true,
      "unitsPerContainer": 90,
      "refillThreshold": 10,
      "defaultRefillQuantity": 90,
      "usualSupplier": "Boots Pharmacy",
      "refillRequestedAt": null,
      "refillCancelledAt": null,
      "isArchived": false,
      "sortOrder": 2,
      "route": "",
      "medicationType": "",
      "doseComponents": [],
      "category": [],
      "notes": "",
      "doseHistory": [],
      "scheduledTimes": [],
      "id": "med_003"
    },
    {
      "name": "Antihistamine (PRN)",
      "unit": "tablet",
      "usagePattern": "prn",
      "dosesPerDay": null,
      "unitsPerDose": 1,
      "scheduleIntervalDays": null,
      "inventoryTracked": false,
      "unitsPerContainer": 20,
      "refillThreshold": 5,
      "defaultRefillQuantity": 20,
      "usualSupplier": "Boots Pharmacy",
      "refillRequestedAt": null,
      "refillCancelledAt": null,
      "isArchived": false,
      "sortOrder": 3,
      "route": "",
      "medicationType": "",
      "doseComponents": [],
      "category": [],
      "notes": "",
      "doseHistory": [],
      "scheduledTimes": [],
      "id": "med_004"
    },
    {
      "name": "Amoxicillin (course, finished)",
      "unit": "capsule",
      "usagePattern": "custom",
      "dosesPerDay": 3,
      "unitsPerDose": 1,
      "scheduleIntervalDays": null,
      "inventoryTracked": false,
      "unitsPerContainer": 21,
      "refillThreshold": 0,
      "defaultRefillQuantity": 21,
      "usualSupplier": "GP Surgery",
      "refillRequestedAt": null,
      "refillCancelledAt": null,
      "isArchived": true,
      "sortOrder": 4,
      "route": "",
      "medicationType": "",
      "doseComponents": [],
      "category": [],
      "notes": "",
      "doseHistory": [],
      "scheduledTimes": [],
      "id": "med_005"
    },
    {
      "name": "Testosterone (Sustanon)",
      "unit": "injection",
      "usagePattern": "custom",
      "dosesPerDay": null,
      "unitsPerDose": 1,
      "scheduleIntervalDays": 14,
      "inventoryTracked": true,
      "unitsPerContainer": 1,
      "refillThreshold": 1,
      "defaultRefillQuantity": 1,
      "usualSupplier": "Sexual Health Clinic",
      "refillRequestedAt": null,
      "refillCancelledAt": null,
      "isArchived": false,
      "sortOrder": 5,
      "route": "",
      "medicationType": "",
      "doseComponents": [],
      "category": [],
      "notes": "",
      "doseHistory": [],
      "scheduledTimes": [],
      "id": "med_006"
    }
  ],
  "ClinicVisits": [
    {
      "title": "Treatment — Gonorrhoea",
      "date": "2026-09-29T13:00:00.000Z",
      "location": "56 Dean Street",
      "clinician": [
        "Hayley"
      ],
      "reasonForVisit": [
        "Treatment"
      ],
      "isFutureAppointment": false,
      "nextReviewDate": null,
      "followUpType": "",
      "clinicalImpression": "Symptomatic urethritis, confirmed Gonorrhoea",
      "clinicalNotes": "Confirmed Gonorrhoea on symptomatic screen. Single-dose antibiotic given in clinic. TOC (test of cure) advised in 2 weeks. Partner notification checklist started.",
      "linkedTestIds": [
        "seed_test_9001",
        "seed_test_9002"
      ],
      "medicationsGivenIds": [],
      "adHocMedicationsGiven": [
        {
          "id": "adhocmed_seed_001",
          "name": "Ceftriaxone 1g IM",
          "notes": "Single dose, given in clinic."
        }
      ],
      "symptomTypeIds": [
        "symptom_cat_001"
      ],
      "symptomsDiscussedIds": [
        "seed_symlog_9001"
      ],
      "primaryReasonSymptomLogId": "seed_symlog_9001",
      "resultIds": [],
      "attachments": [],
      "vaccinationsGivenIds": [],
      "takeHomeMedications": [],
      "isArchived": false,
      "id": "visit_001"
    },
    {
      "title": "Early pregnancy scan",
      "date": "2026-07-28T13:00:00.000Z",
      "location": "Local hospital — antenatal unit",
      "clinician": [
        "Midwife"
      ],
      "reasonForVisit": [
        "Pregnancy care"
      ],
      "isFutureAppointment": false,
      "nextReviewDate": null,
      "followUpType": "",
      "clinicalImpression": "",
      "clinicalNotes": "Dating scan booked after positive home test. Confirmed intrauterine pregnancy, ~6 weeks.",
      "linkedTestIds": [],
      "medicationsGivenIds": [],
      "adHocMedicationsGiven": [],
      "symptomTypeIds": [],
      "symptomsDiscussedIds": [],
      "primaryReasonSymptomLogId": "",
      "resultIds": [],
      "attachments": [],
      "vaccinationsGivenIds": [],
      "takeHomeMedications": [],
      "isArchived": false,
      "id": "visit_002"
    },
    {
      "title": "Miscarriage aftercare",
      "date": "2026-08-17T13:00:00.000Z",
      "location": "Local hospital — antenatal unit",
      "clinician": [
        "Midwife"
      ],
      "reasonForVisit": [
        "Pregnancy care"
      ],
      "isFutureAppointment": false,
      "nextReviewDate": null,
      "followUpType": "",
      "clinicalImpression": "",
      "clinicalNotes": "Follow-up after miscarriage — confirmed complete, no intervention needed. Discussed contraception going forward.",
      "linkedTestIds": [],
      "medicationsGivenIds": [],
      "adHocMedicationsGiven": [],
      "symptomTypeIds": [],
      "symptomsDiscussedIds": [],
      "primaryReasonSymptomLogId": "",
      "resultIds": [],
      "attachments": [],
      "vaccinationsGivenIds": [],
      "takeHomeMedications": [],
      "isArchived": false,
      "id": "visit_003"
    },
    {
      "title": "Treatment — Chlamydia",
      "date": "2026-03-24T14:00:00.000Z",
      "location": "56 Dean Street",
      "clinician": [
        "Lucy"
      ],
      "reasonForVisit": [
        "Treatment"
      ],
      "isFutureAppointment": true,
      "nextReviewDate": "2026-04-14T13:00:00.000Z",
      "followUpType": "Test of cure",
      "clinicalImpression": "",
      "clinicalNotes": "Confirmed Chlamydia on symptomatic screen. Doxycycline course given. TOC advised in 3 weeks.",
      "linkedTestIds": [
        "seed_test_9006"
      ],
      "medicationsGivenIds": [],
      "adHocMedicationsGiven": [],
      "symptomTypeIds": [],
      "symptomsDiscussedIds": [],
      "primaryReasonSymptomLogId": "",
      "resultIds": [],
      "attachments": [],
      "vaccinationsGivenIds": [],
      "takeHomeMedications": [],
      "isArchived": false,
      "id": "visit_004"
    },
    {
      "title": "Routine annual screen",
      "date": "2026-04-29T13:00:00.000Z",
      "location": "56 Dean Street",
      "clinician": [
        "Jonathan"
      ],
      "reasonForVisit": [
        "Routine screen"
      ],
      "isFutureAppointment": false,
      "nextReviewDate": null,
      "followUpType": "",
      "clinicalImpression": "",
      "clinicalNotes": "Full annual screen — all clear.",
      "linkedTestIds": [
        "seed_test_9007"
      ],
      "medicationsGivenIds": [],
      "adHocMedicationsGiven": [],
      "symptomTypeIds": [],
      "symptomsDiscussedIds": [],
      "primaryReasonSymptomLogId": "",
      "resultIds": [],
      "attachments": [],
      "vaccinationsGivenIds": [
        "seed_vaccination_9003"
      ],
      "takeHomeMedications": [
        {
          "medicationId": "seed_med_9001",
          "unit": "containers",
          "quantity": 1
        },
        {
          "medicationId": "seed_med_9003",
          "unit": "units",
          "quantity": 14
        }
      ],
      "isArchived": false,
      "id": "visit_005"
    },
    {
      "title": "IUD insertion",
      "date": "2026-07-23T13:00:00.000Z",
      "location": "56 Dean Street",
      "clinician": [
        "Hayley"
      ],
      "reasonForVisit": [
        "Contraception"
      ],
      "isFutureAppointment": false,
      "nextReviewDate": null,
      "followUpType": "",
      "clinicalImpression": "",
      "clinicalNotes": "Hormonal IUD inserted — testosterone alone isn't reliable contraception. Straightforward procedure, mild cramping advised as normal for a few days.",
      "linkedTestIds": [],
      "medicationsGivenIds": [],
      "adHocMedicationsGiven": [],
      "symptomTypeIds": [],
      "symptomsDiscussedIds": [],
      "primaryReasonSymptomLogId": "",
      "resultIds": [],
      "attachments": [],
      "vaccinationsGivenIds": [],
      "takeHomeMedications": [],
      "isArchived": false,
      "id": "visit_006"
    }
  ],
  "Vaccinations": [
    {
      "title": "Gonorrhoea vaccine (4CMenB)",
      "vaccine": "Gonorrhoea",
      "reason": [
        "High-risk status"
      ],
      "time": null,
      "date": "2026-10-05T10:00:00.000Z",
      "notes": "Offered given recent Gonorrhoea diagnosis and ongoing risk.",
      "symptomIds": [],
      "doses": [
        {
          "doseNumber": 1,
          "date": "2026-10-05T10:00:00.000Z",
          "provider": "56 Dean Street",
          "injectionSite": "Deltoid",
          "notes": "Offered given recent Gonorrhoea diagnosis and ongoing risk."
        }
      ],
      "isArchived": false,
      "id": "vaccination_001"
    },
    {
      "title": "Meningitis B vaccine (4CMenB)",
      "vaccine": "Meningitis B",
      "reason": [
        "Routine"
      ],
      "time": null,
      "date": "2026-06-28T10:00:00.000Z",
      "notes": "Routine MenB vaccination, offered opportunistically at a clinic visit.",
      "symptomIds": [],
      "doses": [
        {
          "doseNumber": 1,
          "date": "2026-06-28T10:00:00.000Z",
          "provider": "56 Dean Street",
          "injectionSite": "Deltoid",
          "notes": "Routine MenB vaccination, offered opportunistically at a clinic visit."
        }
      ],
      "isArchived": false,
      "id": "vaccination_002"
    },
    {
      "title": "Hepatitis A/B vaccine (Twinrix), dose 1",
      "vaccine": "Hepatitis A/B",
      "reason": [
        "Routine"
      ],
      "time": null,
      "date": "2026-04-29T10:00:00.000Z",
      "notes": "First of a 3-dose Twinrix course, offered at the routine annual screen.",
      "symptomIds": [],
      "doses": [
        {
          "doseNumber": 1,
          "date": "2026-04-29T10:00:00.000Z",
          "provider": "56 Dean Street",
          "injectionSite": "Deltoid",
          "notes": "First of a 3-dose Twinrix course, offered at the routine annual screen."
        }
      ],
      "isArchived": false,
      "id": "vaccination_003"
    },
    {
      "title": "Hepatitis A/B vaccine (Twinrix), dose 2",
      "vaccine": "Hepatitis A/B",
      "reason": [
        "Routine"
      ],
      "time": null,
      "date": "2026-05-29T10:00:00.000Z",
      "notes": "Second dose, on schedule. Third and final dose due at the 6-month mark.",
      "symptomIds": [],
      "doses": [
        {
          "doseNumber": 2,
          "date": "2026-05-29T10:00:00.000Z",
          "nextDue": "2026-10-26",
          "provider": "56 Dean Street",
          "injectionSite": "Gluteal",
          "notes": "Second dose, on schedule. Third and final dose due at the 6-month mark."
        }
      ],
      "isArchived": false,
      "id": "vaccination_004"
    }
  ],
  "SymptomLog": [
    {
      "title": "Discharge + discomfort",
      "symptomIds": [
        "symptom_cat_001"
      ],
      "dateStarted": "2026-09-25T07:00:00.000Z",
      "dateResolved": "2026-10-03T07:00:00.000Z",
      "severity": "Moderate",
      "relatedEncounterIds": [
        "seed_encounter_9003"
      ],
      "relatedTestIds": [
        "seed_test_9001"
      ],
      "notes": "Started a few days after seeing F. Mercury — went in for a symptomatic test.",
      "isArchived": false,
      "id": "symlog_001"
    },
    {
      "title": "Mild discharge",
      "symptomIds": [
        "symptom_cat_001"
      ],
      "dateStarted": "2026-03-22T08:00:00.000Z",
      "dateResolved": "2026-03-30T07:00:00.000Z",
      "severity": "Mild",
      "relatedEncounterIds": [
        "seed_encounter_9015"
      ],
      "relatedTestIds": [
        "seed_test_9006"
      ],
      "notes": "Noticed a couple of days after the encounter with Kai.",
      "isArchived": false,
      "id": "symlog_002"
    },
    {
      "title": "Ongoing mild irritation",
      "symptomIds": [
        "symptom_cat_001"
      ],
      "dateStarted": "2026-10-04T07:00:00.000Z",
      "dateResolved": null,
      "severity": "Mild",
      "relatedEncounterIds": [],
      "relatedTestIds": [],
      "notes": "Keeping an eye on it — not bad enough yet to book in.",
      "isArchived": false,
      "id": "symlog_003"
    }
  ],
  "Measurements": [
    {
      "type": "CD4 count",
      "date": "2026-09-06T08:00:00.000Z",
      "value": 620,
      "unit": "cells/µL",
      "enteredValue": 620,
      "enteredUnit": "cells/µL",
      "systolic": null,
      "diastolic": null,
      "note": "Routine bloods.",
      "locationType": "",
      "clinicName": "",
      "linkedClinicVisitId": null,
      "linkedTestId": null,
      "isArchived": false,
      "id": "measurement_001"
    },
    {
      "type": "Weight",
      "date": "2026-09-22T08:00:00.000Z",
      "value": 68.04,
      "unit": "kg",
      "enteredValue": 150,
      "enteredUnit": "lb",
      "systolic": null,
      "diastolic": null,
      "note": "",
      "locationType": "",
      "clinicName": "",
      "linkedClinicVisitId": null,
      "linkedTestId": null,
      "isArchived": false,
      "id": "measurement_002"
    },
    {
      "type": "Blood pressure",
      "date": "2026-09-22T08:00:00.000Z",
      "value": null,
      "unit": "mmHg",
      "enteredValue": null,
      "enteredUnit": "",
      "systolic": 118,
      "diastolic": 76,
      "note": "Routine COCP check.",
      "locationType": "",
      "clinicName": "",
      "linkedClinicVisitId": null,
      "linkedTestId": null,
      "isArchived": false,
      "id": "measurement_003"
    },
    {
      "type": "Weight",
      "date": "2026-10-04T08:00:00.000Z",
      "value": 67.5,
      "unit": "kg",
      "enteredValue": 67.5,
      "enteredUnit": "kg",
      "systolic": null,
      "diastolic": null,
      "note": "",
      "locationType": "",
      "clinicName": "",
      "linkedClinicVisitId": null,
      "linkedTestId": null,
      "isArchived": false,
      "id": "measurement_004"
    },
    {
      "type": "CD4 count",
      "date": "2026-06-08T08:00:00.000Z",
      "value": 590,
      "unit": "cells/µL",
      "enteredValue": 590,
      "enteredUnit": "cells/µL",
      "systolic": null,
      "diastolic": null,
      "note": "Routine bloods.",
      "locationType": "",
      "clinicName": "",
      "linkedClinicVisitId": null,
      "linkedTestId": null,
      "isArchived": false,
      "id": "measurement_005"
    },
    {
      "type": "Blood glucose",
      "date": "2026-10-01T08:00:00.000Z",
      "value": 5.4,
      "unit": "mmol/L",
      "enteredValue": 5.4,
      "enteredUnit": "mmol/L",
      "systolic": null,
      "diastolic": null,
      "note": "Fasting, routine bloods.",
      "locationType": "",
      "clinicName": "",
      "linkedClinicVisitId": null,
      "linkedTestId": null,
      "isArchived": false,
      "id": "measurement_006"
    }
  ],
  "Locations": [
    {
      "name": "Home",
      "type": "",
      "address": "",
      "notes": "",
      "relatedContactId": "",
      "id": "location_001",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "His place",
      "type": "",
      "address": "",
      "notes": "",
      "relatedContactId": "",
      "id": "location_002",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Sauna",
      "type": "",
      "address": "",
      "notes": "",
      "relatedContactId": "",
      "id": "location_003",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Public",
      "type": "",
      "address": "",
      "notes": "",
      "relatedContactId": "",
      "id": "location_004",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Car",
      "type": "",
      "address": "",
      "notes": "",
      "relatedContactId": "",
      "id": "location_005",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Steamworks",
      "type": "🛀 Sauna",
      "address": "Shoreditch, London",
      "notes": "",
      "relatedContactId": "",
      "id": "location_006",
      "createdAt": "2026-08-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "name": "Devon's flat",
      "type": "🏠 His House",
      "address": "Bristol",
      "notes": "",
      "relatedContactId": "seed_contact_9011",
      "id": "location_007",
      "createdAt": "2026-08-15T09:00:00.000Z",
      "isArchived": false
    }
  ],
  "Episodes": [
    {
      "title": "Gonorrhoea — Sep 2026",
      "triggerReason": "Symptom-driven",
      "startEncounterId": "seed_encounter_9003",
      "atRiskEncounterIds": [
        "seed_encounter_9004",
        "seed_encounter_9005"
      ],
      "notifiedEncounterIds": [],
      "testIds": [
        "seed_test_9001",
        "seed_test_9002"
      ],
      "clinicVisitIds": [
        "seed_visit_9001"
      ],
      "symptomLogIds": [
        "seed_symlog_9001"
      ],
      "resolvedDate": "2026-10-05T04:00:28.643Z",
      "resolution": "Treated — course complete",
      "notes": "TOC negative — resolved. Partner notification checklist used for encounters since the exposure date.",
      "isArchived": false,
      "id": "episode_001",
      "createdAt": "2026-09-27T04:00:28.643Z"
    }
  ],
  "Logs": [
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_001",
      "medicationId": "seed_med_9001",
      "type": "refill",
      "delta": 30,
      "date": "2026-09-28T08:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_002",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-10-05T07:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_003",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-10-04T07:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_004",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-10-03T07:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_005",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-10-02T07:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_006",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-10-01T07:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_007",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-09-30T07:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_008",
      "medicationId": "seed_med_9002",
      "type": "refill",
      "delta": 16,
      "date": "2026-09-16T08:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_009",
      "medicationId": "seed_med_9002",
      "type": "dose",
      "delta": -6,
      "date": "2026-10-01T21:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_010",
      "medicationId": "seed_med_9003",
      "type": "refill",
      "delta": 90,
      "date": "2026-08-07T08:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_011",
      "medicationId": "seed_med_9003",
      "type": "dose",
      "delta": -30,
      "date": "2026-09-06T07:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_012",
      "medicationId": "seed_med_9003",
      "type": "dose",
      "delta": -14,
      "date": "2026-10-05T19:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_013",
      "medicationId": "seed_med_9004",
      "type": "dose",
      "delta": -1,
      "date": "2026-10-04T13:30:00.000Z",
      "voided": false
    },
    {
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_014",
      "medicationId": "seed_med_9005",
      "type": "dose",
      "delta": -21,
      "date": "2026-08-22T08:30:00.000Z",
      "voided": false
    }
  ]
};

/**
 * The snapshot rows, keyed by canonical id rather than nested by collection.
 *
 * Flat because the id IS the identity: a record does not carry a collection
 * name, and two collections must never claim the same id.
 *
 * Declared AFTER RAW_LEGACY_SEED_ARRAYS on purpose. The first version of this
 * file put the derived map first and threw a temporal-dead-zone ReferenceError
 * on import - the exact class this repo has now hit in five separate files.
 */
const LEGACY_SEED_DEFINITIONS = (() => {
  const byId = new Map();
  for (const [collection, records] of Object.entries(RAW_LEGACY_SEED_ARRAYS)) {
    for (const record of records) {
      byId.set(normaliseLegacyId(record.id), { ...record, collection });
    }
  }
  return byId;
})();

/** Total records in the snapshot. A non-vacuity precondition for its tests. */
export const LEGACY_SEED_SNAPSHOT_SIZE = 88;

/**
 * The fields worth comparing, deliberately narrow.
 *
 * Excluded:
 *   - isSeed: the user's own edit marker. Copying or comparing it would be
 *     actively harmful; its ABSENCE is what "unedited" means.
 *   - createdAt / updatedAt: every save rewrites updatedAt, so a genuinely
 *     untouched demo record could differ from the snapshot on it alone.
 *   - collection: added by this file to say which snapshot an id came from.
 *     It is bookkeeping, not a record field, so it must not count as
 *     divergence - including it made all 96 snapshot rows classify as
 *     "diverged", which would have made every demo record undeletable. That
 *     is the failure mode the frozen-snapshot design is supposed to make
 *     impossible, and it shipped in the first version.
 *   - nothing else. Reference arrays ARE compared, because both sides are
 *     normalised through normaliseLegacyId() first, so a record whose only
 *     change is that the user removed an attendee reads as diverged.
 *
 * That last point is a deliberate reversal of 3e's demoContent(), which
 * excluded *Ids arrays so that a version bump would not restore one a user had
 * removed. That reasoning is right for REFRESHING demo data and wrong for
 * DELETING it: here a field the user touched is evidence the record is theirs,
 * and a wrong "demo" verdict destroys it.
 */
const STORED_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const STORED_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whole days from `anchor` to `date`, by CALENDAR arithmetic.
 *
 * Never elapsed-milliseconds / 86400000: this app stores fake-UTC datetimes
 * (local wall-clock digits with a deliberate trailing Z), and a duration divided
 * by 86400000 silently disagrees with real dates across a DST boundary - the
 * recorded 27 Sep 2026 medication-adherence bug. Calendar arithmetic has no such
 * failure mode.
 */
function calendarDayOffset(date, anchor) {
  const d = new Date(`${date}T00:00:00.000Z`);
  const a = new Date(`${anchor}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(a.getTime())) return null;
  return Math.round((d.getTime() - a.getTime()) / 86400000);
}

/**
 * Project a date field onto its OWN record's `createdAt`, as a relative offset.
 *
 * THIS IS WHY THE FROZEN SNAPSHOT CAN WORK AT ALL, and it was found by testing
 * the live data rather than by reading it:
 *
 * the seed arrays build their dates RELATIVE to the current date (`daysAgo(1)`
 * and friends), so the same seed yields a different absolute timestamp on every
 * day it is evaluated. The snapshot froze what it saw at generation time, which
 * by the following day was already a day behind. Comparing absolute timestamps
 * can therefore NEVER succeed - 9 of 11 collections read as fully diverged, and
 * wiring that into Clear Sample Data would have made it delete nothing at all.
 *
 * A seed record's identity is not "this exact instant", it is "one day before its
 * own creation". Comparing the projection makes that the test, so it stays stable
 * however long the app has been installed, and a user who genuinely edits a date
 * still gets a different offset and still reads as divergence.
 *
 * Only a value that is EXACTLY a date is projected. Free text is compared
 * literally, so a date-shaped string inside a note remains the user's own writing
 * and still counts as an edit.
 */
function projectDate(value, anchor) {
  if (typeof value !== "string") return value;
  const isDateTime = STORED_DATETIME.test(value);
  if (!isDateTime && !STORED_DATE.test(value)) return value;
  if (!anchor) return value;
  const offset = calendarDayOffset(value.slice(0, 10), anchor);
  // Time of day is compared to the HOUR, not the minute or second, and the reason
  // is the same as the date: a seed that sets a field to `new Date().toISOString()`
  // makes that field "when the seed array was evaluated", so regenerating the
  // snapshot produces a different value by however long the app has been running.
  // Episode.resolvedDate differed by 12 seconds between two evaluations and read
  // as a divergence purely because of it.
  //
  // The residual risk is stated rather than hidden: a user who edits ONLY the
  // clock time of a record sitting on a seed id, by less than an hour, would not
  // be detected as having edited it. Every other kind of edit - a different day,
  // a different hour, any non-date field - is still caught. The alternative was a
  // guard that reports itself broken every time the fixture is regenerated, and a
  // check nobody trusts is one nobody runs.
  if (!isDateTime) return `D${offset}`;
  const sameHourAsAnchor = value.slice(11, 13) === anchor.slice(11, 13);
  return `T${offset}@${sameHourAsAnchor ? "same" : value.slice(11, 13)}`;
}

/**
 * The day this snapshot was captured.
 *
 * Seed arrays build their dates relative to the current date, so every date in
 * the snapshot means "N days before the day this was written". Comparing it to a
 * live record therefore needs each side measured against its OWN epoch: this
 * constant for the frozen rows, today for the record in hand.
 *
 * Not derived from the snapshot's contents, because a seed record's own
 * `createdAt` is itself part of the seeded data (frequently a fixed literal like
 * 2026-07-01), so it records when the demo was WRITTEN, not when the snapshot was
 * taken. Deriving it would produce a plausible-looking wrong constant.
 *
 * A wrong value here does not fail silently - `snapshotFidelity.test.js` checks
 * the live seed arrays against these rows on every run, and a wrong epoch turns
 * every date-bearing record diverged, so the suite goes red immediately.
 */
export const SNAPSHOT_TAKEN_AT = "2026-10-06";

/** Today, as the fake-UTC date string the rest of this module compares. */
function todayAsStoredDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function demoComparable(record, fallbackReference) {
  const out = {};
  // A record's own creation date is the better epoch when it has one, because a
  // seed that hard-codes its dates stays stable against its own createdAt. The
  // fallback exists because not every repository stamps one: TestingRepository's
  // live seed records carry no createdAt at all, and without a fallback every
  // one of them compared as an absolute timestamp and read as diverged.
  const createdAt = typeof record.createdAt === "string" ? record.createdAt.slice(0, 10) : null;
  const anchor = createdAt && STORED_DATE.test(createdAt) ? createdAt : fallbackReference;
  for (const k of Object.keys(record).sort()) {
    if (k === "isSeed" || k === "createdAt" || k === "updatedAt") continue;
    if (k === "collection") continue;
    if (k === "id") {
      out[k] = normaliseLegacyId(record[k]);
      continue;
    }
    // 3d rewrites REFERENCES on migration, so a stored seed record reads as
    // diverged purely because its references moved to the new id space.
    //
    // Matched BY VALUE, not by field name, and that is a deliberate reversal
    // of clearSampleData.js's endsWith("Id"/"Ids") rule. That rule is a
    // name-based convention with a silent failure mode: real seed records
    // carry reference arrays that do NOT follow it - kinksInvolved,
    // protectionUsed, myPosition, whereICame, whereHeCame, chemsAlcoholUsed,
    // symptomsNoted are all id arrays under names that do not end in Ids.
    // Keying on the name alone made encounter_018 classify as diverged purely
    // because its three attendees were re-keyed, which would have made every
    // multi-attendee demo record undeletable.
    //
    // A string is treated as a reference only when it IS a known seed id in
    // either space, so free text is never rewritten.
    out[k] = normaliseValue(record[k], k, anchor);
  }
  return out;
}

/**
 * Normalise a value for comparison.
 *
 * Any string that resolves to a known seed id is normalised through
 * normaliseLegacyId(); everything else is returned untouched. That keeps a
 * user's notes and names byte-comparable while making reference arrays
 * id-space-agnostic.
 */
/**
 * Fields whose stored SHAPE differs between the seed array and what a
 * repository hands back.
 *
 * CHANGED 18 Aug 2026: three fields went from a flat array of id strings to an
 * array of `{ kinkId, role }`, and the repositories run their own
 * `normalizeKinkSelections()` over every one of them on read:
 *
 *   contactRepository.js    statedKinks, limits
 *   encounterRepository.js  kinksInvolved
 *
 * So the frozen snapshot - captured from the raw seed arrays - holds
 * `"kink_037"`, while every record the app actually has in memory holds
 * `{kinkId:"kink_037", role:null}`.
 *
 * That difference is a schema change, not a user edit, and byte-comparing it
 * makes every seed record with a kink read as "diverged". Wired into
 * clearSampleData that means Clear Sample Data silently deletes nothing, which
 * is a real regression even though it destroys no data.
 *
 * Both sides are canonicalised to the same form before comparison, so the shape
 * difference stops being visible while a genuine change to WHICH kinks are
 * listed, or to their role, still counts as divergence.
 *
 * Kept as an explicit list rather than detected by sniffing for objects with a
 * `kinkId` key: sniffing would also catch any future field that happens to use
 * that shape, and would guess at a migration this file has no business knowing
 * about.
 */
const KINK_SELECTION_FIELDS = new Set(["statedKinks", "limits", "kinksInvolved"]);

/** Canonical `{kinkId, role}` for one entry, whichever shape it arrived in. */
function canonicalKinkSelection(entry) {
  if (typeof entry === "string") return { kinkId: entry, role: null };
  if (entry && typeof entry === "object" && entry.kinkId) {
    return { kinkId: entry.kinkId, role: entry.role ?? null };
  }
  return { kinkId: null, role: null };
}

function normaliseValue(value, field, anchor) {
  if (Array.isArray(value)) {
    if (KINK_SELECTION_FIELDS.has(field)) return value.map(canonicalKinkSelection);
    return value.map((v) => normaliseValue(v, undefined, anchor));
  }
  if (typeof value === "string") {
    // Projected BEFORE the seed-id rewrite, and recursively at any depth: a
    // vaccination keeps its dates inside `doses[]`, so a top-level-only
    // projection left those absolute and every vaccination read as diverged.
    const projected = projectDate(value, anchor);
    if (projected !== value) return projected;
    return LEGACY_SEED_DEFINITIONS.has(normaliseLegacyId(value))
      ? normaliseLegacyId(value)
      : value;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = normaliseValue(value[k], k, anchor);
    return out;
  }
  return value;
}

/** The frozen row for a record, or null when its id is not a seed id at all. */
export function legacyDefinitionFor(record) {
  if (!record || typeof record !== "object") return null;
  return LEGACY_SEED_DEFINITIONS.get(normaliseLegacyId(record.id)) || null;
}

/**
 * Is this record still untouched demo data?
 *
 * THE ORDER IS THE RULE, and it is the third time this repo has had to learn
 * it by getting it wrong:
 *
 *   1. `isSeed === false`  -> the user's own data. Unconditionally. It is the
 *      one signal that is an explicit statement by the user rather than an
 *      inference, so no heuristic may override it - including divergence.
 *   2. no snapshot row       -> the user's own data. An id that was never a
 *      seed id is not demo data by default; treating it as demo would delete
 *      anything a future install or a hand-edited backup brought in.
 *   3. matches the snapshot  -> untouched demo data.
 *   4. diverges              -> the user's own data, and the caller should
 *      stamp isSeed: false so the verdict stops being a heuristic.
 */
export function isDemoData(record) {
  if (!record || typeof record !== "object") return false;
  if (record.isSeed === false) return false;
  const definition = legacyDefinitionFor(record);
  if (!definition) return false;
  return (
    JSON.stringify(demoComparable(record, todayAsStoredDate())) ===
    JSON.stringify(demoComparable(definition, SNAPSHOT_TAKEN_AT))
  );
}

/**
 * Stamp isSeed: false on every record that diverges from the snapshot.
 *
 * The stamp is what makes step 4 above stop being a guess: once written, the
 * record carries the same authoritative signal as one the user edited in the
 * app, and every later reader - the migration, reconciliation, Clear Sample
 * Data - reaches the same verdict without re-running a field diff.
 *
 * Returns a NEW array; the input is never mutated, so a caller that then fails
 * to persist cannot leave the in-memory repository half-converted.
 */
export function stampDivergedRecords(records) {
  const out = [];
  const stamped = [];
  for (const record of records || []) {
    if (!record || typeof record !== "object") {
      out.push(record);
      continue;
    }
    if (record.isSeed === false) {
      out.push(record);
      continue;
    }
    const definition = legacyDefinitionFor(record);
    if (definition && !isDemoData(record)) {
      out.push({ ...record, isSeed: false });
      stamped.push(record.id);
      continue;
    }
    out.push(record);
  }
  return { records: out, stamped };
}
