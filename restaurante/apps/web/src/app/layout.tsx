import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegistrarServiceWorker } from '@/components/registrar-sw';
import { AppChrome } from '@/components/app-chrome';

export const metadata: Metadata = {
  title: 'Sistema para Restaurantes',
  description: 'Gestor de pedidos e cardápio digital sem comissão',
  // É isto que faz o navegador oferecer "instalar aplicativo".
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Restaurante' },
  icons: { icon: '/icone-192.png', apple: '/icone-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#0b0b0f',
  // O caixa usa o dedo: sem isto, um toque duplo dá zoom no meio da venda.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <RegistrarServiceWorker />
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
