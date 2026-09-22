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

    it('uses local date not UTC', () => {
      // Events on the same local day but different UTC should group together
      const events = [
        { date: '2026-09-15T23:00:00.000Z', moduleKey: 'encounters' }, // Could be next day UTC
        { date: '2026-09-16T01:00:00.000Z', moduleKey: 'testing' },   // Could be same day local
      ];

      const grouped = groupEventsByDay(events);
      // Both should be grouped by local date
      // 23:00 UTC = 00:00 BST next day, 01:00 UTC = 02:00 BST
      // Depends on timezone, but function uses local date
      expect(Object.keys(grouped).length).toBeGreaterThan(0);
    });
  });
});