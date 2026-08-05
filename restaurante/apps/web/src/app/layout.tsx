import type { Metadata, Viewport } from 'next';
import { Poppins, Archivo } from 'next/font/google';
import './globals.css';
import { RegistrarServiceWorker } from '@/components/registrar-sw';
import { AppChrome } from '@/components/app-chrome';

/**
 * A voz tipográfica do sistema.
 *
 * Poppins: geométrica, redonda, moderna. É a fonte dos títulos e dos números
 * grandes. Escolhida pelo fundador — a serifada que estava antes tinha ar
 * "sofisticado" demais para um sistema de trabalho.
 *
 * Archivo: para o texto do dia a dia. Simples, ótima em tamanho pequeno e com
 * números tabulares (é o que faz dinheiro alinhar em coluna nas tabelas —
 * a Poppins, sendo geométrica, é larga demais para dado denso).
 *
 * As duas são BAIXADAS NO BUILD e servidas pelo próprio sistema — nada de
 * pedir fonte para o Google em tempo de uso. Continua funcionando sem internet,
 * que é requisito do nosso PDV.
 */
const poppins = Poppins({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
  variable: '--fonte-display',
});

const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--fonte-texto',
});

export const metadata: Metadata = {
  title: 'Sistema para Restaurantes',
  description: 'Gestor de pedidos e cardápio digital sem comissão',
  // É isto que faz o navegador oferecer "instalar aplicativo".
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Restaurante' },
  icons: { icon: '/icone-192.png', apple: '/icone-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#FBF7F1',
  // O caixa usa o dedo: sem isto, um toque duplo dá zoom no meio da venda.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} ${archivo.variable}`}>
      <body>
        <RegistrarServiceWorker />
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
