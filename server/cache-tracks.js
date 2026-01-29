#!/usr/bin/env node
// Track cache script - fetches top tracks for artists from Last.fm (fallback Spotify)
// Reads artists from categories.json and imported-playlists.json
// Saves to server/data/artists.json
//
// Usage:
//   node cache-tracks.js                    # Process all artists
//   node cache-tracks.js --artist "Orelsan" # Process single artist
//   node cache-tracks.js --limit 10         # Tracks per artist (default: 10)
//   node cache-tracks.js --refresh          # Refresh all (ignore staleness)
//   node cache-tracks.js --stats            # Show cache statistics

import dotenv from 'dotenv';
dotenv.config();

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import * as artistCache from './artistCache.js';
import * as lastfm from './lastfm.js';
import { searchArtistId, getArtistTopTracks, getTrackId } from './spotify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File paths
const CATEGORIES_PATH = join(__dirname, 'categories.json');
const IMPORTED_PATH = join(__dirname, 'imported-playlists.json');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    artist: null,
    limit: 10,
    refresh: false,
    stats: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--artist':
        options.artist = args[++i];
        break;
      case '--limit':
        options.limit = parseInt(args[++i]) || 10;
        break;
      case '--refresh':
        options.refresh = true;
        break;
      case '--stats':
        options.stats = true;
        break;
      case '--help':
        console.log(`
Track Cache Script
==================

Fetches top tracks for artists from Last.fm (with Spotify fallback).
Saves results to server/data/artists.json.

Usage:
  node cache-tracks.js [options]

Options:
  --artist "Name"   Process single artist only
  --limit N         Number of tracks per artist (default: 10)
  --refresh         Refresh all artists (ignore cache staleness)
  --stats           Show cache statistics and exit
  --help            Show this help message

Examples:
  node cache-tracks.js                      # Cache all artists
  node cache-tracks.js --artist "Stromae"   # Cache single artist
  node cache-tracks.js --refresh            # Force refresh all
`);
        process.exit(0);
    }
  }

  return options;
}

// Load all artists from categories and imported playlists
function loadAllArtists() {
  const artists = new Set();

  // Load from categories.json
  try {
    if (existsSync(CATEGORIES_PATH)) {
      const categories = JSON.parse(readFileSync(CATEGORIES_PATH, 'utf-8'));
      for (const category of Object.values(categories)) {
        for (const artist of category.artists || []) {
          artists.add(artist);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load categories.json:', err.message);
  }

  // Load from imported-playlists.json
  try {
    if (existsSync(IMPORTED_PATH)) {
      const playlists = JSON.parse(readFileSync(IMPORTED_PATH, 'utf-8'));
      for (const playlist of Object.values(playlists)) {
        for (const artist of playlist.artists || []) {
          artists.add(artist);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load imported-playlists.json:', err.message);
  }

  return Array.from(artists).sort();
}

// Look up Spotify IDs for tracks
async function enrichWithSpotifyIds(artistName, tracks) {
  const enriched = [];
  for (const track of tracks) {
    const spotifyId = await getTrackId(artistName, track.name);
    enriched.push({
      ...track,
      spotifyId: spotifyId || null
    });
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }
  return enriched;
}

// Fetch top tracks for an artist (Last.fm with Spotify fallback)
async function fetchArtistTracks(artistName, limit) {
  // Try Last.fm first (all-time top tracks by scrobbles)
  if (lastfm.isConfigured()) {
    const tracks = await lastfm.getArtistTopTracks(artistName, limit);
    if (tracks.length > 0) {
      // Enrich with Spotify IDs for audio cache mapping
      const enrichedTracks = await enrichWithSpotifyIds(artistName, tracks);
      return { tracks: enrichedTracks, source: 'lastfm' };
    }
  }

  // Fallback to Spotify (current popularity) - already has IDs
  const artistId = await searchArtistId(artistName);
  if (artistId) {
    const tracks = await getArtistTopTracks(artistId, limit);
    if (tracks.length > 0) {
      return {
        tracks: tracks.map(t => ({
          name: t.name,
          playcount: null,
          spotifyId: t.id?.replace('spotify-', '') || null
        })),
        source: 'spotify'
      };
    }
  }

  return { tracks: [], source: null };
}

// Process a single artist
async function processArtist(artistName, options) {
  // Check cache first (unless refresh mode)
  if (!options.refresh) {
    const cached = artistCache.getArtistTracks(artistName);
    if (cached && !artistCache.isStale(artistName)) {
      console.log(`  ✓ ${artistName} (cached, ${cached.tracks.length} tracks from ${cached.source})`);
      return { artist: artistName, tracks: cached.tracks.length, source: cached.source, cached: true };
    }
  }

  // Fetch from API
  const result = await fetchArtistTracks(artistName, options.limit);

  if (result.tracks.length > 0) {
    artistCache.saveArtistTracks(artistName, result.tracks, result.source);
    console.log(`  ✓ ${artistName} (${result.tracks.length} tracks from ${result.source})`);
    return { artist: artistName, tracks: result.tracks.length, source: result.source, cached: false };
  } else {
    console.log(`  ✗ ${artistName} (no tracks found)`);
    return { artist: artistName, tracks: 0, source: null, cached: false };
  }
}

// Prune cached artists not in current categories/playlists
function pruneDeletedArtists(validArtists) {
  const removed = artistCache.pruneArtists(validArtists);

  if (removed.length === 0) return;

  console.log(`Pruned ${removed.length} deleted artists`);
  for (const artist of removed) {
    console.log(`  - ${artist}`);
  }
  console.log('');
}

// Show cache statistics
function showStats() {
  console.log('Track Cache Statistics');
  console.log('======================\n');

  const stats = artistCache.getCacheStats();
  console.log(`Total artists: ${stats.totalArtists}`);
  console.log(`From Last.fm:  ${stats.lastfmCount}`);
  console.log(`From Spotify:  ${stats.spotifyCount}`);

  console.log('\nAPI Configuration:');
  console.log(`  Last.fm: ${lastfm.isConfigured() ? '✓ Configured' : '✗ Not configured (set LASTFM_API_KEY)'}`);
}

// Main entry point
async function main() {
  const options = parseArgs();

  // Stats mode
  if (options.stats) {
    showStats();
    return;
  }

  console.log('Track Cache Script');
  console.log('==================\n');

  // Check API configuration
  if (!lastfm.isConfigured()) {
    console.warn('Warning: LASTFM_API_KEY not set, will use Spotify only\n');
  }

  // Get artists to process
  let artists;
  if (options.artist) {
    artists = [options.artist];
  } else {
    artists = loadAllArtists();
    console.log(`Found ${artists.length} unique artists\n`);

    // Auto-prune deleted artists
    pruneDeletedArtists(artists);
  }

  // Process each artist
  const results = [];
  let fetched = 0;
  let fromCache = 0;
  let failed = 0;

  for (const artist of artists) {
    const result = await processArtist(artist, options);
    results.push(result);

    if (result.cached) fromCache++;
    else if (result.tracks > 0) fetched++;
    else failed++;

    // Small delay between API calls
    if (!result.cached) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(40));
  console.log(`Processed: ${results.length} artists`);
  console.log(`From cache: ${fromCache}`);
  console.log(`Fetched: ${fetched}`);
  if (failed > 0) console.log(`Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
