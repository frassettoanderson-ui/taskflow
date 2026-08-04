# Backlog de Funções — Sistema para Restaurantes

> Funções que o fundador quer ter. Cada item marca se **já temos**, **temos em
> parte** ou **não temos**. Ordem de trabalho definida por ele:
> **1º acesso do RESTAURANTE**, depois cliente, KDS, motoboy, portal, etc.
>
> A gente executa em **pacotes** (lotes), não item a item.

---

## Bloco 1 — Acesso do RESTAURANTE

### Recebimento de pedidos (liga/desliga)
- [x] **JÁ TEMOS (em parte).** Existe o botão **Pausar / Reabrir** por marca, no
  Painel (`painel/marcas.tsx` → `PATCH /brands/:id/pausa`). Pausar tira o
  cardápio do ar na hora e recusa pedido novo.
  - A refinar: deixar o botão **mais claro e visível** ("Recebendo pedidos ✅ /
    Pausado ⏸"), e avaliar se deve ser **por canal** (delivery/salão/balcão) e
    não só a marca inteira. — _entra no pacote de design + um ajuste de backend._

### Aceitar pedido automaticamente (liga/desliga)
- [ ] **NÃO TEMOS.** Hoje o pedido pago cai como "Recebido" e **espera a cozinha
  aceitar na mão** (Recebido → Aceito é clique). Falta:
  - um ajuste por marca: "aceitar pedidos automaticamente" (liga/desliga);
  - quando ligado, o pedido pago pula de Recebido direto para Aceito sozinho
    (e aí já baixa estoque, como hoje acontece no aceite manual);
  - pensar se vale ter horário ("auto-aceitar só no horário de pico") — opcional.

---

## Blocos seguintes (depois do restaurante)
_(cliente, KDS, motoboy, portal — a preencher quando chegarmos lá)_
