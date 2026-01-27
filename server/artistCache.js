// Artist track cache - persists top tracks per artist to avoid API spam
// Data stored in server/data/artists.json

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, 'data');
const CACHE_FILE = join(DATA_DIR, 'artists.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Load cache from disk
function loadCache() {
  try {
    if (!existsSync(CACHE_FILE)) return {};
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  } catch (err) {
    console.error('Failed to load artist cache:', err.message);
    return {};
  }
}

// Save cache to disk
function saveCache(cache) {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save artist cache:', err.message);
    return false;
  }
}

// Get cached tracks for an artist
// Returns { tracks, source, lastUpdated } or null if not cached
export function getArtistTracks(artistName) {
  const cache = loadCache();
  const entry = cache[artistName];

  if (!entry) return null;

  return {
    tracks: entry.tracks || [],
    source: entry.source || 'unknown',
    lastUpdated: entry.lastUpdated || null
  };
}

// Save tracks for an artist
// tracks: [{ name, playcount?, spotifyId? }]
// source: 'lastfm' | 'spotify'
export function saveArtistTracks(artistName, tracks, source) {
  const cache = loadCache();

  cache[artistName] = {
    lastUpdated: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    source,
    tracks: tracks.map(t => ({
      name: t.name,
      playcount: t.playcount || null,
      spotifyId: t.spotifyId || null
    }))
  };

  return saveCache(cache);
}

// Check if artist cache entry is stale
// maxAgeDays: number of days before considered stale (default: 90)
export function isStale(artistName, maxAgeDays = 90) {
  const cache = loadCache();
  const entry = cache[artistName];

  if (!entry || !entry.lastUpdated) return true;

  const lastUpdated = new Date(entry.lastUpdated);
  const now = new Date();
  const ageMs = now - lastUpdated;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return ageDays > maxAgeDays;
}

// Get all cached artist names
export function getCachedArtists() {
  const cache = loadCache();
  return Object.keys(cache);
}

// Get cache stats
export function getCacheStats() {
  const cache = loadCache();
  const artists = Object.keys(cache);

  let lastfmCount = 0;
  let spotifyCount = 0;

  for (const artist of artists) {
    if (cache[artist].source === 'lastfm') lastfmCount++;
    else if (cache[artist].source === 'spotify') spotifyCount++;
  }

  return {
    totalArtists: artists.length,
    lastfmCount,
    spotifyCount
  };
}

// Remove an artist from cache
export function removeArtist(artistName) {
  const cache = loadCache();
  if (!cache[artistName]) return false;

  delete cache[artistName];
  return saveCache(cache);
}

// Prune artists not in the provided list
// Returns list of removed artist names
export function pruneArtists(validArtists) {
  const cache = loadCache();
  const validSet = new Set(validArtists);
  const removed = [];

  for (const artist of Object.keys(cache)) {
    if (!validSet.has(artist)) {
      removed.push(artist);
      delete cache[artist];
    }
  }

  if (removed.length > 0) {
    saveCache(cache);
  }

  return removed;
}
