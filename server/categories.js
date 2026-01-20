// Category and artist list management from categories.json
// Supports both static categories and imported Spotify playlists

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded categories
let categoryArtistsCache = null;
let categoryListCache = null;

// File paths
const CATEGORIES_PATH = join(__dirname, 'categories.json');
const IMPORTED_PATH = join(__dirname, 'imported-playlists.json');

// Load categories from JSON file
function loadCategoriesData() {
  try {
    return JSON.parse(readFileSync(CATEGORIES_PATH, 'utf-8'));
  } catch (err) {
    console.error('Failed to load categories.json:', err.message);
    return {};
  }
}

// Load imported playlists
function loadImportedPlaylists() {
  try {
    if (!existsSync(IMPORTED_PATH)) return {};
    return JSON.parse(readFileSync(IMPORTED_PATH, 'utf-8'));
  } catch (err) {
    console.error('Failed to load imported-playlists.json:', err.message);
    return {};
  }
}

// Save imported playlists
function saveImportedPlaylists(data) {
  try {
    writeFileSync(IMPORTED_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save imported-playlists.json:', err.message);
    return false;
  }
}

// Clear caches (call after import/delete)
export function clearCaches() {
  categoryArtistsCache = null;
  categoryListCache = null;
}

// Get mapping of categoryId -> artists array (includes imported)
export function getCategoryArtists() {
  if (!categoryArtistsCache) {
    const staticData = loadCategoriesData();
    const importedData = loadImportedPlaylists();

    categoryArtistsCache = {};

    // Add static categories
    for (const [id, category] of Object.entries(staticData)) {
      categoryArtistsCache[id] = category.artists;
    }

    // Add imported playlists
    for (const [id, playlist] of Object.entries(importedData)) {
      categoryArtistsCache[id] = playlist.artists;
    }
  }
  return categoryArtistsCache;
}

// Get list of categories for client display (includes imported)
export function getCategoryList() {
  if (!categoryListCache) {
    const staticData = loadCategoriesData();
    const importedData = loadImportedPlaylists();

    categoryListCache = [];

    // Add static categories
    for (const [id, category] of Object.entries(staticData)) {
      categoryListCache.push({
        id,
        name: category.name,
        imported: false
      });
    }

    // Add imported playlists (marked as imported)
    for (const [id, playlist] of Object.entries(importedData)) {
      categoryListCache.push({
        id,
        name: playlist.name,
        imported: true,
        spotifyId: playlist.spotifyId,
        artistCount: playlist.artists?.length || 0
      });
    }
  }
  return categoryListCache;
}

// Get artists for a specific category
export function getArtistsForCategory(categoryId) {
  const categories = getCategoryArtists();
  return categories[categoryId] || [];
}

// Import a Spotify playlist as a new category
export function importPlaylist(spotifyPlaylist) {
  const imported = loadImportedPlaylists();

  // Generate a unique ID based on Spotify playlist ID
  const categoryId = `spotify-${spotifyPlaylist.id}`;

  // Check if already imported
  if (imported[categoryId]) {
    return { error: 'Playlist already imported', categoryId };
  }

  // Save the playlist
  imported[categoryId] = {
    name: spotifyPlaylist.name,
    spotifyId: spotifyPlaylist.id,
    artists: spotifyPlaylist.artists,
    importedAt: new Date().toISOString()
  };

  if (!saveImportedPlaylists(imported)) {
    return { error: 'Failed to save playlist' };
  }

  clearCaches();

  return {
    success: true,
    categoryId,
    name: spotifyPlaylist.name,
    artistCount: spotifyPlaylist.artists.length
  };
}

// Delete an imported playlist
export function deleteImportedPlaylist(categoryId) {
  // Only allow deleting imported playlists (safety check)
  if (!categoryId.startsWith('spotify-')) {
    return { error: 'Can only delete imported playlists' };
  }

  const imported = loadImportedPlaylists();

  if (!imported[categoryId]) {
    return { error: 'Playlist not found' };
  }

  const name = imported[categoryId].name;
  delete imported[categoryId];

  if (!saveImportedPlaylists(imported)) {
    return { error: 'Failed to delete playlist' };
  }

  clearCaches();

  return { success: true, name };
}
