// Movie soundtrack quiz generation

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ensureMovieClip, getClipUrl } from './audioCache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let moviesCache = null;

export function loadMovies() {
  if (moviesCache) return moviesCache;

  try {
    const data = readFileSync(join(__dirname, 'movies.json'), 'utf8');
    moviesCache = JSON.parse(data);
    return moviesCache;
  } catch (error) {
    console.error('Failed to load movies.json:', error.message);
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

// Generate a simple ID from movie name
function movieId(name) {
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

export async function getMovieQuizTracks(count = 10, onProgress = null, excludeMovieIds = []) {
  const movies = loadMovies();
  const movieNames = Object.keys(movies);

  if (movieNames.length === 0) {
    throw new Error('No movies configured in movies.json');
  }

  if (movieNames.length < 2) {
    throw new Error('Need at least 2 movies for a quiz');
  }

  const rounds = [];

  // Filter out previously used movies if possible
  const excludeSet = new Set((excludeMovieIds || []).map(id => String(id)));
  const freshMovies = excludeSet.size > 0
    ? movieNames.filter(name => !excludeSet.has(movieId(name)))
    : movieNames;

  // Use fresh movies if enough, otherwise allow repeats
  let moviesToUse = freshMovies;
  if (freshMovies.length < count) {
    console.log(`[MovieQuiz] Not enough fresh movies (${freshMovies.length}/${count}), allowing repeats`);
    moviesToUse = movieNames;
  }

  // Shuffle movies and cycle through them
  const shuffledMovies = shuffle([...moviesToUse]);
  let movieIndex = 0;

  for (let i = 0; i < count; i++) {
    if (onProgress) {
      onProgress({ current: i + 1, total: count, phase: 'Fetching movie soundtracks' });
    }

    // Cycle through movies
    const movieName = shuffledMovies[movieIndex % shuffledMovies.length];
    movieIndex++;

    const movie = movies[movieName];
    const tracks = Array.isArray(movie.tracks) ? movie.tracks : [];
    const normalizedTracks = tracks
      .map(normalizeTrack)
      .filter(t => t.name && t.key);
    if (normalizedTracks.length === 0) {
      console.log(`[MovieQuiz] No tracks configured for: ${movieName}`);
      i--;
      continue;
    }

    const track = normalizedTracks[0];

    if (!track) {
      i--;
      continue;
    }


    const searchQuery = track.search || `${movie.composer} ${track.name} ${movieName} soundtrack`;

    console.log(`[MovieQuiz] Clip: "${track.name}" from "${movieName}" (${movie.composer})`);

    try {
      await ensureMovieClip(movieName, track.key, searchQuery);
    } catch (error) {
      console.log(`[MovieQuiz] Could not cache clip for: ${track.name} (${movieName})`);
      // Skip this round if no preview found
      i--;
      continue;
    }

    rounds.push({
      roundNumber: i + 1,
      previewUrl: getClipUrl(movieName, track.key),
      albumArt: '',
      correctId: movieId(movieName),
      correctMovie: movieName,
      correctTrack: track.name,
      correctComposer: movie.composer,
      correctYear: movie.year
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
export function getMovieList() {
  return Object.keys(loadMovies());
}
