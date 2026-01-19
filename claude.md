# Quizzy - Multiplayer Music Quiz Game

A real-time multiplayer music quiz where players listen to song clips and compete to guess the correct answer.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Music API**: Deezer (free 30-second previews, no auth required)

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
│   ├── gameManager.js          # Room & game logic
│   └── package.json
└── package.json                # Workspace root
```

## Running the App

```bash
npm install    # Install all dependencies
s    # Start both client (5173) and server (3001)
```

Open http://localhost:5173 in your browser.

## Game Features

### Room System
- 6-character room codes (like Kahoot)
- Up to 8 players per room
- Host controls game settings

### Game Settings (Host)
- **Clip Duration**: 5-15 seconds slider
- **Music Genres**: 15 presets including:
  - Top Hits, French 90s-2025, French Classics
  - US Pop, US Hip-Hop, Rock Classics
  - 80s/90s/2000s/2010s Hits
  - EDM, Latino, R&B, Disney, Movie Soundtracks

### Gameplay
- 10 rounds per game
- 4 multiple choice options per round
- Audio stops after configured duration
- 5 extra seconds to answer after audio ends

### Scoring
- Base: 1000 points
- Time penalty: -50 points per second
- Minimum: 100 points for correct answer
- Streak bonus: +50 per consecutive correct

## Socket.io Events

### Client → Server
- `create-room` - Host creates room
- `join-room` - Player joins with code
- `update-settings` - Host changes game config
- `start-game` - Host starts quiz
- `submit-answer` - Player submits guess
- `play-again` - Host restarts game

### Server → Client
- `room-created` / `room-joined` - Room confirmation
- `player-joined` / `player-left` - Player updates
- `game-starting` - Countdown begins
- `new-round` - Song preview + options + clipDuration
- `answer-result` - Individual feedback
- `round-end` - Correct answer + scores
- `game-over` - Final standings

## Key Files

| File | Purpose |
|------|---------|
| `server/music.js` | Deezer API search & track fetching |
| `server/gameManager.js` | Room state, scoring, game loop |
| `client/src/context/GameContext.jsx` | React state + socket events |
| `client/src/components/Lobby.jsx` | Game settings UI |
| `client/src/components/Game.jsx` | Quiz interface |

## Notes

- No API keys needed - Deezer API is free and public
- Spotify integration exists but disabled (no previews available)
- Audio auto-stops after clip duration
- Round auto-ends after clip + 10 seconds timeout
