// Itens do menu do painel (compartilhado entre a navegação e a página de menu do celular).
export type Item = { href: string; rotulo: string; icone: string; admin?: boolean };

export const I = {
  inicio: "M3 11.5 12 4l9 7.5M5 10v10h14V10",
  pedidos: "M6 3h12l1 18H5L6 3Zm3 5h6M9 12h6",
  cadastrar: "M12 5v14M5 12h14",
  produtos: "M4 7l8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7",
  retirada: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z",
  disparos: "M4 12 20 4l-4 16-4-6-8-2Zm8 2 4-6",
  pdv: "M3 5h18v10H3zM7 19h10M12 15v4M7 9h4",
  caixa: "M4 9h16v10H4zM4 9l2-4h12l2 4M10 13h4",
  estoque: "M3 7l9-4 9 4v10l-9 4-9-4V7Zm9 4v10M3 7l9 4 9-4",
  compras: "M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2M10 20h.01M17 20h.01",
  financeiro: "M12 3v18M16.5 7.5C16 6 14.3 5 12 5c-2.8 0-4.5 1.3-4.5 3.2 0 4.3 9 2.3 9 6.6C16.5 16.7 14.7 18 12 18c-2.5 0-4.3-1.1-4.8-2.8",
  relatorios: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  clientes: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
  config: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  usuarios: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10v-1a6 6 0 0 1 12 0v1",
  mais: "M4 6h16M4 12h16M4 18h16",
};

export const GRUPOS: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "",
    itens: [{ href: "/painel", rotulo: "Início", icone: I.inicio, admin: true }],
  },
  {
    titulo: "Loja online",
    itens: [
      { href: "/painel/pedidos", rotulo: "Pedidos", icone: I.pedidos },
      { href: "/painel/produtos", rotulo: "Produtos", icone: I.produtos, admin: true },
      { href: "/painel/produtos/novo", rotulo: "Cadastrar produto", icone: I.cadastrar, admin: true },
      { href: "/painel/disparos", rotulo: "Disparos WhatsApp", icone: I.disparos, admin: true },
    ],
  },
  {
    titulo: "Loja física",
    itens: [
      { href: "/painel/pdv", rotulo: "Frente de caixa (PDV)", icone: I.pdv },
      { href: "/painel/caixa", rotulo: "Caixa", icone: I.caixa },
      { href: "/painel/estoque", rotulo: "Estoque", icone: I.estoque, admin: true },
      { href: "/painel/compras", rotulo: "Compras e fornecedores", icone: I.compras, admin: true },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/painel/financeiro", rotulo: "Financeiro", icone: I.financeiro, admin: true },
      { href: "/painel/relatorios", rotulo: "Relatórios", icone: I.relatorios, admin: true },
      { href: "/painel/clientes", rotulo: "Clientes", icone: I.clientes, admin: true },
      { href: "/painel/usuarios", rotulo: "Usuários", icone: I.usuarios, admin: true },
      { href: "/painel/config", rotulo: "Configurações", icone: I.config, admin: true },
    ],
  },
];

