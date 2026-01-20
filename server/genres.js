// Genre and artist list management from genres.json

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded genres
let genreArtistsCache = null;
let genreListCache = null;

// Load genres from JSON file
function loadGenresData() {
  try {
    const genresPath = join(__dirname, 'genres.json');
    return JSON.parse(readFileSync(genresPath, 'utf-8'));
  } catch (err) {
    console.error('Failed to load genres.json:', err.message);
    return {};
  }
}

// Get mapping of genreId -> artists array
export function getGenreArtists() {
  if (!genreArtistsCache) {
    const data = loadGenresData();
    genreArtistsCache = {};
    for (const [id, genre] of Object.entries(data)) {
      genreArtistsCache[id] = genre.artists;
    }
  }
  return genreArtistsCache;
}

// Get list of genres for client display
export function getGenreList() {
  if (!genreListCache) {
    const data = loadGenresData();
    genreListCache = Object.entries(data).map(([id, genre]) => ({
      id,
      name: genre.name
    }));
  }
  return genreListCache;
}

// Get artists for a specific genre
export function getArtistsForGenre(genreId) {
  const genres = getGenreArtists();
  return genres[genreId] || [];
}
