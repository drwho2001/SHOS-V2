import { describe, it, expect, vi } from 'vitest';
import { 
  getPositiveTestsByOrganism, 
  getTestsBySite, 
  getTopKinks, 
  getTopSymptoms,
  getTestingFrequencyStats,
  getTestingIntervalTrend,
  getOverallAdherence,
  getDoxyPepComplianceRate,
  getAdherenceTrend,
  BASHH_TESTING_INTERVAL_DAYS,
} from './statsCalculations';

describe('statsCalculations', () => {
  describe('BASHH_TESTING_INTERVAL_DAYS', () => {
    it('is 90 days (3 months)', () => {
      expect(BASHH_TESTING_INTERVAL_DAYS).toBe(90);
    });
  });

  describe('getTestingFrequencyStats', () => {
    it('returns correct structure for insufficient tests', () => {
      const result = getTestingFrequencyStats([]);
      expect(result).toEqual({
        averageIntervalDays: null,
        daysSinceLast: null,
        testCount: 0,
        withinBashhInterval: null,
      });
    });

    it('returns stats for single test', () => {
      const tests = [{ id: 't1', date: '2026-09-15T08:00:00.000Z', isArchived: false }];
      const result = getTestingFrequencyStats(tests);
      expect(result.testCount).toBe(1);
      expect(result.averageIntervalDays).toBeNull();
      expect(typeof result.daysSinceLast).toBe('number');
    });

    it('calculates average interval for multiple tests', () => {
      const tests = [
        { id: 't1', date: '2026-06-15T08:00:00.000Z', isArchived: false },
        { id: 't2', date: '2026-09-15T08:00:00.000Z', isArchived: false },
      ];
      const result = getTestingFrequencyStats(tests);
      expect(result.testCount).toBe(2);
      expect(typeof result.averageIntervalDays).toBe('number');
      expect(typeof result.daysSinceLast).toBe('number');
      expect(typeof result.withinBashhInterval).toBe('boolean');
    });

    it('filters out archived tests', () => {
      const tests = [
        { id: 't1', date: '2026-09-01T08:00:00.000Z', isArchived: false },
        { id: 't2', date: '2026-08-01T08:00:00.000Z', isArchived: true },
      ];
      const result = getTestingFrequencyStats(tests);
      expect(result.testCount).toBe(1);
    });
  });

  describe('getTestingIntervalTrend', () => {
    it('returns null for insufficient tests', () => {
      const result = getTestingIntervalTrend([]);
      expect(result.currentGapVsAverage).toBeNull();
      expect(result.recentTrend).toBeNull();
    });

    it('returns null for single test', () => {
      const tests = [{ id: 't1', date: '2026-09-15T08:00:00.000Z', isArchived: false }];
      const result = getTestingIntervalTrend(tests);
      expect(result.currentGapVsAverage).toBeNull();
      expect(result.recentTrend).toBeNull();
    });

    it('returns trend data for sufficient tests', () => {
      const tests = [
        { id: 't1', date: '2026-03-15T08:00:00.000Z', isArchived: false },
        { id: 't2', date: '2026-06-15T08:00:00.000Z', isArchived: false },
        { id: 't3', date: '2026-09-15T08:00:00.000Z', isArchived: false },
      ];
      const result = getTestingIntervalTrend(tests);
      expect(result.currentGapVsAverage).toHaveProperty('direction');
      expect(result.currentGapVsAverage).toHaveProperty('percent');
      expect(result.currentGapVsAverage).toHaveProperty('averageIntervalDays');
      expect(result.currentGapVsAverage).toHaveProperty('daysSinceLast');
    });
  });

  describe('getOverallAdherence', () => {
    it('returns null for no medications', () => {
      const result = getOverallAdherence([], () => ({ sevenDay: { pct: 80 } }));
      expect(result).toBeNull();
    });

    it('filters out PRN meds and archived', () => {
      const meds = [
        { id: 'm1', usagePattern: 'daily', isArchived: false, logs: [] },
        { id: 'm2', usagePattern: 'prn', isArchived: false, logs: [] },
        { id: 'm3', usagePattern: 'daily', isArchived: true, logs: [] },
      ];
      const computeAdherenceFn = vi.fn().mockReturnValue({ sevenDay: { pct: 80 } });
      getOverallAdherence(meds, computeAdherenceFn);
      // Only m1 should be counted
      expect(computeAdherenceFn).toHaveBeenCalledTimes(1);
    });

    it('calculates average of sevenDay.pct', () => {
      const meds = [
        { id: 'm1', usagePattern: 'daily', isArchived: false, logs: [] },
        { id: 'm2', usagePattern: 'daily', isArchived: false, logs: [] },
      ];
      const computeAdherenceFn = vi.fn()
        .mockReturnValueOnce({ sevenDay: { pct: 80 } })
        .mockReturnValueOnce({ sevenDay: { pct: 60 } });
      const result = getOverallAdherence(meds, computeAdherenceFn);
      expect(result).toBe(70); // (80 + 60) / 2
    });
  });

  describe('getDoxyPepComplianceRate', () => {
    it('returns null for no qualifying encounters', () => {
      const result = getDoxyPepComplianceRate([], [], () => true, 72);
      expect(result).toBeNull();
    });

    it('calculates compliance rate', () => {
      const encounters = [
        { id: 'e1', date: '2026-09-15T08:00:00.000Z', isArchived: false },
      ];
      const doses = [
        { type: 'dose', date: '2026-09-16T08:00:00.000Z', voided: false },
      ];
      const result = getDoxyPepComplianceRate(encounters, doses, () => true, 72);
      expect(typeof result).toBe('number');
    });
  });

  describe('getAdherenceTrend', () => {
    it('returns buckets for each month', () => {
      const meds = [
        { 
          id: 'm1', 
          usagePattern: 'daily', 
          isArchived: false, 
          startDate: '2026-01-01T00:00:00.000Z',
          logs: [{ type: 'dose', date: '2026-09-15T08:00:00.000Z', voided: false }]
        },
      ];
      const result = getAdherenceTrend(meds, 3);
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty('label');
      expect(result[0]).toHaveProperty('pct');
    });
  });
});