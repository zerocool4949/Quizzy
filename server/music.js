// Music module - Local cache (Last.fm) + Deezer previews

import * as cacheProvider from './cache-provider.js';

export { getCategoryList } from './categories.js';

// Get the provider module
export function getProvider() {
  return cacheProvider;
}

// Re-export main functions
export const searchTracks = cacheProvider.searchTracks;
export const searchArtistId = cacheProvider.searchArtistId;
export const getArtistTopTracks = cacheProvider.getArtistTopTracks;
