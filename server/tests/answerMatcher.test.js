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

    it('removes accents', () => {
      expect(normalize('Beyoncé')).toBe('beyonce');
      expect(normalize('Stromae')).toBe('stromae');
      expect(normalize('Sigur Rós')).toBe('sigur ros');
    });

    it('handles punctuation', () => {
      expect(normalize("Guns N' Roses")).toBe('guns n roses');
      expect(normalize('AC/DC')).toBe('ac dc');
      expect(normalize('P!nk')).toBe('p nk');
    });

    it('handles empty and null input', () => {
      expect(normalize('')).toBe('');
      expect(normalize(null)).toBe('');
      expect(normalize(undefined)).toBe('');
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

    it('matches without spaces', () => {
      expect(looselyMatches('bonjovi', 'Bon Jovi')).toBe(true);
      expect(looselyMatches('gunsnroses', 'Guns N Roses')).toBe(true);
    });

    it('matches accented vs non-accented', () => {
      expect(looselyMatches('beyonce', 'Beyoncé')).toBe(true);
      expect(looselyMatches('stromae', 'Stromae')).toBe(true);
    });

    it('matches case-insensitive', () => {
      expect(looselyMatches('DRAKE', 'Drake')).toBe(true);
      expect(looselyMatches('drake', 'DRAKE')).toBe(true);
    });

    it('rejects too short input', () => {
      expect(looselyMatches('ab', 'Abba')).toBe(false);
      expect(looselyMatches('a', 'Drake')).toBe(false);
    });

    it('matches multi-word targets with partial words', () => {
      expect(looselyMatches('avril lavigne', 'Avril Lavigne')).toBe(true);
      expect(looselyMatches('avril lavine', 'Avril Lavigne')).toBe(true); // typo
    });

    it('handles movie titles', () => {
      expect(looselyMatches('lion king', 'The Lion King')).toBe(true);
      expect(looselyMatches('the lion king', 'The Lion King')).toBe(true);
      expect(looselyMatches('inception', 'Inception')).toBe(true);
      expect(looselyMatches('forrest gump', 'Forrest Gump')).toBe(true);
    });

    it('rejects partial matches that are too different', () => {
      expect(looselyMatches('queen', 'Queen of the Stone Age')).toBe(false);
      expect(looselyMatches('green', 'Green Day')).toBe(false); // only 1 word of 2
    });

    it('matches song titles with special characters', () => {
      expect(looselyMatches('dont stop believing', "Don't Stop Believin'")).toBe(true);
      expect(looselyMatches('cant help falling in love', "Can't Help Falling in Love")).toBe(true);
    });

    it('handles numbers in titles', () => {
      expect(looselyMatches('99 problems', '99 Problems')).toBe(true);
      expect(looselyMatches('1999', '1999')).toBe(true);
    });
  });
});
