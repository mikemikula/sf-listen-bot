/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Slack-inspired color palette
        'slack-purple': '#4A154B',
        'slack-green': '#007A5A',
        'slack-blue': '#1264A3',
        'slack-orange': '#E01E5A',
        'slack-yellow': '#ECB22E',
        
        // Custom message colors
        'message-bg': '#F8F9FA',
        'message-border': '#E1E5E9',
        'message-text': '#1D1C1D',
        'message-meta': '#616061',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
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
        'xs': '2px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 