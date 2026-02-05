import LanguageSwitcher from '../LanguageSwitcher'
import { useI18n } from '../../i18n'

export default function RoundResults({ roundResults, answerResult, isSpectator }) {
  const { t, language } = useI18n()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <LanguageSwitcher />
      <div className="card max-w-lg w-full animate-fade-up">
        <div className="text-center mb-6">
          <p className="text-slate-400 text-xs uppercase tracking-[0.3em] mb-3">{t('game.answerReveal')}</p>
          <div className="flex flex-col items-center gap-4 bg-slate-900/50 rounded-2xl p-5 border border-teal-500/20">
            <div className="relative">
              <div className="absolute -inset-3 rounded-3xl bg-teal-500/20 blur-xl"></div>
              {roundResults.albumArt ? (
                <img
                  src={roundResults.albumArt}
                  alt="Album art"
                  className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-3xl border border-teal-400/40"
                />
              ) : (
                <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-3xl bg-slate-800/60 border border-teal-500/30 flex items-center justify-center text-slate-400 text-sm">
                  {t('game.noCover')}
                </div>
              )}
            </div>
            <div className="text-center">
              {roundResults.correctMovie ? (
                <>
                  <p className="text-2xl sm:text-3xl font-bold text-amber-200">{roundResults.correctMovie}</p>
                  <p className="text-slate-300">{roundResults.correctTrack}</p>
                  {roundResults.correctComposer && (
                    <p className="text-slate-400 text-sm">{t('game.composedBy', { composer: roundResults.correctComposer })}</p>
                  )}
                </>
              ) : roundResults.correctGame ? (
                <>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-200">{roundResults.correctGame}</p>
                  <p className="text-slate-300">{roundResults.correctTrack}</p>
                  {roundResults.correctComposer && (
                    <p className="text-slate-400 text-sm">{t('game.composedBy', { composer: roundResults.correctComposer })}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-2xl sm:text-3xl font-bold text-teal-200">{roundResults.correctName}</p>
                  <p className="text-slate-300">{roundResults.correctArtist}</p>
                </>
              )}
              {roundResults.correctYear && (
                <span className="inline-flex mt-3 px-2.5 py-1 rounded-full text-xs text-slate-300 bg-slate-800/70 border border-slate-700">
                  {roundResults.correctYear}
                </span>
              )}
            </div>
          </div>
        </div>

        {answerResult && !isSpectator && (
          <div
            className={`text-center p-4 rounded-xl mb-6 ${
              answerResult.points > 0 ? 'bg-emerald-600/20' : 'bg-rose-600/20'
            }`}
          >
            <p className="text-2xl font-bold">
              {answerResult.points > 0
                ? t('game.pointsPlus', { points: answerResult.points })
                : t('game.noPoints')}
            </p>
            {answerResult.mode === 'typed' && !answerResult.fullCorrect && answerResult.points > 0 && (
              <p className="text-slate-300 text-sm">
                {answerResult.artistCorrect && !answerResult.titleCorrect && t('game.artistOnly')}
                {answerResult.titleCorrect && !answerResult.artistCorrect && t('game.titleOnly')}
              </p>
            )}
            {answerResult.streak > 1 && (
              <p className="text-amber-300 text-sm">{t('game.streak', { count: answerResult.streak })}</p>
            )}
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-3 text-slate-300">{t('game.scoreboard')}</h3>
          <div className="space-y-2">
            {roundResults.playerResults.map((player, index) => (
              <div
                key={player.id}
                className="flex items-center justify-between bg-slate-800/60 rounded-lg px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-bold">#{index + 1}</span>
                  <span>{player.name}</span>
                  {player.roundPoints > 0 && (
                    <span className="text-emerald-300 text-sm">+{player.roundPoints}</span>
                  )}
                </div>
                <span className="font-bold text-teal-300">
                  {player.score.toLocaleString(language)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-slate-400 mt-6">{t('game.nextRound')}</p>
      </div>
    </div>
  )
}
