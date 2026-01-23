import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  updateRoomSettings,
  startGame,
  getCurrentRound,
  submitAnswer,
  allPlayersAnswered,
  canEndRound,
  getRoundResults,
  nextRound,
  getGameResults,
  resetRoom
} from './gameManager.js';
import { getCategoryList } from './music.js';
import { importPlaylist, deleteImportedPlaylist } from './categories.js';
import { getPlaylist } from './spotify.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Get available categories from categories.json
app.get('/api/categories', (_req, res) => {
  res.json(getCategoryList());
});

// Import a Spotify playlist as a new category
app.post('/api/playlists/import', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Playlist URL is required' });
  }

  // Fetch playlist from Spotify
  const playlist = await getPlaylist(url);

  if (playlist.error) {
    return res.status(400).json({ error: playlist.error });
  }

  if (playlist.artists.length === 0) {
    return res.status(400).json({ error: 'Playlist has no tracks with artists' });
  }

  // Import the playlist
  const result = importPlaylist(playlist);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  console.log(`Imported playlist "${result.name}" with ${result.artistCount} artists`);
  res.json(result);
});

// Delete an imported playlist
app.delete('/api/playlists/:categoryId', (req, res) => {
  const { categoryId } = req.params;

  const result = deleteImportedPlaylist(categoryId);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  console.log(`Deleted imported playlist "${result.name}"`);
  res.json(result);
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  let currentRoom = null;

  // Create a new room
  socket.on('create-room', ({ playerName }) => {
    const room = createRoom(socket.id, playerName);
    currentRoom = room.code;
    socket.join(room.code);

    socket.emit('room-created', {
      code: room.code,
      players: room.players,
      isHost: true
    });

    console.log(`Room ${room.code} created by ${playerName}`);
  });

  // Join existing room
  socket.on('join-room', ({ code, playerName }) => {
    const result = joinRoom(code, socket.id, playerName);

    if (result.error) {
      socket.emit('join-error', { message: result.error });
      return;
    }

    currentRoom = result.room.code;
    socket.join(result.room.code);

    socket.emit('room-joined', {
      code: result.room.code,
      players: result.room.players,
      isHost: false
    });

    // Send current settings to the joining player
    socket.emit('settings-updated', {
      categoryIds: result.room.categoryIds,
      answerMode: result.room.answerMode,
      difficulty: result.room.difficulty,
      totalRounds: result.room.totalRounds
    });

    // Notify others
    socket.to(result.room.code).emit('player-joined', {
      players: result.room.players
    });

    console.log(`${playerName} joined room ${code}`);
  });

  // Update game settings (categories, answer mode, difficulty, rounds)
  socket.on('update-settings', ({ categoryIds, answerMode, difficulty, totalRounds }) => {
    if (!currentRoom) return;

    const room = getRoom(currentRoom);
    if (room && room.hostId === socket.id) {
      updateRoomSettings(currentRoom, { categoryIds, answerMode, difficulty, totalRounds });
      console.log(`Settings updated: categories: [${categoryIds?.join(', ')}], mode: "${answerMode}", difficulty: ${difficulty}, rounds: ${totalRounds}`);

      // Broadcast settings to all players in the room
      io.to(currentRoom).emit('settings-updated', {
        categoryIds: room.categoryIds,
        answerMode: room.answerMode,
        difficulty: room.difficulty,
        totalRounds: room.totalRounds
      });
    }
  });

  // Start the game
  socket.on('start-game', async () => {
    if (!currentRoom) return;

    const room = getRoom(currentRoom);
    if (!room || room.hostId !== socket.id) return;

    console.log(`Starting game in room ${currentRoom}`);

    // Show loading state while fetching tracks
    io.to(currentRoom).emit('game-loading', { phase: 'starting', message: 'Preparing quiz...' });

    try {
      // Progress callback to send updates to clients
      const onProgress = (progress) => {
        io.to(currentRoom).emit('game-loading', progress);
      };

      const result = await startGame(currentRoom, onProgress);

      if (result.error) {
        console.error(`Game start error: ${result.error}`);
        socket.emit('game-error', { message: result.error });
        return;
      }

      console.log(`Tracks loaded, starting countdown`);

      // NOW start the countdown (tracks are ready)
      io.to(currentRoom).emit('game-starting', { countdown: 3 });

      // Wait for countdown then send first round
      setTimeout(() => {
        sendNextRound(currentRoom);
      }, 3000);
    } catch (error) {
      console.error(`Game start exception: ${error.message}`);
      socket.emit('game-error', { message: error.message });
    }
  });

  // Player submits answer
  socket.on('submit-answer', (payload) => {
  if (!currentRoom) return;

  const result = submitAnswer(currentRoom, socket.id, payload);

  if (result) {
    socket.emit('answer-result', result);

    // End round when everyone is done (mcq once; typed after title or wrong artist)
    if (allPlayersAnswered(currentRoom)) {
      endRound(currentRoom);
    }
  }
});


  // Player explicitly leaves the room
  socket.on('leave-room', () => {
    if (!currentRoom) return;

    console.log(`Player ${socket.id} leaving room ${currentRoom}`);
    const roomCode = currentRoom;
    const room = leaveRoom(roomCode, socket.id);
    socket.leave(roomCode);

    if (room) {
      io.to(roomCode).emit('player-left', {
        players: room.players,
        newHostId: room.hostId
      });

      // Check if remaining players have all answered (end round early)
      if (room.state === 'playing' && allPlayersAnswered(roomCode)) {
        endRound(roomCode);
      }
    }

    currentRoom = null;
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    if (currentRoom) {
      const roomCode = currentRoom;
      const room = leaveRoom(roomCode, socket.id);

      if (room) {
        io.to(roomCode).emit('player-left', {
          players: room.players,
          newHostId: room.hostId
        });

        // Check if remaining players have all answered (end round early)
        if (room.state === 'playing' && allPlayersAnswered(roomCode)) {
          endRound(roomCode);
        }
      }
    }
  });

  // Play again
  socket.on('play-again', () => {
    if (!currentRoom) return;

    const room = getRoom(currentRoom);
    if (room && room.hostId === socket.id) {
      resetRoom(currentRoom);
      io.to(currentRoom).emit('room-reset', {
        players: room.players
      });
    }
  });
});

function sendNextRound(roomCode) {
  const room = getRoom(roomCode);
  const round = getCurrentRound(roomCode);
  console.log(`Sending round for ${roomCode}:`, round ? `Round ${round.roundNumber}` : 'No round');

  if (round && room) {
    // Include clip duration in round data
    io.to(roomCode).emit('new-round', {
      ...round,
      clipDuration: room.clipDuration || 15
    });

    // Auto-end round after clip duration + answer time + buffer
    // answerTime is 10s for typed mode, 5s for MCQ
    const answerTime = room.answerMode === 'typed' ? 10 : 5;
    const timeout = ((room.clipDuration || 15) + answerTime + 5) * 1000;
    const expectedRound = round.roundNumber - 1;

    setTimeout(() => {
      const currentRoom = getRoom(roomCode);
      if (currentRoom && currentRoom.state === 'playing' && currentRoom.currentRound === expectedRound) {
        endRound(roomCode);
      }
    }, timeout);
  }
}

function endRound(roomCode) {
  // Prevent double-ending a round
  if (!canEndRound(roomCode)) return;

  const results = getRoundResults(roomCode);

  if (results) {
    io.to(roomCode).emit('round-end', results);

    // Wait before next round
    setTimeout(() => {
      const status = nextRound(roomCode);

      if (status?.finished) {
        const gameResults = getGameResults(roomCode);
        io.to(roomCode).emit('game-over', gameResults);
      } else {
        sendNextRound(roomCode);
      }
    }, 5000);
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
