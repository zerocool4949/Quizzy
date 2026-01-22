# Quizzy

A real-time multiplayer music quiz game. Listen to song clips, guess the artist and title, compete with friends.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Features

- **Multiplayer** - 6-character room codes, up to 8 players, shareable invite links
- **Two game modes** - Multiple choice or typed answers
- **Typed mode** - Single input, guess artist/title in any order, type both at once for bonus
- **Fuzzy matching** - Typo tolerance, accent insensitive, partial matches
- **Configurable** - Rounds, difficulty, music categories, import Spotify playlists
- **No API keys needed** - Uses free Deezer API (Spotify optional for rankings)

## Game Modes

### Multiple Choice
- 4 options per round
- 5 seconds to answer after clip ends
- 10 base points + speed bonus

### Typed (Default)
- Single input field - guess artist or title in any order
- Type both together (e.g., "Drake Hotline Bling") for double credit
- 3 lives per round - wrong guesses cost a life
- 10 seconds to answer after clip ends
- Artist: 10 points + speed bonus
- Title: 15 points + speed bonus

## Host Settings

| Setting | Options |
|---------|---------|
| Rounds | 10, 15, or 20 |
| Difficulty | Easy (top hit), Medium (top 3), Hard (top 10) |
| Music Source | Deezer or Spotify hybrid |
| Categories | Multi-select, mix genres |
| Import | Add any public Spotify playlist |

## Production Deployment

```bash
# Pull and run
docker compose up -d

# Update
docker compose pull && docker compose up -d
```

Access at `http://your-server:7111`

## Configuration

### Add Categories

Edit `server/categories.json`:

```json
{
  "my-category": {
    "name": "My Category",
    "artists": ["Artist 1", "Artist 2"]
  }
}
```

### Enable Spotify Rankings (Optional)

Add to `server/.env`:

```env
SPOTIFY_CLIENT_ID=your_id
SPOTIFY_CLIENT_SECRET=your_secret
```

Get credentials from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

## Tech Stack

- React + Vite + Tailwind CSS
- Node.js + Express + Socket.io
- Deezer API (free) / Spotify API (optional)
- Docker

## Project Structure

```
quizzy/
├── client/src/
│   ├── components/     # Home, Lobby, Game
│   └── context/        # GameContext (state + sockets)
├── server/
│   ├── index.js        # Express + Socket.io
│   ├── gameManager.js  # Room logic, scoring, matching
│   ├── quiz.js         # Track selection, decoys
│   ├── deezer.js       # Deezer API
│   ├── spotify.js      # Spotify API
│   └── categories.json # Music categories
├── Dockerfile
└── compose.yml
```

## Notes

- Clip duration: 15 seconds
- Each artist appears once per quiz
- Fuzzy matching: ~15% typo tolerance, must type 70%+ of answer, spaces optional
- Track titles cleaned (removes all parenthetical content like "Remastered", "Live", etc.)
- Loading screen shows track fetching progress
- Non-host players see live settings updates in lobby

---

*A Zerocool creation*
