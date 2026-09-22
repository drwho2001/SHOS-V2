import { describe, it, expect } from 'vitest';
import { 
  EXPOSURE_WINDOWS_DAYS, 
  unclearedInfectionsForTest, 
  getEncounterCoverage 
} from './exposureWindows';

describe('exposureWindows', () => {
  describe('EXPOSURE_WINDOWS_DAYS', () => {
    it('has expected infections with windows', () => {
      expect(EXPOSURE_WINDOWS_DAYS).toHaveProperty('Chlamydia');
      expect(EXPOSURE_WINDOWS_DAYS).toHaveProperty('Gonorrhoea');
      expect(EXPOSURE_WINDOWS_DAYS).toHaveProperty('HIV');
      expect(EXPOSURE_WINDOWS_DAYS).toHaveProperty('Syphilis');
      expect(EXPOSURE_WINDOWS_DAYS).toHaveProperty('Hepatitis B');
      expect(EXPOSURE_WINDOWS_DAYS).toHaveProperty('Hepatitis C');
      expect(EXPOSURE_WINDOWS_DAYS).toHaveProperty('Hepatitis A');
      expect(EXPOSURE_WINDOWS_DAYS).toHaveProperty('MGen');
    });

    it('all entries have days and confidence', () => {
      Object.values(EXPOSURE_WINDOWS_DAYS).forEach(entry => {
        expect(entry).toHaveProperty('days');
        expect(entry).toHaveProperty('confidence');
        expect(typeof entry.days).toBe('number');
        expect(entry.days).toBeGreaterThan(0);
        expect(typeof entry.confidence).toBe('string');
      });
    });

    it('has correct window days for common infections', () => {
      expect(EXPOSURE_WINDOWS_DAYS.Chlamydia.days).toBe(14);
      expect(EXPOSURE_WINDOWS_DAYS.Gonorrhoea.days).toBe(14);
      expect(EXPOSURE_WINDOWS_DAYS.HIV.days).toBe(45);
      expect(EXPOSURE_WINDOWS_DAYS.Syphilis.days).toBe(84);
      expect(EXPOSURE_WINDOWS_DAYS['Hepatitis B'].days).toBe(84);
    });
  });

  describe('unclearedInfectionsForTest', () => {
    it('returns empty array for missing encounter date', () => {
      const test = { date: '2026-09-15T08:00:00.000Z', testingFor: ['Chlamydia'] };
      expect(unclearedInfectionsForTest(test, null)).toEqual([]);
    });

    it('returns empty array for missing test date', () => {
      const test = { testingFor: ['Chlamydia'] };
      expect(unclearedInfectionsForTest(test, '2026-09-01T08:00:00.000Z')).toEqual([]);
    });

    it('returns infection when within window', () => {
      const test = { 
        date: '2026-09-10T08:00:00.000Z', 
        testingFor: ['Chlamydia'] 
      };
      const encounterDate = '2026-09-01T08:00:00.000Z';
      // 9 days between, window is 14 days
      const result = unclearedInfectionsForTest(test, encounterDate);
      expect(result).toContain('Chlamydia');
    });

    it('returns empty when outside window', () => {
      const test = { 
        date: '2026-10-01T08:00:00.000Z', 
        testingFor: ['Chlamydia'] 
      };
      const encounterDate = '2026-09-01T08:00:00.000Z';
      // 30 days between, window is 14 days
      const result = unclearedInfectionsForTest(test, encounterDate);
      expect(result).not.toContain('Chlamydia');
    });

    it('filters infections not in EXPOSURE_WINDOWS_DAYS', () => {
      const test = { 
        date: '2026-09-10T08:00:00.000Z', 
        testingFor: ['Chlamydia', 'Mpox', 'Other'] 
      };
      const encounterDate = '2026-09-01T08:00:00.000Z';
      const result = unclearedInfectionsForTest(test, encounterDate);
      expect(result).toContain('Chlamydia');
      expect(result).not.toContain('Mpox');
      expect(result).not.toContain('Other');
    });

    it('handles multiple infections', () => {
      const test = { 
        date: '2026-09-10T08:00:00.000Z', 
        testingFor: ['Chlamydia', 'HIV', 'Syphilis'] 
      };
      const encounterDate = '2026-09-01T08:00:00.000Z';
      // 9 days - Chlamydia(14) and HIV(45) within window, Syphilis(84) within
      const result = unclearedInfectionsForTest(test, encounterDate);
      expect(result).toContain('Chlamydia');
      expect(result).toContain('HIV');
      expect(result).toContain('Syphilis');
    });
  });

  describe('getEncounterCoverage', () => {
    it('returns no_test for missing encounter date', () => {
      const result = getEncounterCoverage(null, []);
      expect(result.status).toBe('no_test');
    });

    it('returns no_test for no relevant tests', () => {
      const tests = [{ date: '2026-08-01T08:00:00.000Z', testingFor: ['Chlamydia'] }];
      const result = getEncounterCoverage('2026-09-01T08:00:00.000Z', tests);
      expect(result.status).toBe('no_test');
    });

    it('returns covered when test clears all infections', () => {
      const tests = [{ 
        id: 't1', 
        date: '2026-10-01T08:00:00.000Z', 
        testingFor: ['Chlamydia'] 
      }];
      const result = getEncounterCoverage('2026-09-01T08:00:00.000Z', tests);
      // 30 days > 14 day window
      expect(result.status).toBe('covered');
    });

    it('returns uncovered when test still within window', () => {
      const tests = [{ 
        id: 't1', 
        date: '2026-09-10T08:00:00.000Z', 
        testingFor: ['Chlamydia'] 
      }];
      const result = getEncounterCoverage('2026-09-01T08:00:00.000Z', tests);
      // 9 days < 14 day window
      expect(result.status).toBe('uncovered');
    });

    it('picks test with fewest uncovered infections', () => {
      const tests = [
        { id: 't1', date: '2026-09-10T08:00:00.000Z', testingFor: ['Chlamydia'] }, // 9 days - uncovered
        { id: 't2', date: '2026-10-01T08:00:00.000Z', testingFor: ['Chlamydia'] }, // 30 days - covered
      ];
      const result = getEncounterCoverage('2026-09-01T08:00:00.000Z', tests);
      expect(result.status).toBe('covered');
      expect(result.test.id).toBe('t2');
    });

    it('handles multiple infections in test', () => {
      const tests = [{ 
        id: 't1', 
        date: '2026-10-01T08:00:00.000Z', 
        testingFor: ['Chlamydia', 'HIV'] 
      }];
      const result = getEncounterCoverage('2026-09-01T08:00:00.000Z', tests);
      // Chlamydia 30 days > 14, HIV 30 days < 45 -> HIV still uncovered
      expect(result.status).toBe('uncovered');
      expect(result.uncoveredInfections).toContain('HIV');
    });

    it('returns no_test for empty tests array', () => {
      const result = getEncounterCoverage('2026-09-01T08:00:00.000Z', []);
      expect(result.status).toBe('no_test');
    });
  });
});