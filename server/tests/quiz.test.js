import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockProvider = {
  name: 'Mock',
  searchArtistId: vi.fn(),
  getArtistTopTracks: vi.fn(),
  searchTracks: vi.fn()
};

vi.mock('../music.js', () => ({
  getProvider: () => mockProvider
}));

vi.mock('../categories.js', () => ({
  getArtistsForCategory: () => ['Artist1', 'Artist2', 'Artist3', 'Artist4']
}));

let getQuizTracks;

beforeAll(async () => {
  ({ getQuizTracks } = await import('../quiz.js'));
});

beforeEach(() => {
  mockProvider.searchArtistId.mockReset();
  mockProvider.getArtistTopTracks.mockReset();
  mockProvider.searchTracks.mockReset();

  mockProvider.searchArtistId.mockImplementation(name => name);
  mockProvider.searchTracks.mockResolvedValue([]);
});

describe('quiz', () => {
  it('excludes previously used tracks when enough candidates exist', async () => {
    const trackPool = {
      Artist1: [
        { id: 't1', name: 'Song1', artist: 'Artist1', previewUrl: 'u1', albumArt: '' }
      ],
      Artist2: [
        { id: 't2', name: 'Song2', artist: 'Artist2', previewUrl: 'u2', albumArt: '' }
      ],
      Artist3: [
        { id: 't3', name: 'Song3', artist: 'Artist3', previewUrl: 'u3', albumArt: '' }
      ],
      Artist4: [
        { id: 't4', name: 'Song4', artist: 'Artist4', previewUrl: 'u4', albumArt: '' }
      ]
    };

    mockProvider.getArtistTopTracks.mockImplementation((artistId) => trackPool[artistId] || []);

    const rounds = await getQuizTracks(['top-hits'], 2, 1, 'spotify', null, ['t2']);
    const ids = rounds.map(r => r.correctId);

    expect(rounds).toHaveLength(2);
    expect(ids.includes('t2')).toBe(false);
  });

  it('falls back to allow repeats when exclusions are too strict', async () => {
    const trackPool = {
      Artist1: [
        { id: 't1', name: 'Song1', artist: 'Artist1', previewUrl: 'u1', albumArt: '' }
      ],
      Artist2: [
        { id: 't2', name: 'Song2', artist: 'Artist2', previewUrl: 'u2', albumArt: '' }
      ],
      Artist3: [
        { id: 't3', name: 'Song3', artist: 'Artist3', previewUrl: 'u3', albumArt: '' }
      ],
      Artist4: [
        { id: 't4', name: 'Song4', artist: 'Artist4', previewUrl: 'u4', albumArt: '' }
      ]
    };

    mockProvider.getArtistTopTracks.mockImplementation((artistId) => trackPool[artistId] || []);

    const rounds = await getQuizTracks(['top-hits'], 4, 1, 'spotify', null, ['t1', 't2', 't3']);
    const ids = rounds.map(r => r.correctId);

    expect(rounds).toHaveLength(4);
    expect(ids.includes('t1')).toBe(true);
  });
});
