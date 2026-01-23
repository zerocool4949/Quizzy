import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  startGame,
  getRoom,
  updateRoomSettings,
  getCurrentRound,
  submitAnswer,
  allPlayersAnswered,
  canEndRound
} from '../gameManager.js';

vi.mock('../quiz.js', () => ({
  getQuizTracks: vi.fn()
}));

import { getQuizTracks } from '../quiz.js';

describe('gameManager', () => {
  beforeEach(() => {
    getQuizTracks.mockReset();
  });

  it('hands off host when the host leaves', () => {
    const room = createRoom('host-1', 'Host');
    joinRoom(room.code, 'player-2', 'Player');

    const updated = leaveRoom(room.code, 'host-1');

    expect(updated).not.toBeNull();
    expect(updated.hostId).toBe('player-2');
    expect(updated.players[0].id).toBe('player-2');
    expect(updated.players[0].isHost).toBe(true);
  });

  it('starts a game and resets scores', async () => {
    const room = createRoom('host-1', 'Host');
    joinRoom(room.code, 'player-2', 'Player');

    const existingRoom = getRoom(room.code);
    existingRoom.players[0].score = 42;
    existingRoom.players[1].score = 7;

    getQuizTracks.mockResolvedValue([
      {
        roundNumber: 1,
        previewUrl: 'https://example.test/preview.mp3',
        albumArt: '',
        correctId: 'track-1',
        correctName: 'Song',
        correctArtist: 'Artist',
        options: []
      }
    ]);

    const result = await startGame(room.code);

    expect(result).toHaveProperty('room');
    expect(result.room.state).toBe('playing');
    expect(result.room.rounds).toHaveLength(1);
    expect(result.room.players.every(p => p.score === 0)).toBe(true);
  });

  it('scores typed mode correctly for artist and title', async () => {
    vi.useFakeTimers();
    const startTime = new Date('2025-01-01T00:00:00Z');
    vi.setSystemTime(startTime);

    const room = createRoom('host-1', 'Host');
    joinRoom(room.code, 'player-2', 'Player');
    updateRoomSettings(room.code, { answerMode: 'typed' });

    getQuizTracks.mockResolvedValue([
      {
        roundNumber: 1,
        previewUrl: 'https://example.test/preview.mp3',
        albumArt: '',
        correctId: 'track-1',
        correctName: 'Hotline Bling',
        correctArtist: 'Drake',
        options: []
      }
    ]);

    await startGame(room.code);
    getCurrentRound(room.code);

    // Answer artist in 3s -> 10 + 3 bonus
    vi.setSystemTime(new Date(startTime.getTime() + 3000));
    const artistResult = submitAnswer(room.code, 'player-2', { text: 'Drake' });
    expect(artistResult.points).toBe(13);
    expect(artistResult.artistCorrect).toBe(true);
    expect(artistResult.titleCorrect).toBe(false);

    // Answer title in 6s -> 15 + 2 bonus
    vi.setSystemTime(new Date(startTime.getTime() + 6000));
    const titleResult = submitAnswer(room.code, 'player-2', { text: 'Hotline Bling' });
    expect(titleResult.points).toBe(30);
    expect(titleResult.fullCorrect).toBe(true);

    vi.useRealTimers();
  });

  it('only ends a round once and respects typed completion', async () => {
    vi.useFakeTimers();
    const startTime = new Date('2025-01-01T00:00:00Z');
    vi.setSystemTime(startTime);

    const room = createRoom('host-1', 'Host');
    joinRoom(room.code, 'player-2', 'Player');
    updateRoomSettings(room.code, { answerMode: 'typed' });

    getQuizTracks.mockResolvedValue([
      {
        roundNumber: 1,
        previewUrl: 'https://example.test/preview.mp3',
        albumArt: '',
        correctId: 'track-1',
        correctName: 'Blinding Lights',
        correctArtist: 'The Weeknd',
        options: []
      }
    ]);

    await startGame(room.code);
    getCurrentRound(room.code);

    expect(allPlayersAnswered(room.code)).toBe(false);

    vi.setSystemTime(new Date(startTime.getTime() + 4000));
    submitAnswer(room.code, 'player-2', { text: 'The Weeknd' });
    expect(allPlayersAnswered(room.code)).toBe(false);

    vi.setSystemTime(new Date(startTime.getTime() + 7000));
    submitAnswer(room.code, 'player-2', { text: 'Blinding Lights' });
    expect(allPlayersAnswered(room.code)).toBe(true);

    expect(canEndRound(room.code)).toBe(true);
    expect(canEndRound(room.code)).toBe(false);

    vi.useRealTimers();
  });
});
