import { useI18n } from '../i18n'

const contributors = 'Clem, Shivo, No, Fab, Dul'

export default function Footer() {
  const { t } = useI18n()

  return (
    <footer className="fixed bottom-3 left-0 right-0 px-4 text-center text-xs text-slate-400 pointer-events-none">
      <p>{t('app.createdBy')}</p>
      <p>
        {t('app.contributorsLabel')} <span className="text-slate-300">{contributors}</span>
      </p>
    </footer>
  )
}
