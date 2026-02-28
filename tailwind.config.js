/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './index.tsx',
        './App.tsx',
        './pages/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}',
        './contexts/**/*.{js,ts,jsx,tsx}',
        './hooks/**/*.{js,ts,jsx,tsx}',
        './lib/**/*.{js,ts,jsx,tsx}',
        './utils/**/*.{js,ts,jsx,tsx}',
        './services/**/*.{js,ts,jsx,tsx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#FFB800',
                    hover: '#EAB308',
                    foreground: '#000000',
                },
                secondary: {
                    DEFAULT: '#84CC16',
                    hover: '#65A30D',
                },
                background: 'var(--background)',
                card: 'var(--card)',
                border: 'var(--border)',
                foreground: 'var(--foreground)',
                muted: 'var(--muted)',
                'brand-yellow': '#FFB800',
                'brand-green': '#72BF44',
                'brand-blue': '#020617',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                brand: ['"Cormorant Garamond"', 'serif'],
                mono: ['"JetBrains Mono"', 'monospace'],
            },
            animation: {
                'float-slow': 'float 20s ease-in-out infinite',
                'float-medium': 'float 15s ease-in-out infinite reverse',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0) scale(1)' },
                    '50%': { transform: 'translateY(-20px) scale(1.05)' },
                },
            },
        },
    },
    plugins: [],
};
