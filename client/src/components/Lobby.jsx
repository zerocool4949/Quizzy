import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

// In production, use same origin. In dev, use localhost:3001
const API_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const ANSWER_MODES = [
  { id: 'typed', name: 'Type it (Artist then Title)' },
  { id: 'mcq', name: '4 answers (multiple choice)' },
];

const DIFFICULTY_LEVELS = [
  { id: 1, name: 'Easy', description: 'Top 1 hit per artist' },
  { id: 2, name: 'Medium', description: 'Top 3 hits per artist' },
  { id: 3, name: 'Hard', description: 'Top 10 hits per artist' },
];

export default function Lobby() {
  const { roomCode, players, isHost, startGame, leaveGame, gameState, updateSettings } = useGame();
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [musicProvider, setMusicProvider] = useState('deezer');
  const [answerMode, setAnswerMode] = useState(ANSWER_MODES[0].id);
  const [difficulty, setDifficulty] = useState(1);
  const [rounds, setRounds] = useState(10);
  const [countdown, setCountdown] = useState(3);

  // Countdown timer effect
  useEffect(() => {
    if (gameState === 'countdown') {
      setCountdown(3);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 1;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState]);

  // Fetch categories and providers from server
  useEffect(() => {
    fetch(`${API_URL}/api/categories`)
      .then(res => res.json())
      .then(data => {
        setCategories(data);
        // Select first category by default if none selected
        if (data.length > 0 && selectedCategories.length === 0) {
          setSelectedCategories([data[0].id]);
        }
      })
      .catch(err => console.error('Failed to fetch categories:', err));

    fetch(`${API_URL}/api/providers`)
      .then(res => res.json())
      .then(data => setProviders(data))
      .catch(err => console.error('Failed to fetch providers:', err));
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        // Don't allow deselecting if it's the only one
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  };

  const handleStartGame = () => {
    if (selectedCategories.length === 0) return;
    updateSettings({
      categoryIds: selectedCategories,
      answerMode,
      difficulty,
      totalRounds: rounds,
      musicProvider
    });
    startGame();
  };

  if (gameState === 'countdown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="card text-center">
          <h2 className="text-4xl font-bold mb-4">Get Ready!</h2>
          <div className="text-8xl font-bold text-purple-500 animate-pulse" key={countdown}>
            {countdown}
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

            {/* Rounds Selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Rounds: <span className="text-purple-400 font-bold">{rounds}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[10, 15, 20].map((num) => (
                  <button
                    key={num}
                    onClick={() => setRounds(num)}
                    className={`px-3 py-2 rounded-xl text-center border transition-colors ${
                      rounds === num
                        ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                        : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 text-gray-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Level Selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Difficulty</label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTY_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setDifficulty(level.id)}
                    className={`px-3 py-2 rounded-xl text-center border transition-colors ${
                      difficulty === level.id
                        ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                        : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 text-gray-200'
                    }`}
                  >
                    <div className="font-medium">{level.name}</div>
                    <div className="text-xs text-gray-400 mt-1">{level.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Music Provider Selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Music Source</label>
              <div className="grid grid-cols-2 gap-2">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setMusicProvider(provider.id)}
                    className={`px-3 py-2 rounded-xl text-center border transition-colors ${
                      musicProvider === provider.id
                        ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                        : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 text-gray-200'
                    }`}
                  >
                    <div className="font-medium">{provider.name}</div>
                    <div className="text-xs text-gray-400 mt-1">{provider.description}</div>
                  </button>
                ))}
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

            {/* Category Selector - Multi-select checkboxes */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Music Categories <span className="text-purple-400">({selectedCategories.length} selected)</span>
              </label>
              <div className="max-h-48 overflow-y-auto bg-gray-800 rounded-xl border border-gray-600 p-2 grid grid-cols-2 gap-2">
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedCategories.includes(category.id)
                        ? 'bg-purple-600/30 text-purple-200'
                        : 'hover:bg-gray-700 text-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                      className="w-4 h-4 rounded border-gray-500 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                    />
                    <span className="text-sm truncate">{category.name}</span>
                  </label>
                ))}
              </div>
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
