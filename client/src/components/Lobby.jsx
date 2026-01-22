import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

// In production, use same origin. In dev, use localhost:3001
const API_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

export default function Lobby() {
  const { roomCode, players, isHost, startGame, leaveGame, gameState, updateSettings, roomSettings } = useGame();
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [musicProvider, setMusicProvider] = useState('spotify');
  const [answerMode, setAnswerMode] = useState('typed');
  const [difficulty, setDifficulty] = useState(2);
  const [rounds, setRounds] = useState(10);
  const [countdown, setCountdown] = useState(3);

  // Playlist import state
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

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

  // Fetch categories from server
  const fetchCategories = () => {
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
  };

  // Fetch categories and providers from server
  useEffect(() => {
    fetchCategories();

    // Auto-select best provider (spotify if available)
    fetch(`${API_URL}/api/providers`)
      .then(res => res.json())
      .then(data => {
        const spotify = data.find(p => p.id === 'spotify');
        if (spotify) setMusicProvider('spotify');
        else if (data.length > 0) setMusicProvider(data[0].id);
      })
      .catch(err => console.error('Failed to fetch providers:', err));
  }, []);

  // Import Spotify playlist
  const handleImportPlaylist = async () => {
    if (!importUrl.trim()) return;

    setImportLoading(true);
    setImportError('');

    try {
      const res = await fetch(`${API_URL}/api/playlists/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl })
      });

      const data = await res.json();

      if (!res.ok) {
        setImportError(data.error || 'Failed to import playlist');
        return;
      }

      // Refresh categories and select the new one
      fetchCategories();
      setSelectedCategories(prev => [...prev, data.categoryId]);
      setImportUrl('');
      setShowImport(false);
    } catch (err) {
      setImportError('Failed to import playlist');
    } finally {
      setImportLoading(false);
    }
  };

  // Delete imported playlist
  const handleDeletePlaylist = async (categoryId, e) => {
    e.stopPropagation();

    if (!confirm('Delete this imported playlist?')) return;

    try {
      const res = await fetch(`${API_URL}/api/playlists/${categoryId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        // Remove from selection if selected
        setSelectedCategories(prev => prev.filter(id => id !== categoryId));
        // Refresh categories
        fetchCategories();
      }
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  };

  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const joinUrl = `${window.location.origin}/join/${roomCode}`;

    // Use fallback method that works on both HTTP and HTTPS
    const textArea = document.createElement('textarea');
    textArea.value = joinUrl;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      setCopied(true);
    } catch (err) {
      console.error('Copy failed:', err);
      // Try clipboard API as last resort
      navigator.clipboard?.writeText(joinUrl).then(() => setCopied(true));
    }

    document.body.removeChild(textArea);
    setTimeout(() => setCopied(false), 2000);
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

  // Broadcast settings to other players whenever host changes them (debounced)
  useEffect(() => {
    if (!isHost || selectedCategories.length === 0) return;

    const timeout = setTimeout(() => {
      updateSettings({
        categoryIds: selectedCategories,
        answerMode,
        difficulty,
        totalRounds: rounds,
        musicProvider
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [isHost, selectedCategories, answerMode, difficulty, rounds, musicProvider, updateSettings]);

  const handleStartGame = () => {
    if (selectedCategories.length === 0) return;
    startGame();
  };

  if (gameState === 'countdown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="card text-center">
          <h2 className="text-4xl font-bold mb-4">Get Ready!</h2>
          <div className="text-8xl font-bold text-sky-500 animate-pulse" key={countdown}>
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
            onClick={copyLink}
            className="text-4xl font-bold tracking-widest text-sky-400 hover:text-sky-300 transition-colors"
            title="Click to copy invite link"
          >
            {roomCode}
          </button>
          <p className="text-gray-500 text-sm mt-2">
            {copied ? 'Link copied!' : 'Click to copy invite link'}
          </p>
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
                  <span className="text-xs bg-sky-600 px-2 py-1 rounded-full">HOST</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isHost && (
          <div className="mb-6 p-4 bg-gray-700/30 rounded-xl space-y-4">
            {/* Compact row: Rounds + Difficulty + Mode */}
            <div className="flex gap-3">
              {/* Rounds */}
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Rounds</label>
                <div className="flex gap-1">
                  {[10, 15, 20].map((num) => (
                    <button
                      key={num}
                      onClick={() => setRounds(num)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-sm border transition-colors ${
                        rounds === num
                          ? 'bg-sky-600/30 border-sky-500 text-sky-200'
                          : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 text-gray-300'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Difficulty</label>
                <div className="flex gap-1">
                  {[
                    { id: 1, name: 'Easy' },
                    { id: 2, name: 'Med' },
                    { id: 3, name: 'Hard' },
                  ].map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setDifficulty(level.id)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-sm border transition-colors ${
                        difficulty === level.id
                          ? 'bg-sky-600/30 border-sky-500 text-sky-200'
                          : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 text-gray-300'
                      }`}
                    >
                      {level.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Answer Mode Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">Mode:</span>
              <div className="flex flex-1 bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setAnswerMode('typed')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    answerMode === 'typed'
                      ? 'bg-sky-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Type Answer
                </button>
                <button
                  onClick={() => setAnswerMode('mcq')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    answerMode === 'mcq'
                      ? 'bg-sky-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Multiple Choice
                </button>
              </div>
            </div>

            {/* Category Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-400">
                  Categories <span className="text-sky-400">({selectedCategories.length})</span>
                </label>
                <button
                  onClick={() => setShowImport(!showImport)}
                  className="text-xs px-2 py-0.5 rounded bg-green-600/30 text-green-300 hover:bg-green-600/50 transition-colors"
                >
                  + Import
                </button>
              </div>

              {/* Import Playlist Form */}
              {showImport && (
                <div className="mb-2 p-2 bg-gray-800 rounded-lg border border-gray-600">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="Spotify playlist URL..."
                      className="flex-1 px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={handleImportPlaylist}
                      disabled={importLoading || !importUrl.trim()}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {importLoading ? '...' : 'Add'}
                    </button>
                  </div>
                  {importError && (
                    <p className="text-xs text-red-400 mt-1">{importError}</p>
                  )}
                </div>
              )}

              {/* Single column list for better readability */}
              <div className="max-h-40 overflow-y-auto bg-gray-800 rounded-lg border border-gray-600 divide-y divide-gray-700">
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group ${
                      selectedCategories.includes(category.id)
                        ? 'bg-sky-600/20'
                        : 'hover:bg-gray-700/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                      className="w-4 h-4 rounded border-gray-500 text-sky-500 focus:ring-sky-500 focus:ring-offset-gray-800 shrink-0"
                    />
                    <span className={`text-sm flex-1 ${
                      selectedCategories.includes(category.id) ? 'text-sky-200' : 'text-gray-300'
                    }`}>
                      {category.name}
                      {category.imported && (
                        <span className="ml-1.5 text-xs text-green-400/80">imported</span>
                      )}
                    </span>
                    {category.imported && (
                      <button
                        onClick={(e) => handleDeletePlaylist(category.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs px-1 transition-opacity"
                        title="Delete"
                      >
                        ×
                      </button>
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {!isHost && (
          <div className="mb-6 p-4 bg-gray-700/30 rounded-xl space-y-3">
            <p className="text-center text-gray-400 text-sm">Waiting for host to start...</p>
            {roomSettings && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Rounds</span>
                  <span className="text-gray-300">{roomSettings.totalRounds}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Difficulty</span>
                  <span className="text-gray-300">
                    {roomSettings.difficulty === 1 ? 'Easy' : roomSettings.difficulty === 2 ? 'Medium' : 'Hard'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mode</span>
                  <span className="text-gray-300">
                    {roomSettings.answerMode === 'typed' ? 'Type Answer' : 'Multiple Choice'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Categories</span>
                  <span className="text-gray-300 text-right max-w-[60%]">
                    {roomSettings.categoryIds?.map(id =>
                      categories.find(c => c.id === id)?.name || id
                    ).join(', ') || '-'}
                  </span>
                </div>
              </div>
            )}
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
