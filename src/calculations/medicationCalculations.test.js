import { describe, it, expect } from 'vitest';
import { 
  computeAdherence, 
  lockoutEndsEstimate, 
  getNextNotificationTime, 
  nextDoseEstimate, 
  formatRemaining, 
  effectiveDoseIntervalHours,
  computeAdherenceTrend,
  computeStock 
} from './medicationCalculations';

// Mock medication data factory
const createMed = (overrides = {}) => ({
  id: 'med_001',
  name: 'Test Med',
  usagePattern: 'daily',
  unitsPerDose: 1,
  dosesPerDay: 1,
  scheduleIntervalDays: null,
  unitsPerContainer: 30,
  refillThreshold: 5,
  inventoryTracked: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  logs: [],
  ...overrides,
});

describe('medicationCalculations', () => {
  describe('effectiveDoseIntervalHours', () => {
    it('returns 24 for daily meds with 1 dose/day', () => {
      const med = createMed({ usagePattern: 'daily', dosesPerDay: 1 });
      expect(effectiveDoseIntervalHours(med)).toBe(24);
    });

    it('returns 12 for daily meds with 2 doses/day', () => {
      const med = createMed({ usagePattern: 'daily', dosesPerDay: 2 });
      expect(effectiveDoseIntervalHours(med)).toBe(12);
    });

    it('returns interval for custom meds with scheduleIntervalDays', () => {
      const med = createMed({ usagePattern: 'custom', scheduleIntervalDays: 14 });
      expect(effectiveDoseIntervalHours(med)).toBe(336); // 14 * 24
    });

    it('returns null for PRN meds', () => {
      const med = createMed({ usagePattern: 'prn' });
      expect(effectiveDoseIntervalHours(med)).toBeNull();
    });
  });

  describe('computeAdherence', () => {
    it('returns null for PRN meds', () => {
      const med = createMed({ usagePattern: 'prn' });
      med.logs = [];
      const result = computeAdherence(med);
      expect(result).toBeNull();
    });

    it('returns streak, sevenDay, sinceRefill for daily meds', () => {
      const med = createMed({ 
        usagePattern: 'daily',
        startDate: '2026-01-01T00:00:00.000Z',
      });
      // 3 consecutive days of doses
      med.logs = [
        { type: 'dose', date: '2026-09-15T08:00:00.000Z', voided: false },
        { type: 'dose', date: '2026-09-16T08:00:00.000Z', voided: false },
        { type: 'dose', date: '2026-09-17T08:00:00.000Z', voided: false },
      ];
      const result = computeAdherence(med);
      expect(result).toHaveProperty('streak');
      expect(result).toHaveProperty('sevenDay');
      expect(result).toHaveProperty('sinceRefill');
      expect(result.sevenDay).toHaveProperty('pct');
      expect(result.sinceRefill).toHaveProperty('pct');
    });

    it('returns correct structure with sevenDay having pct', () => {
      const med = createMed({ usagePattern: 'daily' });
      med.logs = [
        { type: 'dose', date: '2026-09-15T08:00:00.000Z', voided: false },
      ];
      const result = computeAdherence(med);
      expect(typeof result.sevenDay.pct).toBe('number');
    });
  });

  describe('lockoutEndsEstimate / getNextNotificationTime', () => {
    it('lockoutEndsEstimate returns null for meds without interval', () => {
      const med = createMed({ usagePattern: 'prn' });
      expect(lockoutEndsEstimate(med, '2026-09-15T08:00:00.000Z')).toBeNull();
    });

it('getNextNotificationTime uses interval for adaptive mode', () => {
      // Test without scheduledTimes to verify adaptive mode uses interval
      const med = createMed({ scheduledTimes: [] }); // no scheduled times
      const lastDose = '2026-09-15T22:00:00.000Z';
      const next = getNextNotificationTime(med, lastDose, 'adaptive');
      // Should be ~24h after last dose
      expect(next).toBeInstanceOf(Date);
      const lastDoseLocal = new Date(2026, 8, 15, 22, 0, 0).getTime(); // Sept 15, 22:00 local
      const diff = next.getTime() - lastDoseLocal;
      // Should be approximately 24 hours (within 1 hour tolerance)
      expect(diff).toBeGreaterThan(23 * 3600000);
      expect(diff).toBeLessThan(25 * 3600000);
    });

    it('getNextNotificationTime uses scheduledTimes for fixed mode', () => {
      const med = createMed({ scheduledTimes: ['08:00', '20:00'] });
      const lastDose = '2026-09-15T22:00:00.000Z';
      const next = getNextNotificationTime(med, lastDose, 'fixed');
      expect(next).toBeTruthy();
    });
  });

  describe('formatRemaining', () => {
    it('formats days correctly', () => {
      expect(formatRemaining(5)).toBe('5d remaining');
      expect(formatRemaining(1.5)).toBe('1d remaining');
    });

    it('formats hours when under 1 day', () => {
      expect(formatRemaining(0.5)).toBe('~12h remaining');
      expect(formatRemaining(0.1)).toBe('~2h remaining');
    });

    it('formats minutes when under 1 hour', () => {
      expect(formatRemaining(0.01)).toBe('~14m remaining');
      expect(formatRemaining(0.001)).toBe('~1m remaining');
    });
  });

  describe('computeStock', () => {
    it('returns tracked: false for non-inventory tracked meds', () => {
      const med = createMed({ inventoryTracked: false });
      const result = computeStock(med);
      expect(result.tracked).toBe(false);
    });

    it('calculates currentStock from logs', () => {
      const med = createMed({ 
        inventoryTracked: true,
        refillThreshold: 5,
        unitsPerDose: 1,
        unitsPerContainer: 30,
        dosesPerDay: 1,
      });
      med.logs = [
        { type: 'refill', delta: 30, date: '2026-09-01T00:00:00.000Z', voided: false },
        { type: 'dose', delta: -1, date: '2026-09-15T08:00:00.000Z', voided: false },
        { type: 'dose', delta: -1, date: '2026-09-16T08:00:00.000Z', voided: false },
      ];
      const result = computeStock(med);
      expect(result.tracked).toBe(true);
      expect(result.currentStock).toBe(28); // 30 - 1 - 1
    });

    it('places the refill marker inside the track even when stock exceeds the refill quantity', () => {
      // DoxyPEP on device: 22 capsules on hand, 8-capsule refill, threshold 8.
      const med = createMed({
        inventoryTracked: true,
        usagePattern: 'prn',
        unitsPerDose: 2,
        refillThreshold: 8,
        defaultRefillQuantity: 8,
        unitsPerContainer: 8,
      });
      med.logs = [{ type: 'refill', delta: 22, date: '2026-09-01T00:00:00.000Z', voided: false }];
      const result = computeStock(med);
      expect(result.levelPct).toBe(100);
      expect(result.thresholdPct).toBeCloseTo(36.36, 1);
      expect(result.thresholdPct).toBeLessThan(100);
    });

    it('marks the threshold proportionally on a healthy multi-container supply', () => {
      const med = createMed({
        inventoryTracked: true,
        refillThreshold: 7,
        defaultRefillQuantity: 30,
        unitsPerContainer: 30,
      });
      med.logs = [{ type: 'refill', delta: 187, date: '2026-09-01T00:00:00.000Z', voided: false }];
      const result = computeStock(med);
      expect(result.levelPct).toBe(100);
      expect(result.thresholdPct).toBeCloseTo(3.74, 1);
    });

    it('puts the marker at the fill line when stock is exactly at the threshold', () => {
      const med = createMed({
        inventoryTracked: true,
        refillThreshold: 5,
        defaultRefillQuantity: 20,
        unitsPerContainer: 20,
      });
      med.logs = [{ type: 'refill', delta: 5, date: '2026-09-01T00:00:00.000Z', voided: false }];
      const result = computeStock(med);
      expect(result.levelPct).toBe(25);
      expect(result.thresholdPct).toBe(25);
    });
  });

  describe('computeAdherenceTrend', () => {
    const doseOn = (daysAgo) => {
      const d = new Date();
      d.setHours(9, 0, 0, 0);
      d.setDate(d.getDate() - daysAgo);
      return { type: 'dose', date: d.toISOString(), voided: false };
    };

    it('reports a downward trend when this week is worse than last week', () => {
      const med = createMed({ usagePattern: 'daily', dosesPerDay: 1 });
      med.logs = [
        doseOn(0), doseOn(1), doseOn(2),
        ...[7, 8, 9, 10, 11, 12, 13].map(doseOn),
      ];
      const trend = computeAdherenceTrend(med);
      expect(trend.current).toBe(43); // 3/7
      expect(trend.previous).toBe(100); // 7/7
      expect(trend.direction).toBe('down');
      expect(trend.hasData).toBe(true);
    });

    it('reports an upward trend when this week improves on last week', () => {
      const med = createMed({ usagePattern: 'daily', dosesPerDay: 1 });
      med.logs = [
        doseOn(0), doseOn(1), doseOn(2), doseOn(3), doseOn(4), doseOn(5), doseOn(6),
        doseOn(7), doseOn(8),
      ];
      const trend = computeAdherenceTrend(med);
      expect(trend.current).toBe(100);
      expect(trend.previous).toBe(29); // 2/7
      expect(trend.direction).toBe('up');
      expect(trend.hasData).toBe(true);
    });

    it('shows no trend for a medication started this week', () => {
      const med = createMed({ usagePattern: 'daily', dosesPerDay: 1 });
      med.logs = [doseOn(0), doseOn(1), doseOn(2)];
      const trend = computeAdherenceTrend(med);
      expect(trend.direction).toBe('up');
      expect(trend.hasData).toBe(false);
    });

    it('returns null for PRN medications, matching computeAdherence', () => {
      const med = createMed({ usagePattern: 'prn' });
      med.logs = [doseOn(1)];
      expect(computeAdherenceTrend(med)).toBeNull();
    });
  });
});