import type { Metadata, Viewport } from 'next';
import { Fraunces, Archivo } from 'next/font/google';
import './globals.css';
import { RegistrarServiceWorker } from '@/components/registrar-sw';
import { AppChrome } from '@/components/app-chrome';

/**
 * A voz tipográfica do sistema — "Papel & Brasa".
 *
 * Fraunces: serifada variável, com eixos de "wonk" e "soft". Tem mão de
 * artesão, de casa de comida — nada a ver com a fonte de dashboard genérico.
 * Usada nos momentos de marca: títulos e o número do pedido.
 *
 * Archivo: grotesca industrial, ótima em tamanho pequeno e com números
 * tabulares (essencial para dinheiro alinhar em coluna). É a voz do dia a dia.
 *
 * As duas são BAIXADAS NO BUILD e servidas pelo próprio sistema — nada de
 * pedir fonte para o Google em tempo de uso. Continua funcionando sem internet,
 * que é requisito do nosso PDV.
 */
// As duas são fontes VARIÁVEIS: um arquivo só cobre todos os pesos, e ainda dá
// acesso aos eixos de desenho. Por isso não listamos pesos — pedir peso fixo
// desliga os eixos (`SOFT`/`WONK`, que são justamente o charme da Fraunces).
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
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
    <html lang="pt-BR" className={`${fraunces.variable} ${archivo.variable}`}>
      <body>
        <RegistrarServiceWorker />
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
