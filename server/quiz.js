// Quiz generation logic - track selection, difficulty, decoys

import { getProvider } from './music.js';
import { getTrackYear } from './spotify.js';
import { cleanTitle } from './titleUtils.js';
import { getArtistsForCategory } from './categories.js';

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

// Remove duplicate strings (case-insensitive)
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

// Difficulty determines how many top tracks per artist:
// 1 (easy) = top 1, 2 (medium) = top 3, 3 (hard) = top 10
function getTrackLimitForDifficulty(difficulty) {
  switch (difficulty) {
    case 1: return 1;  // Easy: only #1 hit
    case 2: return 3;  // Medium: top 3 hits
    case 3: return 10; // Hard: top 10 hits
    default: return 1;
  }
}

// Fetch tracks for multiple categories based on difficulty
async function getMultiCategoryTracks(categoryIds, difficulty = 1, provider, onProgress = null, targetRounds = 50) {
  // Sample equally from each category, enough to cover requested rounds (with buffer)
  const artistsNeeded = Math.max(60, targetRounds * 3); // 3x buffer for failed lookups
  const perCategory = Math.ceil(artistsNeeded / categoryIds.length);

  let sampledArtists = [];
  const seenArtists = new Set();

  for (const categoryId of categoryIds) {
    const artists = getArtistsForCategory(categoryId);
    if (!artists || artists.length === 0) continue;

    // Shuffle this category's artists
    const shuffled = [...artists].sort(() => Math.random() - 0.5);

    // Take up to perCategory unique artists from this playlist
    let taken = 0;
    for (const artist of shuffled) {
      if (taken >= perCategory) break;
      const key = artist.trim().toLowerCase();
      if (!key || seenArtists.has(key)) continue;
      seenArtists.add(key);
      sampledArtists.push(artist);
      taken++;
    }
  }

  if (sampledArtists.length === 0) {
    console.warn(`No artists found for categories: [${categoryIds.join(', ')}]`);
    return [];
  }

  // Shuffle the combined sample
  const sampleArtists = sampledArtists.sort(() => Math.random() - 0.5);

  const trackLimit = getTrackLimitForDifficulty(difficulty);
  console.log(`[${provider.name}] Fetching tracks for ${sampleArtists.length} artists from ${categoryIds.length} categories (${perCategory} per category, difficulty: ${difficulty}, top ${trackLimit} per artist)`);

  let completed = 0;
  const total = sampleArtists.length;

  const tasks = sampleArtists.map(name => async () => {
    const id = await provider.searchArtistId(name);
    let tracks = [];
    if (id) {
      tracks = await provider.getArtistTopTracks(id, trackLimit);
    }
    completed++;
    if (onProgress) {
      onProgress({ phase: 'artists', completed, total, artistName: name, tracksFound: tracks.length });
    }
    return tracks;
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
  console.log(`[${provider.name}] Found ${tracks.length} unique preview tracks from artist top tracks`);

  return tracks;
}

// Get all artists from categories (for decoy generation)
function getAllArtistsFromCategories(categoryIds) {
  let allArtists = [];
  for (const categoryId of categoryIds) {
    const artists = getArtistsForCategory(categoryId);
    if (artists && artists.length > 0) {
      allArtists.push(...artists);
    }
  }
  return dedupeStrings(allArtists);
}

async function enrichTracksWithYear(tracks, limit = 4) {
  const tasks = tracks.map(track => async () => {
    if (track.year) return track;
    const year = await getTrackYear(track.artist, track.name);
    return { ...track, year: year || null };
  });

  return runWithLimit(tasks, limit);
}

// Main quiz generation function
// @param categoryIds - array of category IDs
// @param count - number of rounds
// @param difficulty - 1 (easy), 2 (medium), 3 (hard)
// @param musicProvider - music provider to use (default: spotify hybrid)
export async function getQuizTracks(
  categoryIds,
  count = 10,
  difficulty = 1,
  musicProvider = 'spotify',
  onProgress = null,
  excludeTrackIds = []
) {
  // Handle both single categoryId (string) and array of categoryIds for backward compatibility
  const categories = Array.isArray(categoryIds) ? categoryIds : [categoryIds];

  // Get the music provider module
  const provider = getProvider(musicProvider);
  console.log(`Getting tracks using ${provider.name} for categories: [${categories.join(', ')}] with difficulty: ${difficulty}`);

  if (onProgress) {
    onProgress({ phase: 'starting', message: 'Fetching artists...' });
  }

  // Get tracks from curated artist lists (reliable)
  let tracks = await getMultiCategoryTracks(categories, difficulty, provider, onProgress, count);

  // Fallback to search if not enough tracks
  if (tracks.length < count * 2) {
    console.log("Not enough tracks, trying direct category search");
    for (const categoryId of categories) {
      const searchTerm = categoryId.replace(/-/g, " ");
      const extraTracks = await provider.searchTracks(`${searchTerm} hits`, 50);

      const existing = new Set(tracks.map(t => t.id));
      extraTracks.forEach(track => {
        if (track?.id && !existing.has(track.id)) {
          existing.add(track.id);
          tracks.push(track);
        }
      });
    }
  }

  // Last resort: top hits
  if (tracks.length < 4) {
    console.log("Still not enough, fetching top hits");
    tracks = await getMultiCategoryTracks(["top-hits"], difficulty, provider);
  }

  if (tracks.length < 4) {
    throw new Error("Could not find enough tracks with previews");
  }

  console.log(`Total tracks available: ${tracks.length}`);

  if (onProgress) {
    onProgress({ phase: 'building', message: 'Building quiz rounds...', totalTracks: tracks.length });
  }

  // Shuffle tracks
  const shuffled = [...tracks].sort(() => Math.random() - 0.5);

  const excludeSet = new Set((excludeTrackIds || []).map(id => String(id)));

  // Pick tracks for rounds, limiting each artist to 1 appearance
  function selectRoundTracks(sourceTracks) {
    const maxPerArtist = 1;
    const artistCount = new Map();
    const selected = [];

    for (const track of sourceTracks) {
      if (selected.length >= count) break;

      const artistLower = track.artist.toLowerCase();
      const currentCount = artistCount.get(artistLower) || 0;

      if (currentCount < maxPerArtist) {
        selected.push(track);
        artistCount.set(artistLower, currentCount + 1);
      }
    }

    return selected;
  }

  const filtered = excludeSet.size > 0
    ? shuffled.filter(track => !excludeSet.has(String(track.id)))
    : shuffled;

  let roundTracks = selectRoundTracks(filtered);
  if (excludeSet.size > 0 && roundTracks.length < count) {
    console.log('Not enough fresh tracks, allowing repeats for this game');
    roundTracks = selectRoundTracks(shuffled);
  }

  console.log(`Selected ${roundTracks.length} tracks with artist diversity`);

  const enrichedRoundTracks = await enrichTracksWithYear(roundTracks);

  // Get ALL artists from categories for decoy generation (not just the 50 sampled)
  const allCategoryArtists = getAllArtistsFromCategories(categories);
  console.log(`Using ${allCategoryArtists.length} artists from full category list for decoys`);

  // For each round, create question with decoys from the FULL artist list
  const rounds = [];

  for (let index = 0; index < enrichedRoundTracks.length; index++) {
    const correctTrack = enrichedRoundTracks[index];
    const cleanedCorrectName = cleanTitle(correctTrack.name);
    const correctArtistLower = correctTrack.artist.toLowerCase();

    // Filter out the correct artist from decoy candidates
    const decoyArtists = allCategoryArtists.filter(
      artist => artist.toLowerCase() !== correctArtistLower
    );

    // Shuffle all decoy candidates - we'll try more than 3 to handle failures
    const shuffledDecoyArtists = [...decoyArtists].sort(() => Math.random() - 0.5);

    // Create decoy entries - try pool first, then fetch if needed
    const decoys = [];
    const usedArtists = new Set();

    for (const artistName of shuffledDecoyArtists) {
      if (decoys.length >= 3) break;
      if (usedArtists.has(artistName.toLowerCase())) continue;

      // Try to find a real track from this artist in our pool
      const artistTrack = shuffled.find(
        t => t.artist.toLowerCase() === artistName.toLowerCase() && t.id !== correctTrack.id
      );

      if (artistTrack) {
        decoys.push({
          id: artistTrack.id,
          name: cleanTitle(artistTrack.name),
          artist: artistTrack.artist
        });
        usedArtists.add(artistName.toLowerCase());
      } else {
        // No track in pool - fetch one for this artist
        try {
          const artistId = await provider.searchArtistId(artistName);
          if (artistId) {
            const artistTracks = await provider.getArtistTopTracks(artistId, 1);
            if (artistTracks.length > 0) {
              const t = artistTracks[0];
              decoys.push({ id: t.id, name: cleanTitle(t.name), artist: t.artist });
              usedArtists.add(artistName.toLowerCase());
            }
          }
        } catch {
          // Fetch failed, try next artist
        }
      }
    }

    // If we still don't have 3 decoys, fill with placeholder (should be rare)
    while (decoys.length < 3 && shuffledDecoyArtists.length > usedArtists.size) {
      const remaining = shuffledDecoyArtists.filter(a => !usedArtists.has(a.toLowerCase()));
      if (remaining.length === 0) break;
      const artistName = remaining[0];
      decoys.push({
        id: `decoy-${artistName.replace(/\s+/g, '-').toLowerCase()}-${index}`,
        name: `${artistName} Hit`,
        artist: artistName
      });
      usedArtists.add(artistName.toLowerCase());
    }

    const options = [
      { id: correctTrack.id, name: cleanedCorrectName, artist: correctTrack.artist },
      ...decoys
    ].sort(() => Math.random() - 0.5);

    rounds.push({
      roundNumber: index + 1,
      previewUrl: correctTrack.previewUrl,
      albumArt: correctTrack.albumArt,
      correctId: correctTrack.id,
      correctName: cleanedCorrectName,
      correctArtist: correctTrack.artist,
      correctArtists: correctTrack.artists || [correctTrack.artist],
      correctYear: correctTrack.year || null,
      options
    });
  }

  return rounds;
}
