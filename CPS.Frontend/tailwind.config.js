/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          50: '#fbf2ed',
          100: '#f6e1d4',
          500: '#d97757',
          600: '#c4613f',
          700: '#9d4e33',
        },
        'light-base': '#faf9f5',
        'light-raised': '#ffffff',
        'light-subtle': '#f3f1ea',
        'light-input': '#ffffff',
        'light-primary': '#1f1e1d',
        'light-secondary': '#5a564f',
        'light-tertiary': '#8a857a',
        'light-faint': '#b8b3a7',
        'light-DEFAULT': '#e6e2d8',
        'light-strong': '#d5d0c3',
        'light-subtle-border': '#efebe0',

        'dark-base': '#1c1b1a',
        'dark-raised': '#242321',
        'dark-subtle': '#2b2a27',
        'dark-input': '#242321',
        'dark-primary': '#f5f5f5',
        'dark-secondary': '#d0d0d0',
        'dark-tertiary': '#a0a0a0',
        'dark-faint': '#707070',
        'dark-DEFAULT': '#3a3a38',
        'dark-strong': '#4a4a48',
        'dark-subtle-border': '#2a2a28',

        success: {
          light: '#e9f0e1',
          DEFAULT: '#4a7c3a',
        },
        warning: {
          light: '#fbecd9',
          DEFAULT: '#b87333',
        },
        danger: {
          light: '#f6e1df',
          DEFAULT: '#b2413a',
        },
        info: {
          light: '#e2ecf3',
          DEFAULT: '#3c6c8c',
        },
      },
      backgroundColor: ({ theme }) => ({
        light: {
          base: '#faf9f5',
          raised: '#ffffff',
          subtle: '#f3f1ea',
          input: '#ffffff',
        },
        dark: {
          base: '#1c1b1a',
          raised: '#242321',
          subtle: '#2b2a27',
          input: '#242321',
        },
      }),
      textColor: ({ theme }) => ({
        light: {
          primary: '#1f1e1d',
          secondary: '#5a564f',
          tertiary: '#8a857a',
          faint: '#b8b3a7',
        },
        dark: {
          primary: '#f5f5f5',
          secondary: '#d0d0d0',
          tertiary: '#a0a0a0',
          faint: '#707070',
        },
      }),
      borderColor: ({ theme }) => ({
        light: {
          DEFAULT: '#e6e2d8',
          strong: '#d5d0c3',
          subtle: '#efebe0',
        },
        dark: {
          DEFAULT: '#3a3a38',
          strong: '#4a4a48',
          subtle: '#2a2a28',
        },
      }),
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        full: '9999px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
        sm: '0 2px 4px rgba(0, 0, 0, 0.08)',
        md: '0 4px 12px rgba(0, 0, 0, 0.15)',
        lg: '0 10px 25px rgba(0, 0, 0, 0.2)',
        focus: '0 0 0 3px rgba(217, 119, 87, 0.25)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs: '11px',
        sm: '13px',
        base: '14px',
        md: '15px',
        lg: '17px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        display: '44px',
      },
      transitionDuration: {
        fast: '120ms',
        DEFAULT: '200ms',
        slow: '360ms',
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(.22,.61,.36,1)',
      },
      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
        caps: '0.04em',
      },
    },
  },
  plugins: [
    ({ addBase, matchUtilities, theme }) => {
      addBase({
        ':root': {
          '@apply bg-light-base text-light-primary': {},
          colorScheme: 'light',
        },
        '.dark': {
          '@apply bg-dark-base text-dark-primary': {},
          colorScheme: 'dark',
        },
        'html, body': {
          '@apply transition-colors duration-200': {},
        },
      });
    },
  ],
}

