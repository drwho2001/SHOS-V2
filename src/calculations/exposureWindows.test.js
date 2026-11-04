import { describe, it, expect } from 'vitest';
import { unclearedPriorityInfectionsForEncounter, RING_PRIORITY_INFECTIONS } from './exposureWindows';

// The Home "At-Risk Encounters" ring counts two things: exposures the last
// negative test still cannot clear (green), and encounters since that test
// (pink). This is the green half - which of an encounter's infections the
// test is still too early to rule out.
const test = {
  date: '2026-09-23T00:00:00.000Z',
  testingFor: ['HIV', 'Gonorrhoea', 'Chlamydia', 'Syphilis'],
};

const encounter = (date, prep = 'Adequate - daily (≥4/week)', doxy = 'Not indicated') => ({
  date,
  myPrepCoverage: prep,
  myDoxyPepStatus: doxy,
});

describe('unclearedPriorityInfectionsForEncounter', () => {
  it('counts gonorrhoea and chlamydia inside their 14-day window', () => {
    const out = unclearedPriorityInfectionsForEncounter(test, encounter('2026-09-14T00:00:00.000Z'));
    expect(out).toEqual(['Gonorrhoea', 'Chlamydia']);
  });

  it('does not count an exposure exactly 14 days before the test', () => {
    const out = unclearedPriorityInfectionsForEncounter(test, encounter('2026-09-09T00:00:00.000Z'));
    expect(out).toEqual([]);
  });

  it('skips HIV when PrEP coverage is adequate', () => {
    const out = unclearedPriorityInfectionsForEncounter(
      test,
      encounter('2026-09-01T00:00:00.000Z', 'Adequate - Event-based (2-1-1)'),
    );
    expect(out).not.toContain('HIV');
  });

  it('counts HIV inside 45 days when PrEP coverage is not adequate', () => {
    const out = unclearedPriorityInfectionsForEncounter(
      test,
      encounter('2026-09-01T00:00:00.000Z', ''),
    );
    expect(out).toContain('HIV');
  });

  it('does not count HIV or chlamydia after 45 days', () => {
    const out = unclearedPriorityInfectionsForEncounter(
      test,
      encounter('2026-08-01T00:00:00.000Z', ''),
    );
    expect(out).toEqual([]);
  });

  it('skips chlamydia when DoxyPEP was taken, but still counts gonorrhoea', () => {
    const out = unclearedPriorityInfectionsForEncounter(
      test,
      encounter('2026-09-19T00:00:00.000Z', 'Adequate - daily (≥4/week)', 'Indicated - taken'),
    );
    expect(out).toEqual(['Gonorrhoea']);
  });

  it('counts chlamydia when DoxyPEP was indicated but not taken', () => {
    const out = unclearedPriorityInfectionsForEncounter(
      test,
      encounter('2026-09-19T00:00:00.000Z', 'Adequate - daily (≥4/week)', 'Indicated - not yet taken'),
    );
    expect(out).toContain('Chlamydia');
  });

  it('leaves syphilis out even inside its own 84-day window', () => {
    const out = unclearedPriorityInfectionsForEncounter(
      test,
      encounter('2026-07-15T00:00:00.000Z', 'Adequate - daily (≥4/week)'),
    );
    expect(out).toEqual([]);
    expect(RING_PRIORITY_INFECTIONS).not.toContain('Syphilis');
  });

  it('returns nothing for an encounter after the test day', () => {
    expect(unclearedPriorityInfectionsForEncounter(test, encounter('2026-09-24T00:00:00.000Z'))).toEqual([]);
    expect(unclearedPriorityInfectionsForEncounter(test, encounter('2026-10-01T00:00:00.000Z'))).toEqual([]);
  });

  it('treats a same-day encounter as still uncleared, even minutes after midnight', () => {
    // A Test stores a date and no time, so 00:11 on the test day is not
    // evidence that the encounter came after the sample was taken.
    const out = unclearedPriorityInfectionsForEncounter(test, encounter('2026-09-23T00:11:00.000Z'));
    expect(out).toContain('Gonorrhoea');
    expect(out).toContain('Chlamydia');
  });
});
