/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'qz-bg': 'var(--qz-bg)',
        'qz-surface': 'var(--qz-surface)',
        'qz-border': 'var(--qz-border)',
        'qz-text': 'var(--qz-text)',
        'qz-muted': 'var(--qz-text-muted)',
        'qz-primary': 'var(--qz-primary)',
        'qz-success': 'var(--qz-success)',
        'qz-warning': 'var(--qz-warning)',
        'qz-danger': 'var(--qz-danger)',
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
