// YouTube audio downloader - downloads and extracts 15-second clips
// Requires yt-dlp and ffmpeg installed on the system

import { execSync } from 'child_process';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getCacheDir, hasTrack } from './audioCache.js';

// Clip configuration
const CLIP_DURATION = 15; // seconds
const CLIP_START_PERCENT = 0.20; // Start at 20% into the song (often hits verse/chorus)
const MIN_START = 15; // Minimum 15 seconds in (skip short intros)

// Tool paths - update these if not in PATH
// Default to just command name (assumes in PATH)
let YT_DLP = process.env.YT_DLP_PATH || 'yt-dlp';
let FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
let FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

// Try common Windows install locations if default fails
const WINGET_YT_DLP = 'C:/Users/Raphael/AppData/Local/Microsoft/WinGet/Packages/yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe/yt-dlp.exe';

// Multiple possible ffmpeg locations (version numbers change)
const FFMPEG_PATHS = [
  'C:/Users/Raphael/AppData/Local/Microsoft/WinGet/Packages/yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-N-122319-gf6a95c7eb7-win64-gpl/bin/ffmpeg.exe',
  'C:/Users/Raphael/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.0.1-full_build/bin/ffmpeg.exe'
];

// Check if a command exists
function commandExists(cmd) {
  try {
    // Try -version first (ffmpeg style), then --version (most tools)
    try {
      execSync(`"${cmd}" -version`, { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      execSync(`"${cmd}" --version`, { stdio: 'pipe', timeout: 5000 });
      return true;
    }
  } catch {
    return false;
  }
}

// Initialize tool paths
function initToolPaths() {
  // Check yt-dlp
  if (!commandExists(YT_DLP) && existsSync(WINGET_YT_DLP)) {
    YT_DLP = WINGET_YT_DLP;
  }

  // Check ffmpeg - try multiple locations
  if (!commandExists(FFMPEG)) {
    for (const ffmpegPath of FFMPEG_PATHS) {
      if (existsSync(ffmpegPath)) {
        FFMPEG = ffmpegPath;
        FFPROBE = ffmpegPath.replace('ffmpeg.exe', 'ffprobe.exe');
        break;
      }
    }
  }
}

// Initialize on module load
initToolPaths();

// Check if required tools are available
export function checkDependencies() {
  const ytdlpOk = commandExists(YT_DLP);
  const ffmpegOk = commandExists(FFMPEG);

  return {
    ytdlp: ytdlpOk,
    ffmpeg: ffmpegOk,
    ready: ytdlpOk && ffmpegOk,
    ytdlpPath: YT_DLP,
    ffmpegPath: FFMPEG
  };
}

// Get audio duration using ffprobe
function getDuration(filePath) {
  try {
    const cmd = `"${FFPROBE}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const output = execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
    return parseFloat(output.trim());
  } catch {
    return null;
  }
}

// Calculate optimal clip start position (20% into song)
function calculateClipStart(duration) {
  let start = Math.floor(duration * CLIP_START_PERCENT);

  // Ensure minimum offset to skip intros
  start = Math.max(start, MIN_START);

  // Ensure we don't go past the end (leave room for 30s clip + 5s buffer)
  const maxStart = duration - CLIP_DURATION - 5;
  start = Math.min(start, maxStart);

  // Fallback for very short songs
  if (start < 0) start = 0;

  return start;
}

// Sanitize string for filesystem
function sanitize(str) {
  return String(str || '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .substring(0, 50);
}

// Download and extract clip from YouTube
// trackId: identifier for the cached file (usually spotify-{id})
// artist: artist name for search
// title: track title for search
// Returns: { success, path?, error? }
export async function downloadTrack(trackId, artist, title) {
  const deps = checkDependencies();
  if (!deps.ready) {
    return {
      success: false,
      error: `Missing dependencies: ${!deps.ytdlp ? 'yt-dlp ' : ''}${!deps.ffmpeg ? 'ffmpeg' : ''}`.trim()
    };
  }

  // Check if already cached
  if (hasTrack(trackId)) {
    return { success: true, path: join(getCacheDir(), `${trackId}.mp3`), cached: true };
  }

  const cacheDir = getCacheDir();
  const query = `${artist} ${title} official audio`;
  const outputPath = join(cacheDir, `${trackId}.mp3`);
  const tempPath = join(cacheDir, `${sanitize(trackId)}_temp.mp3`);

  try {
    // Step 1: Download full audio to temp file
    const downloadCmd = [
      `"${YT_DLP}"`,
      '--ffmpeg-location', `"${FFMPEG}"`,
      `"ytsearch1:${query}"`,
      '--no-playlist',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '5',
      '-o', `"${tempPath}"`,
      '--no-warnings',
      '--quiet'
    ].join(' ');

    execSync(downloadCmd, { stdio: 'pipe', timeout: 120000 });

    if (!existsSync(tempPath)) {
      return { success: false, error: 'Download failed - no file created' };
    }

    // Step 2: Get duration and calculate start position
    const duration = getDuration(tempPath);
    if (!duration) {
      unlinkSync(tempPath);
      return { success: false, error: 'Could not determine audio duration' };
    }

    const clipStart = calculateClipStart(duration);

    // Step 3: Extract clip using ffmpeg
    const extractCmd = [
      `"${FFMPEG}"`,
      '-y',
      '-ss', clipStart.toString(),
      '-i', `"${tempPath}"`,
      '-t', CLIP_DURATION.toString(),
      '-acodec', 'libmp3lame',
      '-ab', '128k',
      `"${outputPath}"`,
      '-loglevel', 'error'
    ].join(' ');

    execSync(extractCmd, { stdio: 'pipe', timeout: 30000 });

    // Step 4: Cleanup temp file
    unlinkSync(tempPath);

    if (existsSync(outputPath)) {
      return {
        success: true,
        path: outputPath,
        duration,
        clipStart,
        clipEnd: clipStart + CLIP_DURATION
      };
    } else {
      return { success: false, error: 'Clip extraction failed' };
    }
  } catch (error) {
    // Cleanup on error
    if (existsSync(tempPath)) {
      try { unlinkSync(tempPath); } catch {}
    }
    return { success: false, error: error.message };
  }
}
