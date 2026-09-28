/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Geist', 'Inter', 'sans-serif'],
      },
      colors: {
        ink: '#09090b',
        panel: '#101013',
        line: '#27272a',
        accent: '#fbbf24',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
