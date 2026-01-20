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

// Search for artist ID (use Deezer directly - it works fine for this)
export async function searchArtistId(artistName) {
  // Try Deezer first since it's simpler
  const deezerId = await deezer.searchArtistId(artistName);
  if (deezerId) return { provider: 'deezer', id: deezerId };

  // Fall back to Spotify
  const spotifyId = await spotify.searchArtistId(artistName);
  if (spotifyId) return { provider: 'spotify', id: spotifyId };

  return null;
}

// Get top tracks using Spotify metadata, then find on Deezer
export async function getArtistTopTracks(artistIdObj, limit = 10) {
  if (!artistIdObj) return [];

  // If we have a Deezer ID, just use Deezer directly
  if (artistIdObj.provider === 'deezer') {
    return deezer.getArtistTopTracks(artistIdObj.id, limit);
  }

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

    // Find best match
    const normalizedName = normalizeForSearch(track.name);
    const normalizedArtist = normalizeForSearch(track.artist);

    const match = deezerResults.find(d => {
      const dName = normalizeForSearch(d.name);
      const dArtist = normalizeForSearch(d.artist);
      return dName.includes(normalizedName) || normalizedName.includes(dName) ||
             (dArtist.includes(normalizedArtist) && dName.length > 0);
    }) || deezerResults[0];

    if (match && match.previewUrl) {
      // Avoid duplicates
      if (!results.some(r => r.id === match.id)) {
        results.push(match);
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

    return (data.tracks || []).slice(0, limit).map(track => ({
      name: track.name,
      artist: track.artists?.[0]?.name || ''
    }));
  } catch {
    return [];
  }
}

// Search tracks - use Deezer directly (it's reliable)
export async function searchTracks(query, limit = 50) {
  return deezer.searchTracks(query, limit);
}

// Check if hybrid mode is available (needs Spotify credentials)
export async function isAvailable() {
  return spotify.isAvailable();
}

export const name = 'Spotify (hybrid)';
