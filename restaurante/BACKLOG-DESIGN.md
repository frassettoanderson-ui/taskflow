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

---

## Entregue

### Pacote 1 — menu lateral + pedidos por tipo (commit a seguir)
1. [x] **Menu lateral** à esquerda em todas as telas de gestão (`MenuLateral` +
   `AppChrome` no layout raiz). Agrupado por Dia a dia / Sua loja / Bastidores,
   com rodapé de usuário e Sair. Aparece só nas rotas do painel (login, cozinha,
   caixa, cardápio do cliente e portal ficam sem menu). Vira gaveta no celular.
   - Cores atuais mantidas; identidade (marinho/laranja Obrigô?) fica p/ o pacote
     de cores.
2. [x] **Tela principal = Pedidos por tipo**: 3 colunas (Delivery, Salão,
   Retirada/Balcão), ao vivo, com botão de **recebendo pedidos / pausado** por
   marca no topo. É o que abre ao entrar no sistema.
   - Nota: a tela antiga `/pedidos` (tabela com filtros) continua existindo por
     URL, mas saiu do menu. Depois a gente decide se mescla ou aposenta.
