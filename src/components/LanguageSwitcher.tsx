import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../lib/translations';
import { Globe, Check } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages: { code: Language; label: string; native: string }[] = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'am', label: 'Amharic', native: 'አማርኛ' },
    { code: 'ar', label: 'Arabic', native: 'العربية' },
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
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-[#dad4c8] hover:border-[#0c0d0e] transition-all text-sm font-semibold text-[#0c0d0e] shadow-xs"
        aria-label="Select Language"
      >
        <Globe className="w-4 h-4 text-[#078a52]" />
        <span>{currentLang?.native}</span>
        <span className="text-xs uppercase text-[#55534e] font-mono">({language})</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-52 bg-white border-2 border-[#0c0d0e] rounded-2xl shadow-[-4px_4px_0px_#0c0d0e] overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-150">
          <div className="p-1.5 space-y-1">
            {languages.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-[#84e7a5]/30 text-[#02492a] font-bold"
                      : "text-[#0c0d0e] hover:bg-[#faf9f7]"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{lang.native}</span>
                    <span className="text-xs text-[#55534e] font-normal">{lang.label}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#078a52]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
