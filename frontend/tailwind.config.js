/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        brand: {
          blue: '#3B82F6',
          'blue-dark': '#2563EB',
          'blue-light': '#60A5FA',
        },
        // Urgency level colors (dynamic, item-specific)
        urgency: {
          critical: '#EF4444',      // Red
          warning: '#F59E0B',       // Yellow/Orange
          healthy: '#10B981',       // Green
          unknown: '#9CA3AF',       // Gray
        },
        // Confidence level colors
        confidence: {
          high: '#10B981',          // Green
          medium: '#F59E0B',        // Yellow
          low: '#EF4444',           // Red
          none: '#9CA3AF',          // Gray
        },
        // UI neutrals
        neutral: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
