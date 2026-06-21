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
        // Cores semanticas de status (paleta oficial do projeto)
        status: {
          ok: '#88b87f', // verde
          info: '#69a8d9', // azul claro
          danger: '#d15b47', // vermelho
          warn: '#ffb752', // amarelo
        },
        // Roxo oficial
        roxo: {
          50: '#f2f0f8',
          100: '#e6e1f1',
          200: '#d2cae6',
          300: '#b3a7d4',
          400: '#9585bf',
          500: '#8171ac',
          600: '#6d5d97',
          700: '#5b4d7e',
        },
        // Fundos cinza (geral / area mais escura)
        fundo: '#f0f0f0',
        caixa: '#e8e8e8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
