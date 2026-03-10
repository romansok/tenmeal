import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'sunrise-orange': '#FF6B35',
        'warm-amber': '#FFB347',
        'creamy-white': '#FFF8F0',
        'deep-espresso': '#2C1810',
        'fresh-veggie-green': '#5BAD6F',
        'success': '#4CAF82',
        'warning': '#FFD166',
        'error': '#EF476F',
        'info': '#118AB2',
      },
      fontFamily: {
        rubik: ['var(--font-rubik)', 'sans-serif'],
      },
      backgroundImage: {
        'morning-gradient': 'linear-gradient(135deg, #FFF3E0 0%, #FFD49A 45%, #FFAA6B 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'slide-up': 'slideUp 400ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
