import LanguageSwitcher from '../LanguageSwitcher'
import { useI18n } from '../../i18n'

export default function GameLoading({ loadingProgress }) {
  const { t } = useI18n()
  const progress = loadingProgress || {}
  const percent = progress.phase === 'artists' && progress.total
    ? Math.round((progress.completed / progress.total) * 100)
    : 0

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <LanguageSwitcher />
      <div className="card text-center max-w-md w-full animate-fade-up">
        <h2 className="text-2xl font-bold mb-6">{t('game.loadingTitle')}</h2>

        {progress.phase === 'artists' && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-slate-400 mb-2">
              <span>{t('game.fetchingTracks')}</span>
              <span>{percent}%</span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {progress.phase === 'building' && (
          <p className="text-slate-300 mb-6">{t('game.buildingQuiz')}</p>
        )}

        <div className="flex justify-center">
          <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  )
}
