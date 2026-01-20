# Quizzy - Multiplayer Music Quiz Game

A real-time multiplayer music quiz where players listen to song clips and compete to guess the correct answer.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Music API**: Deezer (free) or Spotify hybrid (Spotify rankings + Deezer audio)
- **Deployment**: Docker + Docker Compose

## Project Structure

```
quizzy/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Home.jsx        # Landing page (create/join room)
│   │   │   ├── Lobby.jsx       # Waiting room + game settings
│   │   │   └── Game.jsx        # Quiz gameplay + results
│   │   ├── context/
│   │   │   └── GameContext.jsx # Global state + Socket.io
│   │   └── hooks/
│   │       └── useSocket.js    # Socket.io hook
│   └── package.json
├── server/
│   ├── index.js                # Express + Socket.io server
│   ├── music.js                # Music provider abstraction
│   ├── deezer.js               # Deezer API wrapper
│   ├── spotify.js              # Spotify API wrapper (auth + metadata)
│   ├── spotify-hybrid.js       # Hybrid provider (Spotify rankings + Deezer audio)
│   ├── categories.js           # Category/artist loading
│   ├── quiz.js                 # Quiz generation logic
│   ├── gameManager.js          # Room & game logic + answer matching
│   ├── categories.json         # Category/playlist configuration (editable)
│   └── package.json
├── Dockerfile                  # Multi-stage Docker build
├── compose.yml                 # Production deployment
└── package.json                # Workspace root
```

## Running the App

### Development
```bash
npm install    # Install all dependencies
npm run dev    # Start both client (5173) and server (3001)
```

Open http://localhost:5173 in your browser.

### Production (Docker)

The app is automatically built and published to GitHub Container Registry on every push to main.

#### First-time setup

1. Clone the repo on your server:
```bash
git clone https://github.com/zerocool4949/Quizzy.git
cd Quizzy
```

2. Authenticate with GitHub Container Registry (one-time):
```bash
# Create a Personal Access Token at https://github.com/settings/tokens
# with "read:packages" permission
echo 'YOUR_PAT_HERE' | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

3. Create environment file for Spotify (optional):
```bash
cp .env.example .env
# Edit .env with your Spotify credentials
```

4. Start the app:
```bash
docker compose up -d
```

5. Access at `http://your-server:7111`

#### Updating to latest version

No rebuilding needed - just pull the latest image:
```bash
docker compose pull && docker compose up -d
```

#### Configuration

To change the external port, edit `compose.yml`:
```yaml
ports:
  - "8080:7111"  # Change 8080 to your desired port
```

The `categories.json` and `imported-playlists.json` files are mounted as volumes, so you can edit them without rebuilding:
```bash
nano server/categories.json
docker compose restart
```

#### Building locally (optional)

If you want to build locally instead of using the pre-built image, edit `compose.yml`:
```yaml
services:
  quizzy:
    # image: ghcr.io/zerocool4949/quizzy:latest
    build: .  # Uncomment this line
```

Then run:
```bash
docker compose up -d --build
```

## Game Features

### Room System
- 6-character room codes (like Kahoot)
- Up to 8 players per room
- Host controls game settings

### Answer Modes
- **MCQ Mode**: 4 multiple choice options, 5 seconds to answer after clip
- **Typed Mode** (default): Single input field - guess artist and title in any order
  - 10 seconds to answer after clip
  - 3 lives per round (hearts) - wrong guesses cost a life
  - Guess artist or title in any order (or both at once!)
  - Type "Drake Hotline Bling" to get credit for both in one go
  - Fuzzy matching with typo tolerance (Levenshtein distance)
  - Case insensitive, accent insensitive
  - Partial matches accepted (e.g., "Weeknd" matches "The Weeknd")

### Game Settings (Host)
- **Rounds**: 10, 15, or 20 rounds per game
- **Difficulty**:
  - Easy: Top 1 hit per artist (most recognizable songs)
  - Medium: Top 3 hits per artist
  - Hard: Top 10 hits per artist (includes deeper cuts)
- **Music Source**: Deezer (free) or Spotify hybrid (uses Spotify rankings with Deezer audio)
- **Answer Mode**: MCQ or Typed
- **Music Categories**: Multi-select from `server/categories.json` (mix categories!)
- **Import Spotify Playlists**: Import any public Spotify playlist as a new category

### Scoring

**MCQ Mode:**
- 10 points for correct answer
- Speed bonus: +3 (<3s), +2 (<6s), +1 (<10s)
- Max per round: 13 points

**Typed Mode:**
- Artist correct: 10 points + speed bonus
- Title correct: 15 points + speed bonus
- Speed bonus: +3 (<5s), +2 (<10s), +1 (<15s)
- Max per round: 31 points (13 artist + 18 title)

## Configuration

### Adding/Editing Categories

Edit `server/categories.json`:
```json
{
  "category-id": {
    "name": "Display Name",
    "artists": [
      "Artist 1",
      "Artist 2"
    ]
  }
}
```

No code changes needed - just restart the server.

### Spotify Hybrid Mode (Optional)

The Spotify option uses a hybrid approach: Spotify API for track discovery/rankings, Deezer for playable audio previews. This gives you Spotify's chart data while avoiding their preview URL restrictions.

To enable, add credentials to `server/.env`:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

Get credentials from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

### Importing Spotify Playlists

In the lobby, hosts can import any public Spotify playlist as a new quiz category:

1. Click **"+ Import Playlist"** in the Music Categories section
2. Paste a Spotify playlist URL (e.g., `https://open.spotify.com/playlist/...`)
3. Click **Import** - the playlist's artists will be extracted and saved
4. The imported category will appear with a green "(imported)" label
5. Hover over imported categories to see the delete button (X)

Imported playlists are stored in `server/imported-playlists.json` and persist across restarts.

**Note:** Spotify's personalized playlists (like "Today's Top Hits") may not be accessible - use public user-created playlists instead.

## Socket.io Events

### Client → Server
- `create-room` - Host creates room
- `join-room` - Player joins with code
- `update-settings` - Host changes game config (categoryIds, answerMode, difficulty, totalRounds, musicProvider)
- `start-game` - Host starts quiz
- `submit-answer` - Player submits guess
  - MCQ: `{ answerId: string }`
  - Typed: `{ text: string }` (matches against artist/title automatically)
- `leave-room` - Player leaves the room
- `play-again` - Host restarts game

### Server → Client
- `room-created` / `room-joined` - Room confirmation
- `player-joined` / `player-left` - Player updates
- `game-starting` - Countdown begins
- `new-round` - Song preview + options + clipDuration + answerMode + answerTime
- `answer-result` - Individual feedback (includes `mode`, `phase` for typed)
- `round-end` - Correct answer + scores
- `game-over` - Final standings

## API Endpoints

- `GET /api/categories` - List available categories (static + imported)
- `GET /api/providers` - List available music providers (Deezer, Spotify)
- `POST /api/playlists/import` - Import a Spotify playlist as category (`{ url: string }`)
- `DELETE /api/playlists/:categoryId` - Delete an imported playlist

## Key Files

| File | Purpose |
|------|---------|
| `server/categories.json` | Category/artist configuration (edit this!) |
| `server/deezer.js` | Deezer API wrapper (search, artist lookup) |
| `server/categories.js` | Category/artist loading from JSON |
| `server/quiz.js` | Quiz generation (track selection, difficulty, decoys) |
| `server/gameManager.js` | Room state, scoring, fuzzy matching |
| `client/src/context/GameContext.jsx` | React state + socket events |
| `client/src/components/Lobby.jsx` | Game settings UI |
| `client/src/components/Game.jsx` | Quiz interface (MCQ + Typed modes) |

## Notes

- No API keys needed - Deezer API is free and public
- Clip duration is fixed at 15 seconds
- Round auto-ends after clip + answer time (5s MCQ, 10s Typed)
- Fuzzy matching uses Levenshtein distance with ~25% typo tolerance
- Each artist appears only once per quiz for variety
- Track titles are cleaned (removes "Remastered", "Live", etc.)
- Artists are randomly sampled (50 per game) from selected categories for playable tracks
- MCQ decoy answers are drawn from the full category artist list for harder guessing
- In production, the built client is served from the Express server

---

*A Zerocool creation*
