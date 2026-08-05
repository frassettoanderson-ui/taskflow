'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  IconeCaixa,
  IconeCardapio,
  IconeClientes,
  IconeCozinha,
  IconeEntregas,
  IconeEstoque,
  IconeFinanceiro,
  IconeMarketing,
  IconeMenu,
  IconePedidos,
  IconeRelatorios,
  IconeSair,
  IconeSalao,
} from './icones';

/**
 * O MENU LATERAL do restaurante — a espinha do sistema.
 *
 * Fica sempre à esquerda; o que se clica aqui abre no meio da tela.
 *
 * Organizado por INTENÇÃO, não por tela solta: primeiro o que se usa com o
 * salão cheio, depois o que se cadastra com calma, depois o que se olha à
 * noite fechando o caixa.
 */

type Grupo = {
  titulo: string;
  itens: Array<{ href: string; label: string; Icone: (p: { tamanho?: number }) => React.ReactElement }>;
};

const GRUPOS: Grupo[] = [
  {
    titulo: 'Dia a dia',
    itens: [
      { href: '/painel', label: 'Pedidos', Icone: IconePedidos },
      { href: '/kds', label: 'Cozinha', Icone: IconeCozinha },
      { href: '/pdv', label: 'Caixa', Icone: IconeCaixa },
      { href: '/salao', label: 'Salão', Icone: IconeSalao },
    ],
  },
  {
    titulo: 'Sua loja',
    itens: [
      { href: '/admin', label: 'Cardápio', Icone: IconeCardapio },
      { href: '/clientes', label: 'Clientes', Icone: IconeClientes },
      { href: '/marketing', label: 'Marketing', Icone: IconeMarketing },
    ],
  },
  {
    titulo: 'Bastidores',
    itens: [
      { href: '/relatorios', label: 'Relatórios', Icone: IconeRelatorios },
      { href: '/financeiro', label: 'Financeiro', Icone: IconeFinanceiro },
      { href: '/estoque', label: 'Estoque', Icone: IconeEstoque },
      { href: '/entregadores', label: 'Entregas', Icone: IconeEntregas },
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

  const loja = me?.tenant?.name ?? 'Meu restaurante';

  return (
    <>
      {/* barra fininha só no celular, para abrir o menu */}
      <div className="menu-mobile-barra">
        <button className="menu-hamburguer" onClick={() => setAberto((a) => !a)} aria-label="Abrir menu">
          <IconeMenu tamanho={22} />
        </button>
        <span className="menu-mobile-nome">{loja}</span>
      </div>

      {aberto && <div className="menu-fundo" onClick={() => setAberto(false)} />}

      <aside className="menu-lateral" data-aberto={aberto}>
        <div className="menu-topo">
          {/* a marca: um "prato com brasa" desenhado em SVG, não emoji */}
          <div className="menu-logo" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
              <path
                d="M12 7.4c1.9 1.3 2.9 2.7 2.9 4.2a2.9 2.9 0 0 1-5.8 0c0-1.5 1-2.9 2.9-4.2Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div className="menu-loja">
            <strong>{loja}</strong>
            <span>Painel do restaurante</span>
          </div>
        </div>

        <nav className="menu-nav">
          {GRUPOS.map((g) => (
            <div className="menu-grupo" key={g.titulo}>
              <div className="menu-grupo-titulo">{g.titulo}</div>
              {g.itens.map(({ href, label, Icone }) => (
                <Link key={href} href={href} className="menu-item" data-ativo={ativo(href)}>
                  <span className="menu-icone">
                    <Icone tamanho={19} />
                  </span>
                  <span>{label}</span>
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
            <IconeSair tamanho={17} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
