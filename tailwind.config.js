/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#06110c', 900: '#08150f', 800: '#0b1c14', 700: '#10271c', 600: '#183626' },
        lime: { DEFAULT: '#b8f53d', 300: '#d2ff7a', 400: '#c4fa55', 500: '#b8f53d', 600: '#93cc22' },
        mist: { DEFAULT: '#e8f3ea', muted: '#93ab9d', dim: '#5f7a6c' },
        amber: { signal: '#f5c451' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'sans-serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(184,245,61,0.25), 0 12px 48px -12px rgba(184,245,61,0.25)',
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.7)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
      },
      animation: { shimmer: 'shimmer 1.6s linear infinite', pulseDot: 'pulseDot 1.8s ease-in-out infinite' },
    },
  },
  plugins: [],
}
