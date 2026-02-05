// Video game soundtrack quiz generation

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ensureMovieClip, getClipUrl } from './audioCache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Fetch video game cover art from iTunes (no API key needed)
async function fetchVideogameCover(gameName, year) {
  try {
    const query = year ? `${gameName} ${year}` : gameName;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=software&limit=3`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return '';

    const data = await response.json();

    // Find best match (prefer exact title match)
    const results = data.results || [];
    const normalizedGame = gameName.toLowerCase();

    // Try to find exact match first
    let match = results.find(r =>
      r.trackName?.toLowerCase() === normalizedGame ||
      r.collectionName?.toLowerCase() === normalizedGame
    );

    // Fall back to first result
    if (!match && results.length > 0) {
      match = results[0];
    }

    if (match?.artworkUrl100) {
      // Get higher resolution (replace 100x100 with 600x600)
      return match.artworkUrl100.replace('100x100', '600x600');
    }

    return '';
  } catch (error) {
    // Silently fail - cover is optional
    return '';
  }
}

let videogamesCache = null;

export function clearVideogamesCache() {
  videogamesCache = null;
}

export function loadVideogames() {
  if (videogamesCache) return videogamesCache;

  try {
    const data = readFileSync(join(__dirname, 'videogames.json'), 'utf8');
    videogamesCache = JSON.parse(data);
    return videogamesCache;
  } catch (error) {
    console.error('Failed to load videogames.json:', error.message);
    return {};
  }
}

// Shuffle array in place
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Generate a simple ID from game name
function gameId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function normalizeTrack(track) {
  if (typeof track === 'string') {
    return { name: track, key: track };
  }
  if (!track || typeof track !== 'object') {
    return { name: '', key: '' };
  }
  const name = track.name || track.title || '';
  return {
    name,
    key: track.key || name,
    search: track.search
  };
}

export async function getVideogameQuizTracks(count = 10, onProgress = null, excludeGameIds = []) {
  const videogames = loadVideogames();
  const gameNames = Object.keys(videogames);

  if (gameNames.length === 0) {
    throw new Error('No video games configured in videogames.json');
  }

  if (gameNames.length < 2) {
    throw new Error('Need at least 2 video games for a quiz');
  }

  const rounds = [];

  // Filter out previously used games if possible
  const excludeSet = new Set((excludeGameIds || []).map(id => String(id)));
  const freshGames = excludeSet.size > 0
    ? gameNames.filter(name => !excludeSet.has(gameId(name)))
    : gameNames;

  // Use fresh games if enough, otherwise allow repeats
  let gamesToUse = freshGames;
  if (freshGames.length < count) {
    console.log(`[VideogameQuiz] Not enough fresh games (${freshGames.length}/${count}), allowing repeats`);
    gamesToUse = gameNames;
  }

  // Shuffle games and cycle through them
  const shuffledGames = shuffle([...gamesToUse]);
  let gameIndex = 0;

  for (let i = 0; i < count; i++) {
    if (onProgress) {
      onProgress({ current: i + 1, total: count, phase: 'Fetching video game soundtracks' });
    }

    // Cycle through games
    const gameName = shuffledGames[gameIndex % shuffledGames.length];
    gameIndex++;

    const game = videogames[gameName];
    const tracks = Array.isArray(game.tracks) ? game.tracks : [];
    const normalizedTracks = tracks
      .map(normalizeTrack)
      .filter(t => t.name && t.key);
    if (normalizedTracks.length === 0) {
      console.log(`[VideogameQuiz] No tracks configured for: ${gameName}`);
      i--;
      continue;
    }

    const track = normalizedTracks[0];

    if (!track) {
      i--;
      continue;
    }


    const searchQuery = track.search || `${game.composer} ${track.name} ${gameName} soundtrack`;

    console.log(`[VideogameQuiz] Clip: "${track.name}" from "${gameName}" (${game.composer})`);

    try {
      await ensureMovieClip(gameName, track.key, searchQuery);
    } catch (error) {
      console.log(`[VideogameQuiz] Could not cache clip for: ${track.name} (${gameName})`);
      // Skip this round if no preview found
      i--;
      continue;
    }

    // Fetch game cover from iTunes (non-blocking, optional)
    const cover = await fetchVideogameCover(gameName, game.year);

    rounds.push({
      roundNumber: i + 1,
      previewUrl: getClipUrl(gameName, track.key),
      albumArt: cover,
      correctId: gameId(gameName),
      correctGame: gameName,
      correctTrack: track.name,
      correctComposer: game.composer,
      correctYear: game.year
    });
  }

  if (rounds.length === 0) {
    throw new Error('Could not generate any valid rounds. Check yt-dlp/ffmpeg availability.');
  }

  // Re-number rounds in case some were skipped
  rounds.forEach((r, i) => r.roundNumber = i + 1);

  return rounds;
}

// For CLI testing
export function getVideogameList() {
  return Object.keys(loadVideogames());
}
