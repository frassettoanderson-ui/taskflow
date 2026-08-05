# Backlog de Design — Sistema para Restaurantes

> Lista do que o fundador pediu para melhorar no visual. A gente executa em
> **pacotes** (lotes), não item a item. Cada item vira uma linha aqui; quando um
> pacote é entregue, marco `[x]` e registro o commit.

## Princípio
O visual atual está "sem graça". Objetivo: deixar o sistema com cara de produto
de verdade — mais vivo, mais profissional — sem quebrar o que já funciona.

---

## A fazer (a preencher com o que o fundador for falando)

_(vazio — os itens em execução/entregues estão abaixo)_

---

## Em execução

_(nada agora)_

### A revisitar (decisão adiada pelo fundador)
- **Ligar/desligar recebimento de pedidos** — as barras verdes foram removidas
  da tela de pedidos. Pensar depois a forma certa de ligar/desligar (onde fica,
  como é o gesto). O backend (`PATCH /brands/:id/pausa`) continua pronto.
- **CSS órfão** para limpar: blocos `.recebimento*`, `.pedidos-colunas`,
  `.coluna*`, `.pedido-cliente`, `.pedido-marca` em `globals.css` ficaram sem
  uso após o pacote 2 (não renderizam; limpar numa próxima).

---

## Entregue

### Pacote 1 — menu lateral + pedidos por tipo (commit a seguir)
1. [x] **Menu lateral** à esquerda em todas as telas de gestão (`MenuLateral` +
   `AppChrome` no layout raiz). Agrupado por Dia a dia / Sua loja / Bastidores,
   com rodapé de usuário e Sair. Aparece só nas rotas do painel (login, cozinha,
   caixa, cardápio do cliente e portal ficam sem menu). Vira gaveta no celular.
   - Cores atuais mantidas; identidade (marinho/laranja Obrigô?) fica p/ o pacote
     de cores.
2. [x] **Tela principal = Pedidos**: (versão inicial em 3 colunas)
   - Nota: a tela antiga `/pedidos` (tabela com filtros) continua existindo por
     URL, mas saiu do menu. Depois a gente decide se mescla ou aposenta.

### Pacote 5 — identidade visual "Papel & Brasa" (commit a seguir)
15. [x] **Tema novo**: base clara quente (papel de cardápio) + menu lateral
    espresso. Sombras quentes, grão de papel sutil. Ver `DESIGN.md`.
16. [x] **Tipografia** distintiva: Fraunces (títulos e números) + Archivo
    (interface). Auto-hospedadas — continuam funcionando offline.
17. [x] **Ícones SVG** substituíram TODOS os emojis da interface
    (`components/icones.tsx`). Emoji sobrou só onde é conteúdo (mensagem de
    campanha ao cliente).
18. [x] **Tempo correndo** no cartão do pedido, com alerta âmbar/vermelho —
    veio das referências (iFood/Anota AI).
19. [x] **Acessibilidade**: contraste medido em todas as telas (zero problemas),
    `--muted` corrigido, alvos de toque aumentados, foco visível,
    `prefers-reduced-motion` respeitado.
20. [x] **Cor da marca à prova de escolha ruim**: luminosidade travada via
    `oklch` — amarelo-limão saiu de 1,27:1 para 5,52:1.
21. [x] **KDS mantido escuro** (tela de cozinha), com tokens próprios.

### Pacote 4 — número do pedido, caixa, indicadores por etapa, cards 1:1 (commit a seguir)
11. [x] **Cards 1:1** (quadrados).
12. [x] **Número do pedido** por dia (1,2,3...), contando TODOS os canais e
    marcas juntos. Zera quando o **caixa** é aberto (novo dia). Caixa fechado =
    pedido sem número. Nova entidade `CashSession` + `Order.dailyNumber`.
13. [x] **Indicadores por etapa** no topo (Aguardando pgto, Recebido, Em preparo,
    Pronto, Saiu) — além de Faturado/Pedidos hoje.
14. [x] **Botões**: Abrir caixa ⇄ Fechar caixa; Parar pedidos ⇄ Receber pedidos
    (single = a marca; multi = todas); e no multi um **dropdown** para ligar/
    desligar cada estabelecimento.
    - Pendências anotadas: alinhar o "Fechamento do dia" do PDV com a sessão de
      caixa (hoje o PDV conta por data, não por sessão).

### Pacote 3 — topo do painel: resultados + ações + abas
6. [x] **Removidos** o título "Pedidos" e o checkbox "mostrar finalizados".
7. [x] **Painel de resultados**: Faturado hoje + Pedidos hoje (endpoint novo
   `GET /orders/resumo`, calculado no fuso local, dia inteiro — não preso aos
   últimos 100; ao vivo). Espaço para mais métricas depois.
8. [x] **Barra de ações** com **+ Novo pedido** em destaque.
   - Provisório: por ora aponta para `/pdv` (o fluxo existente de criar venda).
     Definir depois o fluxo próprio de "novo pedido" (escolher tipo) e os demais
     botões da barra.
9. [x] **Abas por tipo**: Todos, Salão, Retirada, Delivery — filtram a lista.
10. [x] **Abas por estabelecimento** (2ª fileira, só no modo multi): Todos
    estabelecimentos + cada marca.

### Pacote 2 — pedidos em lista única com tags
3. [x] **Removidas as barras verdes** de recebimento (decisão de ligar/desligar
   adiada — ver "A revisitar").
4. [x] **Tudo numa lista só** (grade que flui), sem separar em colunas.
5. [x] Cada pedido ganhou **TAGS**: tipo (**Delivery**, **Retirada/Balcão** e
   **Salão · mesa X** — a mesa vem do backend agora) + estabelecimento (só no
   modo multi). Cada tipo tem sua cor para bater o olho.
