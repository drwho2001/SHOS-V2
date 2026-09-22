import { describe, it, expect } from 'vitest';
import {
  nowAsStoredDateTime,
  nowAsDateString,
  nowAsDateTimeLocalString,
  nowAsStoredDate,
  inDaysAsStoredDate,
  realTimestampFromStored,
} from './dateInputHelpers';

describe('dateInputHelpers', () => {
  describe('nowAsStoredDateTime', () => {
    it('returns string in fake-UTC format', () => {
      const result = nowAsStoredDateTime();
      // Format: YYYY-MM-DDTHH:mm:00.000Z
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
    });

    it('seconds and milliseconds are zeroed', () => {
      const result = nowAsStoredDateTime();
      expect(result.endsWith(':00.000Z')).toBe(true);
    });
  });

  describe('nowAsDateString', () => {
    it('returns YYYY-MM-DD format', () => {
      const result = nowAsDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('nowAsDateTimeLocalString', () => {
    it('returns YYYY-MM-DDTHH:mm format', () => {
      const result = nowAsDateTimeLocalString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
  });

  describe('nowAsStoredDate', () => {
    it('returns fake-UTC format with midnight time', () => {
      const result = nowAsStoredDate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });
  });

  describe('inDaysAsStoredDate', () => {
    it('returns YYYY-MM-DD from fake-UTC string with days offset', () => {
      const result = inDaysAsStoredDate(0);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });

    it('handles future dates', () => {
      const result = inDaysAsStoredDate(5);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });

    it('handles past dates', () => {
      const result = inDaysAsStoredDate(-5);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });
  });

  describe('realTimestampFromStored', () => {
    it('parses fake-UTC as local time', () => {
      // Fake-UTC: 2026-09-15T08:00:00.000Z (literal 08:00 local)
      const stored = '2026-09-15T08:00:00.000Z';
      const result = realTimestampFromStored(stored);
      // Should be treated as 08:00 local, not 08:00 UTC
      const expected = new Date(2026, 8, 15, 8, 0, 0).getTime(); // month is 0-indexed
      expect(result).toBe(expected);
    });

    it('handles midnight correctly', () => {
      const stored = '2026-01-01T00:00:00.000Z';
      const result = realTimestampFromStored(stored);
      const expected = new Date(2026, 0, 1, 0, 0, 0).getTime();
      expect(result).toBe(expected);
    });
  });
});