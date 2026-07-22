# Sistema para Restaurantes — Contexto do Projeto

> Este arquivo é a **fonte de verdade** do projeto. Consultar em TODAS as etapas, antes de qualquer decisão de código.
> Status atual: **Etapas 0 a 6 concluídas.**
> — Etapa 0: fundação (Docker, multi-tenant, login/papéis, adaptadores fake).
> — Etapa 1: cardápio público → pedido → pagamento fake (Pix) → KDS → acompanhamento ao vivo.
> — Etapa 2: multimarca e multicanal (2 marcas, cardápio por canal, unidade + estações,
>   área de entrega por bairro/raio, horários, pausar marca/item, painel único de pedidos).
> — Etapa 3: salão (QR na mesa, comanda do garçom, totem, chamar garçom/pedir a conta,
>   taxa de serviço, divisão da conta, mapa de mesas, fila, reservas, papéis Caixa e Garçom).
> — Etapa 4: CRM (TenantCustomer + NetworkCustomer preparada), cashback com extrato e
>   validade, cupons segmentados, campanhas em massa pela fila (BullMQ), recuperação de
>   carrinho abandonado e NPS automático. WhatsApp segue fake.
> — Etapa 5: bastidores (relatórios/BI, estoque com ficha técnica e CMV com baixa
>   automática, financeiro com DRE e contas, entregadores com despacho e acerto, LGPD
>   com exportação e anonimização). Despacho e mapa seguem fake.
> — Etapa 6: portal (vitrine cross-tenant com opt-in, comissão embutida no preço, funil de
>   graduação, carteira da rede, split de 3 lados gravado, pool de motoboys entre tenants,
>   assinatura do SaaS). Pagamento, cobrança e despacho seguem fake.
> — Telas de cadastro (`/admin`): o restaurante monta sozinho marca, cardápio por canal
>   (com foto enviada do PC e complementos), horários, área de entrega, cashback, unidades,
>   estações, mesas em lote e equipe. Não depende mais do seed.
> — PDV (`/pdv`): o caixa do balcão. Venda nasce paga e já na cozinha, com troco calculado,
>   cliente opcional (vira CRM) e fechamento do dia por forma de pagamento. Dono/gerente/caixa.
>   Maquininha e impressora térmica continuam fora (Etapa 7).
>
> ⚠️ ETAPA 7 EM ESPERA por decisão do fundador: nada que exija conta em serviço externo
> (pagamento real, WhatsApp, mapa, NF-e, iFood, despacho) deve ser iniciado sem ele pedir.
>
> ⚠️ NUNCA pedir que o fundador cole senha ou chave no chat. O combinado é: eu digo qual
> chave e onde pegar, ELE põe no `.env` da máquina dele, e eu escrevo o código que lê de lá.
>
> ⚠️ ISOLAMENTO: só DOIS lugares leem vários tenants — `PortalService.vitrine` (marcas com
> opt-in, campos públicos) e `DeliveryService.despacharPeloPool` (entregadores com opt-in).
> Todo o resto continua trancado. Se precisar de um terceiro, discuta antes.
>
> ⚠️ ARMADILHA DE DATA: nunca use `new Date('2026-07-22')` para um dia — isso é meia-noite
> em UTC, 21h do dia anterior no Brasil. Use os helpers de `src/common/datas.ts`.
> Como rodar e testar: ver [README.md](./README.md).

## Sobre o fundador (como me comunicar)

- O fundador **não é programador**. Falar sempre em **português simples, sem jargão**.
- A cada ação, dizer **em uma frase** o que foi feito e por quê.
- Ir **um passo de cada vez** e confirmar antes de decisões importantes.

---

## 1. Visão do produto

Um sistema para restaurantes com dois grandes blocos:

**(A) SaaS de "canal próprio"** — gestor de pedidos + cardápio digital **sem comissão de marketplace**, cobrindo:
- delivery
- retirada
- atendimento presencial (salão)

**(B) Portal / marketplace próprio** — um domínio geral onde todos os restaurantes que usam o sistema aparecem e recebem pedidos. Desenhado como **funil de aquisição** que devolve o cliente para o canal próprio do restaurante — princípio **"seus clientes, seus dados"** — e **não** como mais um pedágio estilo iFood.

**Público-alvo:** de restaurantes pequenos a operações de **dark kitchen com várias marcas**.

---

## 2. Lista completa de funcionalidades (o destino final)

Construídas ao longo das etapas — não tudo de uma vez.

### Núcleo do gestor
- Multimarca num só gestor
- Agregador de canais num painel
- Cardápios independentes por canal (delivery / salão / balcão)
- KDS (tela de cozinha) por estação e por marca
- PDV integrado
- Roteamento e regras (área por bairro/raio, horários, pausar item/loja)

### Cardápio do cliente
- Sem app e sem cadastro
- Carregamento rápido
- Pagamento online no próprio cardápio
- Complementos e cross-sell
- Agendamento de pedidos
- White-label (cara da marca)
- Acompanhamento do pedido em tempo real (recebido → preparo → pronto → saiu → entregue)

### Atendimento
- IA conversacional no WhatsApp (texto / áudio / imagem)
- Multicanal (WhatsApp, Instagram, Facebook)
- Recuperação de carrinho abandonado

### Aquisição e retenção
- CRM proprietário (os dados do cliente são do restaurante)
- Fidelidade e cashback
- Tráfego pago
- Disparo de campanhas em massa
- Cupons segmentados

### Bastidores
- Relatórios / BI por marca
- Financeiro (DRE, contas a pagar/receber, acerto de motoboy/garçom)
- Estoque com ficha técnica e cálculo de CMV (custo real por prato)
- Nota fiscal (NF-e / NFC-e)
- Gestão de entregadores
- Multiunidade / multiloja com gestão central

### Presencial
- QR Code na mesa (autoatendimento)
- Comanda digital no celular/tablet do garçom
- Chamar garçom e pedir a conta pelo cardápio
- Pagamento na mesa e divisão de conta
- Totem de autoatendimento
- Gestão de salão (mapa de mesas, taxa de serviço, fila, reservas)

### Qualidade e confiança
- Pesquisa de satisfação / NPS
- Controle de usuários e permissões por perfil
- App próprio (PWA e depois nativo)
- Modo de contingência offline
- Portabilidade e exportação da base de clientes
- Segurança e LGPD

### Portal / marketplace
- Vitrine e descoberta cross-tenant (opt-in por marca)
- Carteira de cashback da rede
- Comissão embutida no preço (o restaurante recebe cheio)
- Funil de graduação (migrar o cliente do portal para o canal direto)
- Logística compartilhada (pool de motoboys)
- Tráfego / marketing coletivo

---

## 3. Modelo de monetização

Implementar a **lógica**; os **valores devem ser configuráveis** (nada de número fixo no código).

1. **Restaurante:** assinatura mensal do SaaS + taxa em algumas formas de pagamento (cobrar como "processamento": cheio no cartão, zero/baixo no Pix).
2. **Consumidor:** pequena comissão **embutida no preço**, apenas em pedidos que o **PORTAL descobriu** — **nunca** no pedido que veio pelo canal direto do restaurante.
3. **Motoboy:** cerca de **10% da taxa de entrega**. A margem principal da logística vem do **markup do frete cobrado do consumidor**, não do motoboy.

Divisão do dinheiro por **split no gateway** — a plataforma **não retém** o valor.
Modelar recebedores: **restaurante, plataforma e motoboy**.

---

## 4. Stack (já decidida — seguir)

- **TypeScript** em tudo. **Monorepo**.
- **Backend:** NestJS, organizado em **módulos separados** (um por área de negócio).
- **Frontend:** Next.js (React). O **cardápio** deve ser rápido (renderização no servidor/borda).
- **Banco:** PostgreSQL. **ORM:** Prisma. Usar **Row-Level Security** (ou filtro por tenant garantido em código) para isolar os dados de cada tenant.
- **Cache / fila / tempo real:** Redis (+ **BullMQ** para tarefas assíncronas; **pub/sub** para KDS e rastreio ao vivo).
- Tudo deve rodar na máquina do fundador com **`docker compose up`**, com **dados de exemplo (seed)**.
- **Priorizar clareza sobre esperteza.** Comentar o código. Escrever **testes básicos do que é crítico**.

---

## 5. Princípios de arquitetura

- **Monolito modular** (não microserviços agora), com **fronteiras claras** entre módulos.
- **Multi-tenant:** todo dado pertence a um **tenant**. A **marca (brand)** é entidade de **primeira classe desde já** (um tenant pode ter várias marcas). O **cardápio pertence à marca e a um canal**.
- **Pedido** tem: `tenant`, `marca`, `canal`, `origem` (`direto` | `portal` | `ifood`) e `unidade` (se presencial).
- **Portas & adaptadores** para TUDO que é externo: definir uma **interface** e, por enquanto, implementar um **FAKE**. Externos previstos:
  - `PaymentProvider` (pagamento + split)
  - `MessagingProvider` (WhatsApp / IA / push)
  - `MapProvider` (mapa / rota / frete)
  - `FiscalProvider` (NF-e)
  - `MarketplaceImport` (iFood)
  - `DeliveryProvider` (despacho de motoboy)

  ⚠️ **Nunca pedir conta em serviço externo antes da Etapa 7.**
- **Orientado a eventos internamente:** mudanças de estado do pedido emitem **eventos de domínio**; KDS, rastreio, notificações e split são **assinantes desacoplados** (se um falhar, o pedido continua).
- **Confiabilidade desde o início:** app **sem estado** (escala horizontal), **fila** para picos, **webhooks idempotentes**, **degradação graciosa**, e **modo de contingência offline** no PDV.

---

## 6. Como trabalhar com o fundador (todas as etapas)

1. **Antes de codar**, mostrar um **plano curto** da etapa e **como ele vai testar** no final. **Esperar aprovação.**
2. Construir em **partes pequenas**; a cada parte, dizer **como testar** e **confirmar que funcionou**.
3. **Commits pequenos** com mensagens claras.
4. Onde houver **mais de um caminho**, explicar as opções em **português simples** e deixar ele escolher.
5. No fim de cada etapa, entregar um **passo a passo bem mastigado** de como rodar e testar, e a lista do que ficou como **"fake / ponta solta"**.
