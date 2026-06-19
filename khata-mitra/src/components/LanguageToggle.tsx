import { Language } from '../types';

interface LanguageToggleProps {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export default function LanguageToggle({ language, setLanguage }: LanguageToggleProps) {
  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
      className="relative overflow-hidden inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shadow-sm hover:shadow transition-all duration-300 hover:scale-105 active:scale-95 group text-zinc-800 dark:text-zinc-200 cursor-pointer"
    >
      <span className="flex h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
      <span>{language === 'en' ? 'हिंदी (Hindi)' : 'English (अंग्रेजी)'}</span>
    </button>
  );
}
