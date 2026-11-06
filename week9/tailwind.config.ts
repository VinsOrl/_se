import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: '#FBF6F2', dark: '#1A1714' },
        ink: { DEFAULT: '#2B2622', light: '#F0EAE5' },
        sage: { DEFAULT: '#5B755B', light: '#6E916E' },
        blush: { DEFAULT: '#F3E7DF' },
        muted: { DEFAULT: '#6A5F58', dark: '#9B928A' },
        line: { DEFAULT: 'rgba(43,38,34,0.12)' },
        urgency: {
          overdue: { bg: '#FDEDEC', fg: '#8B1D15', darkBg: '#3D1F1F', darkFg: '#D94F4F' },
          soon: { bg: '#FEF5E7', fg: '#9A5410', darkBg: '#3D2F1A', darkFg: '#E0A040' },
          week: { bg: '#EDF3ED', fg: '#3D563D' },
        }
      },
      fontFamily: {
        heading: ['Lora', 'serif'],
        body: ['Nunito Sans', 'sans-serif'],
      },
      borderRadius: { card: '24px' },
      maxWidth: { page: '1080px' },
    }
  },
  plugins: []
} satisfies Config
