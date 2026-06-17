/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Azul-petroleo (mantido para compatibilidade)
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
        // Azul principal (topbar / botoes / links) - estilo Acessorias
        marca: {
          50: '#eef6fb',
          100: '#d4e8f4',
          200: '#a9d1e9',
          300: '#74b3d8',
          400: '#4f9bca',
          500: '#3f8cba',
          600: '#357ba6',
          700: '#2e6788',
          800: '#28526c',
          900: '#1f3f54',
        },
        // Cores semanticas de status (Painel de Indicadores)
        status: {
          ok: '#5cb85c', // verde - antecipado / no prazo
          info: '#5b9bd5', // azul - no prazo / antecipadas
          danger: '#cf3c5d', // vermelho/crimson - com multa / atrasado
          warn: '#f0ad4e', // laranja - a realizar / prazo tecnico
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
