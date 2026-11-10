// seedDivergence.js
//
// WHY THIS FILE EXISTS
// --------------------
//
// ADDED 5 Nov 2026 (B7) — Testing's `setting` field moved from display strings
// with emoji to stable keys. This snapshot is FROZEN and must keep the values
// that actually shipped, so the migration is applied to BOTH sides at compare
// time instead: a stored "home" and the snapshot's "🏠 Home" normalise to the
// same key. Without that, every unedited demo test would read as diverged (and
// therefore become undeletable) the moment the migration ran.
import { normaliseSetting } from "./testingSettings.js";
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
      "isDemo": true,
      "name": "Alex",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 31,
      "ageIsApprox": false,
      "profilePicture": "",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "",
      "email": "",
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
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [],
      "availabilityExceptions": [],
      "availabilityTimeZone": "",
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
      "bdsmRole": [
        "Unknown / not discussed"
      ],
      "sexualPosition": [
        "Unknown / not discussed"
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
      "isDemo": true,
      "name": "Jordan",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 32,
      "ageIsApprox": false,
      "profilePicture": "",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "",
      "email": "",
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
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [],
      "availabilityExceptions": [],
      "availabilityTimeZone": "",
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
      "bdsmRole": [
        "Switch"
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
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_002",
      "createdAt": "2026-07-15T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Sam",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 29,
      "ageIsApprox": false,
      "profilePicture": "",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "07700 900123",
      "email": "",
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
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [],
      "availabilityExceptions": [],
      "availabilityTimeZone": "",
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
      "bdsmRole": [
        "Unknown / not discussed"
      ],
      "sexualPosition": [
        "Unknown / not discussed"
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
      "isDemo": true,
      "name": "Riley",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": null,
      "ageIsApprox": false,
      "profilePicture": "",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "",
      "email": "",
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
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [],
      "availabilityExceptions": [],
      "availabilityTimeZone": "",
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
      "isDemo": true,
      "name": "F. Mercury",
      "nickname": "",
      "pronouns": "He/him",
      "gender": "Male",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 34,
      "ageIsApprox": false,
      "profilePicture": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20128%20128%22%3E%3Crect%20width%3D%22128%22%20height%3D%22128%22%20rx%3D%2264%22%20fill%3D%22%23b8ded8%22%2F%3E%3Cpath%20d%3D%22M31%2058c0-26%2013-41%2033-41s33%2015%2033%2041v18c-9%2010-20%2015-33%2015S40%2086%2031%2076Z%22%20fill%3D%22%23302923%22%2F%3E%3Cpath%20d%3D%22M12%20128c3-29%2022-44%2052-44s49%2015%2052%2044%22%20fill%3D%22%232f7774%22%2F%3E%3Cellipse%20cx%3D%2264%22%20cy%3D%2258%22%20rx%3D%2229%22%20ry%3D%2235%22%20fill%3D%22%23c88864%22%2F%3E%3Cpath%20d%3D%22M31%2056c0-24%2014-39%2033-39s34%2015%2034%2039c-6-15-15-21-22-25-9%2011-25%2018-45%2020Z%22%20fill%3D%22%23302923%22%2F%3E%3Ccircle%20cx%3D%2252%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Ccircle%20cx%3D%2276%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Cpath%20d%3D%22M56%2074c5%204%2011%204%2016%200%22%20fill%3D%22none%22%20stroke%3D%22%238b4f42%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "07700 900456",
      "email": "fmercury@example.test",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Phone/WhatsApp"
      ],
      "city": "London",
      "address": "Soho, London W1D 3QF",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "outdoorMeetup": true,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [
        {
          "id": "seed_mercury_friday",
          "days": [
            5
          ],
          "start": "20:00",
          "end": "02:00"
        }
      ],
      "availabilityExceptions": [],
      "availabilityTimeZone": "Europe/London",
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
      "bdsmRole": [
        "Unknown / not discussed"
      ],
      "sexualPosition": [
        "Unknown / not discussed"
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
      "notes": "Met on a night out in Soho.",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_005",
      "createdAt": "2026-10-01T08:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Sylvie J.",
      "nickname": "",
      "pronouns": "She/her",
      "gender": "Trans-female",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 29,
      "ageIsApprox": true,
      "profilePicture": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20128%20128%22%3E%3Crect%20width%3D%22128%22%20height%3D%22128%22%20rx%3D%2264%22%20fill%3D%22%23f2c9ba%22%2F%3E%3Cpath%20d%3D%22M31%2058c0-26%2013-41%2033-41s33%2015%2033%2041v18c-9%2010-20%2015-33%2015S40%2086%2031%2076Z%22%20fill%3D%22%23241f2a%22%2F%3E%3Cpath%20d%3D%22M12%20128c3-29%2022-44%2052-44s49%2015%2052%2044%22%20fill%3D%22%23bd5d57%22%2F%3E%3Cellipse%20cx%3D%2264%22%20cy%3D%2258%22%20rx%3D%2229%22%20ry%3D%2235%22%20fill%3D%22%2391563f%22%2F%3E%3Cpath%20d%3D%22M28%2060c-4-27%2012-45%2036-45s40%2018%2036%2045c-6-17-17-25-26-28-10%2013-27%2021-46%2022Z%22%20fill%3D%22%23241f2a%22%2F%3E%3Ccircle%20cx%3D%2252%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Ccircle%20cx%3D%2276%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Cpath%20d%3D%22M56%2074c5%204%2011%204%2016%200%22%20fill%3D%22none%22%20stroke%3D%22%238b4f42%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "",
      "email": "sylvie_j@example.test",
      "snapchat": "sylvie_ldn",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Sniffies",
        "Grindr",
        "Feeld",
        "Bumble"
      ],
      "city": "London",
      "address": "",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [
        {
          "id": "seed_sylvie_weekend",
          "days": [
            5,
            6
          ],
          "start": "19:00",
          "end": "23:00"
        }
      ],
      "availabilityExceptions": [],
      "availabilityTimeZone": "Europe/London",
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
      "bdsmRole": [
        "sub"
      ],
      "sexualPosition": [
        "bottom"
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
      "notes": "Often free after work on Friday or Saturday.",
      "linkedContactIds": [],
      "linkedContactLabels": {},
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_006",
      "createdAt": "2026-10-17T08:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Grace J.",
      "nickname": "",
      "pronouns": "She/her",
      "gender": "Female",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 26,
      "ageIsApprox": false,
      "profilePicture": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20128%20128%22%3E%3Crect%20width%3D%22128%22%20height%3D%22128%22%20rx%3D%2264%22%20fill%3D%22%23d4c8e8%22%2F%3E%3Cpath%20d%3D%22M31%2058c0-26%2013-41%2033-41s33%2015%2033%2041v18c-9%2010-20%2015-33%2015S40%2086%2031%2076Z%22%20fill%3D%22%2351384a%22%2F%3E%3Cpath%20d%3D%22M12%20128c3-29%2022-44%2052-44s49%2015%2052%2044%22%20fill%3D%22%236f5b9b%22%2F%3E%3Cellipse%20cx%3D%2264%22%20cy%3D%2258%22%20rx%3D%2229%22%20ry%3D%2235%22%20fill%3D%22%23e0aa84%22%2F%3E%3Cpath%20d%3D%22M31%2057c0-25%2013-40%2033-40s33%2015%2033%2040c-8-12-14-19-20-28-12%2012-28%2020-46%2028Z%22%20fill%3D%22%2351384a%22%2F%3E%3Ccircle%20cx%3D%2252%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Ccircle%20cx%3D%2276%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Cpath%20d%3D%22M56%2074c5%204%2011%204%2016%200%22%20fill%3D%22none%22%20stroke%3D%22%238b4f42%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "07700 900789",
      "email": "grace@example.test",
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
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [
        {
          "id": "seed_grace_tuesday",
          "days": [
            2
          ],
          "start": "18:00",
          "end": "22:00"
        }
      ],
      "availabilityExceptions": [],
      "availabilityTimeZone": "Europe/London",
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
      "bdsmRole": [
        "Unknown / not discussed"
      ],
      "sexualPosition": [
        "Unknown / not discussed"
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
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_007",
      "createdAt": "2026-11-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Morgan",
      "nickname": "",
      "pronouns": "She/her",
      "gender": "Female",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 31,
      "ageIsApprox": false,
      "profilePicture": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20128%20128%22%3E%3Crect%20width%3D%22128%22%20height%3D%22128%22%20rx%3D%2264%22%20fill%3D%22%23f0ddaa%22%2F%3E%3Cpath%20d%3D%22M31%2058c0-26%2013-41%2033-41s33%2015%2033%2041v18c-9%2010-20%2015-33%2015S40%2086%2031%2076Z%22%20fill%3D%22%23322622%22%2F%3E%3Cpath%20d%3D%22M12%20128c3-29%2022-44%2052-44s49%2015%2052%2044%22%20fill%3D%22%23a66c25%22%2F%3E%3Cellipse%20cx%3D%2264%22%20cy%3D%2258%22%20rx%3D%2229%22%20ry%3D%2235%22%20fill%3D%22%23b87350%22%2F%3E%3Cpath%20d%3D%22M30%2057c-2-25%2012-41%2034-41%2021%200%2036%2016%2034%2041-9-13-15-21-20-30-11%2015-28%2024-48%2030Z%22%20fill%3D%22%23322622%22%2F%3E%3Ccircle%20cx%3D%2252%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Ccircle%20cx%3D%2276%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Cpath%20d%3D%22M56%2074c5%204%2011%204%2016%200%22%20fill%3D%22none%22%20stroke%3D%22%238b4f42%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "07700 900321",
      "email": "morgan@example.test",
      "snapchat": "",
      "fabguys": "morgan_g",
      "fabswingers": "morgan_s",
      "recon": "",
      "contactableVia": [
        "Phone/WhatsApp"
      ],
      "city": "London",
      "address": "Soho, London W1D 3QF",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [
        {
          "id": "seed_morgan_tuesday",
          "days": [
            2
          ],
          "start": "18:00",
          "end": "22:00"
        },
        {
          "id": "seed_morgan_sunday",
          "days": [
            0
          ],
          "start": "14:00",
          "end": "18:00"
        }
      ],
      "availabilityExceptions": [],
      "availabilityTimeZone": "Europe/London",
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
      "bdsmRole": [
        "Unknown / not discussed"
      ],
      "sexualPosition": [
        "Unknown / not discussed"
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
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_008",
      "createdAt": "2026-07-21T08:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Priya",
      "nickname": "",
      "pronouns": "They/them",
      "gender": "Non-binary",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 24,
      "ageIsApprox": false,
      "profilePicture": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20128%20128%22%3E%3Crect%20width%3D%22128%22%20height%3D%22128%22%20rx%3D%2264%22%20fill%3D%22%23f2c9ba%22%2F%3E%3Cpath%20d%3D%22M31%2058c0-26%2013-41%2033-41s33%2015%2033%2041v18c-9%2010-20%2015-33%2015S40%2086%2031%2076Z%22%20fill%3D%22%23241f2a%22%2F%3E%3Cpath%20d%3D%22M12%20128c3-29%2022-44%2052-44s49%2015%2052%2044%22%20fill%3D%22%23bd5d57%22%2F%3E%3Cellipse%20cx%3D%2264%22%20cy%3D%2258%22%20rx%3D%2229%22%20ry%3D%2235%22%20fill%3D%22%2391563f%22%2F%3E%3Cpath%20d%3D%22M28%2060c-4-27%2012-45%2036-45s40%2018%2036%2045c-6-17-17-25-26-28-10%2013-27%2021-46%2022Z%22%20fill%3D%22%23241f2a%22%2F%3E%3Ccircle%20cx%3D%2252%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Ccircle%20cx%3D%2276%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Cpath%20d%3D%22M56%2074c5%204%2011%204%2016%200%22%20fill%3D%22none%22%20stroke%3D%22%238b4f42%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "",
      "email": "priya@example.test",
      "snapchat": "priya_bm",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Telegram",
        "Messenger",
        "Signal",
        "Discord",
        "Bluesky"
      ],
      "city": "Birmingham",
      "address": "Birmingham city centre, B1 1AA",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "outdoorMeetup": true,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [
        {
          "id": "seed_priya_weekday",
          "days": [
            1,
            2,
            3,
            4,
            5
          ],
          "start": "18:00",
          "end": "22:00"
        },
        {
          "id": "seed_priya_saturday",
          "days": [
            6
          ],
          "start": "14:00",
          "end": "18:00"
        }
      ],
      "availabilityExceptions": [],
      "availabilityTimeZone": "Europe/London",
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
      "createdAt": "2026-11-04T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Sam T.",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 30,
      "ageIsApprox": false,
      "profilePicture": "",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "07700 900123",
      "email": "sam_t@example.test",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Signal",
        "Discord"
      ],
      "city": "Manchester",
      "address": "Manchester city centre, M1 3EZ",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [
        {
          "id": "seed_sam_t_weekend",
          "days": [
            5,
            6
          ],
          "start": "19:00",
          "end": "23:00"
        }
      ],
      "availabilityExceptions": [],
      "availabilityTimeZone": "Europe/London",
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
      "bdsmRole": [
        "Switch"
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
      "rating": "",
      "excludeFromActiveTracking": false,
      "markedComplete": false,
      "favourited": false,
      "id": "contact_010",
      "createdAt": "2026-11-07T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Devon",
      "nickname": "",
      "pronouns": "He/him",
      "gender": "Trans-male",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 38,
      "ageIsApprox": false,
      "profilePicture": "",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "07700 900654",
      "email": "devon@example.test",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [
        "Telegram",
        "Signal"
      ],
      "city": "Bristol",
      "address": "Bristol city centre, BS1 3QF",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [
        {
          "id": "seed_devon_weekday",
          "days": [
            1,
            2,
            3,
            4
          ],
          "start": "18:00",
          "end": "22:00"
        }
      ],
      "availabilityExceptions": [],
      "availabilityTimeZone": "Europe/London",
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
      "bdsmRole": [
        "Dom"
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
      "createdAt": "2026-09-01T08:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Kai",
      "nickname": "",
      "pronouns": "He/they",
      "gender": "Male",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 45,
      "ageIsApprox": true,
      "profilePicture": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20128%20128%22%3E%3Crect%20width%3D%22128%22%20height%3D%22128%22%20rx%3D%2264%22%20fill%3D%22%23b8ded8%22%2F%3E%3Cpath%20d%3D%22M31%2058c0-26%2013-41%2033-41s33%2015%2033%2041v18c-9%2010-20%2015-33%2015S40%2086%2031%2076Z%22%20fill%3D%22%23302923%22%2F%3E%3Cpath%20d%3D%22M12%20128c3-29%2022-44%2052-44s49%2015%2052%2044%22%20fill%3D%22%232f7774%22%2F%3E%3Cellipse%20cx%3D%2264%22%20cy%3D%2258%22%20rx%3D%2229%22%20ry%3D%2235%22%20fill%3D%22%23c88864%22%2F%3E%3Cpath%20d%3D%22M31%2056c0-24%2014-39%2033-39s34%2015%2034%2039c-6-15-15-21-22-25-9%2011-25%2018-45%2020Z%22%20fill%3D%22%23302923%22%2F%3E%3Ccircle%20cx%3D%2252%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Ccircle%20cx%3D%2276%22%20cy%3D%2259%22%20r%3D%222.4%22%20fill%3D%22%23302923%22%2F%3E%3Cpath%20d%3D%22M56%2074c5%204%2011%204%2016%200%22%20fill%3D%22none%22%20stroke%3D%22%238b4f42%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "",
      "email": "kai@example.test",
      "snapchat": "",
      "fabguys": "",
      "fabswingers": "",
      "recon": "",
      "contactableVia": [],
      "city": "Leeds",
      "address": "Leeds city centre, LS1 4AP",
      "hosts": "",
      "travels": "",
      "travelMode": [],
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [
        {
          "id": "seed_kai_weekday",
          "days": [
            1,
            2,
            3,
            4,
            5
          ],
          "start": "18:00",
          "end": "22:00"
        }
      ],
      "availabilityExceptions": [],
      "availabilityTimeZone": "Europe/London",
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
      "createdAt": "2026-04-24T08:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Ash",
      "nickname": "",
      "pronouns": "She/they",
      "gender": "Non-binary",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 27,
      "ageIsApprox": true,
      "profilePicture": "",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "",
      "email": "",
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
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [],
      "availabilityExceptions": [],
      "availabilityTimeZone": "",
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
      "createdAt": "2026-10-26T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Anonymous — sauna",
      "nickname": "",
      "pronouns": "",
      "gender": "",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": null,
      "ageIsApprox": false,
      "profilePicture": "",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "",
      "email": "",
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
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [],
      "availabilityExceptions": [],
      "availabilityTimeZone": "",
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
      "createdAt": "2026-11-08T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Jamie",
      "nickname": "",
      "pronouns": "He/him",
      "gender": "Male",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": null,
      "ageIsApprox": false,
      "profilePicture": "",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "",
      "email": "",
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
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "Unavailable foreseeably",
      "weeklyAvailability": [],
      "availabilityExceptions": [],
      "availabilityTimeZone": "",
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
      "createdAt": "2026-01-14T09:00:00.000Z",
      "isArchived": true
    },
    {
      "isDemo": true,
      "name": "Nat",
      "nickname": "",
      "pronouns": "She/her",
      "gender": "Female",
      "piercings": "",
      "tattoos": "",
      "hivStatus": null,
      "hivStatusInformedDate": "",
      "age": 33,
      "ageIsApprox": false,
      "profilePicture": "",
      "fistingProfile": {
        "role": "",
        "handSize": "",
        "maxDepth": null,
        "maxDepthUnit": "cm",
        "maxWidth": null,
        "maxWidthUnit": "cm",
        "maxFingers": null,
        "canTakeDoubles": false,
        "notes": ""
      },
      "phone": "",
      "email": "",
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
      "outdoorMeetup": false,
      "availability": [],
      "nonAvailabilityRules": [],
      "readilyAvailable": "",
      "weeklyAvailability": [],
      "availabilityExceptions": [],
      "availabilityTimeZone": "",
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
      "bdsmRole": [
        "Unknown / not discussed"
      ],
      "sexualPosition": [
        "Unknown / not discussed"
      ],
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
      "createdAt": "2026-09-26T08:00:00.000Z",
      "isArchived": false
    }
  ],
  "Encounters": [
    {
      "isDemo": true,
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_001",
      "createdAt": "2026-07-20T21:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_002",
      "createdAt": "2026-08-02T18:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "F. Mercury — his place",
      "date": "2026-10-27T22:30:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_003",
      "createdAt": "2026-10-27T23:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Sylvie — drinks then hers",
      "date": "2026-11-04T21:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_004",
      "createdAt": "2026-11-04T22:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Grace — first date",
      "date": "2026-11-08T19:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_005",
      "createdAt": "2026-11-08T21:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Morgan — first date",
      "date": "2026-07-22T18:30:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_006",
      "createdAt": "2026-07-22T21:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Morgan — hers, exclusive now",
      "date": "2026-08-06T19:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_007",
      "createdAt": "2026-08-06T21:30:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Morgan — weekend away",
      "date": "2026-08-20T17:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_008",
      "createdAt": "2026-08-20T22:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Morgan — hers",
      "date": "2026-10-08T19:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_009",
      "createdAt": "2026-10-08T21:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Morgan — mine",
      "date": "2026-10-30T20:30:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_010",
      "createdAt": "2026-10-30T22:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Jordan — his place",
      "date": "2026-09-01T20:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_011",
      "createdAt": "2026-09-01T22:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Sauna trip",
      "date": "2026-09-26T15:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_012",
      "createdAt": "2026-09-26T17:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Priya — birthday drinks then mine",
      "date": "2026-11-05T22:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_013",
      "createdAt": "2026-11-05T23:30:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Devon — app hookup, his place",
      "date": "2026-09-06T19:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_014",
      "createdAt": "2026-09-06T21:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Kai — his flat",
      "date": "2026-04-29T20:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_015",
      "createdAt": "2026-04-29T22:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Ash — mine, regular thing",
      "date": "2026-10-31T20:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_016",
      "createdAt": "2026-10-31T22:30:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Nat — coffee date",
      "date": "2026-10-01T14:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_017",
      "createdAt": "2026-10-01T16:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "title": "Birthday party afters",
      "date": "2026-10-21T22:00:00.000Z",
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
      "sessionId": "",
      "loadsCount": 0,
      "fistCount": 0,
      "activityDetails": [],
      "id": "encounter_018",
      "createdAt": "2026-10-21T22:45:00.000Z",
      "isArchived": false
    }
  ],
  "Tests": [
    {
      "isDemo": true,
      "title": "Symptomatic screen — Gonorrhoea positive",
      "date": "2026-11-01T10:00:00.000Z",
      "resultDate": "2026-11-03T10:00:00.000Z",
      "setting": "clinicSymptomatic",
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
      "followUpActionedDate": "2026-11-02T10:00:00.000Z",
      "writtenPlan": "",
      "notes": "Discharge + discomfort a few days after an encounter. Positive for Gonorrhoea, negative for everything else screened.",
      "trackingInfo": "",
      "kitCodePk": "",
      "kitCodeSk": "",
      "kitAccessKey": "",
      "attachments": [],
      "isRoutineRetestPlan": false,
      "routineRetestSourceTestId": null,
      "plannedForDate": null,
      "routineRetestPerformedAt": null,
      "clinicVisitIds": [
        "seed_visit_9001"
      ],
      "isArchived": false,
      "id": "test_001"
    },
    {
      "isDemo": true,
      "title": "Test of cure — Gonorrhoea",
      "date": "2026-11-08T10:00:00.000Z",
      "resultDate": "2026-11-09T10:00:00.000Z",
      "setting": "clinicRoutine",
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
      "isRoutineRetestPlan": false,
      "routineRetestSourceTestId": null,
      "plannedForDate": null,
      "routineRetestPerformedAt": null,
      "clinicVisitIds": [
        "seed_visit_9001"
      ],
      "isArchived": false,
      "id": "test_002"
    },
    {
      "isDemo": true,
      "title": "Routine PrEP monitoring screen",
      "date": "2026-08-02T09:00:00.000Z",
      "resultDate": "2026-08-05T09:00:00.000Z",
      "setting": "clinicRoutine",
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
      "isRoutineRetestPlan": false,
      "routineRetestSourceTestId": null,
      "plannedForDate": null,
      "routineRetestPerformedAt": null,
      "clinicVisitIds": [],
      "isArchived": false,
      "id": "test_003"
    },
    {
      "isDemo": true,
      "title": "Pre-relationship screen",
      "date": "2026-07-20T09:00:00.000Z",
      "resultDate": "2026-07-23T09:00:00.000Z",
      "setting": "clinicRoutine",
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
      "isRoutineRetestPlan": false,
      "routineRetestSourceTestId": null,
      "plannedForDate": null,
      "routineRetestPerformedAt": null,
      "clinicVisitIds": [],
      "isArchived": false,
      "id": "test_004"
    },
    {
      "isDemo": true,
      "title": "Home kit STI screen",
      "date": "2026-11-07T10:00:00.000Z",
      "resultDate": null,
      "setting": "home",
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
      "isRoutineRetestPlan": false,
      "routineRetestSourceTestId": null,
      "plannedForDate": null,
      "routineRetestPerformedAt": null,
      "clinicVisitIds": [],
      "isArchived": false,
      "id": "test_005"
    },
    {
      "isDemo": true,
      "title": "Symptomatic screen — Chlamydia positive",
      "date": "2026-04-28T09:00:00.000Z",
      "resultDate": "2026-05-01T09:00:00.000Z",
      "setting": "clinicSymptomatic",
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
      "isRoutineRetestPlan": false,
      "routineRetestSourceTestId": null,
      "plannedForDate": null,
      "routineRetestPerformedAt": null,
      "clinicVisitIds": [
        "seed_visit_9004"
      ],
      "isArchived": false,
      "id": "test_006"
    },
    {
      "isDemo": true,
      "title": "Routine annual screen",
      "date": "2026-06-03T09:00:00.000Z",
      "resultDate": "2026-06-08T09:00:00.000Z",
      "setting": "clinicRoutine",
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
      "isRoutineRetestPlan": false,
      "routineRetestSourceTestId": null,
      "plannedForDate": null,
      "routineRetestPerformedAt": null,
      "clinicVisitIds": [
        "seed_visit_9005"
      ],
      "isArchived": false,
      "id": "test_007"
    }
  ],
  "Medications": [
    {
      "isDemo": true,
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
      "isDemo": true,
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
      "isDemo": true,
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
      "isDemo": true,
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
      "isDemo": true,
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
      "isDemo": true,
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
      "isDemo": true,
      "title": "Treatment — Gonorrhoea",
      "date": "2026-11-03T14:00:00.000Z",
      "location": "56 Dean Street",
      "locationId": "",
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
      "isDemo": true,
      "title": "Early pregnancy scan",
      "date": "2026-09-01T13:00:00.000Z",
      "location": "Local hospital — antenatal unit",
      "locationId": "",
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
      "isDemo": true,
      "title": "Miscarriage aftercare",
      "date": "2026-09-21T13:00:00.000Z",
      "location": "Local hospital — antenatal unit",
      "locationId": "",
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
      "isDemo": true,
      "title": "Treatment — Chlamydia",
      "date": "2026-04-28T13:00:00.000Z",
      "location": "56 Dean Street",
      "locationId": "",
      "clinician": [
        "Lucy"
      ],
      "reasonForVisit": [
        "Treatment"
      ],
      "isFutureAppointment": true,
      "nextReviewDate": "2026-05-19T13:00:00.000Z",
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
      "isDemo": true,
      "title": "Routine annual screen",
      "date": "2026-06-03T13:00:00.000Z",
      "location": "56 Dean Street",
      "locationId": "",
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
      "isDemo": true,
      "title": "IUD insertion",
      "date": "2026-08-27T13:00:00.000Z",
      "location": "56 Dean Street",
      "locationId": "",
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
      "isDemo": true,
      "title": "Gonorrhoea vaccine (4CMenB)",
      "vaccine": "Gonorrhoea",
      "reason": [
        "High-risk status"
      ],
      "time": null,
      "date": "2026-11-09T11:00:00.000Z",
      "notes": "Offered given recent Gonorrhoea diagnosis and ongoing risk.",
      "symptomIds": [],
      "doses": [
        {
          "doseNumber": 1,
          "date": "2026-11-09T11:00:00.000Z",
          "provider": "56 Dean Street",
          "injectionSite": "Deltoid",
          "notes": "Offered given recent Gonorrhoea diagnosis and ongoing risk."
        }
      ],
      "isArchived": false,
      "id": "vaccination_001"
    },
    {
      "isDemo": true,
      "title": "Meningitis B vaccine (4CMenB)",
      "vaccine": "Meningitis B",
      "reason": [
        "Routine"
      ],
      "time": null,
      "date": "2026-08-02T10:00:00.000Z",
      "notes": "Routine MenB vaccination, offered opportunistically at a clinic visit.",
      "symptomIds": [],
      "doses": [
        {
          "doseNumber": 1,
          "date": "2026-08-02T10:00:00.000Z",
          "provider": "56 Dean Street",
          "injectionSite": "Deltoid",
          "notes": "Routine MenB vaccination, offered opportunistically at a clinic visit."
        }
      ],
      "isArchived": false,
      "id": "vaccination_002"
    },
    {
      "isDemo": true,
      "title": "Hepatitis A/B vaccine (Twinrix), dose 1",
      "vaccine": "Hepatitis A/B",
      "reason": [
        "Routine"
      ],
      "time": null,
      "date": "2026-06-03T10:00:00.000Z",
      "notes": "First of a 3-dose Twinrix course, offered at the routine annual screen.",
      "symptomIds": [],
      "doses": [
        {
          "doseNumber": 1,
          "date": "2026-06-03T10:00:00.000Z",
          "provider": "56 Dean Street",
          "injectionSite": "Deltoid",
          "notes": "First of a 3-dose Twinrix course, offered at the routine annual screen."
        }
      ],
      "isArchived": false,
      "id": "vaccination_003"
    },
    {
      "isDemo": true,
      "title": "Hepatitis A/B vaccine (Twinrix), dose 2",
      "vaccine": "Hepatitis A/B",
      "reason": [
        "Routine"
      ],
      "time": null,
      "date": "2026-07-03T10:00:00.000Z",
      "notes": "Second dose, on schedule. Third and final dose due at the 6-month mark.",
      "symptomIds": [],
      "doses": [
        {
          "doseNumber": 2,
          "date": "2026-07-03T10:00:00.000Z",
          "nextDue": "2026-11-30",
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
      "isDemo": true,
      "title": "Discharge + discomfort",
      "symptomIds": [
        "symptom_cat_001"
      ],
      "dateStarted": "2026-10-30T08:00:00.000Z",
      "dateResolved": "2026-11-07T08:00:00.000Z",
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
      "isDemo": true,
      "title": "Mild discharge",
      "symptomIds": [
        "symptom_cat_001"
      ],
      "dateStarted": "2026-04-26T07:00:00.000Z",
      "dateResolved": "2026-05-04T07:00:00.000Z",
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
      "isDemo": true,
      "title": "Ongoing mild irritation",
      "symptomIds": [
        "symptom_cat_001"
      ],
      "dateStarted": "2026-11-08T08:00:00.000Z",
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
      "isDemo": true,
      "type": "CD4 count",
      "date": "2026-10-11T08:00:00.000Z",
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
      "isDemo": true,
      "type": "Weight",
      "date": "2026-10-27T09:00:00.000Z",
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
      "isDemo": true,
      "type": "Blood pressure",
      "date": "2026-10-27T09:00:00.000Z",
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
      "isDemo": true,
      "type": "Weight",
      "date": "2026-11-08T09:00:00.000Z",
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
      "isDemo": true,
      "type": "CD4 count",
      "date": "2026-07-13T08:00:00.000Z",
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
      "isDemo": true,
      "type": "Blood glucose",
      "date": "2026-11-05T09:00:00.000Z",
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
      "isDemo": true,
      "name": "Home",
      "type": "",
      "address": "",
      "postcode": "",
      "notes": "",
      "relatedContactId": "",
      "id": "location_001",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "His place",
      "type": "",
      "address": "",
      "postcode": "",
      "notes": "",
      "relatedContactId": "",
      "id": "location_002",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Sauna",
      "type": "",
      "address": "",
      "postcode": "",
      "notes": "",
      "relatedContactId": "",
      "id": "location_003",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Public",
      "type": "",
      "address": "",
      "postcode": "",
      "notes": "",
      "relatedContactId": "",
      "id": "location_004",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Car",
      "type": "",
      "address": "",
      "postcode": "",
      "notes": "",
      "relatedContactId": "",
      "id": "location_005",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Steamworks",
      "type": "🛀 Sauna",
      "address": "Shoreditch, London",
      "postcode": "",
      "notes": "",
      "relatedContactId": "",
      "id": "location_006",
      "createdAt": "2026-08-01T09:00:00.000Z",
      "isArchived": false
    },
    {
      "isDemo": true,
      "name": "Devon's flat",
      "type": "🏠 His House",
      "address": "Bristol",
      "postcode": "",
      "notes": "",
      "relatedContactId": "seed_contact_9011",
      "id": "location_007",
      "createdAt": "2026-08-15T09:00:00.000Z",
      "isArchived": false
    }
  ],
  "Episodes": [
    {
      "isDemo": true,
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
      "resolvedDate": "2026-11-09T03:48:27.117Z",
      "resolution": "Treated — course complete",
      "notes": "TOC negative — resolved. Partner notification checklist used for encounters since the exposure date.",
      "isArchived": false,
      "id": "episode_001",
      "createdAt": "2026-11-01T03:48:27.117Z"
    }
  ],
  "Logs": [
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_001",
      "medicationId": "seed_med_9001",
      "type": "refill",
      "delta": 30,
      "date": "2026-11-02T09:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_002",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-11-09T08:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_003",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-11-08T08:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_004",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-11-07T08:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_005",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-11-06T08:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_006",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-11-05T08:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_007",
      "medicationId": "seed_med_9001",
      "type": "dose",
      "delta": -1,
      "date": "2026-11-04T08:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_008",
      "medicationId": "seed_med_9002",
      "type": "refill",
      "delta": 16,
      "date": "2026-10-21T08:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_009",
      "medicationId": "seed_med_9002",
      "type": "dose",
      "delta": -6,
      "date": "2026-11-05T22:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_010",
      "medicationId": "seed_med_9003",
      "type": "refill",
      "delta": 90,
      "date": "2026-09-11T08:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_011",
      "medicationId": "seed_med_9003",
      "type": "dose",
      "delta": -30,
      "date": "2026-10-11T07:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_012",
      "medicationId": "seed_med_9003",
      "type": "dose",
      "delta": -14,
      "date": "2026-11-09T20:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_013",
      "medicationId": "seed_med_9004",
      "type": "dose",
      "delta": -1,
      "date": "2026-11-08T14:30:00.000Z",
      "voided": false
    },
    {
      "isDemo": true,
      "reason": [],
      "sideEffects": [],
      "notes": "",
      "id": "log_014",
      "medicationId": "seed_med_9005",
      "type": "dose",
      "delta": -21,
      "date": "2026-09-26T08:30:00.000Z",
      "voided": false
    }
  ],
  "Cycles": [
    {
      "isDemo": true,
      "startDate": "2026-09-13",
      "endDate": "2026-09-18",
      "flow": "Medium",
      "symptomIds": [],
      "notes": "",
      "isArchived": false,
      "id": "cycle_001",
      "createdAt": "2026-11-10T03:48:27.432Z"
    },
    {
      "isDemo": true,
      "startDate": "2026-10-11",
      "endDate": "2026-10-15",
      "flow": "Heavy",
      "symptomIds": [],
      "notes": "",
      "isArchived": false,
      "id": "cycle_002",
      "createdAt": "2026-11-10T03:48:27.432Z"
    },
    {
      "isDemo": true,
      "startDate": "2026-11-09",
      "endDate": null,
      "flow": "Light",
      "symptomIds": [],
      "notes": "Ongoing.",
      "isArchived": false,
      "id": "cycle_003",
      "createdAt": "2026-11-10T03:48:27.432Z"
    }
  ],
  "Contraception": [
    {
      "isDemo": true,
      "method": "Combined pill",
      "formulation": "Pill/Tablet",
      "startDate": "2025-10-06",
      "endDate": "2026-08-07",
      "intervalDays": null,
      "nextDueDate": null,
      "linkedClinicVisitId": null,
      "notes": "Stopped when the relationship with Morgan became exclusive.",
      "isArchived": false,
      "id": "contra_001",
      "createdAt": "2026-11-10T03:48:26.957Z"
    },
    {
      "isDemo": true,
      "method": "Depot",
      "formulation": "Injection",
      "startDate": "2026-09-26",
      "endDate": null,
      "intervalDays": 84,
      "nextDueDate": "2026-12-19",
      "linkedClinicVisitId": null,
      "notes": "Started after the miscarriage — wanted something more reliable than the pill.",
      "isArchived": false,
      "id": "contra_002",
      "createdAt": "2026-11-10T03:48:26.957Z"
    },
    {
      "isDemo": true,
      "method": "IUD (hormonal)",
      "formulation": "IUD/Implant",
      "startDate": "2026-08-27",
      "endDate": null,
      "intervalDays": null,
      "nextDueDate": null,
      "linkedClinicVisitId": "seed_visit_9006",
      "notes": "Testosterone alone isn't reliable contraception — opted for a hormonal IUD as well.",
      "isArchived": false,
      "id": "contra_003",
      "createdAt": "2026-11-10T03:48:26.957Z"
    }
  ],
  "Pregnancy": [
    {
      "isDemo": true,
      "testDate": "2026-10-01",
      "testResult": "Negative",
      "estimatedDueDate": null,
      "status": "",
      "outcomeDate": null,
      "sensitive": false,
      "notes": "Precautionary test.",
      "isArchived": false,
      "id": "pregnancy_001",
      "createdAt": "2026-11-10T03:48:27.458Z"
    },
    {
      "isDemo": true,
      "testDate": "2026-08-27",
      "testResult": "Positive",
      "estimatedDueDate": "2027-04-29",
      "status": "Miscarriage",
      "outcomeDate": "2026-09-18",
      "sensitive": true,
      "notes": "Found out at 5 weeks. Miscarried naturally at home, confirmed at follow-up.",
      "isArchived": false,
      "id": "pregnancy_002"
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
export const LEGACY_SEED_SNAPSHOT_SIZE = 96;

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

  // TIME OF DAY IS NOT COMPARED, and that is a deliberate limitation rather than
  // a rounding choice.
  //
  // A field set to `new Date().toISOString()` - `Episode.resolvedDate` is the one
  // that exists today - records "when the seed array was evaluated". Two
  // evaluations an hour apart produce two different values, so any time-of-day
  // comparison makes that record diverge purely from regeneration. The first fix
  // compared the HOUR, and the next run drifted 77 minutes and failed anyway: a
  // tolerance is being defeated by a clock, which is what it was chosen to avoid.
  //
  // So the comparison is day-resolution, and the cost is stated: a user who edits
  // only the time of day of a record sitting on a seed id, on the same calendar
  // day, is not detected. That is the price of a fixture that can be regenerated
  // at any time without becoming wrong, which matters more - the alternative is a
  // guard that reports itself broken on every regeneration and is then ignored.
  //
  // `snapshotFidelity.test.js` covers the day-resolution case explicitly, and a
  // migration that needs hour-level fidelity has never existed.
  return `T${offset}`;
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
export const SNAPSHOT_TAKEN_AT = "2026-11-10";

/** Today, as the fake-UTC date string the rest of this module compares. */
function todayAsStoredDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isEmptyDefaultValue(v) {
  if (v === "" || v === 0 || v === "0" || v === false || v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.values(v).every(isEmptyDefaultValue);
  return false;
}

function demoComparable(record, fallbackReference, counterpartKeys) {
  const out = {};
  // A record's own creation date is the better epoch when it has one, because a
  // seed that hard-codes its dates stays stable against its own createdAt. The
  // fallback exists because not every repository stamps one: TestingRepository's
  // live seed records carry no createdAt at all, and without a fallback every
  // one of them compared as an absolute timestamp and read as diverged.
  const createdAt = typeof record.createdAt === "string" ? record.createdAt.slice(0, 10) : null;
  const anchor = createdAt && STORED_DATE.test(createdAt) ? createdAt : fallbackReference;
  for (const k of Object.keys(record).sort()) {
    if (k === "isSeed" || k === "isDemo" || k === "createdAt" || k === "updatedAt") continue;
    if (k === "collection") continue;
    // New optional fields are merged into live seed records by repository
    // defaults, but older frozen seed snapshots do not contain them. Ignore
    // only their empty default values; a meaningful user edit still makes the
    // seed diverge and therefore remain protected from Clear Sample Data.
    //
    // The general form (below) covers any such field without naming it: a key
    // the other side does not have at all, carrying only an empty default.
    // Naming them one at a time is how `piercings` and `tattoos` slipped
    // through and made every seeded contact read as the user's own data.
    if (counterpartKeys && !counterpartKeys.has(k) && isEmptyDefaultValue(record[k])) continue;
    if (k === "sessionId" && record[k] === "") continue;
    if (["loadsCount", "fistCount"].includes(k) && (record[k] === 0 || record[k] === "0" || record[k] == null)) continue;
    if (k === "activityDetails" && Array.isArray(record[k]) && record[k].length === 0) continue;
    if (k === "fistingProfile" && record[k] &&
      record[k].role === "" && record[k].handSize === "" &&
      record[k].maxDepth == null && record[k].maxDepthUnit === "cm" &&
      record[k].maxWidth == null && record[k].maxWidthUnit === "cm" &&
      record[k].maxFingers == null && record[k].canTakeDoubles === false &&
      record[k].notes === "") continue;
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
    // ADDED 5 Nov 2026 (B7) — see this file's header. Applied before the date
    // projection because a setting is text, never a date, and before the seed-id
    // rewrite because "home" is not an id.
    if (field === "setting") {
      const normalisedSetting = normaliseSetting(value);
      if (normalisedSetting !== value) return normalisedSetting;
    }
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
  if (record.isDemo === false) return false;
  const definition = legacyDefinitionFor(record);
  if (!definition) return false;
  return (
    JSON.stringify(demoComparable(record, todayAsStoredDate(), new Set(Object.keys(definition)))) ===
    JSON.stringify(demoComparable(definition, SNAPSHOT_TAKEN_AT, new Set(Object.keys(record))))
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
