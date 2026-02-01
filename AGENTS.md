# Repository Guidelines

## Project Structure & Module Organization
- `client/` hosts the React + Vite frontend; main UI lives in `client/src/components/`.
- `client/src/context/` holds shared game state and socket wiring.
- `client/src/locales/` contains translation JSON files; update `client/src/i18n.jsx` when adding a new language.
- `server/` is the Express + Socket.io backend; game flow is in `server/gameManager.js`.
- `server/quiz.js` handles quiz generation, artist sampling, and track fetching via `music.js`.
- `server/movieQuiz.js` handles movie soundtrack quiz generation (separate from music quiz).
- `server/movies.json` contains the curated list of movies/series with their soundtrack tracks.
- `server/music.js` re-exports the active provider (`cache-provider.js`).
- `server/cache-provider.js` is the main music provider (cache-first with Spotify fallback + Deezer previews).
- `server/artistCache.js` handles local cache persistence (`server/data/artists.json`).
- `server/lastfm.js` wraps the Last.fm API for all-time top tracks.
- `server/spotify.js` wraps the Spotify API (token management, playlist import, fallback).
- `server/deezer.js` wraps the Deezer API for audio previews.
- `server/audioCache.js` downloads/serves cached movie soundtrack clips (yt-dlp + ffmpeg) and prewarms on startup.
- `server/answerMatcher.js` provides fuzzy matching for typed answers (Levenshtein distance, normalization).
- `server/titleUtils.js` provides shared title cleaning helpers.
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
- Copy `.env.example` to `server/.env` and set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `LASTFM_API_KEY`.
- Get a free Last.fm API key at https://www.last.fm/api/account/create
- Do not commit secrets; use `.env` and keep API credentials local.

## Key Implementation Details
- **Playlist sampling**: Artists are sampled equally from each playlist (not proportionally by size) to ensure smaller playlists get fair representation. Sample size scales with round count (`rounds * 3` buffer, minimum 60). See `getMultiCategoryTracks` in `server/quiz.js`.
- **Spotify token caching**: The Spotify access token is cached with a promise lock to prevent parallel fetches when concurrent requests arrive. See `getAccessToken` in `server/spotify.js`.
- **Title cleaning**: Track titles are cleaned by removing parenthetical content `(...)`, bracketed content `[...]`, and everything after ` - ` (which typically contains metadata like "Remastered", "Live", "Acoustic", etc.). Cache stores original titles; cleaning is applied at Deezer search (`server/cache-provider.js`) and output (`server/quiz.js`). See `cleanTitle` in `server/titleUtils.js`.
- **Typed answer matching**: Uses Levenshtein distance with ~15% typo tolerance and word-level matching for multi-word answers. Accents and punctuation are normalized. See `server/answerMatcher.js`.
- **Typed scoring**: Speed bonus tiers are +5 (<5s), +3 (<10s), +1 (<15s). Artist base 10, title base 15, combo +5. See `submitAnswer` in `server/gameManager.js`.
- **Round timing**: Round ends at `clipDuration + answerTime` (answerTime is 10s for typed/movie, 5s for MCQ). See `getCurrentRound` in `server/gameManager.js` and `sendNextRound` in `server/index.js`.
- **Movie soundtrack mode**: Uses typed input (not MCQ) to guess the movie/series name. Tracks are loaded from `server/movies.json` and searched on Deezer by `composer + trackName`. Players get 3 lives. See `server/movieQuiz.js` and movie handling in `server/gameManager.js`.
- **Movie clip cache**: Movie mode uses local MP3 clips cached in `server/data/audio/`, served from `/audio`. Clips are prewarmed on server start via `audioCache.js`. Movies in `server/movies.json` use either a plain string (`"Track Name"`) or object with search override (`{ "name": "Track", "search": "Artist Track" }`). Clip selection uses 20s length and starts at ~30% of song duration but never before 20s. Configure via `MOVIE_CLIP_SECONDS`, `MOVIE_CLIP_START_PERCENT`, `MOVIE_CLIP_CONCURRENCY`, and `SERVER_URL`. Requires `yt-dlp` and `ffmpeg` (installed in Dockerfile).
- **Game logging**: Each game logs rounds to `server/logs/games.jsonl` (JSON lines format) when the game starts. Includes timestamp, roomId, playerCount, categories, and track details (artist, title, year). File is ignored by git. See `server/gameLogger.js`.
- **Lobby settings persistence**: When returning to lobby after a game, settings (categories, difficulty, mode, rounds) are preserved via `roomSettings` from the game context. See `Lobby.jsx` state initialization.
- **Direct link join handling**: Join requests via direct links (`/join/:code`) are queued in `pendingJoinRef` if the socket isn't connected yet, then processed on the `connect` event. This prevents race conditions where users submit the join form before socket.io finishes connecting. See `GameContext.jsx`.
- **Spectator mode**: Players can join as spectators (watch but not play). Spectators have `role: 'spectator'` in player objects, don't count toward the 8-player limit, can join mid-game, and can switch to player role in lobby (host cannot become spectator). See `switchRole` in `server/roomManager.js` and `isSpectator` state in `GameContext.jsx`.
- **Answer normalization**: Leading articles ("the", "a", "an", "les", "la", "le", "l") are stripped from both user input and target text during matching, so "beatles" matches "The Beatles". See `normalize` in `server/answerMatcher.js`.

## Socket & Real-time Architecture
- `client/src/context/GameContext.jsx` is the central hub for all socket.io communication and game state management.
- Socket events flow: client action → `socketRef.current.emit()` → server handler in `server/index.js` → broadcast back to clients → reducer dispatch.
- **Timing-sensitive areas**: Any emit that happens early in component lifecycle (direct links, page refresh) may fire before socket connects. Use `pendingJoinRef` pattern if adding similar features.
- Room join flow: URL `/join/:code` → `Home.jsx` extracts code → user submits → `joinRoom()` → server `join-room` event → `room-joined` response → navigate to `/lobby/:code`.

## Local Track Cache Architecture

### Overview

Quizzy uses a local JSON cache for track discovery, populated by Last.fm (with Spotify fallback). This provides all-time top tracks ranked by cumulative scrobbles rather than current streaming popularity.

**Why Last.fm?** Last.fm returns all-time top tracks by total scrobbles, while Spotify's API returns current streaming popularity (skewed toward recent releases). For example, Orelsan's top tracks on Last.fm include "Basique" (2017), but Spotify only returns 2021+ songs.

### Data Flow

```
Quiz requests tracks for artist
    ↓
1. Check cache (server/data/artists.json)
   - If fresh (< 90 days): use cached tracks
   - If stale: try refresh, fallback to stale data if fails
   - If miss: fetch from Last.fm → Spotify fallback → save to cache
    ↓
2. For each track, find Deezer preview
   - Search Deezer by "artist trackname"
   - Match by normalized artist + title
    ↓
3. Return tracks with previewUrl
```

### Cache Modules

- `server/artistCache.js` - Cache persistence (get/save/isStale/prune)
- `server/lastfm.js` - Last.fm API wrapper for all-time top tracks
- `server/cache-provider.js` - Integration layer (wraps cache + Spotify + Deezer)
- `server/cache-warmer.js` - Startup warming, auto-prune, and CLI tool

### Cache Data Format

`server/data/artists.json`:
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

### Cache Warming

- **On server startup**: Background refresh for missing/stale artists
- **On playlist import**: Foreground fetch for new artists (30s timeout)
- **Auto-prune**: Deleted artists removed from cache
- **Concurrency lock**: Duplicate fetches for the same artist are queued, not duplicated (see `inProgress` Set in `cache-warmer.js`)

### CLI Usage

```bash
# Music cache (Last.fm/Spotify)
node server/cache-warmer.js                    # Refresh missing/stale artists
node server/cache-warmer.js --artist "Stromae" # Single artist
node server/cache-warmer.js --refresh          # Force refresh all
node server/cache-warmer.js --stats            # Show statistics

# Movie audio cache (YouTube)
node server/audioCache.js --warm               # Download missing clips (default)
node server/audioCache.js --prune              # Remove clips not in movies.json
node server/audioCache.js --stats              # Show cache statistics
```

### Configuration

Required environment variables:
- `LASTFM_API_KEY` - Primary source for track rankings
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` - Fallback + playlist import

Behavior:
- If `LASTFM_API_KEY` missing → Use Spotify only
- If Spotify credentials missing → Cache only (no fallback)

## Docker Notes
- `compose.yml` mounts three volumes: `categories.json` (read-only), `imported-playlists.json`, and `logs/` directory for game history persistence.
- Images are built via GitHub Actions on tag push and stored in `ghcr.io/zerocool4949/quizzy`.
