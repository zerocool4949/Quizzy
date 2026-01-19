import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

// In production, use same origin. In dev, use localhost:3001
const API_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const ANSWER_MODES = [
  { id: 'mcq', name: '4 answers (multiple choice)' },
  { id: 'typed', name: 'Type it (Artist then Title)' },
];

export default function Lobby() {
  const { roomCode, players, isHost, startGame, leaveGame, gameState, updateSettings } = useGame();
  const [clipDuration, setClipDuration] = useState(10);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [answerMode, setAnswerMode] = useState(ANSWER_MODES[0].id);
  const [showGenreList, setShowGenreList] = useState(false);

  // Fetch genres from server
  useEffect(() => {
    fetch(`${API_URL}/api/genres`)
      .then(res => res.json())
      .then(data => {
        setGenres(data);
        if (data.length > 0 && !selectedGenre) {
          setSelectedGenre(data[0]);
        }
      })
      .catch(err => console.error('Failed to fetch genres:', err));
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  const handleStartGame = () => {
    if (!selectedGenre) return;
    updateSettings({
      clipDuration,
      genreId: selectedGenre.id,
      answerMode
    });
    startGame();
  };

  if (gameState === 'countdown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="card text-center">
          <h2 className="text-4xl font-bold mb-4">Get Ready!</h2>
          <div className="text-8xl font-bold text-purple-500 animate-pulse">
            3
          </div>
          <p className="text-gray-400 mt-4">Game starting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card max-w-lg w-full">
        <div className="text-center mb-6">
          <p className="text-gray-400 mb-2">Room Code</p>
          <button
            onClick={copyCode}
            className="text-4xl font-bold tracking-widest text-purple-400 hover:text-purple-300 transition-colors"
            title="Click to copy"
          >
            {roomCode}
          </button>
          <p className="text-gray-500 text-sm mt-2">Click to copy</p>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-300">
            Players ({players.length}/8)
          </h3>
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-3"
              >
                <span className="font-medium">{player.name}</span>
                {player.isHost && (
                  <span className="text-xs bg-purple-600 px-2 py-1 rounded-full">HOST</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isHost && (
          <div className="mb-6 p-4 bg-gray-700/30 rounded-xl space-y-5">
            <h3 className="text-lg font-semibold text-gray-300">Game Settings</h3>

            {/* Clip Duration Slider */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Clip Duration: <span className="text-purple-400 font-bold">{clipDuration}s</span>
              </label>
              <input
                type="range"
                min="5"
                max="15"
                value={clipDuration}
                onChange={(e) => setClipDuration(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>5s</span>
                <span>10s</span>
                <span>15s</span>
              </div>
            </div>
              {/* Answer Mode Selector */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Answer Mode</label>
                <div className="grid grid-cols-1 gap-2">
                  {ANSWER_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setAnswerMode(m.id)}
                      className={`w-full px-4 py-3 rounded-xl text-left border transition-colors ${
                        answerMode === m.id
                          ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                          : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 text-gray-200'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

            {/* Genre Selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Music Genre</label>
              <button
                onClick={() => setShowGenreList(!showGenreList)}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-left flex justify-between items-center hover:bg-gray-600/50 transition-colors"
              >
                <span>{selectedGenre?.name || 'Loading...'}</span>
                <svg
                  className={`w-5 h-5 transition-transform ${showGenreList ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showGenreList && (
                <div className="mt-2 max-h-48 overflow-y-auto bg-gray-800 rounded-xl border border-gray-600">
                  {genres.map((genre) => (
                    <button
                      key={genre.id}
                      onClick={() => {
                        setSelectedGenre(genre);
                        setShowGenreList(false);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-700 transition-colors ${
                        selectedGenre?.id === genre.id ? 'bg-purple-600/30 text-purple-300' : ''
                      }`}
                    >
                      {genre.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!isHost && (
          <div className="mb-6 p-4 bg-gray-700/30 rounded-xl text-center text-gray-400">
            Waiting for host to configure and start...
          </div>
        )}

        <div className="space-y-3">
          {isHost ? (
            <button
              onClick={handleStartGame}
              className="btn-primary w-full text-lg"
              disabled={players.length < 1}
            >
              Start Game
            </button>
          ) : null}
          <button onClick={leaveGame} className="btn-secondary w-full">
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
