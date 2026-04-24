const plugin = require('tailwindcss/plugin');

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-900': '#05070A',
        'neon-cyan': '#00F6FF',
        'neon-magenta': '#FF00E6',
        emerald: '#00FF9C',
        amber: '#FFB86B'
      },
      boxShadow: {
        neon: '0 0 0.75rem rgba(0, 246, 255, 0.55), 0 0 2.2rem rgba(255, 0, 230, 0.22)'
      },
      animation: {
        'kompass-pulse': 'kompassPulse 2.8s ease-in-out infinite',
        sparkline: 'sparklineShift 5s linear infinite'
      },
      keyframes: {
        kompassPulse: {
          '0%, 100%': { transform: 'scale(0.9)', opacity: 0.4 },
          '50%': { transform: 'scale(1.2)', opacity: 1 }
        },
        sparklineShift: {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '-120' }
        }
      }
    }
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.neon-glow': {
          boxShadow:
            '0 0 0.65rem rgba(0,246,255,0.45), 0 0 1.4rem rgba(255,0,230,0.18)'
        },
        '.glass-blur': {
          backdropFilter: 'blur(18px)'
        },
        '.glass-panel': {
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(18px)'
        },
        '.scanline': {
          position: 'relative'
        }
      });
    })
  ]
};
