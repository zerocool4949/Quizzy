// Using Deezer API - free, no auth required, reliable 30-second previews

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load genres from JSON file (edit genres.json to add/change playlists)
function loadGenres() {
  try {
    const genresPath = join(__dirname, 'genres.json');
    const data = JSON.parse(readFileSync(genresPath, 'utf-8'));
    // Convert { "id": { name, artists } } to { "id": artists }
    const result = {};
    for (const [id, genre] of Object.entries(data)) {
      result[id] = genre.artists;
    }
    return result;
  } catch (err) {
    console.error('Failed to load genres.json:', err.message);
    return {};
  }
}

const GENRE_ARTISTS = loadGenres();

// Export genre list for client
export function getGenreList() {
  try {
    const genresPath = join(__dirname, 'genres.json');
    const data = JSON.parse(readFileSync(genresPath, 'utf-8'));
    return Object.entries(data).map(([id, genre]) => ({
      id,
      name: genre.name
    }));
  } catch {
    return [];
  }
}

// --------------------
// Utilities
// --------------------

function dedupeStrings(arr) {
  const seen = new Set();
  return arr.filter(s => {
    const key = String(s).trim().toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapTrack(t) {
  return {
    id: String(t.id),
    name: t.title,
    artist: t.artist?.name ?? "",
    previewUrl: t.preview,
    albumArt: t.album?.cover_medium ?? ""
  };
}

// Simple concurrency limiter (prevents rate-limit spikes)
async function runWithLimit(tasks, limit = 5) {
  const results = [];
  let i = 0;

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  });

  await Promise.all(workers);
  return results;
}

// --------------------
// Deezer API
// --------------------

export async function searchTracks(query, limit = 50) {
  // Keep this for your fallback logic (direct genre search)
  try {
    const response = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      console.log(`Deezer API error for "${query}": ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.data || [])
      .filter(track => track.preview)
      .map(mapTrack);
  } catch (error) {
    console.log(`Search error for "${query}":`, error?.message ?? error);
    return [];
  }
}

async function searchArtistId(artistName) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=1`
    );
    if (!res.ok) return null;

    const data = await res.json();
    return data?.data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function getArtistTopTracks(artistId, limit = 25) {
  try {
    const res = await fetch(`https://api.deezer.com/artist/${artistId}/top?limit=${limit}`);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.data || [])
      .filter(t => t.preview)
      .map(mapTrack);
  } catch {
    return [];
  }
}

// --------------------
// Track sourcing
// --------------------

async function getGenreTracks(genreId) {
  let artists = GENRE_ARTISTS[genreId];
  if (!artists) {
    console.warn(`Unknown genreId: "${genreId}"`);
    return [];
  }

  artists = dedupeStrings(artists);

  console.log(`Fetching tracks for ${artists.length} artists in genre: ${genreId}`);

  // Use more artists for a larger pool; still safe with concurrency limit
  const sampleArtists = artists.slice(0, 35);

  const tasks = sampleArtists.map(name => async () => {
    const id = await searchArtistId(name);
    if (!id) return [];
    return getArtistTopTracks(id, 25);
  });

  const results = await runWithLimit(tasks, 5);

  // Combine and dedupe by track id
  const trackMap = new Map();
  results.flat().forEach(track => {
    if (track?.id && !trackMap.has(track.id)) {
      trackMap.set(track.id, track);
    }
  });

  const tracks = Array.from(trackMap.values());
  console.log(`Found ${tracks.length} unique preview tracks from artist top tracks`);

  return tracks;
}

// --------------------
// Quiz generation
// --------------------

export async function getQuizTracks(genreId, count = 10) {
  console.log(`Getting tracks for genre: "${genreId}"`);

  // Get tracks from curated artist list (reliable)
  let tracks = await getGenreTracks(genreId);

  // Fallback to search if not enough tracks
  if (tracks.length < count * 2) {
    console.log("Not enough tracks, trying direct genre search");
    const searchTerm = genreId.replace(/-/g, " ");
    const extraTracks = await searchTracks(`${searchTerm} hits`, 50);

    const existing = new Set(tracks.map(t => t.id));
    extraTracks.forEach(track => {
      if (track?.id && !existing.has(track.id)) {
        existing.add(track.id);
        tracks.push(track);
      }
    });
  }

  // Last resort: top hits
  if (tracks.length < 4) {
    console.log("Still not enough, fetching top hits");
    tracks = await getGenreTracks("top-hits");
  }

  if (tracks.length < 4) {
    throw new Error("Could not find enough tracks with previews");
  }

  console.log(`Total tracks available: ${tracks.length}`);

  // Shuffle tracks
  const shuffled = [...tracks].sort(() => Math.random() - 0.5);

  // Pick tracks for rounds, limiting each artist to max 2 appearances
  const maxPerArtist = 2;
  const artistCount = new Map();
  const roundTracks = [];

  for (const track of shuffled) {
    if (roundTracks.length >= count) break;

    const artistLower = track.artist.toLowerCase();
    const currentCount = artistCount.get(artistLower) || 0;

    if (currentCount < maxPerArtist) {
      roundTracks.push(track);
      artistCount.set(artistLower, currentCount + 1);
    }
  }

  console.log(`Selected ${roundTracks.length} tracks with artist diversity`);

  // For each round, create question with decoys from DIFFERENT artists
  return roundTracks.map((correctTrack, index) => {
    // Filter out tracks from the same artist (case-insensitive comparison)
    const correctArtistLower = correctTrack.artist.toLowerCase();
    const otherArtistTracks = shuffled.filter(t =>
      t.id !== correctTrack.id && t.artist.toLowerCase() !== correctArtistLower
    );

    // Pick 3 decoys from different artists
    const decoys = otherArtistTracks
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const options = [
      { id: correctTrack.id, name: correctTrack.name, artist: correctTrack.artist },
      ...decoys.map(t => ({ id: t.id, name: t.name, artist: t.artist }))
    ].sort(() => Math.random() - 0.5);

    return {
      roundNumber: index + 1,
      previewUrl: correctTrack.previewUrl,
      albumArt: correctTrack.albumArt,
      correctId: correctTrack.id,
      correctName: correctTrack.name,
      correctArtist: correctTrack.artist,
      options
    };
  });
}
