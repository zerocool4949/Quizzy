// Simple JSON lines logger for game rounds (debugging/review)

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOGS_DIR = join(__dirname, 'logs');
const LOG_FILE = join(LOGS_DIR, 'games.jsonl');

// Ensure logs directory exists
function ensureLogsDir() {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

// Log a completed game
export function logGame(roomId, categories, rounds, playerCount) {
  try {
    ensureLogsDir();

    const entry = {
      timestamp: new Date().toISOString(),
      roomId,
      playerCount,
      categories,
      rounds: rounds.map(r => {
        if (r.correctMovie) {
          return { movie: r.correctMovie, track: r.correctTrack, composer: r.correctComposer, year: r.correctYear || null };
        }
        if (r.correctGame) {
          return { game: r.correctGame, track: r.correctTrack, composer: r.correctComposer, year: r.correctYear || null };
        }
        return { artist: r.correctArtist, title: r.correctName, year: r.correctYear || null };
      })
    };

    appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (err) {
    console.error('Failed to log game:', err.message);
  }
}
