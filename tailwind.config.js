/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        terminal: '#0b1324',
        steel: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569' },
        board: '#0f172a',
        led: '#ffb81c',
        sky: { DEFAULT: '#0b5fd8', dark: '#0847a6', light: '#3b82f6' },
        brass: { 200: '#fef3c7', 300: '#fde68a', 400: '#f59e0b', 500: '#d97706', 600: '#92400e' },
        go: '#059669',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', '"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        raised: '0 1px 2px rgba(15,23,42,.06)',
        pressed: 'inset 0 1px 3px rgba(15,23,42,.18)',
        well: 'inset 0 1px 2px rgba(15,23,42,.05)',
        panel: '0 1px 3px rgba(15,23,42,.06), 0 4px 14px -4px rgba(15,23,42,.05)',
        boardin: 'inset 0 2px 6px rgba(0,0,0,.5)',
      },
    },
  },
  plugins: [],
};
