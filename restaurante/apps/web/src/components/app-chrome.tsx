'use client';

import { usePathname } from 'next/navigation';
import { MenuLateral } from './menu-lateral';

/**
 * Decide quando mostrar o menu lateral.
 *
 * O menu é do PAINEL do restaurante. Ele NÃO deve aparecer em:
 *   - login;
 *   - cardápio do cliente (/m), mesa (/mesa), acompanhamento (/pedido);
 *   - cozinha (/kds) e caixa (/pdv) — são telas de tela cheia, cada uma no seu
 *     modo, e o operador não fica navegando por menu ali;
 *   - portal (é do consumidor) e a tela de "sem internet".
 *
 * Em vez de mover dezenas de arquivos de pasta, este componente envolve tudo no
 * layout raiz e liga o menu só nas rotas de gestão.
 */

/** Rotas que ganham o menu lateral. */
const ROTAS_DO_PAINEL = [
  '/painel',
  '/pedidos',
  '/clientes',
  '/marketing',
  '/relatorios',
  '/financeiro',
  '/estoque',
  '/entregadores',
  '/admin',
  '/salao',
];

/** Telas que, mesmo dentro das rotas acima, são "tela cheia" e não levam menu. */
const EXCECOES = ['/salao/mesa'];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  const ehExcecao = EXCECOES.some((r) => pathname === r || pathname.startsWith(r + '/'));
  const ehPainel =
    !ehExcecao &&
    ROTAS_DO_PAINEL.some((r) => pathname === r || pathname.startsWith(r + '/'));

  if (!ehPainel) return <>{children}</>;

  return (
    <div className="console">
      <MenuLateral />
      <div className="console-area">{children}</div>
    </div>
  );
}
