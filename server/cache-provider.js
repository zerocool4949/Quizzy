// Cache-First Music Provider
// Uses local artist cache (Last.fm data) as primary source
// Falls back to Spotify when cache miss or stale
// Uses Deezer for audio previews

import * as artistCache from './artistCache.js';
import * as lastfm from './lastfm.js';
import * as spotify from './spotify.js';
import { cleanTitle } from './titleUtils.js';
import * as deezer from './deezer.js';

const CACHE_STALENESS_DAYS = 90;

// Normalize text for matching
function normalizeForSearch(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\(ft\..*?\)/gi, '')
    .replace(/\(with .*?\)/gi, '')
    .replace(/\(.*?remix.*?\)/gi, '')
    .replace(/\(.*?version.*?\)/gi, '')
    .replace(/\(.*?remaster.*?\)/gi, '')
    .replace(/['']/g, "'")
    .trim();
}

function isRemixTitle(title) {
  return /\bremix\b/i.test(String(title || ''));
}

// Search for artist - check cache first, fallback to Spotify
export async function searchArtistId(artistName) {
  // Check cache first
  const cached = artistCache.getArtistTracks(artistName);
  if (cached && cached.tracks.length > 0) {
    return { provider: 'cache', id: artistName };
  }

  // Fallback to Spotify
  const spotifyId = await spotify.searchArtistId(artistName);
  if (spotifyId) {
    return { provider: 'spotify', id: spotifyId, artistName };
  }

  return null;
}

// Get top tracks with Deezer previews
export async function getArtistTopTracks(artistIdObj, limit = 10) {
  if (!artistIdObj) return [];

  const { provider, id, artistName: fallbackName } = artistIdObj;
  const artistName = provider === 'cache' ? id : fallbackName;

  // Try cache lookup
  if (artistName) {
    const cached = artistCache.getArtistTracks(artistName);

    // Fresh cache - use it
    if (cached && cached.tracks.length > 0 && !artistCache.isStale(artistName, CACHE_STALENESS_DAYS)) {
      console.log(`[Cache] Hit: ${artistName} (${cached.tracks.length} tracks from ${cached.source})`);
      return enrichTracksWithPreviews(cached.tracks, artistName, limit);
    }

    // Stale cache - try refresh, fallback to stale if fails
    if (cached && cached.tracks.length > 0) {
      console.log(`[Cache] Stale: ${artistName}, refreshing...`);
      try {
        const fresh = await fetchAndCacheTracks(artistName, limit);
        if (fresh.length > 0) {
          return enrichTracksWithPreviews(fresh, artistName, limit);
        }
      } catch (err) {
        console.warn(`[Cache] Refresh failed for ${artistName}, using stale data:`, err.message);
      }
      // Use stale data as fallback
      return enrichTracksWithPreviews(cached.tracks, artistName, limit);
    }
  }

  // Cache miss - fetch and cache
  const targetArtist = artistName || id;
  console.log(`[Cache] Miss: ${targetArtist}, fetching...`);
  const tracks = await fetchAndCacheTracks(targetArtist, limit);
  return enrichTracksWithPreviews(tracks, targetArtist, limit);
}

// Fetch tracks from Last.fm (with Spotify fallback) and cache them
async function fetchAndCacheTracks(artistName, limit) {
  // Try Last.fm first (all-time top tracks by scrobbles)
  if (lastfm.isConfigured()) {
    const tracks = await lastfm.getArtistTopTracks(artistName, limit * 2); // Fetch extra for filtering
    if (tracks.length > 0) {
      const formatted = tracks.map(t => ({
        name: t.name,
        playcount: t.playcount || null,
        spotifyId: null
      }));
      artistCache.saveArtistTracks(artistName, formatted, 'lastfm');
      console.log(`[Cache] Saved ${artistName} (${formatted.length} tracks from lastfm)`);
      return formatted;
    }
  }

  // Fallback to Spotify
  const spotifyId = await spotify.searchArtistId(artistName);
  if (spotifyId) {
    const spotifyTracks = await spotify.getArtistTopTracks(spotifyId, limit * 2);
    if (spotifyTracks.length > 0) {
      const formatted = spotifyTracks.map(t => ({
        name: cleanTitle(t.name),
        playcount: null,
        spotifyId: t.id?.replace('spotify-', '') || null
      }));
      artistCache.saveArtistTracks(artistName, formatted, 'spotify');
      console.log(`[Cache] Saved ${artistName} (${formatted.length} tracks from spotify)`);
      return formatted;
    }
  }

  console.warn(`[Cache] No tracks found for ${artistName}`);
  return [];
}

// Find Deezer previews for cached tracks
async function enrichTracksWithPreviews(cachedTracks, artistName, limit) {
  const results = [];

  for (const track of cachedTracks) {
    if (results.length >= limit) break;

    // Skip remixes
    if (isRemixTitle(track.name)) continue;

    // Search Deezer for this specific track
    const query = `${artistName} ${track.name}`;
    const deezerResults = await deezer.searchTracks(query, 5);

    // Find best match - must match both artist AND have similar title
    const normalizedName = normalizeForSearch(track.name);
    const normalizedArtist = normalizeForSearch(artistName);

    const match = deezerResults.find(d => {
      if (isRemixTitle(d.name)) return false;
      const dName = normalizeForSearch(d.name);
      const dArtist = normalizeForSearch(d.artist);

      // Artist must match
      const artistMatch = dArtist.includes(normalizedArtist) || normalizedArtist.includes(dArtist);
      if (!artistMatch) return false;

      // Title must have some similarity
      const titleMatch = dName.includes(normalizedName) || normalizedName.includes(dName) ||
                         dName.split(' ').some(word => word.length > 3 && normalizedName.includes(word));
      return titleMatch;
    });

    // Only use if we found a proper match with preview
    if (match && match.previewUrl) {
      // Avoid duplicates
      if (!results.some(r => r.id === match.id)) {
        results.push({
          id: match.id,
          name: track.name,
          artist: artistName,
          artists: [artistName],
          previewUrl: match.previewUrl,
          albumArt: match.albumArt,
          year: null
        });
      }
    }

    // Small delay between Deezer requests
    await new Promise(r => setTimeout(r, 50));
  }

  // Fallback: if no matches found, try direct Deezer artist search
  if (results.length === 0) {
    console.log(`[Cache] No Deezer matches for ${artistName}, trying direct artist search`);
    const deezerArtistId = await deezer.searchArtistId(artistName);

    if (deezerArtistId) {
      const deezerTracks = await deezer.getArtistTopTracks(deezerArtistId, limit);
      for (const track of deezerTracks) {
        if (isRemixTitle(track.name)) continue;
        results.push({
          id: track.id,
          name: track.name,
          artist: track.artist,
          artists: [track.artist],
          previewUrl: track.previewUrl,
          albumArt: track.albumArt,
          year: null
        });
      }
    }
  }

  return results;
}

// Search tracks - delegate to Spotify hybrid approach (not cached)
export async function searchTracks(query, limit = 50) {
  // For track search, use Spotify metadata + Deezer previews
  const spotifyTracks = await spotify.searchTracksMeta(query, limit);
  if (spotifyTracks.length === 0) return [];

  const results = [];

  for (const track of spotifyTracks) {
    if (results.length >= limit) break;

    const searchQuery = `${track.artist} ${track.name}`;
    const deezerResults = await deezer.searchTracks(searchQuery, 3);

    const normalizedName = normalizeForSearch(track.name);
    const normalizedArtist = normalizeForSearch(track.artist);

    const match = deezerResults.find(d => {
      if (isRemixTitle(d.name)) return false;
      const dName = normalizeForSearch(d.name);
      const dArtist = normalizeForSearch(d.artist);

      const artistMatch = dArtist.includes(normalizedArtist) || normalizedArtist.includes(dArtist);
      if (!artistMatch) return false;

      const titleMatch = dName.includes(normalizedName) || normalizedName.includes(dName) ||
        dName.split(' ').some(word => word.length > 3 && normalizedName.includes(word));
      return titleMatch;
    });

    if (match && match.previewUrl) {
      if (!results.some(r => r.id === match.id)) {
        results.push({
          id: match.id,
          name: track.name,
          artist: track.artist,
          artists: track.artists || [track.artist],
          previewUrl: match.previewUrl,
          albumArt: track.albumArt || match.albumArt,
          year: track.year || null
        });
      }
    }
  }

  return results;
}

// Always available (cache + fallback)
export async function isAvailable() {
  return true;
}

export const name = 'Local Cache (Last.fm + Spotify)';
