import { describe, it, expect } from 'vitest';
import { fuzzyIncludes, findClosestMatch, findContactDuplicateCandidates } from './fuzzyMatch';

describe('fuzzyMatch', () => {
  describe('fuzzyIncludes', () => {
    it('returns true for exact match', () => {
      expect(fuzzyIncludes('hello world', 'hello')).toBe(true);
    });

    it('returns true for case-insensitive match', () => {
      expect(fuzzyIncludes('Hello World', 'hello')).toBe(true);
    });

    it('returns false for short query (3 chars or fewer) without exact match', () => {
      // 'piss' contains 'i' which is 1 char - should NOT match 'i felt off today'
      expect(fuzzyIncludes('i felt off today', 'piss')).toBe(false);
    });

    it('returns true for short query with exact word match', () => {
      expect(fuzzyIncludes('hello world', 'world')).toBe(true);
    });

    it('handles fuzzy matching for longer queries', () => {
      expect(fuzzyIncludes('fisting', 'fisting')).toBe(true);
      expect(fuzzyIncludes('fisting', 'fistingg')).toBe(true); // typo tolerance
    });

    it('returns false for completely different strings', () => {
      expect(fuzzyIncludes('completely different', 'nothing alike')).toBe(false);
    });
  });

  describe('findClosestMatch', () => {
    it('finds exact match returns null (caller should handle exact)', () => {
      const options = ['apple', 'banana', 'cherry'];
      // Exact match returns null per function design
      expect(findClosestMatch(options, 'banana')).toBeNull();
    });

    it('finds close match with typo', () => {
      const options = ['apple', 'banana', 'cherry'];
      expect(findClosestMatch(options, 'banan')).toBe('banana');
    });

    it('returns null for no close match', () => {
      const options = ['apple', 'banana', 'cherry'];
      expect(findClosestMatch(options, 'xyz')).toBeNull();
    });

    it('returns null for too short typed text', () => {
      const options = ['apple', 'banana'];
      expect(findClosestMatch(options, 'a')).toBeNull(); // too short
    });
  });

  describe('findContactDuplicateCandidates', () => {
    it('detects exact phone match', () => {
      const contacts = [
        { id: 'c1', name: 'John', phone: '555-1234' },
        { id: 'c2', name: 'Jane', phone: '555-1234' },
      ];
      const candidates = findContactDuplicateCandidates(contacts);
      expect(candidates.length).toBe(1);
      expect(candidates[0]).toHaveProperty('a');
      expect(candidates[0]).toHaveProperty('b');
      expect(candidates[0]).toHaveProperty('matched');
      expect(candidates[0].matched).toContain('phone');
    });

    it('detects exact Snapchat match', () => {
      const contacts = [
        { id: 'c1', name: 'John', snapchat: 'john123' },
        { id: 'c2', name: 'Jane', snapchat: 'john123' },
      ];
      const candidates = findContactDuplicateCandidates(contacts);
      expect(candidates.length).toBe(1);
      expect(candidates[0].matched).toContain('Snapchat'); // capitalized as in source
    });

    it('flags different people with same name but different phone (name matches)', () => {
      const contacts = [
        { id: 'c1', name: 'John Smith', phone: '555-1111' },
        { id: 'c2', name: 'John Smith', phone: '555-2222' },
      ];
      const candidates = findContactDuplicateCandidates(contacts);
      // Same name triggers nameMatch, so it IS flagged as potential duplicate
      // (different phone doesn't prevent flagging when names match)
      expect(candidates.length).toBe(1);
      expect(candidates[0].matched).toContain('name');
    });
  });
});