
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../lib/translations';
import { Globe, Check } from 'lucide-react';
import { cn } from './ui';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages: { code: Language; label: string; native: string }[] = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'am', label: 'Amharic', native: 'አማርኛ' },
    { code: 'om', label: 'Afaan Oromo', native: 'Afaan Oromo' },
    { code: 'ti', label: 'Tigrinya', native: 'ትግርኛ' },
    { code: 'af', label: 'Afar', native: 'Qafar' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLang = languages.find(l => l.code === language);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-gray-300"
      >
        <Globe className="w-4 h-4 text-primary" />
        <span className="hidden md:inline font-medium">{currentLang?.native}</span>
        <span className="md:hidden font-medium uppercase">{language}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-[#1A1A1A] border border-gray-800 rounded-xl shadow-xl overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { setLanguage(lang.code); setIsOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between transition-colors",
                  language === lang.code
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <div className="flex flex-col">
                  <span>{lang.native}</span>
                  <span className="text-[10px] text-gray-600 font-normal">{lang.label}</span>
                </div>
                {language === lang.code && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
