import LanguageSwitcher from '../LanguageSwitcher'
import { useI18n } from '../../i18n'

export default function GameCountdown({ countdown }) {
  const { t } = useI18n()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <LanguageSwitcher />
      <div className="card text-center animate-fade-up">
        <h2 className="text-4xl font-bold mb-4">{t('game.getReady')}</h2>
        <div className="text-8xl font-bold text-teal-400 animate-pulse">{countdown}</div>
      </div>
    </div>
  )
}
