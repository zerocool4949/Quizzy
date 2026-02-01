// Movie soundtrack quiz generation

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as deezer from './deezer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let moviesCache = null;

function loadMovies() {
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

// Search Deezer for a soundtrack track
async function findTrackPreview(composer, trackName, movieName) {
  // Try composer + track name first (most accurate)
  let query = `${composer} ${trackName}`;
  let results = await deezer.searchTracks(query, 10);

  // Filter for results that look like soundtrack/instrumental
  let match = results.find(t =>
    t.artist.toLowerCase().includes(composer.toLowerCase()) ||
    t.name.toLowerCase().includes(trackName.toLowerCase())
  );

  if (match) return match;

  // Try with movie name in query
  query = `${trackName} ${movieName} soundtrack`;
  results = await deezer.searchTracks(query, 10);
  match = results[0];

  if (match) return match;

  // Last resort: just track name
  results = await deezer.searchTracks(trackName, 5);
  return results[0] || null;
}

export async function getMovieQuizTracks(count = 10, onProgress = null) {
  const movies = loadMovies();
  const movieNames = Object.keys(movies);

  if (movieNames.length === 0) {
    throw new Error('No movies configured in movies.json');
  }

  if (movieNames.length < 2) {
    throw new Error('Need at least 2 movies for a quiz');
  }

  const rounds = [];
  const usedTracks = new Set();

  // Shuffle movies and cycle through them
  const shuffledMovies = shuffle([...movieNames]);
  let movieIndex = 0;

  for (let i = 0; i < count; i++) {
    if (onProgress) {
      onProgress({ current: i + 1, total: count, phase: 'Fetching movie soundtracks' });
    }

    // Cycle through movies
    const movieName = shuffledMovies[movieIndex % shuffledMovies.length];
    movieIndex++;

    const movie = movies[movieName];
    const availableTracks = movie.tracks.filter(t => !usedTracks.has(`${movieName}:${t}`));

    // If no unused tracks, pick any track
    const trackName = availableTracks.length > 0
      ? availableTracks[Math.floor(Math.random() * availableTracks.length)]
      : movie.tracks[Math.floor(Math.random() * movie.tracks.length)];

    usedTracks.add(`${movieName}:${trackName}`);

    // Find the track on Deezer
    const track = await findTrackPreview(movie.composer, trackName, movieName);

    console.log(`[MovieQuiz] Searching: "${trackName}" from "${movieName}" (${movie.composer})`);
    if (track) {
      console.log(`[MovieQuiz] Found: "${track.name}" by "${track.artist}"`);
    }

    if (!track || !track.previewUrl) {
      console.log(`[MovieQuiz] Could not find preview for: ${trackName} (${movieName})`);
      // Skip this round if no preview found
      i--;
      continue;
    }

    // Build decoy options (other movies)
    const decoyMovies = movieNames.filter(m => m !== movieName);
    shuffle(decoyMovies);
    const decoys = decoyMovies.slice(0, 3).map(m => ({
      id: movieId(m),
      name: m
    }));

    // Build options array with correct answer in random position
    const options = [
      { id: movieId(movieName), name: movieName },
      ...decoys
    ];
    shuffle(options);

    rounds.push({
      roundNumber: i + 1,
      previewUrl: track.previewUrl,
      albumArt: track.albumArt || '',
      correctId: movieId(movieName),
      correctMovie: movieName,
      correctTrack: trackName,
      correctComposer: movie.composer,
      correctYear: movie.year,
      options
    });
  }

  if (rounds.length === 0) {
    throw new Error('Could not generate any valid rounds. Check Deezer availability.');
  }

  // Re-number rounds in case some were skipped
  rounds.forEach((r, i) => r.roundNumber = i + 1);

  return rounds;
}

// For CLI testing
export function getMovieList() {
  return Object.keys(loadMovies());
}
