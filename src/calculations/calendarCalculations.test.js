import { describe, it, expect } from 'vitest';
import { getCalendarEvents, groupEventsByDay } from './calendarCalculations';

describe('calendarCalculations', () => {
  describe('getCalendarEvents', () => {
    it('returns events for all modules', () => {
      const mockData = {
        encounters: [
          { id: 'e1', date: '2026-09-15T08:00:00.000Z', title: 'Test encounter', isArchived: false },
        ],
        tests: [
          { id: 't1', date: '2026-09-15T08:00:00.000Z', title: 'Test test', isArchived: false, result: 'Negative' },
        ],
        clinicVisits: [
          { id: 'v1', date: '2026-09-15T08:00:00.000Z', title: 'Clinic visit', isArchived: false, isFutureAppointment: true },
        ],
        symptomEntries: [
          { id: 's1', dateStarted: '2026-09-15T08:00:00.000Z', title: 'Symptom', isArchived: false },
        ],
        vaccinations: [
          { id: 'vac1', date: '2026-09-15T08:00:00.000Z', vaccineName: 'Test vaccine', isArchived: false },
        ],
        medications: [
          { id: 'm1', name: 'Test med', isArchived: false, createdAt: '2026-09-15T08:00:00.000Z' },
        ],
      };

      const events = getCalendarEvents(mockData);
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      
      // Each event should have required fields
      events.forEach(event => {
        expect(event).toHaveProperty('moduleKey');
        expect(event).toHaveProperty('date');
        expect(event).toHaveProperty('title');
        expect(event).toHaveProperty('id');
      });
    });

    // ADDED 20 Oct 2026 (t130) - ONE EVENT PER DOSE, so this screen and the
    // phone's real calendar show the same things. A vaccine course is a
    // series (a four-week schedule is four dates), and two different vaccines
    // on one day are two different things that happened - so they are two
    // events, not one merged one.
    it('shows one event per DOSE, not one per record', () => {
      const mockData = {
        encounters: [], tests: [], clinicVisits: [], symptomEntries: [], medications: [],
        vaccinations: [
          {
            id: 'vac1', vaccine: 'Hepatitis B', isArchived: false,
            doses: [
              { doseNumber: 1, date: '2026-09-01', time: '11:00' },
              { doseNumber: 2, date: '2026-09-29', time: '11:00' },
              { doseNumber: 3, date: '2026-10-27', time: '11:00' },
            ],
          },
        ],
      };
      const events = getCalendarEvents(mockData);
      const vax = events.filter((e) => e.moduleKey === 'vaccinations');
      expect(vax).toHaveLength(3);
      expect(vax.map((e) => e.date.slice(0, 10))).toEqual(['2026-09-01', '2026-09-29', '2026-10-27']);
      // Every event still carries the RECORD id, because that is what the
      // calendar screen navigates to when an event is tapped.
      expect(vax.every((e) => e.id === 'vac1')).toBe(true);
      // And each event has its own key, so two doses of one record are two
      // events rather than one event listed twice.
      expect(new Set(vax.map((e) => e.key)).size).toBe(3);
    });

    it('two different vaccines on the same day are two events', () => {
      const mockData = {
        encounters: [], tests: [], clinicVisits: [], symptomEntries: [], medications: [],
        vaccinations: [
          { id: 'vax_mpox', vaccine: 'Mpox', isArchived: false, doses: [{ doseNumber: 1, date: '2026-09-01' }] },
          { id: 'vax_bex', vaccine: 'Bexcero', isArchived: false, doses: [{ doseNumber: 1, date: '2026-09-01' }] },
        ],
      };
      const vax = getCalendarEvents(mockData).filter((e) => e.moduleKey === 'vaccinations');
      expect(vax).toHaveLength(2);
      expect(vax.map((e) => e.title).sort()).toEqual(['Bexcero', 'Mpox']);
      expect(vax.every((e) => e.date.slice(0, 10) === '2026-09-01')).toBe(true);
    });

    it('filters out archived records', () => {
      const mockData = {
        encounters: [
          { id: 'e1', date: '2026-09-15T08:00:00.000Z', title: 'Active', isArchived: false },
          { id: 'e2', date: '2026-09-15T08:00:00.000Z', title: 'Archived', isArchived: true },
        ],
        tests: [], clinicVisits: [], symptomEntries: [], vaccinations: [], medications: [],
      };

      const events = getCalendarEvents(mockData);
      expect(events.length).toBe(1);
      expect(events[0].title).toBe('Active');
    });

    it('includes future clinic visits', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const mockData = {
        clinicVisits: [
          { id: 'v1', date: futureDate, title: 'Future appt', isArchived: false, isFutureAppointment: true },
          { id: 'v2', date: '2026-01-01T08:00:00.000Z', title: 'Past appt', isArchived: false, isFutureAppointment: false },
        ],
        encounters: [], tests: [], symptomEntries: [], vaccinations: [], medications: [],
      };

      const events = getCalendarEvents(mockData);
      // Both future and past appointments are included (function doesn't filter by isFutureAppointment)
      expect(events.length).toBe(2);
      expect(events.some(e => e.title === 'Future appt')).toBe(true);
      expect(events.some(e => e.title === 'Past appt')).toBe(true);
    });

    it('includes medication start date and dose history', () => {
      const mockData = {
        medications: [
          { 
            id: 'm1', 
            name: 'Test Med', 
            isArchived: false, 
            createdAt: '2026-09-15T08:00:00.000Z',
            doseHistory: [
              { supersededAt: '2026-09-10T08:00:00.000Z', note: 'Increased dose' }
            ]
          }
        ],
        encounters: [], tests: [], clinicVisits: [], symptomEntries: [], vaccinations: [],
      };

      const events = getCalendarEvents(mockData);
      expect(events.length).toBe(2); // createdAt + doseHistory
      expect(events.some(e => e.title.includes('started'))).toBe(true);
      expect(events.some(e => e.title.includes('dose changed'))).toBe(true);
    });
  });

  describe('groupEventsByDay', () => {
    it('groups events by day', () => {
      const events = [
        { date: '2026-09-15T08:00:00.000Z', moduleKey: 'encounters' },
        { date: '2026-09-15T14:00:00.000Z', moduleKey: 'testing' },
        { date: '2026-09-16T08:00:00.000Z', moduleKey: 'encounters' },
      ];

      const grouped = groupEventsByDay(events);
      expect(Object.keys(grouped).length).toBe(2);
      expect(grouped['2026-09-15'].length).toBe(2);
      expect(grouped['2026-09-16'].length).toBe(1);
    });

    it('groups all events for same day together (no deduplication by moduleKey)', () => {
      const events = [
        { date: '2026-09-15T08:00:00.000Z', moduleKey: 'encounters' },
        { date: '2026-09-15T14:00:00.000Z', moduleKey: 'encounters' },
      ];

      const grouped = groupEventsByDay(events);
      // Both events on same day are grouped together
      expect(grouped['2026-09-15'].length).toBe(2);
    });

    it('handles empty array', () => {
      const grouped = groupEventsByDay([]);
      expect(grouped).toEqual({});
    });

    it('groups by the STORED day, so a midnight dose is on the day it was given', () => {
      // CHANGED 20 Oct 2026 (t130). The old version of this test asserted
      // only that the result had at least one key - which passes whether the
      // grouping is right or wrong, and so proved nothing. (The research
      // behind the change says it plainly: the test "cannot catch it".)
      //
      // The property that matters: a stored datetime's digits are LITERAL
      // LOCAL WALL-CLOCK TIME with a deliberate "Z" lie, so the day is read
      // with the UTC getters. A dose with no recorded time is local midnight,
      // and it must be filed under ITS OWN day - not the previous one, which
      // is what reading it with the local getters does in every
      // negative-offset zone, while the phone's calendar filed it correctly.
      //
      // Honest limit, and the same one calendarSyncOffset.test.js documents:
      // in UTC the offset is 0, so the naive read and this one agree, and no
      // test here can fail in UTC. That is a property of the bug, not a gap
      // in the test.
      const midnightDose = { date: '2026-09-15T00:00:00.000Z', moduleKey: 'vaccinations' };
      const grouped = groupEventsByDay([midnightDose]);
      expect(Object.keys(grouped)).toEqual(['2026-09-15']);

      // And the grouping follows the stored digits, not a UTC conversion of
      // them: two events on the same stored day group together whatever the
      // clock says.
      const sameDay = [
        { date: '2026-09-15T23:00:00.000Z', moduleKey: 'encounters' },
        { date: '2026-09-15T01:00:00.000Z', moduleKey: 'testing' },
      ];
      const groupedSameDay = groupEventsByDay(sameDay);
      expect(Object.keys(groupedSameDay)).toEqual(['2026-09-15']);
      expect(groupedSameDay['2026-09-15']).toHaveLength(2);
    });
  });
});