'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

/**
 * O MENU LATERAL do restaurante — a espinha do sistema.
 *
 * Fica sempre à esquerda; o que se clica aqui abre no meio da tela. Substitui a
 * antiga fileira de botões no topo.
 *
 * Organizado por "o que a pessoa quer fazer", não por tela solta: primeiro o
 * dia a dia (pedidos, cozinha, caixa), depois o cadastro, depois os bastidores.
 */

type Grupo = {
  titulo: string;
  itens: Array<{ href: string; label: string; icone: string }>;
};

const GRUPOS: Grupo[] = [
  {
    titulo: 'Dia a dia',
    itens: [
      { href: '/painel', label: 'Pedidos', icone: '🧾' },
      { href: '/kds', label: 'Cozinha', icone: '👨‍🍳' },
      { href: '/pdv', label: 'Caixa (balcão)', icone: '💵' },
      { href: '/salao', label: 'Salão', icone: '🍽️' },
    ],
  },
  {
    titulo: 'Sua loja',
    itens: [
      { href: '/admin', label: 'Cardápio e cadastro', icone: '📋' },
      { href: '/clientes', label: 'Clientes', icone: '🙋' },
      { href: '/marketing', label: 'Marketing', icone: '📣' },
    ],
  },
  {
    titulo: 'Bastidores',
    itens: [
      { href: '/relatorios', label: 'Relatórios', icone: '📊' },
      { href: '/financeiro', label: 'Financeiro', icone: '💰' },
      { href: '/estoque', label: 'Estoque', icone: '📦' },
      { href: '/entregadores', label: 'Entregas', icone: '🛵' },
    ],
  },
];

const NOME_DO_PAPEL: Record<string, string> = {
  OWNER: 'Dono',
  MANAGER: 'Gerente',
  CASHIER: 'Caixa',
  WAITER: 'Garçom',
  OPERATOR: 'Cozinha',
};

type Me = {
  user: { name: string; role: string };
  tenant: { name: string } | null;
};

export function MenuLateral() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [aberto, setAberto] = useState(false); // no celular, abre/fecha

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => {});
  }, []);

  // Trocar de tela fecha o menu no celular.
  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  /** Um item conta como ativo também nas telas "filhas" dele (ex.: /pedido/x). */
  function ativo(href: string) {
    if (href === '/painel') return pathname === '/painel' || pathname.startsWith('/pedido');
    return pathname === href || pathname.startsWith(href + '/');
  }

  async function sair() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* barra fininha só no celular, para abrir o menu */}
      <div className="menu-mobile-barra">
        <button className="menu-hamburguer" onClick={() => setAberto((a) => !a)} aria-label="Menu">
          ☰
        </button>
        <span className="menu-mobile-nome">{me?.tenant?.name ?? 'Meu restaurante'}</span>
      </div>

      {aberto && <div className="menu-fundo" onClick={() => setAberto(false)} />}

      <aside className="menu-lateral" data-aberto={aberto}>
        <div className="menu-topo">
          <div className="menu-logo">🍽️</div>
          <div className="menu-loja">
            <strong>{me?.tenant?.name ?? 'Meu restaurante'}</strong>
            <span>Painel do restaurante</span>
          </div>
        </div>

        <nav className="menu-nav">
          {GRUPOS.map((g) => (
            <div className="menu-grupo" key={g.titulo}>
              <div className="menu-grupo-titulo">{g.titulo}</div>
              {g.itens.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className="menu-item"
                  data-ativo={ativo(i.href)}
                >
                  <span className="menu-icone">{i.icone}</span>
                  <span>{i.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="menu-rodape">
          {me && (
            <div className="menu-usuario">
              <div className="menu-avatar">{me.user.name.charAt(0).toUpperCase()}</div>
              <div className="menu-usuario-info">
                <strong>{me.user.name}</strong>
                <span>{NOME_DO_PAPEL[me.user.role] ?? me.user.role}</span>
              </div>
            </div>
          )}
          <button className="menu-sair" onClick={sair}>
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
