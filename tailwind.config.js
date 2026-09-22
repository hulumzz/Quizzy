/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-blue': '#3b82f6',
        'neon-purple': '#a855f7',
        'neon-pink': '#ec4899',
        'bg-dark': '#05050a',
        'primary': '#6a11cb',
        'secondary': '#2575fc',
        'accent': '#ff0080',
      },
      fontFamily: {
        'outfit': ['Outfit', 'sans-serif'],
      },
      animation: {
        'float': 'floatY 6s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        floatY: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      }
    },
  },
  plugins: [],
}
