/** Design tokens. Colours resolve to CSS variables so the light theme can swap them. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        elevated: v('elevated'),
        fg: v('fg'),
        secondary: v('secondary'),
        muted: v('muted'),
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        brand: { violet: '#8B5CF6', cyan: '#22D3EE' },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#F43F5E',
        aws: '#FF9900',
        azure: '#0089D6',
        gcp: '#34A853',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: '14px', btn: '10px' },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #8B5CF6 0%, #22D3EE 100%)',
        'brand-soft': 'linear-gradient(135deg, rgba(139,92,246,.16) 0%, rgba(34,211,238,.12) 100%)',
      },
      boxShadow: {
        glow: 'inset 0 1px 0 0 rgba(255,255,255,0.04), 0 0 0 1px var(--line)',
        lift: '0 12px 32px -12px rgba(0,0,0,.45)',
        brand: '0 8px 24px -8px rgba(139,92,246,.55)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        mesh: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(8%,-6%) scale(1.1)' },
          '66%': { transform: 'translate(-6%,8%) scale(.95)' },
        },
        pulseDot: { '0%': { boxShadow: '0 0 0 0 rgba(16,185,129,.6)' }, '100%': { boxShadow: '0 0 0 8px rgba(16,185,129,0)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        float: 'float 6s ease-in-out infinite',
        mesh: 'mesh 18s ease-in-out infinite',
        'pulse-dot': 'pulseDot 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};
