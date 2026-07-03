
import React, { useEffect, useState } from 'react';
import { Leaf, Sun } from 'lucide-react';
import { cn } from './ui';

const ThemeToggle = () => {
  const [theme, setTheme] = useState<'classic' | 'fresh'>('classic');

  useEffect(() => {
    // Check local storage
    const savedTheme = localStorage.getItem('baro-theme') as 'classic' | 'fresh' | null;
    if (savedTheme === 'fresh') {
      setTheme('fresh');
      document.body.setAttribute('data-theme', 'fresh');
    } else {
      setTheme('classic');
      document.body.removeAttribute('data-theme');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'classic' ? 'fresh' : 'classic';
    setTheme(newTheme);
    localStorage.setItem('baro-theme', newTheme);

    // Trigger impressive visual feedback
    const overlay = document.createElement('div');
    overlay.className = 'system-flush-overlay';
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 500);

    if (newTheme === 'fresh') {
      document.body.setAttribute('data-theme', 'fresh');
    } else {
      document.body.removeAttribute('data-theme');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex items-center justify-between w-16 h-8 rounded-full p-1 transition-all duration-500 shadow-inner",
        theme === 'classic'
          ? "bg-gradient-to-r from-zinc-900 to-zinc-800 border border-yellow-500/20"
          : "bg-gradient-to-r from-emerald-900 to-emerald-800 border border-emerald-600/50"
      )}
      title={`Switch to ${theme === 'classic' ? 'Fresh' : 'Classic'} Theme`}
    >
      {/* Track Icons */}
      <Leaf className={cn("w-4 h-4 ml-1 transition-opacity duration-300", theme === 'fresh' ? "text-emerald-400 opacity-100" : "opacity-0")} />
      <Sun className={cn("w-4 h-4 mr-1 transition-opacity duration-300", theme === 'classic' ? "text-yellow-500 opacity-100" : "opacity-0")} />

      {/* Thumb */}
      <div
        className={cn(
          "absolute top-1 left-1 w-6 h-6 rounded-full shadow-lg transition-transform duration-500 flex items-center justify-center",
          theme === 'classic' ? "translate-x-8 bg-yellow-500" : "translate-x-0 bg-emerald-400"
        )}
      >
        {theme === 'classic' ? (
          <Sun className="w-3 h-3 text-yellow-950" fill="currentColor" />
        ) : (
          <Leaf className="w-3 h-3 text-emerald-950" fill="currentColor" />
        )}
      </div>
    </button>
  );
};

export default ThemeToggle;
