// Spotify API wrapper - fallback when Deezer fails
// Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env

import dotenv from 'dotenv';
dotenv.config();

let accessToken = null;
let tokenExpiry = 0;

// Get access token using client credentials flow
async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer)
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('Spotify credentials not configured');
    return null;
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      console.error('Spotify auth failed:', response.status);
      return null;
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);

    console.log('Spotify token acquired, expires in', data.expires_in, 'seconds');
    return accessToken;
  } catch (error) {
    console.error('Spotify auth error:', error.message);
    return null;
  }
}

// Clean up track titles (same logic as Deezer)
function cleanTitle(title) {
  if (!title) return '';

  const patterns = [
    /\s*\(remaster(ed)?\)/gi,
    /\s*\(remaster(ed)?\s+\d{4}\)/gi,
    /\s*\(\d{4}\s+remaster(ed)?\)/gi,
    /\s*\(deluxe( edition)?\)/gi,
    /\s*\(bonus track\)/gi,
    /\s*\(radio edit\)/gi,
    /\s*\(single( version)?\)/gi,
    /\s*\(album version\)/gi,
    /\s*\(original( mix)?\)/gi,
    /\s*\(extended( mix| version)?\)/gi,
    /\s*\(live\)/gi,
    /\s*\(live .*?\)/gi,
    /\s*\(acoustic\)/gi,
    /\s*\(unplugged\)/gi,
    /\s*\(explicit\)/gi,
    /\s*\(clean\)/gi,
    /\s*\(mono\)/gi,
    /\s*\(stereo\)/gi,
    /\s*\(remix\)/gi,
    /\s*\(feat\..*?\)/gi,
    /\s*\(ft\..*?\)/gi,
    /\s*\(with .*?\)/gi,
    /\s*- remaster(ed)?(\s+\d{4})?/gi,
    /\s*- \d{4} remaster(ed)?/gi,
    /\s*- single version/gi,
    /\s*- radio edit/gi,
    /\s*- live/gi,
  ];

  let cleaned = title;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

// Map Spotify track to our internal format
function mapTrack(track) {
  return {
    id: `spotify-${track.id}`,
    name: cleanTitle(track.name),
    artist: track.artists?.[0]?.name ?? '',
    previewUrl: track.preview_url,
    albumArt: track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? ''
  };
}

// Search for tracks
export async function searchTracks(query, limit = 50) {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      console.log(`Spotify search error for "${query}": ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.tracks?.items || [])
      .filter(track => track.preview_url) // Only tracks with previews
      .map(mapTrack);
  } catch (error) {
    console.log(`Spotify search error for "${query}":`, error?.message ?? error);
    return [];
  }
}

// Search for artist ID
export async function searchArtistId(artistName) {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.artists?.items?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// Get top tracks for an artist
export async function getArtistTopTracks(artistId, limit = 10) {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    // Spotify requires a market parameter for top tracks
    const response = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!response.ok) return [];

    const data = await response.json();

    return (data.tracks || [])
      .filter(track => track.preview_url)
      .slice(0, limit)
      .map(mapTrack);
  } catch {
    return [];
  }
}

// Check if Spotify is configured and working
export async function isAvailable() {
  const token = await getAccessToken();
  return token !== null;
}
