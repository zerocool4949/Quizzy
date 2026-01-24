import { useI18n } from '../i18n';

export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className={`absolute top-4 right-4 ${className}`.trim()}>
      <label className="text-xs text-slate-400 mr-2">{t('language.label')}</label>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        aria-label={t('language.label')}
        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-200"
      >
        <option value="en">{t('language.english')}</option>
        <option value="fr">{t('language.french')}</option>
      </select>
    </div>
  );
}
