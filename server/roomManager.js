// Room management - creation, joining, leaving, settings

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function createRoom(hostId, hostName) {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();

  const room = {
    code,
    hostId,
    players: [
      {
        id: hostId,
        name: hostName,
        score: 0,
        streak: 0,
        isHost: true,
        role: 'player'
      }
    ],
    state: 'lobby', // lobby, playing, finished
    categoryIds: ['top-hits'],
    clipDuration: 15,
    answerMode: 'typed', // 'mcq' | 'typed' | 'movie'
    difficulty: 1, // 1=easy, 2=medium, 3=hard
    musicProvider: 'spotify',
    rounds: [],
    currentRound: 0,
    totalRounds: 10,
    roundStartTime: null,
    answers: new Map(),
    usedTrackIds: new Set(),
    usedMovieIds: new Set()
  };

  rooms.set(code, room);
  return room;
}

export function joinRoom(code, playerId, playerName, asSpectator = false) {
  const room = rooms.get(code.toUpperCase());

  if (!room) return { error: 'Room not found' };
  if (room.state !== 'lobby' && !asSpectator) return { error: 'Game already in progress' };
  if (room.players.find(p => p.id === playerId)) return { error: 'Already in room' };

  // Only count active players toward the 8-player limit
  const activePlayers = room.players.filter(p => p.role === 'player').length;
  if (!asSpectator && activePlayers >= 8) return { error: 'Room is full (max 8 players)' };

  room.players.push({
    id: playerId,
    name: playerName,
    score: 0,
    streak: 0,
    isHost: false,
    role: asSpectator ? 'spectator' : 'player'
  });

  return { room };
}

export function leaveRoom(code, playerId) {
  const room = rooms.get(code?.toUpperCase());
  if (!room) return null;

  room.players = room.players.filter(p => p.id !== playerId);
  room.answers?.delete(playerId);

  // If host left, assign new host or delete room
  if (room.hostId === playerId) {
    if (room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    } else {
      rooms.delete(code);
      return null;
    }
  }

  return room;
}

export function getRoom(code) {
  return rooms.get(code?.toUpperCase());
}

export function updateRoomSettings(code, { categoryIds, answerMode, difficulty, totalRounds }) {
  const room = rooms.get(code?.toUpperCase());
  if (room && room.state === 'lobby') {
    if (categoryIds && categoryIds.length > 0) room.categoryIds = categoryIds;
    if (answerMode) room.answerMode = answerMode;
    if (difficulty) room.difficulty = difficulty;
    if (totalRounds) room.totalRounds = totalRounds;
    return true;
  }
  return false;
}

export function resetRoom(code) {
  const room = rooms.get(code?.toUpperCase());
  if (!room) return null;

  room.state = 'lobby';
  room.rounds = [];
  room.currentRound = 0;
  room.roundEnded = false;
  room.roundStartTime = null;
  room.answers.clear();
  room.players.forEach(p => {
    p.score = 0;
    p.streak = 0;
  });

  return room;
}

export function switchRole(code, playerId) {
  const room = rooms.get(code?.toUpperCase());
  if (!room || room.state !== 'lobby') return { error: 'Cannot switch role during game' };

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'Player not found' };

  // Cannot switch host to spectator
  if (player.isHost && player.role === 'player') {
    return { error: 'Host cannot become spectator' };
  }

  // Check player limit when switching to player
  if (player.role === 'spectator') {
    const activePlayers = room.players.filter(p => p.role === 'player').length;
    if (activePlayers >= 8) return { error: 'Room is full (max 8 players)' };
  }

  player.role = player.role === 'player' ? 'spectator' : 'player';
  return { room, newRole: player.role };
}

export function deleteRoom(code) {
  rooms.delete(code);
}
