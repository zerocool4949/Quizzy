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
  getRoundResults,
  nextRound,
  getGameResults,
  resetRoom
} from './gameManager.js';
import { getCategoryList, getProviderList } from './music.js';

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

// Get available music providers
app.get('/api/providers', (_req, res) => {
  res.json(getProviderList());
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

    // Notify others
    socket.to(result.room.code).emit('player-joined', {
      players: result.room.players
    });

    console.log(`${playerName} joined room ${code}`);
  });

  // Update game settings (categories, answer mode, difficulty, rounds, music provider)
  socket.on('update-settings', ({ categoryIds, answerMode, difficulty, totalRounds, musicProvider }) => {
    if (!currentRoom) return;

    const room = getRoom(currentRoom);
    if (room && room.hostId === socket.id) {
      updateRoomSettings(currentRoom, { categoryIds, answerMode, difficulty, totalRounds, musicProvider });
      console.log(`Settings updated: categories: [${categoryIds?.join(', ')}], mode: "${answerMode}", difficulty: ${difficulty}, rounds: ${totalRounds}, provider: ${musicProvider}`);
    }
  });

  // Start the game
  socket.on('start-game', async () => {
    if (!currentRoom) return;

    const room = getRoom(currentRoom);
    if (!room || room.hostId !== socket.id) return;

    console.log(`Starting game in room ${currentRoom}`);
    io.to(currentRoom).emit('game-starting', { countdown: 3 });

    try {
      const result = await startGame(currentRoom);

      if (result.error) {
        console.error(`Game start error: ${result.error}`);
        socket.emit('game-error', { message: result.error });
        return;
      }

      console.log(`Game started successfully, sending first round in 3s`);

      // Wait for countdown
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


  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    if (currentRoom) {
      const room = leaveRoom(currentRoom, socket.id);

      if (room) {
        io.to(currentRoom).emit('player-left', {
          players: room.players,
          newHostId: room.hostId
        });
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
