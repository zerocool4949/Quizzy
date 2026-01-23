export default function GameOver({ gameResults, isHost, playAgain, leaveGame }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card max-w-lg w-full text-center">
        <h2 className="text-3xl font-bold mb-2">Game Over!</h2>
        <div className="my-8">
          <p className="text-gray-400 mb-2">Winner</p>
          <p className="text-4xl font-bold text-yellow-400 animate-bounce-in">
            {gameResults.winner.name}
          </p>
          <p className="text-2xl text-sky-400 mt-2">
            {gameResults.winner.score.toLocaleString()} points
          </p>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-300">Final Standings</h3>
          <div className="space-y-2">
            {gameResults.standings.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                  player.rank === 1
                    ? 'bg-yellow-600/20 border border-yellow-500/50'
                    : player.rank === 2
                    ? 'bg-gray-400/20 border border-gray-400/50'
                    : player.rank === 3
                    ? 'bg-orange-600/20 border border-orange-500/50'
                    : 'bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-500">#{player.rank}</span>
                  <span className="font-medium">{player.name}</span>
                </div>
                <span className="font-bold text-sky-400">
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
