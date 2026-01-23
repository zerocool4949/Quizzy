// Music module - Spotify metadata + Deezer previews (hybrid approach)

import * as spotifyHybrid from './spotify-hybrid.js';

export { getCategoryList } from './categories.js';

// Get the provider module
export function getProvider() {
  return spotifyHybrid;
}

// Re-export main functions
export const searchTracks = spotifyHybrid.searchTracks;
export const searchArtistId = spotifyHybrid.searchArtistId;
export const getArtistTopTracks = spotifyHybrid.getArtistTopTracks;
