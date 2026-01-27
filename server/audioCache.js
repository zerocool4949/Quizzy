// Audio cache - manages locally cached audio previews
// Files stored in server/audio-cache/ with Spotify track ID as filename

import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_DIR = join(__dirname, 'audio-cache');

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

// Get cache directory path (for external use)
export function getCacheDir() {
  return CACHE_DIR;
}

// Build filename for a track
// trackId: can be spotify ID or custom identifier
function buildFilename(trackId) {
  // Sanitize the ID to be filesystem-safe
  const safeId = String(trackId).replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${safeId}.mp3`;
}

// Check if a track is cached
export function hasTrack(trackId) {
  const filePath = join(CACHE_DIR, buildFilename(trackId));
  return existsSync(filePath);
}

// Get the local file path for a cached track
// Returns null if not cached
export function getTrackPath(trackId) {
  const filePath = join(CACHE_DIR, buildFilename(trackId));
  if (!existsSync(filePath)) return null;
  return filePath;
}

// Get the URL path for serving a cached track
// Returns null if not cached
// Used with Express route: GET /audio/:filename
export function getTrackUrl(trackId) {
  if (!hasTrack(trackId)) return null;
  return `/audio/${buildFilename(trackId)}`;
}

// Save audio buffer to cache
// buffer: Buffer or Uint8Array
export function saveTrack(trackId, buffer) {
  try {
    const filePath = join(CACHE_DIR, buildFilename(trackId));
    writeFileSync(filePath, buffer);
    return true;
  } catch (err) {
    console.error(`Failed to save audio for ${trackId}:`, err.message);
    return false;
  }
}

// Delete a cached track
export function deleteTrack(trackId) {
  try {
    const filePath = join(CACHE_DIR, buildFilename(trackId));
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Failed to delete audio for ${trackId}:`, err.message);
    return false;
  }
}

// Get all cached track IDs
export function getCachedTracks() {
  try {
    const files = readdirSync(CACHE_DIR);
    return files
      .filter(f => f.endsWith('.mp3'))
      .map(f => f.replace('.mp3', ''));
  } catch {
    return [];
  }
}

// Get cache statistics
export function getCacheStats() {
  try {
    const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.mp3'));
    let totalSize = 0;

    for (const file of files) {
      const stat = statSync(join(CACHE_DIR, file));
      totalSize += stat.size;
    }

    return {
      trackCount: files.length,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
    };
  } catch {
    return {
      trackCount: 0,
      totalSizeBytes: 0,
      totalSizeMB: '0.00'
    };
  }
}

// Remove audio files for specific Spotify track IDs
// Returns count of removed files
export function removeTracks(spotifyIds) {
  let removed = 0;
  for (const id of spotifyIds) {
    if (deleteTrack(`spotify-${id}`)) {
      removed++;
    }
  }
  return removed;
}
