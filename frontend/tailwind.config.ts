import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f4f7fb',
        surface: '#ffffff',
        brand: '#0f6cbd',
        success: '#178a55',
        danger: '#c13f35',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Manrope"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        soft: '0 10px 24px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
