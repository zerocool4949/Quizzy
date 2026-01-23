import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';

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
  const [lives, setLives] = useState(null);
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
      setLives(currentRound?.startingLives ?? null);
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
        <div className="card text-center max-w-md w-full animate-fade-up">
          <h2 className="text-2xl font-bold mb-6">Setting up quiz...</h2>

          {/* Progress bar */}
          {progress.phase === 'artists' && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>Fetching tracks</span>
                <span>{percent}%</span>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Building phase */}
          {progress.phase === 'building' && (
            <p className="text-slate-300 mb-6">
              Building quiz...
            </p>
          )}

          {/* Spinner */}
          <div className="flex justify-center">
            <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'countdown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="card text-center animate-fade-up">
          <h2 className="text-4xl font-bold mb-4">Get Ready!</h2>
          <div className="text-8xl font-bold text-teal-400 animate-pulse">{countdown}</div>
        </div>
      </div>
    );
  }

  if (gameState === 'finished' && gameResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="card max-w-lg w-full text-center animate-fade-up">
          <h2 className="text-3xl font-bold mb-2">Game Over!</h2>
          <div className="my-8">
            <p className="text-slate-400 mb-2">Winner</p>
            <p className="text-4xl font-bold text-amber-300 animate-bounce-in">
              {gameResults.winner.name}
            </p>
            <p className="text-2xl text-teal-300 mt-2">
              {gameResults.winner.score.toLocaleString()} points
            </p>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 text-slate-300">Final Standings</h3>
            <div className="space-y-2">
              {gameResults.standings.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                    player.rank === 1
                      ? 'bg-amber-500/20 border border-amber-400/50'
                      : player.rank === 2
                      ? 'bg-slate-400/20 border border-slate-300/40'
                      : player.rank === 3
                      ? 'bg-orange-500/20 border border-orange-400/50'
                      : 'bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-slate-400">#{player.rank}</span>
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <span className="font-bold text-teal-300">
                    {player.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {isHost && (
              <button onClick={playAgain} className="btn-primary w-full">
                Play Again
              </button>
            )}
            <button onClick={leaveGame} className="btn-secondary w-full">
              Leave Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'roundEnd' && roundResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="card max-w-lg w-full animate-fade-up">
          <div className="text-center mb-6">
            <p className="text-slate-400 text-xs uppercase tracking-[0.3em] mb-3">Answer Reveal</p>
            <div className="flex flex-col items-center gap-4 bg-slate-900/50 rounded-2xl p-5 border border-teal-500/20">
              <div className="relative">
                <div className="absolute -inset-3 rounded-3xl bg-teal-500/20 blur-xl"></div>
                {roundResults.albumArt ? (
                  <img
                    src={roundResults.albumArt}
                    alt="Album art"
                    className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-3xl border border-teal-400/40"
                  />
                ) : (
                  <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-3xl bg-slate-800/60 border border-teal-500/30 flex items-center justify-center text-slate-400 text-sm">
                    No cover
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-teal-200">{roundResults.correctName}</p>
                <p className="text-slate-300">{roundResults.correctArtist}</p>
                {roundResults.correctYear && (
                  <span className="inline-flex mt-3 px-2.5 py-1 rounded-full text-xs text-slate-300 bg-slate-800/70 border border-slate-700">
                    {roundResults.correctYear}
                  </span>
                )}
              </div>
            </div>
          </div>

          {answerResult && (
            <div
              className={`text-center p-4 rounded-xl mb-6 ${
                answerResult.points > 0 ? 'bg-emerald-600/20' : 'bg-rose-600/20'
              }`}
            >
              <p className="text-2xl font-bold">
                {answerResult.points > 0 ? '+' + answerResult.points : 'No points'}
              </p>
              {answerResult.mode === 'typed' && !answerResult.fullCorrect && answerResult.points > 0 && (
                <p className="text-slate-300 text-sm">
                  {answerResult.artistCorrect && !answerResult.titleCorrect && 'Artist only'}
                  {answerResult.titleCorrect && !answerResult.artistCorrect && 'Title only'}
                </p>
              )}
              {answerResult.streak > 1 && (
                <p className="text-amber-300 text-sm">{answerResult.streak} streak!</p>
              )}
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-3 text-slate-300">Scoreboard</h3>
            <div className="space-y-2">
              {roundResults.playerResults.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between bg-slate-800/60 rounded-lg px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-bold">#{index + 1}</span>
                    <span>{player.name}</span>
                    {player.roundPoints > 0 && (
                      <span className="text-emerald-300 text-sm">+{player.roundPoints}</span>
                    )}
                  </div>
                  <span className="font-bold text-teal-300">
                    {player.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-slate-400 mt-6">Next round starting...</p>
        </div>
      </div>
    );
  }

  // Sort players by score for live scoreboard
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // Playing state
  return (
    <div className="min-h-screen flex flex-col p-4">
      <audio ref={audioRef} />

      <div className="w-full max-w-4xl mx-auto">
        {/* Round progression bar at top */}
        <div className="w-full md:max-w-lg mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-400">Round Progress</span>
            <span className="text-sm text-slate-400">
              {currentRound?.roundNumber}/{currentRound?.totalRounds}
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: currentRound?.totalRounds || 10 }).map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all ${
                  i < (currentRound?.roundNumber || 1) - 1
                    ? 'bg-emerald-400'
                    : i === (currentRound?.roundNumber || 1) - 1
                    ? 'bg-teal-400'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full">
        {/* Main game card */}
        <div className="card flex-1 md:max-w-lg animate-fade-up">
          {/* Big Timer */}
          <div className="text-center mb-6">
            <div
              className={`text-6xl font-bold tabular-nums ${
                timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-teal-300'
              }`}
            >
              {timeLeft}
            </div>
            <span className="text-slate-400 text-sm">seconds left</span>
          </div>

          {/* Song progress bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-400">
                {songProgress < 100 ? 'Playing...' : 'Song ended'}
              </span>
              <span className="text-xs text-slate-400">{clipDuration}s clip</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  songProgress >= 100 ? 'bg-slate-500' : 'bg-teal-500'
                }`}
                style={{ width: `${songProgress}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 bg-teal-600/30 rounded-full flex items-center justify-center mb-3">
              <div className={`w-14 h-14 bg-teal-500/40 rounded-full flex items-center justify-center ${songProgress < 100 ? 'animate-pulse' : ''}`}>
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
              <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
              <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          <p className="text-center text-slate-300 mb-4">What song is this?</p>

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
                    className={`p-4 rounded-xl text-left transition-all border ${
                      showResult
                        ? answerResult.isCorrect
                          ? 'bg-emerald-600/30 border-emerald-500'
                          : 'bg-rose-600/30 border-rose-500'
                        : isSelected
                        ? 'bg-teal-600/30 border-teal-500'
                        : 'bg-slate-800/60 hover:bg-slate-700/60 border-slate-700'
                    } ${myAnswer && !isSelected ? 'opacity-50' : ''}`}
                  >
                    <p className="font-semibold">{option.name}</p>
                    <p className="text-sm text-slate-300">{option.artist}</p>
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
                  artistCorrect ? 'bg-emerald-600/30 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  Artist {artistCorrect ? '✓' : '?'}
                </div>
                <div className={`px-3 py-1 rounded-full text-sm ${
                  titleCorrect ? 'bg-emerald-600/30 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  Title {titleCorrect ? '✓' : '?'}
                </div>
              </div>

              {/* Lives display */}
            {!(artistCorrect && titleCorrect) && lives > 0 && (
              <div className="flex justify-center gap-2 mb-2">
                {Array.from({ length: Math.max(lives, 0) }).map((_, i) => (
                  <svg
                    key={i}
                    className={`w-6 h-6 transition-all ${
                      i < lives ? 'text-rose-400' : 'text-slate-700'
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
                <div className="text-center text-emerald-300 text-sm">
                  +{totalPoints} points
                </div>
              )}

              {/* Single input for artist or title */}
              {!(artistCorrect && titleCorrect) && lives > 0 && (
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
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
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-teal-400"
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
                  <div className="p-4 rounded-xl bg-emerald-600/20">
                    <p className="text-lg font-bold">Perfect!</p>
                    <p className="text-emerald-300">+{totalPoints} points</p>
                  </div>
                </div>
              )}

              {lives === 0 && !(artistCorrect && titleCorrect) && (
                <div className="text-center">
                  <div className="p-4 rounded-xl bg-rose-600/20">
                    <p className="text-lg font-bold">Out of lives!</p>
                    {totalPoints > 0 && (
                      <p className="text-emerald-300">+{totalPoints} points</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {myAnswer && !answerResult && currentRound?.answerMode !== 'typed' && (
            <p className="text-center text-slate-400 mt-4">Waiting for other players...</p>
          )}
        </div>

        {/* Live Scoreboard */}
        <div className="w-full md:w-56 shrink-0 order-first md:order-last mb-4 md:mb-0">
          <div className="card md:sticky md:top-4 animate-fade-up">
            <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
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
                    index === 0 ? 'bg-amber-500/20' : 'bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-bold ${index === 0 ? 'text-amber-300' : 'text-slate-500'}`}>
                      {index + 1}
                    </span>
                    <span className="truncate">{player.name}</span>
                  </div>
                  <span className="font-bold text-teal-300 ml-2">
                    {player.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            {/* Exit button */}
            <button
              onClick={leaveGame}
              className="w-full mt-4 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-rose-600/50 rounded-lg transition-colors"
            >
              Leave Game
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
