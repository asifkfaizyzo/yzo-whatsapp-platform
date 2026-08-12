/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#f0f6ff',
          100: '#e0edff',
          200: '#c2dbff',
          300: '#94beff',
          400: '#5e99ff',
          500: '#3672f7',
          600: '#125fe2', // Custom royal blue palette
          700: '#0f4fc8',
          800: '#104094',
          900: '#133777',
          950: '#0c224b',
        }
      }
    },
  },
  plugins: [],
};