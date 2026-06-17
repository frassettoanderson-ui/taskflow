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
        // Cor principal (topbar / botoes / links). Definida via CSS vars para
        // permitir a troca de estilo (ver index.css / lib/tema.ts).
        marca: {
          50: 'rgb(var(--marca-50) / <alpha-value>)',
          100: 'rgb(var(--marca-100) / <alpha-value>)',
          200: 'rgb(var(--marca-200) / <alpha-value>)',
          300: 'rgb(var(--marca-300) / <alpha-value>)',
          400: 'rgb(var(--marca-400) / <alpha-value>)',
          500: 'rgb(var(--marca-500) / <alpha-value>)',
          600: 'rgb(var(--marca-600) / <alpha-value>)',
          700: 'rgb(var(--marca-700) / <alpha-value>)',
          800: 'rgb(var(--marca-800) / <alpha-value>)',
          900: 'rgb(var(--marca-900) / <alpha-value>)',
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
