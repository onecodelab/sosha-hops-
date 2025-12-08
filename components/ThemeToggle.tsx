import React, { useEffect, useState } from 'react';

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check local storage or default to dark
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setIsDark(isChecked);
    
    if (isChecked) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <label className="relative inline-block w-[3.5em] h-[2em]" title="Toggle Theme">
      {/* Hidden checkbox */}
      <input 
        type="checkbox" 
        className="peer opacity-0 w-0 h-0" 
        checked={isDark}
        onChange={toggleTheme}
      />

      {/* Slider */}
      <span
        className="
          absolute inset-0 cursor-pointer rounded-[30px] transition duration-500 
          bg-gray-300 /* Neutral for Light Mode */
          peer-checked:bg-gray-700 
          dark:peer-checked:bg-[#1e293b]
          
          before:content-[''] before:absolute before:h-[1.4em] before:w-[1.4em] before:rounded-full before:left-[10%] before:bottom-[15%] 
          
          /* Sun Icon (Light Mode) */
          before:shadow-[inset_8px_-4px_0px_0px_#ffffff] 
          before:bg-white
          
          before:transition before:duration-500 
          
          /* Moon Icon (Dark Mode) */
          peer-checked:before:translate-x-full 
          peer-checked:before:shadow-[inset_15px_-4px_0px_15px_#fff000] /* Yellow Sun/Moon shift */
          peer-checked:before:bg-transparent
        "
      />
    </label>
  );
};

export default ThemeToggle;