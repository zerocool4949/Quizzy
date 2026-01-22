// Deezer API wrapper - free, no auth required, reliable 30-second previews

// Clean up track titles by removing parenthetical content and common suffixes
function cleanTitle(title) {
  if (!title) return '';

  let cleaned = title
    // Remove all parenthetical content: (Remastered), (Live), (feat. X), etc.
    .replace(/\s*\([^)]*\)/g, '')
    // Remove all bracketed content: [Remastered], [Deluxe], etc.
    .replace(/\s*\[[^\]]*\]/g, '')
    // Remove common dash suffixes
    .replace(/\s*-\s*(remaster(ed)?|live|acoustic|remix|radio edit|single version)(\s+\d{4})?$/gi, '')
    .replace(/\s*-\s*\d{4}\s+remaster(ed)?$/gi, '');

  return cleaned.trim();
}

// Map Deezer track response to our internal format
function mapTrack(t) {
  return {
    id: String(t.id),
    name: cleanTitle(t.title),
    artist: t.artist?.name ?? "",
    previewUrl: t.preview,
    albumArt: t.album?.cover_medium ?? ""
  };
}

// Search for tracks by query
export async function searchTracks(query, limit = 50) {
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

// Search for an artist and return their Deezer ID
export async function searchArtistId(artistName) {
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

// Get top tracks for an artist by their Deezer ID
export async function getArtistTopTracks(artistId, limit = 10) {
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

// Check if Deezer is available
export async function isAvailable() {
  try {
    const res = await fetch('https://api.deezer.com/search?q=test&limit=1');
    return res.ok;
  } catch {
    return false;
  }
}

export const name = 'Deezer';
