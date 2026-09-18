import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Em producao o app e servido sob /gestoroa (mesmo dominio da Nauta, atras do nginx).
// Em dev continua na raiz para o proxy /api funcionar sem prefixo.
export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? '/gestoroa/' : '/';
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'GestorOA',
          short_name: 'GestorOA',
          description: 'Gestao de obrigacoes acessorias',
          theme_color: '#0f5c5e',
          background_color: '#f1f5f4',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            {
              src: 'icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
      }),
    ],
    server: {
      port: 5174,
      proxy: {
        '/api': 'http://localhost:4002',
        '/p': 'http://localhost:4002',
      },
    },
  };
});
