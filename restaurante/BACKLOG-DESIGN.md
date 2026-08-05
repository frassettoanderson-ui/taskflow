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

### Pacote 2 — pedidos em lista única com tags (commit a seguir)
3. [x] **Removidas as barras verdes** de recebimento (decisão de ligar/desligar
   adiada — ver "A revisitar").
4. [x] **Tudo numa lista só** (grade que flui), sem separar em colunas.
5. [x] Cada pedido ganhou **TAGS**: tipo (**Delivery**, **Retirada/Balcão** e
   **Salão · mesa X** — a mesa vem do backend agora) + estabelecimento (só no
   modo multi). Cada tipo tem sua cor para bater o olho.
