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
