# Repository Guidelines

## Project Structure & Module Organization
- `client/` hosts the React + Vite frontend; main UI lives in `client/src/components/`.
- `client/src/context/` holds shared game state and socket wiring.
- `client/src/locales/` contains translation JSON files; update `client/src/i18n.jsx` when adding a new language.
- `server/` is the Express + Socket.io backend; game flow is in `server/gameManager.js`.
- `server/quiz.js` handles quiz generation, artist sampling, and track fetching.
- `server/spotify.js` wraps the Spotify API (token management, playlist import, track search).
- `server/answerMatcher.js` provides fuzzy matching for typed answers (Levenshtein distance, normalization).
- Shared config and deployment files are at repo root: `compose.yml`, `Dockerfile`, `.env.example`.

## Build, Test, and Development Commands
- `npm install` installs root workspaces (`client`, `server`).
- `npm run dev` runs both apps concurrently (Vite on `:5173`, API on `:3001` by default).
- `npm run build` builds the client for production (`client/dist`).
- `npm start` runs the server in production mode.
- `npm test` runs server tests (Vitest). Use `npm run test:watch` for watch mode.
- `docker compose up -d` runs the full stack in production containers.

## Coding Style & Naming Conventions
- Follow existing formatting per package: client files use 2-space indents and no semicolons; server files use 2-space indents and semicolons.
- Prefer single quotes in JS/JSX to match current files.
- Keep filenames descriptive and aligned with existing patterns (e.g., `Game.jsx`, `roomManager.js`).
- No repo-wide formatter is configured; keep changes consistent with nearby code.

## Testing Guidelines
- Backend tests use Vitest (`server` workspace).
- Name tests to mirror modules or behaviors (example: `answerMatcher.test.js` in `server/`).
- Add tests for scoring, round flow, and answer matching when changing game logic.

## Commit & Pull Request Guidelines
- Recent commits use short, imperative summaries (examples: "Add multilingual support", "Clarify difficulty tooltip").
- Keep commit subjects under ~60 characters and scoped to one change.
- PRs should include a concise summary, testing notes (`npm test`, `npm run dev`), and screenshots for UI changes.
- Link related issues or feature requests when applicable.

## Configuration & Security Notes
- Copy `.env.example` to `server/.env` and set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.
- Do not commit secrets; use `.env` and keep API credentials local.

## Key Implementation Details
- **Playlist sampling**: Artists are sampled equally from each playlist (not proportionally by size) to ensure smaller playlists get fair representation. Sample size scales with round count (`rounds * 3` buffer, minimum 60). See `getMultiCategoryTracks` in `server/quiz.js`.
- **Spotify token caching**: The Spotify access token is cached with a promise lock to prevent parallel fetches when concurrent requests arrive. See `getAccessToken` in `server/spotify.js`.
- **Title cleaning**: Track titles are cleaned by removing parenthetical content `(...)`, bracketed content `[...]`, and everything after ` - ` (which typically contains metadata like "Remastered", "Live", "Acoustic", etc.). See `cleanTitle` in `server/spotify.js`.
- **Typed answer matching**: Uses Levenshtein distance with ~15% typo tolerance and word-level matching for multi-word answers. Accents and punctuation are normalized. See `server/answerMatcher.js`.
- **Game logging**: Each game logs rounds to `server/logs/games.jsonl` (JSON lines format) when the game starts. Includes timestamp, roomId, playerCount, categories, and track details (artist, title, year). See `server/gameLogger.js`.
- **Lobby settings persistence**: When returning to lobby after a game, settings (categories, difficulty, mode, rounds) are preserved via `roomSettings` from the game context. See `Lobby.jsx` state initialization.
- **Direct link join handling**: Join requests via direct links (`/join/:code`) are queued in `pendingJoinRef` if the socket isn't connected yet, then processed on the `connect` event. This prevents race conditions where users submit the join form before socket.io finishes connecting. See `GameContext.jsx`.

## Socket & Real-time Architecture
- `client/src/context/GameContext.jsx` is the central hub for all socket.io communication and game state management.
- Socket events flow: client action → `socketRef.current.emit()` → server handler in `server/index.js` → broadcast back to clients → reducer dispatch.
- **Timing-sensitive areas**: Any emit that happens early in component lifecycle (direct links, page refresh) may fire before socket connects. Use `pendingJoinRef` pattern if adding similar features.
- Room join flow: URL `/join/:code` → `Home.jsx` extracts code → user submits → `joinRoom()` → server `join-room` event → `room-joined` response → navigate to `/lobby/:code`.

## Audio Architecture Plan

### Current State
- Spotify provides metadata (artist, title, year, album art)
- Deezer provides 15-second previews
- Spotify "top tracks" returns current popularity only (misses classics)

### Planned Architecture

**Track Discovery (with fallback + cache):**
```
Local artist cache (server/data/artists.json)
    ↓ fallback if artist not cached
Last.fm API (all-time top tracks by scrobbles)
    ↓ fallback if artist not found on Last.fm
Spotify API (current top tracks)
    ↓
Save to local artist cache
```

**Audio Preview (with fallback):**
```
Local audio cache (server/audio-cache/)
    ↓ fallback if not cached
Deezer API (15-sec previews)
```

**Why cache Last.fm results:**
- Avoid bombing Last.fm API with repeated requests
- Faster track discovery (no network latency)
- Works offline for known artists
- Top tracks rarely change (all-time rankings are stable)

### Implementation Plan

**Phase 1-4: Cache Modules (DONE)**
- [x] `server/artistCache.js` - Persists top tracks per artist to `server/data/artists.json`
- [x] `server/lastfm.js` - Last.fm API wrapper for all-time top tracks
- [x] `server/audioCache.js` - Manages local audio files in `server/audio-cache/`
- [x] `server/youtube-downloader.js` - Downloads 15-sec clips from YouTube
- [x] `server/cache-tracks.js` - CLI to fetch track lists (Last.fm → Spotify fallback)
- [x] `server/cache-audio.js` - CLI to download audio previews
- [x] Auto-prune: Deleted artists/playlists are automatically cleaned from cache
- [x] Spotify ID mapping: Tracks include `spotifyId` for direct cache lookup

**Cache data format** (`server/data/artists.json`):
```json
{
  "Stromae": {
    "lastUpdated": "2026-01-27",
    "source": "lastfm",
    "tracks": [
      { "name": "Papaoutai", "playcount": 6228941, "spotifyId": "34dx8DACTJsc3rsJdaEIQw" }
    ]
  }
}
```

**CLI Usage:**
```bash
# Track lists (fast, run often)
node cache-tracks.js                    # All artists from categories/playlists
node cache-tracks.js --artist "Stromae" # Single artist
node cache-tracks.js --refresh          # Force refresh all (re-fetch Spotify IDs)
node cache-tracks.js --stats            # Show statistics

# Audio previews (slow, run on-demand)
node cache-audio.js                     # All cached artists
node cache-audio.js --artist "Stromae"  # Single artist
node cache-audio.js --stats             # Show statistics
```

**Phase 5: Quizzy Integration (TODO)**
- [ ] Add Express route: `GET /audio/:trackId.mp3` to serve cached audio
- [ ] Modify `server/quiz.js` to check audio cache before Deezer:
  ```js
  const cacheUrl = audioCache.getTrackUrl(`spotify-${track.spotifyId}`);
  if (cacheUrl) return cacheUrl;
  // fallback to Deezer
  ```
- [ ] Consider using artist cache for track selection (instead of Spotify top tracks)

**Phase 5: Unified Flow**
```
Quiz requests tracks for artist
    ↓
1. Check artist cache → if miss: Last.fm → fallback Spotify → save to cache
    ↓
2. For each track, get preview:
   a. Check audio cache → return /audio/{trackId}.mp3
   b. Fallback: Deezer preview URL
    ↓
3. Return tracks with previewUrl (local or Deezer)
```

### File Naming Convention
Use Spotify track ID for cache files (consistent, unique):
```
server/audio-cache/
  spotify-4iV5W9uYEdYUVa79Axb7Rh.mp3
  spotify-7ouMYWpwJ422jRcDASAM9z.mp3
```

### POC Branch
Proof of concept with YouTube downloading available on `feature/audio-cache` branch.

## Docker Notes
- `compose.yml` mounts three volumes: `categories.json` (read-only), `imported-playlists.json`, and `logs/` directory for game history persistence.
- Images are built via GitHub Actions on tag push and stored in `ghcr.io/zerocool4949/quizzy`.
