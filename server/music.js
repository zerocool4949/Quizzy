// Music module - provider abstraction layer
// Supports Deezer (free) and Spotify hybrid (Spotify metadata + Deezer previews)

import * as spotifyHybrid from './spotify-hybrid.js';

export { getCategoryList } from './categories.js';

// Available music providers
export const providers = {
  spotify: spotifyHybrid  // Hybrid: uses Spotify for discovery, Deezer for playback
};

// Get the provider module by name
export function getProvider(name = 'spotify') {
  return providers[name] || providers.spotify;
}

// List available providers for the UI
export function getProviderList() {
  return [
    { id: 'spotify', name: 'Spotify', description: 'Spotify rankings + Deezer audio' }
  ];
}

// Re-export for backward compatibility (defaults to Spotify hybrid)
export const searchTracks = spotifyHybrid.searchTracks;
export const searchArtistId = spotifyHybrid.searchArtistId;
export const getArtistTopTracks = spotifyHybrid.getArtistTopTracks;
