/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#FFB800", // Sosha Yellow
          hover: "#EAB308",
          foreground: "#000000",
        },
        secondary: {
          DEFAULT: "#84CC16", // Fresh Green
          hover: "#65A30D",
        },
        background: "var(--background)",
        card: "var(--card)",
        border: "var(--border)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
      },
      animation: {
        "float-slow": "float 20s ease-in-out infinite",
        "float-medium": "float 15s ease-in-out infinite reverse",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-20px) scale(1.05)" },
        },
      },
    },
  },
  plugins: [],
};