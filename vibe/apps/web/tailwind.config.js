/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vibe: {
          blue: '#4F8EFF',
          purple: '#A855F7',
          pink: '#EC4899',
          dark: '#0f0f23',
          card: 'rgba(255, 255, 255, 0.08)',
        }
      },
      backgroundImage: {
        'vibe-gradient': 'linear-gradient(180deg, #4F8EFF 0%, #A855F7 50%, #EC4899 100%)',
        'vibe-gradient-r': 'linear-gradient(135deg, #4F8EFF 0%, #A855F7 50%, #EC4899 100%)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(79, 142, 255, 0.15)',
        'glow-lg': '0 0 40px rgba(168, 85, 247, 0.2)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.12)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.18)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
