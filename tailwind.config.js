/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Slack-inspired color palette
        slack: {
          purple: '#4A154B',
          green: '#007A5A',
          blue: '#1264A3',
          orange: '#E01E5A',
          yellow: '#ECB22E',
        },
        // Custom grays for message cards
        message: {
          bg: '#F8F9FA',
          border: '#E1E5E9',
          text: '#1D1C1D',
          meta: '#616061',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s infinite',
        'bounce-gentle': 'bounce 2s infinite',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 