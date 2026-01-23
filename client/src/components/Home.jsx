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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="glow-orb w-64 h-64 bg-teal-400/30 -left-10 -top-10" />
      <div className="glow-orb w-80 h-80 bg-rose-400/30 -right-10 top-20" />
      <div className="glow-orb w-72 h-72 bg-blue-400/20 left-1/3 -bottom-10" />

      <div className="text-center mb-12 animate-fade-up">
        <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-teal-300 via-cyan-300 to-sky-300 text-transparent bg-clip-text drop-shadow">
          Quizzy
        </h1>
        <p className="text-slate-300 text-lg">The multiplayer music quiz game</p>
      </div>

      {error && (
        <div className="card bg-rose-900/40 border-rose-500/60 mb-6 max-w-md w-full animate-fade-up">
          <p className="text-rose-100">{error}</p>
          <button onClick={clearError} className="text-rose-200 text-sm mt-2 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {!mode && (
        <div className="card max-w-md w-full space-y-4 animate-fade-up">
          <button onClick={() => setMode('create')} className="btn-primary w-full text-lg">
            Create Game
          </button>
          <button onClick={() => setMode('join')} className="btn-secondary w-full text-lg">
            Join Game
          </button>
        </div>
      )}

      {mode === 'create' && (
        <form onSubmit={handleCreate} className="card max-w-md w-full space-y-4 animate-fade-up">
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
        <form onSubmit={handleJoin} className="card max-w-md w-full space-y-4 animate-fade-up">
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

      <div className="mt-8 text-center text-slate-400 text-sm animate-fade-up">
        <p className="mt-1">Created by Raph</p>
      </div>
    </div>
  );
}
