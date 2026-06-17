/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Azul-petroleo primario + cinza-claro de fundo
        petroleo: {
          50: '#eef6f6',
          100: '#d3e8e8',
          200: '#a7d1d2',
          300: '#6fb2b4',
          400: '#3d8e91',
          500: '#1f7376',
          600: '#0f5c5e',
          700: '#0c4a4c',
          800: '#0b3c3e',
          900: '#0a3133',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
