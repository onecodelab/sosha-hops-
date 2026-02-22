
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => { },
  t: (s) => s,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('baro-lang') as Language;
    if (saved && ['en', 'am', 'om', 'ti', 'af'].includes(saved)) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('baro-lang', lang);
  };

  const lookup = (langCode: Language, keys: string[]): string | undefined => {
    let current: any = translations[langCode];
    for (const key of keys) {
      if (!current || typeof current !== 'object') return undefined;
      current = current[key];
    }
    return typeof current === 'string' ? current : undefined;
  };

  const t = (path: string): string => {
    const keys = path.split('.');
    // Try current language first, fallback to English, then return path
    return lookup(language, keys) ?? lookup('en', keys) ?? path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
