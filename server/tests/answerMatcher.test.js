import { describe, expect, it } from 'vitest';
import { normalize, looselyMatches } from '../answerMatcher.js';

describe('answerMatcher', () => {
  describe('normalize', () => {
    it('strips leading articles (the, a, an)', () => {
      expect(normalize('The Beatles')).toBe('beatles');
      expect(normalize('A Tribe Called Quest')).toBe('tribe called quest');
      expect(normalize('An Artist')).toBe('artist');
    });

    it('strips French articles (le, la, les, l)', () => {
      expect(normalize('Les Négresses Vertes')).toBe('negresses vertes');
      expect(normalize('La Femme')).toBe('femme');
      expect(normalize('Le Tigre')).toBe('tigre');
    });

    it('preserves articles mid-string', () => {
      expect(normalize('Florence and the Machine')).toBe('florence and the machine');
      expect(normalize('Rage Against the Machine')).toBe('rage against the machine');
    });
  });

  describe('looselyMatches', () => {
    it('matches without leading article', () => {
      expect(looselyMatches('beatles', 'The Beatles')).toBe(true);
      expect(looselyMatches('Beatles', 'The Beatles')).toBe(true);
      expect(looselyMatches('the beatles', 'The Beatles')).toBe(true);
    });

    it('matches French artists without article', () => {
      expect(looselyMatches('femme', 'La Femme')).toBe(true);
      expect(looselyMatches('negresses vertes', 'Les Négresses Vertes')).toBe(true);
    });

    it('matches with typos', () => {
      expect(looselyMatches('betles', 'The Beatles')).toBe(true);
      expect(looselyMatches('beattles', 'The Beatles')).toBe(true);
    });

    it('rejects unrelated answers', () => {
      expect(looselyMatches('rolling stones', 'The Beatles')).toBe(false);
      expect(looselyMatches('bee', 'The Beatles')).toBe(false);
    });
  });
});
