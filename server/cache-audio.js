#!/usr/bin/env node
// Audio cache script - downloads 30-second previews from YouTube
// Reads track lists from server/data/artists.json (run cache-tracks.js first)
// Saves audio to server/audio-cache/
//
// Usage:
//   node cache-audio.js                    # Process all cached artists
//   node cache-audio.js --artist "Orelsan" # Process single artist
//   node cache-audio.js --limit 5          # Limit tracks per artist
//   node cache-audio.js --stats            # Show cache statistics

import dotenv from 'dotenv';
dotenv.config();

import * as artistCache from './artistCache.js';
import * as audioCache from './audioCache.js';
import { downloadTrack, checkDependencies } from './youtube-downloader.js';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    artist: null,
    limit: null, // null = all tracks
    stats: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--artist':
        options.artist = args[++i];
        break;
      case '--limit':
        options.limit = parseInt(args[++i]) || null;
        break;
      case '--stats':
        options.stats = true;
        break;
      case '--help':
        console.log(`
Audio Cache Script
==================

Downloads 30-second audio previews from YouTube.
Requires track lists in server/data/artists.json (run cache-tracks.js first).

Usage:
  node cache-audio.js [options]

Options:
  --artist "Name"   Process single artist only
  --limit N         Limit tracks per artist (default: all)
  --stats           Show cache statistics and exit
  --help            Show this help message

Examples:
  node cache-audio.js                       # Download all
  node cache-audio.js --artist "Stromae"    # Single artist
  node cache-audio.js --limit 5             # First 5 tracks per artist

Requirements:
  - yt-dlp (winget install yt-dlp)
  - ffmpeg (winget install ffmpeg)
`);
        process.exit(0);
    }
  }

  return options;
}

// Sanitize string for track ID
function sanitize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

// Process a single artist
async function processArtist(artistName, options) {
  console.log(`\n${artistName}`);
  console.log('-'.repeat(artistName.length));

  // Get cached tracks
  const cached = artistCache.getArtistTracks(artistName);
  if (!cached || cached.tracks.length === 0) {
    console.log('  ✗ No cached tracks (run cache-tracks.js first)');
    return { artist: artistName, total: 0, downloaded: 0, skipped: 0, failed: 0 };
  }

  let tracks = cached.tracks;
  if (options.limit) {
    tracks = tracks.slice(0, options.limit);
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const track of tracks) {
    const trackId = `${sanitize(artistName)}-${sanitize(track.name)}`;

    // Check if already cached
    if (audioCache.hasTrack(trackId)) {
      console.log(`  ⏭ ${track.name}`);
      skipped++;
      continue;
    }

    // Download
    console.log(`  ⬇ ${track.name}...`);
    const result = await downloadTrack(trackId, artistName, track.name);

    if (result.success) {
      const pct = Math.round(result.clipStart / result.duration * 100);
      console.log(`    ✓ ${result.clipStart}s-${result.clipEnd}s (${pct}% into song)`);
      downloaded++;
    } else {
      console.log(`    ✗ ${result.error}`);
      failed++;
    }

    // Delay between downloads
    await new Promise(r => setTimeout(r, 1500));
  }

  return { artist: artistName, total: tracks.length, downloaded, skipped, failed };
}

// Show cache statistics
function showStats() {
  console.log('Audio Cache Statistics');
  console.log('======================\n');

  const stats = audioCache.getCacheStats();
  console.log(`Total tracks: ${stats.trackCount}`);
  console.log(`Total size:   ${stats.totalSizeMB} MB`);

  const deps = checkDependencies();
  console.log('\nDependencies:');
  console.log(`  yt-dlp: ${deps.ytdlp ? '✓' : '✗'}`);
  console.log(`  ffmpeg: ${deps.ffmpeg ? '✓' : '✗'}`);

  if (!deps.ready) {
    console.log('\nInstall missing dependencies:');
    console.log('  winget install yt-dlp ffmpeg');
  }
}

// Main entry point
async function main() {
  const options = parseArgs();

  // Stats mode
  if (options.stats) {
    showStats();
    return;
  }

  console.log('Audio Cache Script');
  console.log('==================');

  // Check dependencies
  const deps = checkDependencies();
  if (!deps.ready) {
    console.error('\nMissing required dependencies:');
    if (!deps.ytdlp) console.error('  - yt-dlp not found');
    if (!deps.ffmpeg) console.error('  - ffmpeg not found');
    console.error('\nInstall with: winget install yt-dlp ffmpeg');
    process.exit(1);
  }

  // Get artists to process
  let artists;
  if (options.artist) {
    artists = [options.artist];
  } else {
    artists = artistCache.getCachedArtists();
    if (artists.length === 0) {
      console.error('\nNo artists in cache. Run cache-tracks.js first.');
      process.exit(1);
    }
    console.log(`\nProcessing ${artists.length} cached artists...`);
  }

  // Process each artist
  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const artist of artists) {
    const result = await processArtist(artist, options);
    totalDownloaded += result.downloaded;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
  }

  // Summary
  console.log('\n' + '='.repeat(40));
  console.log(`Downloaded: ${totalDownloaded}`);
  console.log(`Skipped (cached): ${totalSkipped}`);
  if (totalFailed > 0) console.log(`Failed: ${totalFailed}`);

  const stats = audioCache.getCacheStats();
  console.log(`\nTotal cache: ${stats.trackCount} tracks (${stats.totalSizeMB} MB)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
