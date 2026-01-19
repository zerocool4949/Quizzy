import dotenv from 'dotenv';
dotenv.config();

let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error('Failed to get Spotify access token');
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early

  return accessToken;
}

async function spotifyFetch(endpoint) {
  const token = await getAccessToken();
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  return response.json();
}

export async function getPlaylistTracks(playlistId) {
  const data = await spotifyFetch(`/playlists/${playlistId}/tracks?limit=50`);

  return data.items
    .map(item => item.track)
    .filter(track => track && track.preview_url) // Only tracks with previews
    .map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      previewUrl: track.preview_url,
      albumArt: track.album.images[0]?.url
    }));
}

export async function searchPlaylists(query) {
  const data = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=playlist&limit=10`);

  return data.playlists.items.map(playlist => ({
    id: playlist.id,
    name: playlist.name,
    image: playlist.images[0]?.url,
    trackCount: playlist.tracks.total
  }));
}

export async function getFeaturedPlaylists() {
  const data = await spotifyFetch('/browse/featured-playlists?limit=10');

  return data.playlists.items.map(playlist => ({
    id: playlist.id,
    name: playlist.name,
    image: playlist.images[0]?.url,
    trackCount: playlist.tracks.total
  }));
}

// Search for tracks by genre/query and return them for quiz
export async function searchTracks(query, limit = 50) {
  const data = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);

  return data.tracks.items
    .filter(track => track && track.preview_url)
    .map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      previewUrl: track.preview_url,
      albumArt: track.album.images[0]?.url
    }));
}

// Get tracks for a quiz round - uses search query directly
export async function getQuizTracks(searchQuery, count = 10) {
  console.log(`Searching for tracks: "${searchQuery}"`);
  let tracks = await searchTracks(searchQuery, 50);
  console.log(`Found ${tracks.length} tracks with previews`);

  if (tracks.length < 4) {
    console.log('Not enough tracks, trying broader search');
    tracks = await searchTracks('popular music', 50);
  }

  if (tracks.length < 4) {
    throw new Error('Could not find enough tracks with previews');
  }

  // Shuffle and pick tracks for rounds
  const shuffled = tracks.sort(() => Math.random() - 0.5);
  const roundTracks = shuffled.slice(0, Math.min(count, shuffled.length));

  // For each round, create question with decoys
  return roundTracks.map((correctTrack, index) => {
    // Get 3 random decoys from other tracks
    const otherTracks = tracks.filter(t => t.id !== correctTrack.id);
    const decoys = otherTracks
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Combine correct answer with decoys and shuffle
    const options = [correctTrack, ...decoys]
      .sort(() => Math.random() - 0.5)
      .map(t => ({
        id: t.id,
        name: t.name,
        artist: t.artist
      }));

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

// Default search queries for quick start (used as fallback)
export const DEFAULT_PLAYLISTS = [
  { id: 'top-hits-2024', name: "Top Hits 2024", isSearch: true },
  { id: 'rock-classics', name: "Rock Classics", isSearch: true },
  { id: 'pop-hits', name: "Pop Hits", isSearch: true },
  { id: 'hip-hop-2024', name: "Hip Hop", isSearch: true },
  { id: 'dance-electronic', name: "Dance & Electronic", isSearch: true }
];
