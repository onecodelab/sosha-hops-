/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./{components,pages,hooks,contexts,lib,services,queries,utils}/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                primary: {
                    DEFAULT: '#FFC800', // Sharper Gold
                    hover: '#FDB600',
                    foreground: '#000000',
                    glow: 'var(--primary-glow)'
                },
                secondary: {
                    DEFAULT: '#A3E635', // Vibrant Lime
                    hover: '#84CC16',
                    foreground: '#000000'
                },
                background: 'var(--background)',
                card: 'var(--card)',
                border: 'var(--border)',
                foreground: 'var(--foreground)',
                muted: 'var(--muted)',
            },
            backdropBlur: {
                xs: '2px',
            },
            animation: {
                'float-slow': 'float 20s ease-in-out infinite',
                'float-medium': 'float 15s ease-in-out infinite reverse',
                'pulse-slow': 'pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0) scale(1)' },
                    '50%': { transform: 'translateY(-20px) scale(1.02)' },
                }
            }
        },
    },
    plugins: [],
    safelist: [
        'border-red-500/20',
        'border-green-500/20',
        'border-green-400/20',
        'border-primary/20',
        'border-orange-400/20',
        'text-red-400',
        'text-green-400',
        'text-yellow-400',
        'text-purple-400',
        'text-orange-400',
    ]
}
