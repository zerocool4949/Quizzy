// Music module - provider abstraction layer
// Supports Deezer (free) and Spotify hybrid (Spotify metadata + Deezer previews)

import * as deezer from './deezer.js';
import * as spotifyHybrid from './spotify-hybrid.js';

export { getCategoryList } from './categories.js';

// Available music providers
export const providers = {
  deezer,
  spotify: spotifyHybrid  // Hybrid: uses Spotify for discovery, Deezer for playback
};

// Get the provider module by name
export function getProvider(name = 'deezer') {
  return providers[name] || providers.deezer;
}

// List available providers for the UI
export function getProviderList() {
  return [
    { id: 'deezer', name: 'Deezer', description: 'Free, no account needed' },
    { id: 'spotify', name: 'Spotify', description: 'Spotify rankings + Deezer audio' }
  ];
}

// Re-export for backward compatibility (defaults to Deezer)
export const searchTracks = deezer.searchTracks;
export const searchArtistId = deezer.searchArtistId;
export const getArtistTopTracks = deezer.getArtistTopTracks;
