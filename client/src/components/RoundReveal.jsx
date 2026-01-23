export default function RoundReveal({ roundResults, answerResult }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card max-w-lg w-full">
        <div className="text-center mb-6">
          <p className="text-gray-400 mb-3">The answer was</p>
          {roundResults.albumArt && (
            <img
              src={roundResults.albumArt}
              alt="Album art"
              className="w-44 h-44 rounded-lg shadow-lg mx-auto mb-4"
            />
          )}
          <p className="text-2xl font-bold">{roundResults.correctName}</p>
          <p className="text-xl text-gray-200">{roundResults.correctArtist}</p>
          {roundResults.correctYear && (
            <p className="text-gray-300">{roundResults.correctYear}</p>
          )}
        </div>

        {answerResult && (
          <div
            className={`text-center p-4 rounded-xl mb-6 ${
              answerResult.points > 0 ? 'bg-green-600/20' : 'bg-red-600/20'
            }`}
          >
            <p className="text-2xl font-bold">
              {answerResult.points > 0 ? '+' + answerResult.points : 'No points'}
            </p>
            {answerResult.mode === 'typed' && !answerResult.fullCorrect && answerResult.points > 0 && (
              <p className="text-gray-400 text-sm">
                {answerResult.artistCorrect && !answerResult.titleCorrect && 'Artist only'}
                {answerResult.titleCorrect && !answerResult.artistCorrect && 'Title only'}
              </p>
            )}
            {answerResult.streak > 1 && (
              <p className="text-yellow-400 text-sm">{answerResult.streak} streak!</p>
            )}
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-300">Scoreboard</h3>
          <div className="space-y-2">
            {roundResults.playerResults.map((player, index) => (
              <div
                key={player.id}
                className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 font-bold">#{index + 1}</span>
                  <span>{player.name}</span>
                  {player.roundPoints > 0 && (
                    <span className="text-green-400 text-sm">+{player.roundPoints}</span>
                  )}
                </div>
                <span className="font-bold text-sky-400">
                  {player.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-gray-400 mt-6">Next round starting...</p>
      </div>
    </div>
  );
}
