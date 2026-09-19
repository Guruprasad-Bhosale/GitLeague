/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#090D16',
        surface: '#0F172A',
        surfaceBorder: '#1E293B',
        neonCyan: '#00F0FF',
        neonPurple: '#A855F7',
        neonGold: '#F59E0B',
        cyberGreen: '#10B981',
      },
    },
  },
  plugins: [],
}
