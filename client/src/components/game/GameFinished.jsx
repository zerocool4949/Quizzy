import LanguageSwitcher from '../LanguageSwitcher'
import { useI18n } from '../../i18n'

export default function GameFinished({ gameResults, isHost, playAgain, leaveGame }) {
  const { t, language } = useI18n()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <LanguageSwitcher />
      <div className="card max-w-lg w-full text-center animate-fade-up">
        <h2 className="text-3xl font-bold mb-2">{t('game.gameOver')}</h2>
        <div className="my-8">
          <p className="text-slate-400 mb-2">{t('game.winner')}</p>
          <p className="text-4xl font-bold text-amber-300 animate-bounce-in">
            {gameResults.winner.name}
          </p>
          <p className="text-2xl text-teal-300 mt-2">
            {gameResults.winner.score.toLocaleString(language)} {t('game.pointsLabel')}
          </p>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-slate-300">{t('game.finalStandings')}</h3>
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
                  {player.score.toLocaleString(language)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {gameResults.rounds && gameResults.rounds.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-300">
                {gameResults.rounds[0]?.movie ? t('game.moviesPlayed') : gameResults.rounds[0]?.game ? t('game.videogamesPlayed') : t('game.songsPlayed')}
              </h3>
              <button
                onClick={() => {
                  const isMovieMode = gameResults.rounds[0]?.movie
                  const isVideogameMode = gameResults.rounds[0]?.game
                  const text = gameResults.rounds
                    .map((r, i) => isMovieMode
                      ? `${i + 1}. ${r.movie} - ${r.track}`
                      : isVideogameMode
                      ? `${i + 1}. ${r.game} - ${r.track}`
                      : `${i + 1}. ${r.artist} - ${r.title}`)
                    .join('\n')
                  const blob = new Blob([text], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = isMovieMode ? 'quizzy-movies.txt' : isVideogameMode ? 'quizzy-videogames.txt' : 'quizzy-songs.txt'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="text-sm text-teal-400 hover:text-teal-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('game.downloadList')}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-800/40 rounded-lg p-3">
              {gameResults.rounds.map((round, index) => (
                <div key={index} className="text-sm text-slate-300">
                  <span className="text-slate-500">{index + 1}.</span>{' '}
                  {round.movie ? `${round.movie} - ${round.track}` : round.game ? `${round.game} - ${round.track}` : `${round.artist} - ${round.title}`}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {isHost && (
            <button onClick={playAgain} className="btn-primary w-full">
              {t('buttons.playAgain')}
            </button>
          )}
          <button onClick={leaveGame} className="btn-secondary w-full">
            {t('buttons.leaveGame')}
          </button>
        </div>
      </div>
    </div>
  )
}
