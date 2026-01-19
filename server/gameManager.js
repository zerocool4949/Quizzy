import { getQuizTracks } from './music.js';

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ---------- Typed-answer helpers ----------
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance for typo tolerance
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

// Fuzzy matching with typo tolerance
function looselyMatches(userText, targetText) {
  const u = normalize(userText);
  const t = normalize(targetText);

  if (!u || !t) return false;
  if (u === t) return true;

  // require minimum length to avoid "a" matching everything
  if (u.length < 3) return false;

  // Substring match
  if (t.includes(u) || u.includes(t)) return true;

  // Levenshtein distance - allow ~20% typos (min 2 chars)
  const maxDistance = Math.max(2, Math.floor(t.length * 0.25));
  const distance = levenshtein(u, t);
  if (distance <= maxDistance) return true;

  // Also check if user typed a significant word from the target
  const targetWords = t.split(' ').filter(w => w.length >= 4);
  const userWords = u.split(' ').filter(w => w.length >= 3);

  for (const uw of userWords) {
    for (const tw of targetWords) {
      if (tw.includes(uw) || uw.includes(tw)) return true;
      if (levenshtein(uw, tw) <= Math.max(1, Math.floor(tw.length * 0.25))) return true;
    }
  }

  return false;
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
        isHost: true
      }
    ],
    state: 'lobby', // lobby, playing, finished
    genreId: 'top-hits',
    clipDuration: 10,
    answerMode: 'mcq', // 'mcq' | 'typed'
    rounds: [],
    currentRound: 0,
    totalRounds: 10,
    roundStartTime: null,
    answers: new Map()
  };

  rooms.set(code, room);
  return room;
}

export function joinRoom(code, playerId, playerName) {
  const room = rooms.get(code.toUpperCase());

  if (!room) return { error: 'Room not found' };
  if (room.state !== 'lobby') return { error: 'Game already in progress' };
  if (room.players.find(p => p.id === playerId)) return { error: 'Already in room' };
  if (room.players.length >= 8) return { error: 'Room is full (max 8 players)' };

  room.players.push({
    id: playerId,
    name: playerName,
    score: 0,
    streak: 0,
    isHost: false
  });

  return { room };
}

export function leaveRoom(code, playerId) {
  const room = rooms.get(code);
  if (!room) return null;

  room.players = room.players.filter(p => p.id !== playerId);

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

// Legacy (looks unused in your current flow)
export function setPlaylist(code, playlistId) {
  const room = rooms.get(code);
  if (room && room.state === 'lobby') {
    room.playlistId = playlistId;
    return true;
  }
  return false;
}

export function updateRoomSettings(code, { clipDuration, genreId, answerMode }) {
  const room = rooms.get(code);
  if (room && room.state === 'lobby') {
    if (clipDuration) room.clipDuration = clipDuration;
    if (genreId) room.genreId = genreId;
    if (answerMode) room.answerMode = answerMode; // 'mcq' | 'typed'
    return true;
  }
  return false;
}

export async function startGame(code) {
  const room = rooms.get(code);
  if (!room || room.state !== 'lobby') return { error: 'Cannot start game' };
  if (room.players.length < 1) return { error: 'Need at least 1 player' };

  try {
    room.rounds = await getQuizTracks(room.genreId, room.totalRounds);
    room.state = 'playing';
    room.currentRound = 0;

    // Reset scores
    room.players.forEach(p => {
      p.score = 0;
      p.streak = 0;
    });

    return { room };
  } catch (error) {
    return { error: error.message };
  }
}

export function getCurrentRound(code) {
  const room = rooms.get(code);
  if (!room || room.state !== 'playing') return null;

  const round = room.rounds[room.currentRound];
  if (!round) return null;

  room.roundStartTime = Date.now();
  room.answers.clear();

  // Typed mode gets more time (20s after clip ends vs 5s for MCQ)
  const answerTime = room.answerMode === 'typed' ? 20 : 5;

  // Return round data without the correct answer
  return {
    roundNumber: round.roundNumber,
    totalRounds: room.totalRounds,
    previewUrl: round.previewUrl,
    answerMode: room.answerMode,
    clipDuration: room.clipDuration,
    answerTime, // extra time after clip to answer
    options: room.answerMode === 'mcq' ? round.options : undefined
  };
}

/**
 * submitAnswer supports:
 *  - MCQ: submitAnswer(code, playerId, { answerId }) OR submitAnswer(code, playerId, answerId)
 *  - TYPED: submitAnswer(code, playerId, { phase: 'artist'|'title', text: '...' })
 */
export function submitAnswer(code, playerId, payload) {
  const room = rooms.get(code);
  if (!room || room.state !== 'playing') return null;

  const round = room.rounds[room.currentRound];
  const player = room.players.find(p => p.id === playerId);
  if (!round || !player) return null;

  const timeTaken = (Date.now() - room.roundStartTime) / 1000;

  // -----------------------
  // MCQ MODE
  // Scoring: 10 base + speed bonus (3 if <3s, 2 if <6s, 1 if <10s)
  // -----------------------
  if (room.answerMode !== 'typed') {
    // Backward compatibility: payload might be a raw answerId string
    const answerId = payload?.answerId ?? payload;

    // Don't allow duplicate answers
    if (room.answers.has(playerId)) return null;

    const isCorrect = answerId === round.correctId;

    let points = 0;
    let speedBonus = 0;
    if (isCorrect) {
      points = 10; // Base points
      // Speed bonus based on time taken
      if (timeTaken < 3) speedBonus = 3;
      else if (timeTaken < 6) speedBonus = 2;
      else if (timeTaken < 10) speedBonus = 1;
      points += speedBonus;
      player.streak++;
    } else {
      player.streak = 0;
    }

    player.score += points;

    room.answers.set(playerId, {
      mode: 'mcq',
      finished: true,
      answerId,
      isCorrect,
      points,
      speedBonus,
      timeTaken
    });

    return {
      mode: 'mcq',
      isCorrect,
      points,
      speedBonus,
      totalScore: player.score,
      streak: player.streak
    };
  }

  // -----------------------
  // TYPED MODE (two-step: artist then title)
  // Scoring: Artist = 10 base + speed bonus, Title = 15 base + speed bonus
  // Speed bonus: 3 if <5s, 2 if <10s, 1 if <15s
  // payload: { phase: 'artist'|'title', text: '...' }
  // -----------------------
  const phase = payload?.phase;
  const text = payload?.text;

  if (phase !== 'artist' && phase !== 'title') return null;

  const existing = room.answers.get(playerId);

  // If no entry yet, only artist phase is allowed
  if (!existing && phase !== 'artist') return null;

  // If already finished, block further submissions
  if (existing?.finished) return null;

  const correctArtist = round.correctArtist;
  const correctTitle = round.correctName;

  // Calculate speed bonus for typed mode
  function getSpeedBonus(time) {
    if (time < 5) return 3;
    if (time < 10) return 2;
    if (time < 15) return 1;
    return 0;
  }

  // --- Phase 1: ARTIST ---
  if (phase === 'artist') {
    // Prevent starting twice
    if (existing) return null;

    const artistCorrect = looselyMatches(text, correctArtist);

    if (!artistCorrect) {
      // Artist wrong => this player is done for the round
      player.streak = 0;

      room.answers.set(playerId, {
        mode: 'typed',
        finished: true,
        artistText: text,
        titleText: null,
        artistCorrect: false,
        titleCorrect: false,
        points: 0,
        speedBonus: 0,
        timeTaken
      });

      return {
        mode: 'typed',
        phase: 'artist',
        isCorrect: false,
        points: 0,
        pointsAwarded: 0,
        speedBonus: 0,
        totalScore: player.score,
        streak: player.streak,
        allowTitle: false
      };
    }

    // Artist correct: 10 base + speed bonus
    const speedBonus = getSpeedBonus(timeTaken);
    const pointsAwarded = 10 + speedBonus;
    player.score += pointsAwarded;

    room.answers.set(playerId, {
      mode: 'typed',
      finished: false, // title still possible
      artistText: text,
      titleText: null,
      artistCorrect: true,
      titleCorrect: false,
      points: pointsAwarded,
      speedBonus,
      artistTime: timeTaken
    });

    return {
      mode: 'typed',
      phase: 'artist',
      isCorrect: true,
      points: pointsAwarded,
      pointsAwarded,
      speedBonus,
      totalScore: player.score,
      streak: player.streak,
      allowTitle: true
    };
  }

  // --- Phase 2: TITLE ---
  // Must have a previous artist-correct entry
  if (!existing || !existing.artistCorrect) return null;

  // Only allow title once
  if (existing.titleText) return null;

  const titleCorrect = looselyMatches(text, correctTitle);

  let pointsAwarded = 0;
  let speedBonus = 0;

  if (titleCorrect) {
    // Title correct: 15 base + speed bonus
    speedBonus = getSpeedBonus(timeTaken);
    pointsAwarded = 15 + speedBonus;
    player.streak++;
  } else {
    player.streak = 0;
  }

  player.score += pointsAwarded;

  const totalRoundPoints = (existing.points || 0) + pointsAwarded;

  room.answers.set(playerId, {
    ...existing,
    finished: true,
    titleText: text,
    titleCorrect,
    points: totalRoundPoints,
    titleSpeedBonus: speedBonus
  });

  return {
    mode: 'typed',
    phase: 'title',
    isCorrect: titleCorrect,
    fullCorrect: !!(existing.artistCorrect && titleCorrect),
    points: pointsAwarded,
    pointsAwarded,
    speedBonus,
    totalScore: player.score,
    streak: player.streak
  };
}

export function allPlayersAnswered(code) {
  const room = rooms.get(code);
  if (!room) return false;

  // In typed mode a player is only "done" when finished=true
  return room.players.every(p => room.answers.get(p.id)?.finished);
}

export function getRoundResults(code) {
  const room = rooms.get(code);
  if (!room || room.state !== 'playing') return null;

  const round = room.rounds[room.currentRound];

  const results = {
    correctId: round.correctId,
    correctName: round.correctName,
    correctArtist: round.correctArtist,
    albumArt: round.albumArt,
    playerResults: room.players
      .map(p => {
        const answer = room.answers.get(p.id);

        // For typed mode, “isCorrect” means full correct (artist+title)
        const isCorrectTyped =
          answer?.mode === 'typed' ? !!(answer.artistCorrect && answer.titleCorrect) : false;

        return {
          id: p.id,
          name: p.name,
          score: p.score,
          roundPoints: answer?.points || 0,
          isCorrect:
            answer?.mode === 'mcq'
              ? (answer?.isCorrect || false)
              : isCorrectTyped,
          streak: p.streak
        };
      })
      .sort((a, b) => b.score - a.score)
  };

  return results;
}

export function nextRound(code) {
  const room = rooms.get(code);
  if (!room || room.state !== 'playing') return null;

  room.currentRound++;

  if (room.currentRound >= room.rounds.length) {
    room.state = 'finished';
    return { finished: true };
  }

  return { finished: false };
}

export function getGameResults(code) {
  const room = rooms.get(code);
  if (!room) return null;

  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];

  return {
    winner: {
      id: winner.id,
      name: winner.name,
      score: winner.score
    },
    standings: sortedPlayers.map((p, i) => ({
      rank: i + 1,
      id: p.id,
      name: p.name,
      score: p.score
    }))
  };
}

export function resetRoom(code) {
  const room = rooms.get(code);
  if (!room) return null;

  room.state = 'lobby';
  room.rounds = [];
  room.currentRound = 0;
  room.answers.clear();
  room.players.forEach(p => {
    p.score = 0;
    p.streak = 0;
  });

  return room;
}
