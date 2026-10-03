import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Attention brand palette — black / white / warm sand / neutral
        ink: {
          DEFAULT: '#0A0A0A',
          soft: '#1A1A1A',
          muted: '#6B6B6B',
          faint: '#9A9A9A',
        },
        sand: {
          50: '#FBF8F3',
          100: '#F5EFE6',
          200: '#EDE4D6',
          300: '#E0D2BC',
          400: '#CBB89A',
          500: '#B29A75',
        },
        line: {
          DEFAULT: '#E7E2DA',
          strong: '#CFC7BA',
        },
        paper: {
          DEFAULT: '#FFFFFF',
          warm: '#FAF8F5',
        },
        accent: {
          DEFAULT: '#8A6B4B',
          deep: '#5C4630',
        },
        danger: '#9B2C2C',
        success: '#2F6B4F',
      },
      fontFamily: {
        sans: ['var(--font-en)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        ar: ['var(--font-ar)', 'var(--font-en)', 'sans-serif'],
      },
      fontSize: {
        display: ['clamp(2.75rem, 7vw, 5.5rem)', { lineHeight: '0.98', letterSpacing: '-0.02em' }],
        h1: ['clamp(2rem, 4.5vw, 3.25rem)', { lineHeight: '1.05', letterSpacing: '-0.01em' }],
        h2: ['clamp(1.5rem, 3vw, 2.25rem)', { lineHeight: '1.1' }],
        h3: ['clamp(1.25rem, 2vw, 1.625rem)', { lineHeight: '1.2' }],
        h4: ['1.125rem', { lineHeight: '1.3' }],
        body: ['1rem', { lineHeight: '1.7' }],
        small: ['0.875rem', { lineHeight: '1.6' }],
        caption: ['0.75rem', { lineHeight: '1.5' }],
        label: ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.14em' }],
        price: ['0.9375rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        nav: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.16em' }],
        btn: ['0.75rem', { lineHeight: '1', letterSpacing: '0.16em' }],
      },
      letterSpacing: {
        luxe: '0.22em',
      },
      maxWidth: {
        shell: '1560px',
        content: '1280px',
        prose: '68ch',
      },
      aspectRatio: {
        product: '3 / 4',
        editorial: '4 / 5',
        wide: '16 / 9',
      },
      transitionTimingFunction: {
        luxe: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-end': {
          from: { transform: 'translateX(var(--slide-from, 100%))' },
          to: { transform: 'translateX(0)' },
        },
        'reveal': {
          from: { clipPath: 'inset(0 0 100% 0)' },
          to: { clipPath: 'inset(0 0 0 0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-end': 'slide-in-end 0.42s cubic-bezier(0.22, 1, 0.36, 1) both',
        reveal: 'reveal 0.9s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.8s infinite',
      },
      transitionDuration: {
        '400': '400ms',
        '900': '900ms',
        '1200': '1200ms',
      },
    },
  },
  plugins: [],
};

export default config;
