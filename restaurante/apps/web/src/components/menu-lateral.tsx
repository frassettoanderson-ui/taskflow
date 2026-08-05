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
  IconeSeta,
} from './icones';

/**
 * O MENU LATERAL do restaurante — a espinha do sistema.
 *
 * Três coisas que ele faz:
 *   - RETRAI para uma faixa de ícones, quando a tela é pequena ou a pessoa
 *     quer mais espaço para trabalhar (a escolha fica guardada);
 *   - abre SUBMENUS PARA A DIREITA, sem empurrar o resto do menu para baixo;
 *   - quando retraído, o mesmo painel da direita mostra o nome do item.
 *
 * Organizado por INTENÇÃO, não por tela solta: primeiro o que se usa com o
 * salão cheio, depois o que se cadastra com calma, depois o que se olha à
 * noite fechando o caixa.
 */

type Filho = { href: string; label: string };
type Item = {
  href: string;
  label: string;
  Icone: (p: { tamanho?: number }) => React.ReactElement;
  filhos?: Filho[];
};
type Grupo = { titulo: string; itens: Item[] };

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
      {
        href: '/admin',
        label: 'Cardápio',
        Icone: IconeCardapio,
        // O cadastro tem cinco frentes: viram submenu em vez de a pessoa ter
        // que entrar e caçar a aba certa lá dentro.
        filhos: [
          { href: '/admin?aba=cardapio', label: 'Cardápio' },
          { href: '/admin?aba=identidade', label: 'A cara da marca' },
          { href: '/admin?aba=regras', label: 'Horários e entrega' },
          { href: '/admin?aba=estrutura', label: 'Unidades e mesas' },
          { href: '/admin?aba=usuarios', label: 'Usuários' },
        ],
      },
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

const CHAVE_RETRAIDO = 'menu:retraido';

type Me = {
  user: { name: string; role: string };
  tenant: { name: string } | null;
};

export function MenuLateral() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [aberto, setAberto] = useState(false); // gaveta do celular
  const [retraido, setRetraido] = useState(false);
  /** qual item está com o painel da direita aberto, e onde ele deve aparecer */
  const [voando, setVoando] = useState<string | null>(null);
  const [ondeVoar, setOndeVoar] = useState<{ topo: number; esquerda: number } | null>(null);

  /**
   * O painel é posicionado em coordenadas de TELA, não dentro da barra.
   *
   * Motivo: a lista de menus rola, e um elemento que rola RECORTA o que sai
   * dele — o submenu apareceria cortado pela metade. Medindo o item na hora e
   * fixando o painel na tela, ele sempre sai inteiro, ao lado do item.
   */
  function abrirPainel(href: string, alvo: HTMLElement) {
    const item = alvo.getBoundingClientRect();
    const barra = alvo.closest('.menu-lateral')?.getBoundingClientRect();
    setOndeVoar({ topo: item.top - 6, esquerda: (barra?.right ?? item.right) + 8 });
    setVoando(href);
  }

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => {});
  }, []);

  // A preferência só é lida depois que a página monta — se fosse antes, o HTML
  // do servidor sairia diferente do que o navegador desenha.
  useEffect(() => {
    setRetraido(localStorage.getItem(CHAVE_RETRAIDO) === 'sim');
  }, []);

  // Trocar de tela fecha a gaveta e qualquer painel aberto.
  useEffect(() => {
    setAberto(false);
    setVoando(null);
  }, [pathname]);

  function alternarRetraido() {
    setRetraido((r) => {
      localStorage.setItem(CHAVE_RETRAIDO, r ? 'nao' : 'sim');
      return !r;
    });
    setVoando(null);
  }

  /** Um item conta como ativo também nas telas "filhas" dele (ex.: /pedido/x). */
  function ativo(href: string) {
    const base = href.split('?')[0];
    if (base === '/painel') return pathname === '/painel' || pathname.startsWith('/pedido');
    return pathname === base || pathname.startsWith(base + '/');
  }

  async function sair() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const loja = me?.tenant?.name ?? 'Meu restaurante';

  return (
    <>
      {/* barra fininha só no celular, para abrir a gaveta */}
      <div className="menu-mobile-barra">
        <button
          className="menu-hamburguer"
          onClick={() => setAberto((a) => !a)}
          aria-label="Abrir menu"
        >
          <IconeMenu tamanho={22} />
        </button>
        <span className="menu-mobile-nome">{loja}</span>
      </div>

      {aberto && <div className="menu-fundo" onClick={() => setAberto(false)} />}

      <aside className="menu-lateral" data-aberto={aberto} data-retraido={retraido}>
        <div className="menu-topo">
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

              {g.itens.map((item) => {
                const { href, label, Icone, filhos } = item;
                const temFilhos = !!filhos?.length;
                // O painel da direita aparece quando há submenu OU quando o
                // menu está retraído (aí ele serve para dizer o nome).
                const mostrarPainel = voando === href && (temFilhos || retraido);

                return (
                  <div
                    className="menu-item-caixa"
                    key={href}
                    onMouseEnter={(e) => abrirPainel(href, e.currentTarget)}
                    onMouseLeave={() => setVoando(null)}
                  >
                    <Link
                      href={href}
                      className="menu-item"
                      data-ativo={ativo(href)}
                      title={retraido ? label : undefined}
                    >
                      <span className="menu-icone">
                        <Icone tamanho={20} />
                      </span>
                      <span className="menu-rotulo">{label}</span>
                      {temFilhos && (
                        <span className="menu-seta" aria-hidden="true">
                          <IconeSeta tamanho={15} />
                        </span>
                      )}
                    </Link>

                    {mostrarPainel && (
                      <div
                        className="menu-voo"
                        style={
                          ondeVoar
                            ? { top: ondeVoar.topo, left: ondeVoar.esquerda }
                            : undefined
                        }
                      >
                        {/* retraído, o painel precisa dizer de quem ele é */}
                        {retraido && <div className="menu-voo-titulo">{label}</div>}
                        {filhos?.map((f) => (
                          <Link key={f.href} href={f.href} className="menu-voo-item">
                            {f.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
          <button className="menu-sair" onClick={sair} title="Sair">
            <IconeSair tamanho={17} />
            <span className="menu-rotulo">Sair</span>
          </button>
        </div>

        {/* o puxador que retrai/expande, colado na borda */}
        <button
          className="menu-puxador"
          onClick={alternarRetraido}
          aria-label={retraido ? 'Expandir menu' : 'Recolher menu'}
          title={retraido ? 'Expandir menu' : 'Recolher menu'}
        >
          <IconeSeta tamanho={16} />
        </button>
      </aside>
    </>
  );
}
