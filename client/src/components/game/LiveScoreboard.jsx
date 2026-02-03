import { useI18n } from '../../i18n'

export default function LiveScoreboard({ players, leaveGame }) {
  const { t, language } = useI18n()
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="w-full md:w-56 shrink-0 order-first md:order-last mb-4 md:mb-0">
      <div className="card md:sticky md:top-4 animate-fade-up">
        <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {t('game.liveScores')}
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
                {player.score.toLocaleString(language)}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={leaveGame}
          className="w-full mt-4 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-rose-600/50 rounded-lg transition-colors"
        >
          {t('buttons.leaveGame')}
        </button>
      </div>
    </div>
  )
}
