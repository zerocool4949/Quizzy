// Cache Warmer - Background refresh for missing/stale artists on startup
// Reads artists from categories.json and imported-playlists.json
// Non-blocking: queues refresh in background, doesn't delay server startup

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import * as artistCache from './artistCache.js';
import * as lastfm from './lastfm.js';
import * as spotify from './spotify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CATEGORIES_PATH = join(__dirname, 'categories.json');
const IMPORTED_PATH = join(__dirname, 'imported-playlists.json');
const CACHE_STALENESS_DAYS = 90;

// Load all artists from categories and imported playlists
function getAllArtists() {
  const artists = new Set();

  // Load from categories.json
  try {
    if (existsSync(CATEGORIES_PATH)) {
      const categories = JSON.parse(readFileSync(CATEGORIES_PATH, 'utf-8'));
      for (const category of Object.values(categories)) {
        for (const artist of category.artists || []) {
          artists.add(artist);
        }
      }
    }
  } catch (err) {
    console.error('[Cache Warmer] Failed to load categories.json:', err.message);
  }

  // Load from imported-playlists.json
  try {
    if (existsSync(IMPORTED_PATH)) {
      const playlists = JSON.parse(readFileSync(IMPORTED_PATH, 'utf-8'));
      for (const playlist of Object.values(playlists)) {
        for (const artist of playlist.artists || []) {
          artists.add(artist);
        }
      }
    }
  } catch (err) {
    console.error('[Cache Warmer] Failed to load imported-playlists.json:', err.message);
  }

  return Array.from(artists);
}

// Get cache status
export function getCacheStatus() {
  const allArtists = getAllArtists();
  const cachedArtists = artistCache.getCachedArtists();
  const cachedSet = new Set(cachedArtists);

  const missing = allArtists.filter(a => !cachedSet.has(a));
  const stale = allArtists.filter(a =>
    cachedSet.has(a) && artistCache.isStale(a, CACHE_STALENESS_DAYS)
  );
  const fresh = allArtists.filter(a =>
    cachedSet.has(a) && !artistCache.isStale(a, CACHE_STALENESS_DAYS)
  );

  return {
    total: allArtists.length,
    cached: cachedArtists.length,
    fresh: fresh.length,
    missing: missing.length,
    stale: stale.length,
    missingArtists: missing,
    staleArtists: stale
  };
}

// Fetch and cache tracks for a single artist
async function fetchArtistTracks(artistName, limit = 10) {
  // Try Last.fm first
  if (lastfm.isConfigured()) {
    const tracks = await lastfm.getArtistTopTracks(artistName, limit);
    if (tracks.length > 0) {
      const formatted = tracks.map(t => ({
        name: t.name,
        playcount: t.playcount || null,
        spotifyId: null
      }));
      artistCache.saveArtistTracks(artistName, formatted, 'lastfm');
      return { source: 'lastfm', count: formatted.length };
    }
  }

  // Fallback to Spotify
  const spotifyId = await spotify.searchArtistId(artistName);
  if (spotifyId) {
    const spotifyTracks = await spotify.getArtistTopTracks(spotifyId, limit);
    if (spotifyTracks.length > 0) {
      const formatted = spotifyTracks.map(t => ({
        name: spotify.cleanTitle(t.name),
        playcount: null,
        spotifyId: t.id?.replace('spotify-', '') || null
      }));
      artistCache.saveArtistTracks(artistName, formatted, 'spotify');
      return { source: 'spotify', count: formatted.length };
    }
  }

  return null;
}

// Refresh a list of artists (with rate limiting)
export async function refreshArtists(artistNames, options = {}) {
  const { onProgress, limit = 10 } = options;
  const results = { success: 0, failed: 0, artists: [] };

  for (let i = 0; i < artistNames.length; i++) {
    const artist = artistNames[i];

    try {
      const result = await fetchArtistTracks(artist, limit);

      if (result) {
        results.success++;
        results.artists.push({ name: artist, ...result });
      } else {
        results.failed++;
        results.artists.push({ name: artist, error: 'No tracks found' });
      }
    } catch (err) {
      results.failed++;
      results.artists.push({ name: artist, error: err.message });
    }

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: artistNames.length,
        artist,
        success: results.success,
        failed: results.failed
      });
    }

    // Rate limiting: 200ms between requests
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

// Warm cache on startup (non-blocking)
export async function warmCache() {
  console.log('[Cache Warmer] Starting cache check...');

  // Get all valid artists and prune deleted ones
  const allArtists = getAllArtists();
  const pruned = artistCache.pruneArtists(allArtists);

  if (pruned.length > 0) {
    console.log(`[Cache Warmer] Pruned ${pruned.length} deleted artists`);
  }

  // Check status
  const status = getCacheStatus();
  console.log(`[Cache Warmer] Status: ${status.fresh}/${status.total} fresh, ${status.missing} missing, ${status.stale} stale`);

  if (status.missing === 0 && status.stale === 0) {
    console.log('[Cache Warmer] All artists are fresh');
    return;
  }

  // Queue background refresh (non-blocking)
  const toRefresh = [...status.missingArtists, ...status.staleArtists];
  console.log(`[Cache Warmer] Queueing ${toRefresh.length} artists for background refresh`);

  // Run in background using setTimeout (non-blocking)
  setTimeout(async () => {
    console.log('[Cache Warmer] Starting background refresh...');

    const results = await refreshArtists(toRefresh, {
      onProgress: (p) => {
        if (p.current % 10 === 0 || p.current === p.total) {
          console.log(`[Cache Warmer] Progress: ${p.current}/${p.total} (${p.success} success, ${p.failed} failed)`);
        }
      }
    });

    console.log(`[Cache Warmer] Background refresh complete: ${results.success} success, ${results.failed} failed`);
  }, 1000); // Small delay to let server finish starting
}
