// Spotify Hybrid Provider
// Uses Spotify API for artist/track discovery, Deezer for playable previews
// Best of both worlds: Spotify's metadata + Deezer's free previews

import * as spotify from './spotify.js';
import * as deezer from './deezer.js';

// Clean up track titles for better matching
function normalizeForSearch(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\(ft\..*?\)/gi, '')
    .replace(/\(with .*?\)/gi, '')
    .replace(/\(.*?remix.*?\)/gi, '')
    .replace(/\(.*?version.*?\)/gi, '')
    .replace(/\(.*?remaster.*?\)/gi, '')
    .replace(/['']/g, "'")
    .trim();
}

// Simple concurrency limiter
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

// Search for artist ID (use Deezer directly - it works fine for this)
export async function searchArtistId(artistName) {
  const spotifyId = await spotify.searchArtistId(artistName);
  if (spotifyId) return { provider: 'spotify', id: spotifyId };

  return null;
}

// Get top tracks using Spotify metadata, then find on Deezer for previews
export async function getArtistTopTracks(artistIdObj, limit = 10) {
  if (!artistIdObj) return [];

  // Use Spotify to get top track names
  const spotifyTracks = await getSpotifyTopTrackNames(artistIdObj.id, limit * 2);

  if (spotifyTracks.length === 0) {
    return [];
  }

  // Find each track on Deezer
  const results = [];
  for (const track of spotifyTracks) {
    if (results.length >= limit) break;

    // Search Deezer for this specific track
    const query = `${track.artist} ${track.name}`;
    const deezerResults = await deezer.searchTracks(query, 3);

    // Find best match - must match both artist AND have similar title
    const normalizedName = normalizeForSearch(track.name);
    const normalizedArtist = normalizeForSearch(track.artist);

    const match = deezerResults.find(d => {
      const dName = normalizeForSearch(d.name);
      const dArtist = normalizeForSearch(d.artist);

      // Artist must match
      const artistMatch = dArtist.includes(normalizedArtist) || normalizedArtist.includes(dArtist);
      if (!artistMatch) return false;

      // Title must have some similarity (not just any track by the artist)
      const titleMatch = dName.includes(normalizedName) || normalizedName.includes(dName) ||
                         dName.split(' ').some(word => word.length > 3 && normalizedName.includes(word));
      return titleMatch;
    });

    // Only use if we found a proper match (no fallback to random results)
    if (match && match.previewUrl) {
      // Avoid duplicates
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

// Get track names from Spotify (internal helper)
async function getSpotifyTopTrackNames(spotifyArtistId, limit = 20) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) return [];

  try {
    // Get token
    const authResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    if (!authResponse.ok) return [];
    const authData = await authResponse.json();

    // Get top tracks
    const response = await fetch(
      `https://api.spotify.com/v1/artists/${spotifyArtistId}/top-tracks?market=US`,
      { headers: { 'Authorization': `Bearer ${authData.access_token}` } }
    );

    if (!response.ok) return [];
    const data = await response.json();

    return (data.tracks || []).slice(0, limit).map(track => {
      const artistNames = (track.artists || []).map(a => a.name).filter(Boolean);
      return {
        name: track.name,
        artist: artistNames.join(' & ') || '',
        artists: artistNames,
        albumArt: track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? '',
        year: track.album?.release_date ? String(track.album.release_date).slice(0, 4) : null
      };
    });
  } catch {
    return [];
  }
}

// Search tracks - use Spotify metadata, Deezer for previews
export async function searchTracks(query, limit = 50) {
  const spotifyTracks = await spotify.searchTracksMeta(query, limit);
  if (spotifyTracks.length === 0) return [];

  const tasks = spotifyTracks.map(track => async () => {
    const searchQuery = `${track.artist} ${track.name}`;
    const deezerResults = await deezer.searchTracks(searchQuery, 3);

    const normalizedName = normalizeForSearch(track.name);
    const normalizedArtist = normalizeForSearch(track.artist);

    const match = deezerResults.find(d => {
      const dName = normalizeForSearch(d.name);
      const dArtist = normalizeForSearch(d.artist);

      const artistMatch = dArtist.includes(normalizedArtist) || normalizedArtist.includes(dArtist);
      if (!artistMatch) return false;

      const titleMatch = dName.includes(normalizedName) || normalizedName.includes(dName) ||
        dName.split(' ').some(word => word.length > 3 && normalizedName.includes(word));
      return titleMatch;
    });

    if (!match || !match.previewUrl) return null;

    return {
      id: match.id,
      name: track.name,
      artist: track.artist,
      artists: track.artists || [track.artist],
      previewUrl: match.previewUrl,
      albumArt: track.albumArt || match.albumArt,
      year: track.year || null
    };
  });

  const results = await runWithLimit(tasks, 5);
  const deduped = [];
  const seen = new Set();

  for (const track of results) {
    if (!track) continue;
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    deduped.push(track);
  }

  return deduped;
}

// Check if hybrid mode is available (needs Spotify credentials)
export async function isAvailable() {
  return spotify.isAvailable();
}

export const name = 'Spotify (hybrid)';
