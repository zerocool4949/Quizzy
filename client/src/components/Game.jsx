import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import RoundReveal from './RoundReveal';
import GameOver from './GameOver';

export default function Game() {
  const {
    gameState,
    currentRound,
    roundResults,
    gameResults,
    myAnswer,
    answerResult,
    loadingProgress,
    submitAnswer,
    submitTypedAnswer,
    playAgain,
    leaveGame,
    isHost,
    players,
  } = useGame();

  const audioRef = useRef(null);
  const volumeRef = useRef(0.7);
  const audioTimeoutRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [songProgress, setSongProgress] = useState(0);
  const [countdown, setCountdown] = useState(3);

  // Typed mode state
  const [typedInput, setTypedInput] = useState('');
  const [artistCorrect, setArtistCorrect] = useState(false);
  const [titleCorrect, setTitleCorrect] = useState(false);
  const [lives, setLives] = useState(3); // 3 lives for typed mode
  const [totalPoints, setTotalPoints] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('quizzy-volume');
    const vol = saved ? parseFloat(saved) : 0.7;
    volumeRef.current = vol;
    return vol;
  });
  const clipDuration = currentRound?.clipDuration || 10;

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    volumeRef.current = newVolume;
    localStorage.setItem('quizzy-volume', newVolume.toString());
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Countdown timer for "Get Ready" screen
  useEffect(() => {
    if (gameState === 'countdown') {
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 1;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState]);

  // Reset typed mode state when new round starts
  useEffect(() => {
    if (gameState === 'playing') {
      setTypedInput('');
      setArtistCorrect(false);
      setTitleCorrect(false);
      setLives(3);
      setTotalPoints(0);
    }
  }, [gameState, currentRound?.roundNumber]);

  // Handle typed answer results
  useEffect(() => {
    if (answerResult?.mode === 'typed') {
      // Update state from server response
      if (typeof answerResult.livesLeft === 'number') {
        setLives(answerResult.livesLeft);
      }
      if (typeof answerResult.artistCorrect === 'boolean') {
        setArtistCorrect(answerResult.artistCorrect);
      }
      if (typeof answerResult.titleCorrect === 'boolean') {
        setTitleCorrect(answerResult.titleCorrect);
      }
      if (typeof answerResult.points === 'number') {
        setTotalPoints(answerResult.points);
      }
      // Clear input for next guess
      setTypedInput('');
    }
  }, [answerResult]);

  // Play audio when new round starts
  useEffect(() => {
    // Clear any existing timeout from previous round
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = null;
    }

    if (gameState === 'playing' && currentRound?.previewUrl) {
      const duration = currentRound.clipDuration || 10;
      const answerTime = currentRound.answerTime || 5;
      setTimeLeft(duration + answerTime); // clip duration + answer time
      setSongProgress(0);
      if (audioRef.current) {
        audioRef.current.src = currentRound.previewUrl;
        audioRef.current.volume = volumeRef.current; // Use ref to avoid re-triggering effect
        audioRef.current.play().catch(() => {});

        // Stop audio after clip duration
        audioTimeoutRef.current = setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.pause();
          }
        }, duration * 1000);
      }
    }

    // Cleanup on unmount or when effect re-runs
    return () => {
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
    };
  }, [gameState, currentRound]);

  // Song progress tracker
  useEffect(() => {
    if (gameState !== 'playing') return;

    const duration = currentRound?.clipDuration || 10;
    const startTime = Date.now();

    const progressTimer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setSongProgress(progress);

      if (progress >= 100) {
        clearInterval(progressTimer);
      }
    }, 50);

    return () => clearInterval(progressTimer);
  }, [gameState, currentRound]);

  // Countdown timer
  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, currentRound]);

  // Stop audio when round ends
  useEffect(() => {
    if (gameState === 'roundEnd' && audioRef.current) {
      audioRef.current.pause();
    }
  }, [gameState]);

  if (gameState === 'loading') {
    const progress = loadingProgress || {};
    const percent = progress.phase === 'artists' && progress.total
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="card text-center max-w-md w-full">
          <h2 className="text-2xl font-bold mb-6">Setting up quiz...</h2>

          {/* Progress bar */}
          {progress.phase === 'artists' && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Fetching tracks</span>
                <span>{percent}%</span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Building phase */}
          {progress.phase === 'building' && (
            <p className="text-gray-400 mb-6">
              Building quiz...
            </p>
          )}

          {/* Spinner */}
          <div className="flex justify-center">
            <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'countdown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="card text-center">
          <h2 className="text-4xl font-bold mb-4">Get Ready!</h2>
          <div className="text-8xl font-bold text-sky-500 animate-pulse">{countdown}</div>
        </div>
      </div>
    );
  }

  if (gameState === 'finished' && gameResults) {
    return <GameOver gameResults={gameResults} isHost={isHost} playAgain={playAgain} leaveGame={leaveGame} />;
  }

  if (gameState === 'roundEnd' && roundResults) {
    return <RoundReveal roundResults={roundResults} answerResult={answerResult} />;
  }

  // Sort players by score for live scoreboard
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // Playing state
  return (
    <div className="min-h-screen flex flex-col p-4">
      <audio ref={audioRef} />

      {/* Round progression bar at top */}
      <div className="w-full max-w-4xl mx-auto mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Round Progress</span>
          <span className="text-sm text-gray-400">
            {currentRound?.roundNumber}/{currentRound?.totalRounds}
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: currentRound?.totalRounds || 10 }).map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-all ${
                i < (currentRound?.roundNumber || 1) - 1
                  ? 'bg-green-500'
                  : i === (currentRound?.roundNumber || 1) - 1
                  ? 'bg-sky-500'
                  : 'bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 max-w-4xl mx-auto w-full">
        {/* Main game card */}
        <div className="card flex-1 md:max-w-lg">
          {/* Big Timer */}
        <div className="text-center mb-6">
          <div
            className={`text-6xl font-bold tabular-nums ${
              timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-sky-400'
            }`}
          >
            {timeLeft}
          </div>
          <span className="text-gray-500 text-sm">seconds left</span>
        </div>

        {/* Song progress bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500">
              {songProgress < 100 ? 'Playing...' : 'Song ended'}
            </span>
            <span className="text-xs text-gray-500">{clipDuration}s clip</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                songProgress >= 100 ? 'bg-gray-500' : 'bg-sky-500'
              }`}
              style={{ width: `${songProgress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 bg-sky-600/30 rounded-full flex items-center justify-center mb-3">
            <div className={`w-14 h-14 bg-sky-500/50 rounded-full flex items-center justify-center ${songProgress < 100 ? 'animate-pulse' : ''}`}>
              <svg
                className="w-7 h-7 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
              </svg>
            </div>
          </div>
          {/* Volume slider */}
          <div className="flex items-center gap-2 w-36">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        <p className="text-center text-gray-400 mb-4">What song is this?</p>

        {/* MCQ Mode */}
        {currentRound?.answerMode !== 'typed' && (
          <div className="grid grid-cols-1 gap-3">
            {currentRound?.options?.map((option) => {
              const isSelected = myAnswer === option.id;
              const showResult = answerResult && isSelected;

              return (
                <button
                  key={option.id}
                  onClick={() => !myAnswer && submitAnswer(option.id)}
                  disabled={!!myAnswer}
                  className={`p-4 rounded-xl text-left transition-all ${
                    showResult
                      ? answerResult.isCorrect
                        ? 'bg-green-600 border-green-500'
                        : 'bg-red-600 border-red-500'
                      : isSelected
                      ? 'bg-sky-600 border-sky-500'
                      : 'bg-gray-700/50 hover:bg-gray-600/50 border-gray-600'
                  } border-2 ${myAnswer && !isSelected ? 'opacity-50' : ''}`}
                >
                  <p className="font-semibold">{option.name}</p>
                  <p className="text-sm text-gray-300">{option.artist}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Typed Mode */}
        {currentRound?.answerMode === 'typed' && (
          <div className="space-y-4">
            {/* Status indicators for artist and title */}
            <div className="flex justify-center gap-4 mb-2">
              <div className={`px-3 py-1 rounded-full text-sm ${
                artistCorrect ? 'bg-green-600/30 text-green-400' : 'bg-gray-700 text-gray-400'
              }`}>
                Artist {artistCorrect ? '✓' : '?'}
              </div>
              <div className={`px-3 py-1 rounded-full text-sm ${
                titleCorrect ? 'bg-green-600/30 text-green-400' : 'bg-gray-700 text-gray-400'
              }`}>
                Title {titleCorrect ? '✓' : '?'}
              </div>
            </div>

            {/* Lives display */}
            {!(artistCorrect && titleCorrect) && lives > 0 && (
              <div className="flex justify-center gap-2 mb-2">
                {[0, 1, 2].map((i) => (
                  <svg
                    key={i}
                    className={`w-6 h-6 transition-all ${
                      i < lives ? 'text-red-500' : 'text-gray-600'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                      clipRule="evenodd"
                    />
                  </svg>
                ))}
              </div>
            )}

            {/* Points earned so far */}
            {totalPoints > 0 && (
              <div className="text-center text-green-400 text-sm">
                +{totalPoints} points
              </div>
            )}

            {/* Single input for artist or title */}
            {!(artistCorrect && titleCorrect) && lives > 0 && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {!artistCorrect && !titleCorrect && 'Type the artist or song title'}
                  {artistCorrect && !titleCorrect && 'Now guess the song title'}
                  {!artistCorrect && titleCorrect && 'Now guess the artist'}
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!typedInput.trim()) return;
                    submitTypedAnswer(null, typedInput.trim());
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={typedInput}
                    onChange={(e) => setTypedInput(e.target.value)}
                    placeholder="Type your answer..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!typedInput.trim()}
                    className="btn-primary px-6"
                  >
                    Submit
                  </button>
                </form>
              </div>
            )}

            {/* Done - both correct or out of lives */}
            {(artistCorrect && titleCorrect) && (
              <div className="text-center">
                <div className="p-4 rounded-xl bg-green-600/20">
                  <p className="text-lg font-bold">Perfect!</p>
                  <p className="text-green-400">+{totalPoints} points</p>
                </div>
              </div>
            )}

            {lives === 0 && !(artistCorrect && titleCorrect) && (
              <div className="text-center">
                <div className="p-4 rounded-xl bg-red-600/20">
                  <p className="text-lg font-bold">Out of lives!</p>
                  {totalPoints > 0 && (
                    <p className="text-green-400">+{totalPoints} points</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {myAnswer && !answerResult && currentRound?.answerMode !== 'typed' && (
          <p className="text-center text-gray-400 mt-4">Waiting for other players...</p>
        )}
        </div>

        {/* Live Scoreboard */}
        <div className="w-full md:w-56 shrink-0 order-first md:order-last mb-4 md:mb-0">
          <div className="bg-gray-800/50 rounded-xl p-4 md:sticky md:top-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Live Scores
              </h3>
              <div className="space-y-2">
                {sortedPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      index === 0 ? 'bg-yellow-600/20' : 'bg-gray-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-bold ${index === 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {index + 1}
                      </span>
                      <span className="truncate">{player.name}</span>
                    </div>
                    <span className="font-bold text-sky-400 ml-2">
                      {player.score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              {/* Exit button */}
              <button
                onClick={leaveGame}
                className="w-full mt-4 px-3 py-2 text-xs text-gray-400 hover:text-white bg-gray-700/50 hover:bg-red-600/50 rounded-lg transition-colors"
              >
                Leave Game
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}
