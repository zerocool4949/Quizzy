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
        <div className="card text-center animate-fade-up">
          <h2 className="text-4xl font-bold mb-4">Get Ready!</h2>
          <div className="text-8xl font-bold text-teal-400 animate-pulse" key={countdown}>
            {countdown}
          </div>
          <p className="text-slate-300 mt-4">Game starting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card max-w-lg w-full animate-fade-up">
        <div className="text-center mb-6">
          <p className="text-slate-400 mb-2">Room Code</p>
          <button
            onClick={copyLink}
            className="text-4xl font-bold tracking-widest text-teal-300 hover:text-teal-200 transition-colors"
            title="Click to copy invite link"
          >
            {roomCode}
          </button>
          <p className="text-slate-400 text-sm mt-2">
            {copied ? 'Link copied!' : 'Click to copy invite link'}
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-slate-300">
            Players ({players.length}/8)
          </h3>
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between bg-slate-800/60 rounded-lg px-4 py-3"
              >
                <span className="font-medium">{player.name}</span>
                {player.isHost && (
                  <span className="text-xs bg-teal-600/40 px-2 py-1 rounded-full">HOST</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isHost && (
          <div className="mb-6 p-4 bg-slate-900/40 rounded-xl space-y-4">
            {/* Compact row: Rounds + Difficulty + Mode */}
            <div className="flex gap-3">
              {/* Rounds */}
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1">Rounds</label>
                <div className="flex gap-1">
                  {[10, 15, 20].map((num) => (
                    <button
                      key={num}
                      onClick={() => setRounds(num)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-sm border transition-colors ${
                        rounds === num
                          ? 'bg-teal-600/30 border-teal-400 text-teal-200'
                          : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/60 text-slate-300'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1">Difficulty</label>
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
                          ? 'bg-teal-600/30 border-teal-400 text-teal-200'
                          : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/60 text-slate-300'
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
              <span className="text-xs text-slate-400">Mode:</span>
              <div className="flex flex-1 bg-slate-900 rounded-lg p-0.5">
                <button
                  onClick={() => setAnswerMode('typed')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    answerMode === 'typed'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Type Answer
                </button>
                <button
                  onClick={() => setAnswerMode('mcq')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    answerMode === 'mcq'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Multiple Choice
                </button>
              </div>
            </div>

            {/* Category Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400">
                  Categories <span className="text-teal-300">({selectedCategories.length})</span>
                </label>
                <button
                  onClick={() => setShowImport(!showImport)}
                  className="text-xs px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-200 hover:bg-emerald-600/50 transition-colors"
                >
                  + Import
                </button>
              </div>

              {/* Import Playlist Form */}
              {showImport && (
                <div className="mb-2 p-2 bg-slate-900 rounded-lg border border-slate-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="Spotify playlist URL..."
                      className="flex-1 px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                    />
                    <button
                      onClick={handleImportPlaylist}
                      disabled={importLoading || !importUrl.trim()}
                      className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {importLoading ? '...' : 'Add'}
                    </button>
                  </div>
                  {importError && (
                    <p className="text-xs text-rose-400 mt-1">{importError}</p>
                  )}
                </div>
              )}

              {/* Single column list for better readability */}
              <div className="max-h-40 overflow-y-auto bg-slate-900 rounded-lg border border-slate-700 divide-y divide-slate-800">
                {categories.map((category, index) => (
                  <label
                    key={category.id}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group animate-fade-up ${
                      selectedCategories.includes(category.id)
                        ? 'bg-teal-600/20'
                        : 'hover:bg-slate-800/60'
                    }`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                      className="w-4 h-4 rounded border-slate-500 text-teal-500 focus:ring-teal-500 focus:ring-offset-slate-900 shrink-0"
                    />
                    <span className={`text-sm flex-1 ${
                      selectedCategories.includes(category.id) ? 'text-teal-200' : 'text-slate-300'
                    }`}>
                      {category.name}
                      {category.imported && (
                        <span className="ml-1.5 text-xs text-emerald-300/80">imported</span>
                      )}
                    </span>
                    {category.imported && (
                      <button
                        onClick={(e) => handleDeletePlaylist(category.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 text-xs px-1 transition-opacity"
                        title="Delete"
                      >
                        x
                      </button>
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {!isHost && (
          <div className="mb-6 p-4 bg-slate-900/40 rounded-xl space-y-3">
            <p className="text-center text-slate-400 text-sm">Waiting for host to start...</p>
            {roomSettings && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Rounds</span>
                  <span className="text-slate-300">{roomSettings.totalRounds}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Difficulty</span>
                  <span className="text-slate-300">
                    {roomSettings.difficulty === 1 ? 'Easy' : roomSettings.difficulty === 2 ? 'Medium' : 'Hard'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mode</span>
                  <span className="text-slate-300">
                    {roomSettings.answerMode === 'typed' ? 'Type Answer' : 'Multiple Choice'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Categories</span>
                  <span className="text-slate-300 text-right max-w-[60%]">
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
