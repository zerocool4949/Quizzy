import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export default function Home() {
  const { code: urlCode } = useParams();
  const [mode, setMode] = useState(urlCode ? 'join' : null); // null, 'create', 'join'
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState(urlCode?.toUpperCase() || '');
  const { createRoom, joinRoom, error, clearError } = useGame();

  // If URL has a code, go straight to join mode
  useEffect(() => {
    if (urlCode) {
      setMode('join');
      setRoomCode(urlCode.toUpperCase());
    }
  }, [urlCode]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      createRoom(playerName.trim());
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (playerName.trim() && roomCode.trim()) {
      joinRoom(roomCode.trim(), playerName.trim());
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-sky-400 via-cyan-400 to-teal-400 text-transparent bg-clip-text">
          Quizzy
        </h1>
        <p className="text-gray-400 text-lg">The multiplayer music quiz game</p>
      </div>

      {error && (
        <div className="card bg-red-900/50 border-red-500 mb-6 max-w-md w-full">
          <p className="text-red-200">{error}</p>
          <button onClick={clearError} className="text-red-400 text-sm mt-2 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {!mode && (
        <div className="card max-w-md w-full space-y-4">
          <button onClick={() => setMode('create')} className="btn-primary w-full text-lg">
            Create Game
          </button>
          <button onClick={() => setMode('join')} className="btn-secondary w-full text-lg">
            Join Game
          </button>
        </div>
      )}

      {mode === 'create' && (
        <form onSubmit={handleCreate} className="card max-w-md w-full space-y-4">
          <h2 className="text-2xl font-bold text-center">Create a Room</h2>
          <input
            type="text"
            placeholder="Your nickname"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="input"
            maxLength={15}
            autoFocus
          />
          <button type="submit" className="btn-primary w-full" disabled={!playerName.trim()}>
            Create Room
          </button>
          <button type="button" onClick={() => setMode(null)} className="btn-secondary w-full">
            Back
          </button>
        </form>
      )}

      {mode === 'join' && (
        <form onSubmit={handleJoin} className="card max-w-md w-full space-y-4">
          <h2 className="text-2xl font-bold text-center">Join a Room</h2>
          <input
            type="text"
            placeholder="Your nickname"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="input"
            maxLength={15}
            autoFocus
          />
          <input
            type="text"
            placeholder="Room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="input text-center text-2xl tracking-widest"
            maxLength={6}
          />
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={!playerName.trim() || roomCode.length < 6}
          >
            Join Room
          </button>
          <button type="button" onClick={() => setMode(null)} className="btn-secondary w-full">
            Back
          </button>
        </form>
      )}

      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Powered by Deezer</p>
        <p className="mt-1">A Zerocool creation</p>
      </div>
    </div>
  );
}
