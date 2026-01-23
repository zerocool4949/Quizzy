import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  startGame,
  getRoom
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
});
