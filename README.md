# Quizzy - Multiplayer Music Quiz Game

A real-time multiplayer music quiz where players listen to song clips and compete to guess the correct answer.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Music API**: Deezer (free 30-second previews, no auth required)
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
│   ├── music.js                # Deezer API integration
│   ├── gameManager.js          # Room & game logic + answer matching
│   ├── genres.json             # Genre/playlist configuration (editable)
│   └── package.json
├── Dockerfile                  # Multi-stage Docker build
├── docker-compose.yml          # Production deployment
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

1. Clone the repo on your server:
```bash
git clone https://github.com/zerocool4949/Quizzy.git
cd Quizzy
```

2. Build and run:
```bash
docker compose up -d --build
```

3. Access at `http://your-server:7111`

To change the external port, edit `compose.yml`:
```yaml
ports:
  - "8080:7111"  # Change 8080 to your desired port
```

The `genres.json` file is mounted as a volume, so you can edit it without rebuilding:
```bash
nano server/genres.json
docker compose restart
```

## Game Features

### Room System
- 6-character room codes (like Kahoot)
- Up to 8 players per room
- Host controls game settings

### Answer Modes
- **MCQ Mode**: 4 multiple choice options, 5 seconds to answer after clip
- **Typed Mode**: Type artist name, then song title
  - 20 seconds to answer after clip
  - Fuzzy matching with typo tolerance (Levenshtein distance)
  - Case insensitive, accent insensitive
  - Partial matches accepted (e.g., "Weeknd" matches "The Weeknd")

### Game Settings (Host)
- **Clip Duration**: 5-15 seconds slider
- **Answer Mode**: MCQ or Typed
- **Music Genres**: Loaded from `server/genres.json`

### Scoring

**MCQ Mode:**
- Base: 1000 points
- Time penalty: -50 points per second
- Minimum: 100 points for correct answer
- Streak bonus: +50 per consecutive correct

**Typed Mode:**
- Artist correct: 600 base, -30/second, min 50
- Title correct: 600 base, -30/second, min 50
- Streak bonus: +50 per consecutive full correct (artist + title)

## Configuration

### Adding/Editing Genres

Edit `server/genres.json`:
```json
{
  "genre-id": {
    "name": "Display Name",
    "artists": [
      "Artist 1",
      "Artist 2"
    ]
  }
}
```

No code changes needed - just restart the server.

## Socket.io Events

### Client → Server
- `create-room` - Host creates room
- `join-room` - Player joins with code
- `update-settings` - Host changes game config (clipDuration, genreId, answerMode)
- `start-game` - Host starts quiz
- `submit-answer` - Player submits guess
  - MCQ: `{ answerId: string }`
  - Typed: `{ phase: 'artist'|'title', text: string }`
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

- `GET /api/genres` - List available genres from genres.json

## Key Files

| File | Purpose |
|------|---------|
| `server/genres.json` | Genre/artist configuration (edit this!) |
| `server/music.js` | Deezer API + genre loading |
| `server/gameManager.js` | Room state, scoring, fuzzy matching |
| `client/src/context/GameContext.jsx` | React state + socket events |
| `client/src/components/Lobby.jsx` | Game settings UI |
| `client/src/components/Game.jsx` | Quiz interface (MCQ + Typed modes) |

## Notes

- No API keys needed - Deezer API is free and public
- Audio auto-stops after configured clip duration
- Round auto-ends after clip + answer time (5s MCQ, 20s Typed)
- Fuzzy matching uses Levenshtein distance with ~25% typo tolerance
- In production, the built client is served from the Express server
