// Deezer API wrapper - free, no auth required, reliable 30-second previews

// Clean up track titles by removing common suffixes
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
