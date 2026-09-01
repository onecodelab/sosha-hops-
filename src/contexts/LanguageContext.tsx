
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../lib/translations';
export type Language = 'en' | 'am' | 'ar';

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
  const [language, setLanguageState] = useState<Language>('am');

  useEffect(() => {
    const saved = localStorage.getItem('baro-lang') as Language;
    if (saved && ['en', 'am', 'ar'].includes(saved)) {
      setLanguageState(saved);
    } else {
      setLanguageState('am');
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('baro-lang', lang);
  };

  const lookup = (langCode: Language, keys: string[]): string | undefined => {
    try {
      let current: any = translations[langCode];
      if (!current) return undefined;
      
      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          return undefined;
        }
      }
      return typeof current === 'string' ? current : undefined;
    } catch (e) {
      return undefined;
    }
  };

  const t = (path: string): string => {
    if (!path) return '';
    const keys = path.split('.');
    
    // 1. Try selected language
    // 2. Try English fallback
    // 3. Try hardcoded emergency fallbacks for common/critical keys
    const result = lookup(language, keys) ?? lookup('en', keys);
    
    if (result !== undefined) return result;

    // Log the missing key for debugging
    console.warn(`[Translation] Missing path: "${path}" in [${language}] and [en]`);

    // Handle common typos or legacy keys
    if (path.includes('orderTable.') && !path.includes('ordersTable')) {
        const pluralPath = path.replace('orderTable.', 'ordersTables.');
        const pluralResult = lookup(language, pluralPath.split('.')) ?? lookup('en', pluralPath.split('.'));
        if (pluralResult) return pluralResult;
    }

    return path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
