// Game logic - rounds, scoring, answers

import { getQuizTracks } from './quiz.js';
import { normalize, looselyMatches } from './answerMatcher.js';
import { logGame } from './gameLogger.js';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  updateRoomSettings,
  resetRoom
} from './roomManager.js';

// Re-export room management functions
export { createRoom, joinRoom, leaveRoom, getRoom, updateRoomSettings, resetRoom };

export async function startGame(code, onProgress = null) {
  const room = getRoom(code);
  if (!room || room.state !== 'lobby') return { error: 'Cannot start game' };
  if (room.players.length < 1) return { error: 'Need at least 1 player' };

  try {
    const excludeTrackIds = room.usedTrackIds ? Array.from(room.usedTrackIds) : [];
    room.rounds = await getQuizTracks(
      room.categoryIds,
      room.totalRounds,
      room.difficulty,
      room.musicProvider,
      onProgress,
      excludeTrackIds
    );
    room.state = 'playing';
    room.currentRound = 0;

    // Reset scores
    room.players.forEach(p => {
      p.score = 0;
      p.streak = 0;
    });

    // Track used songs to avoid repeats across games
    room.rounds.forEach(round => {
      if (round?.correctId) {
        room.usedTrackIds.add(round.correctId);
      }
    });

    // Log game for debugging/review
    logGame(code, room.categoryIds, room.rounds, room.players.length);

    return { room };
  } catch (error) {
    return { error: error.message };
  }
}

export function getCurrentRound(code) {
  const room = getRoom(code);
  if (!room || room.state !== 'playing') return null;

  const round = room.rounds[room.currentRound];
  if (!round) return null;

  room.roundStartTime = Date.now();
  room.roundEnded = false;
  room.answers.clear();

  const answerTime = room.answerMode === 'typed' ? 10 : 5;
  const startingLives = room.difficulty === 3 ? 5 : 3;

  return {
    roundNumber: round.roundNumber,
    totalRounds: room.totalRounds,
    previewUrl: round.previewUrl,
    answerMode: room.answerMode,
    clipDuration: room.clipDuration,
    answerTime,
    startingLives,
    options: room.answerMode === 'mcq' ? round.options : undefined
  };
}

export function submitAnswer(code, playerId, payload) {
  const room = getRoom(code);
  if (!room || room.state !== 'playing') return null;

  const round = room.rounds[room.currentRound];
  const player = room.players.find(p => p.id === playerId);
  if (!round || !player) return null;

  const timeTaken = (Date.now() - room.roundStartTime) / 1000;

  // MCQ MODE
  if (room.answerMode !== 'typed') {
    const answerId = payload?.answerId ?? payload;
    if (room.answers.has(playerId)) return null;

    const isCorrect = answerId === round.correctId;
    let points = 0;
    let speedBonus = 0;

    if (isCorrect) {
      points = 10;
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

  // TYPED MODE
  const text = payload?.text;
  if (!text) return null;

  let existing = room.answers.get(playerId);

  if (!existing) {
    // Hard difficulty (3) gets 5 lives, others get 3
    const startingLives = room.difficulty === 3 ? 5 : 3;
    existing = {
      mode: 'typed',
      finished: false,
      lives: startingLives,
      artistCorrect: false,
      titleCorrect: false,
      points: 0,
      comboApplied: false
    };
    room.answers.set(playerId, existing);
  }

  if (existing.finished) return null;

  const correctArtists = round.correctArtists || [round.correctArtist];
  const correctTitle = round.correctName;

  function getSpeedBonus(time) {
    if (time < 5) return 5;
    if (time < 10) return 3;
    if (time < 15) return 1;
    return 0;
  }

  let matchesArtist = !existing.artistCorrect && correctArtists.some(artist => looselyMatches(text, artist));
  let matchesTitle = !existing.titleCorrect && looselyMatches(text, correctTitle);

  // Check if input contains both artist AND title
  if (text.length >= 6 && !existing.artistCorrect && !existing.titleCorrect) {
    const normalizedInput = normalize(text);
    const normalizedTitle = normalize(correctTitle);
    const matchesAnyArtist = correctArtists.some(artist => normalizedInput.includes(normalize(artist)));
    if (matchesAnyArtist && normalizedInput.includes(normalizedTitle)) {
      matchesArtist = true;
      matchesTitle = true;
    }
  }

  // Wrong guess - lose a life
  if (!matchesArtist && !matchesTitle) {
    existing.lives--;
    if (existing.lives <= 0) {
      player.streak = 0;
      existing.finished = true;
    }
    room.answers.set(playerId, existing);

    return {
      mode: 'typed',
      matched: null,
      isCorrect: false,
      fullCorrect: false,
      points: 0,
      pointsAwarded: 0,
      speedBonus: 0,
      totalScore: player.score,
      streak: player.streak,
      livesLeft: existing.lives,
      artistCorrect: existing.artistCorrect,
      titleCorrect: existing.titleCorrect
    };
  }

  // Process artist match
  if (matchesArtist) {
    const speedBonus = getSpeedBonus(timeTaken);
    const pointsAwarded = 10 + speedBonus;
    player.score += pointsAwarded;
    existing.artistText = text;
    existing.artistCorrect = true;
    existing.points = (existing.points || 0) + pointsAwarded;
    existing.artistSpeedBonus = speedBonus;
    existing.artistTime = timeTaken;
  }

  // Process title match
  if (matchesTitle) {
    const speedBonus = getSpeedBonus(timeTaken);
    const pointsAwarded = 15 + speedBonus;
    player.score += pointsAwarded;
    existing.titleText = text;
    existing.titleCorrect = true;
    existing.points = (existing.points || 0) + pointsAwarded;
    existing.titleSpeedBonus = speedBonus;
    existing.titleTime = timeTaken;
  }

  const fullCorrect = existing.artistCorrect && existing.titleCorrect;
  let comboBonus = 0;
  if (fullCorrect) {
    player.streak++;
    existing.finished = true;
    if (!existing.comboApplied) {
      comboBonus = 5;
      player.score += comboBonus;
      existing.points += comboBonus;
      existing.comboApplied = true;
    }
  }

  room.answers.set(playerId, existing);

  const matchedBoth = matchesArtist && matchesTitle;
  const matched = matchedBoth ? 'both' : (matchesArtist ? 'artist' : 'title');
  const pointsAwarded = (matchesArtist ? 10 + (existing.artistSpeedBonus || 0) : 0) +
                        (matchesTitle ? 15 + (existing.titleSpeedBonus || 0) : 0) +
                        comboBonus;

  return {
    mode: 'typed',
    matched,
    isCorrect: true,
    fullCorrect,
    points: existing.points,
    pointsAwarded,
    speedBonus: matchedBoth ? (existing.artistSpeedBonus || 0) + (existing.titleSpeedBonus || 0) :
                (matchesArtist ? existing.artistSpeedBonus : existing.titleSpeedBonus),
    totalScore: player.score,
    streak: player.streak,
    livesLeft: existing.lives,
    artistCorrect: existing.artistCorrect,
    titleCorrect: existing.titleCorrect
  };
}

export function allPlayersAnswered(code) {
  const room = getRoom(code);
  if (!room) return false;
  return room.players.every(p => room.answers.get(p.id)?.finished);
}

export function canEndRound(code) {
  const room = getRoom(code);
  if (!room || room.state !== 'playing') return false;
  if (room.roundEnded) return false;
  room.roundEnded = true;
  return true;
}

export function getRoundResults(code) {
  const room = getRoom(code);
  if (!room || room.state !== 'playing') return null;

  const round = room.rounds[room.currentRound];

  return {
    correctId: round.correctId,
    correctName: round.correctName,
    correctArtist: round.correctArtist,
    correctYear: round.correctYear,
    albumArt: round.albumArt,
    playerResults: room.players
      .map(p => {
        const answer = room.answers.get(p.id);
        const isCorrectTyped = answer?.mode === 'typed' ? !!(answer.artistCorrect && answer.titleCorrect) : false;

        return {
          id: p.id,
          name: p.name,
          score: p.score,
          roundPoints: answer?.points || 0,
          isCorrect: answer?.mode === 'mcq' ? (answer?.isCorrect || false) : isCorrectTyped,
          streak: p.streak
        };
      })
      .sort((a, b) => b.score - a.score)
  };
}

export function nextRound(code) {
  const room = getRoom(code);
  if (!room || room.state !== 'playing') return null;

  room.currentRound++;

  if (room.currentRound >= room.rounds.length) {
    room.state = 'finished';
    return { finished: true };
  }

  return { finished: false };
}

export function getGameResults(code) {
  const room = getRoom(code);
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
    })),
    rounds: room.rounds.map(r => ({
      artist: r.correctArtist,
      title: r.correctName
    }))
  };
}

