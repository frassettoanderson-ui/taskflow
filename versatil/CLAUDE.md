# Projeto Versátil — loja de logística reversa (e-commerce + WhatsApp + PDV)

> Status: **ESBOÇO + identidade** (28/09/2026). Código ainda não iniciado. Marca: **VERSÁTIL — "Melhor preço da região"**, preto + dourado.

## O negócio
- Loja que vende produtos de **logística reversa** (devolução, caixa aberta, avaria leve) com preço bem abaixo do mercado.
- Canal de venda principal: **grupos de WhatsApp**. Muitas vezes é **1 unidade** de cada produto.
- Também vende **presencialmente** na loja, usando o **mesmo estoque**.

## Visão geral (fluxo principal)
```
Cadastro (bot WhatsApp ou painel)  →  sugestão de preço (média de mercado)  →  preço manual
      →  publica no site  →  disparo automático nos grupos (foto + preço + link com UTM do grupo)
      →  cliente abre o link  →  checkout (Pix/cartão via Asaas) com RESERVA da unidade
      →  webhook confirma pagamento  →  pedido cai no painel (separar / enviar / retirada)
PDV presencial  →  mesma reserva/baixa de estoque
Job diário  →  produtos "parados" → sugestão de promoção → "queimar" = baixa preço + re-dispara
```

## Módulos

### 1. Loja (site público) — mobile-first
- Vitrine, categorias, busca, página de produto com **fotos reais**, **selo de condição** (Novo lacrado / Caixa aberta / Avaria estética / Sem caixa), preço "de/por" (média de mercado riscada vs nosso preço).
- **Link com preview bonito no WhatsApp** (Open Graph: foto, título, preço) → exige renderização no servidor (SSR).
- Selo "Última unidade" / "Reservado — libera em X min".
- PWA instalável (Android e iPhone), carregamento rápido em 4G.

### 2. Checkout + pagamentos (Asaas)
- Pix (QR + copia-e-cola, expira em 10–15 min) e cartão (à vista / parcelado).
- Captura **nome + WhatsApp no primeiro passo** (base para recuperar carrinho abandonado).
- Entrega: retirada na loja / entrega local / Correios-Melhor Envio (definir).
- Webhook Asaas → pedido `PAGO` → painel + notificação.

### 3. Anti-venda-dupla (crítico)
- Estoque controlado **por unidade** (`disponivel`, `reservado`, `vendido`).
- Ao iniciar o pagamento: reserva **atômica** no banco (`UPDATE ... SET status='reservado' WHERE id=? AND status='disponivel'` — só 1 transação vence; a outra recebe "acabou de ser reservado, entre na fila").
- Reserva com **validade** (Pix 15 min / cartão até a resposta da operadora). Job libera reservas vencidas e cancela a cobrança no Asaas.
- **Fila de espera**: se a reserva expirar, avisa o próximo interessado.
- PDV usa exatamente a mesma função de reserva/baixa.
- Proteção extra: se dois pagamentos confirmarem para a mesma unidade (caso raro de corrida com webhook), o segundo é estornado automaticamente e sinalizado no painel.

### 4. Cadastro rápido
- **Bot no WhatsApp** (número interno da loja): manda 1–5 fotos + texto livre ("fritadeira air fryer mondial 4L caixa aberta") → IA (Gemini visão) monta título, categoria, descrição, condição → bot responde com a **média de mercado** → operador responde o preço → confirma → publica e dispara.
- **Painel (celular)**: tela única com câmera, ditado por voz, mesmos campos pré-preenchidos pela IA.
- Leitura de **código de barras/EAN** quando houver (acelera identificação e busca de preço).
- Custo do lote/unidade (opcional) → permite calcular margem.

### 5. Pesquisa de preço de mercado
- Busca o produto em Mercado Livre, Google Shopping e grandes varejistas (via API/serviço de busca — ex. Serper/SerpAPI; Gemini com grounding como apoio).
- Mostra **mín / mediana / máx** + 3–5 links de referência, só produtos **novos** equivalentes.
- Sugere faixas: "‑30% da mediana", "‑40%", "‑50%". **Preço final é sempre manual.**

### 6. Disparo nos grupos de WhatsApp
- Via **Evolution API** (não-oficial — a API oficial da Meta **não envia para grupos**).
- Cadastro dos grupos no painel (ativar/desativar, categoria de interesse por grupo).
- Mensagem: foto + título + condição + preço de/por + link com `?g=<grupo>` (rastreia qual grupo vende).
- **Anti-bloqueio** (lições dos incidentes anteriores): intervalo aleatório entre grupos, variação de texto por template/IA, fila com limite por hora, número dedicado ao disparo, sem mensagens idênticas em série.
- Opção de agrupar vários produtos num "combo do dia" para reduzir volume de mensagens.

### 7. Produtos parados (giro de estoque)
- Contador de **dias sem vender** + visualizações/cliques (produto visto e não vendido ≠ produto ignorado).
- Faixas: 🟢 até 7 dias · 🟡 8–20 · 🔴 21+ (configurável).
- Sugestões automáticas: baixar X%, "relâmpago 24h", combo com outro produto.
- Botão **"Queimar"**: aplica desconto + re-dispara nos grupos com texto novo ("BAIXOU!").

### 8. Painel de pedidos (operação)
- Kanban: Pago → Separando → Pronto p/ retirada / Enviado → Entregue.
- Impressão de etiqueta/romaneio, código de rastreio, mensagem automática ao cliente em cada etapa (WhatsApp individual).
- Trocas/devoluções (lembrar **direito de arrependimento de 7 dias** em compra online — CDC art. 49).

### 9. PDV presencial
- Tela de caixa no celular/tablet; busca por nome ou **QR/etiqueta** colada no produto.
- Pagamento: Pix QR na tela (Asaas), maquininha (registro manual, ou integrar depois), dinheiro.
- Baixa no mesmo estoque em tempo real → o produto some do site na hora.

### 10. Análise de desempenho
- Vendas por dia/semana, ticket médio, margem (se custo informado), **tempo médio até vender**.
- **Vendas e cliques por grupo** de WhatsApp (qual grupo rende).
- Funil: visitas → início de checkout → pagamento; **carrinhos/checkouts abandonados** com botão "chamar no WhatsApp".
- Pix gerados e não pagos, produtos mais vistos sem venda, categorias que giram mais.

## Pagamentos — decisão proposta: **Asaas**
Taxas públicas (set/2026, sem negociação): Pix **R$ 1,99 fixo** (100 primeiros/mês grátis), cartão à vista **2,99% + R$ 0,49**. Split nativo entre contas Asaas, sem custo extra.
- Pix fixo é ótimo para ticket médio/alto (R$ 300 → 0,66%); para ticket baixo (< R$ 100) o Mercado Pago (Pix ~0,99%) sai mais barato.
- Efí: cartão ~3,49%, Pix ~1,19%. Mercado Pago: cartão ~4,98% (recebimento na hora). Pagar.me: bom split, mas foco em volume maior.
- A gente já tem integração Asaas pronta (cobrança Nauta) → menos trabalho.
- Com volume, dá pra negociar taxa com o gerente Asaas.

## Stack proposta
- **Next.js** (loja com SSR p/ preview no WhatsApp + painel + PDV no mesmo app, PWA).
- **API Node/TS + Prisma + PostgreSQL** (transações para reserva atômica); Redis opcional para filas.
- **Worker** de jobs: disparos, expiração de reservas, relatório de produtos parados.
- **Evolution API** (2 instâncias: bot de cadastro + disparo).
- **Gemini** (visão/descrição) + serviço de busca de preço.
- Imagens: compressão/WebP + CDN. Hospedagem: VPS própria (container dedicado).

## Fases de construção
1. **MVP de venda**: loja + cadastro no painel + checkout Asaas (sandbox) + reserva anti-dupla + painel de pedidos.
2. **Disparo**: grupos, fila anti-bloqueio, preview OG, rastreio por grupo.
3. **Cadastro inteligente**: bot WhatsApp + IA + pesquisa de preço de mercado.
4. **PDV** + etiquetas QR.
5. **Giro e análise**: produtos parados, "queimar", dashboard, checkouts abandonados.

## Decisões (respostas do usuário, 28/09/2026)
1. **Split = taxa de serviço do Anderson** (software house). Cobrança criada na conta Asaas da LOJA, com split para a walletId do Anderson (% ou fixo por pedido — definir). Pix do PDV também gerado via Asaas → entra no split. Venda presencial em dinheiro/maquininha **não passa pelo Asaas** → precisa de regra (ex.: fatura mensal sobre essas vendas, ou taxa só sobre o online).
2. **10 grupos, ~30 produtos/dia** → ~300 mensagens/dia em grupos. Fila espalha ao longo do dia (1 produto a cada ~20–25 min por grupo) OU modo "vitrine" (3–5 posts/dia com vários produtos + link "novidades de hoje"). Configurável; começar com o modo espalhado + limite por hora.
3. **Só retirada na loja** (fase 1). Sem frete. Pedido pago gera **código de retirada** (QR + 4 dígitos) conferido no balcão; prazo de retirada configurável (definir o que acontece se não retirar). Direito de arrependimento (7 dias, CDC) continua valendo na compra online.
4. **Estoque variado** → suporta unidade única E lotes com quantidade. Reserva atômica por quantidade (`UPDATE ... SET disponivel = disponivel - :q WHERE id=? AND disponivel >= :q`).
5. **Tem CNPJ e conta Asaas.**
6. **Números de WhatsApp: ainda não tem** → precisa de pelo menos 1 chip dedicado (ideal 2: bot + disparo) antes da fase 2. Fase 1 não depende disso.

### Rodada 2 (28/09/2026)
- **Taxa do split = percentual** (valor a definir) — configurável no painel (`SPLIT_PERCENT`), aplicado sobre o valor líquido no Asaas.
- **Ticket de R$ 15 a R$ 5.000.** Pix Asaas é R$ 1,99 fixo → pesa 13% num item de R$ 15 e 0,04% num de R$ 5.000 (empate com Pix % ~0,99% ≈ R$ 200). Ações: negociar Pix percentual/tarifa menor com o gerente Asaas pelo volume (~900 vendas/mês); incentivar **carrinho com vários itens** (1 Pix para o pedido todo, não por item). Cartão: parcelamento só acima de um valor mínimo.
- **Retirada sem prazo**, mas o painel precisa de **Estornar** (total/parcial) → API de estorno do Asaas (Pix e cartão); unidade volta ao estoque; conferir como o split é revertido no estorno antes de ir pra produção.
- **Nota fiscal: ligar no nosso motor** ([[emissor-fiscal]] — NFC-e no PDV/online, NF-e se preciso).
- **Identidade: preto + dourado.**

## Identidade visual (`brand/`)
- Logo refeita em vetor a partir da original (que veio dourado-sobre-branco): `logo-dourado-fundo-preto.svg/png` (principal), `logo-dourado.svg` + `logo-dourado-transparente.png`, `logo-preto.svg` (fundo claro), `icone-app.svg` + `icone-app-512.png` (PWA/favicon/foto de perfil). Texto convertido em curvas (Montserrat 800/700) — não depende de fonte. Regerar: `python brand/gen_logo.py` (precisa de Montserrat.ttf).
- Paleta: preto `#0B0B0C` · superfície `#16161A` · dourado claro `#F3D98B` · dourado `#D4AF55` · dourado escuro `#A67C2E` · off-white `#F5F1E8`. Dourado em degradê vertical (claro→escuro) nos destaques; preço e botões de compra em dourado sólido.
- Símbolo = martelo de leilão → linguagem de "arremate / oportunidade" (ex.: "Arrematado!" quando vende, contador de reserva).

## Perguntas em aberto
- Valor do % do split; cobra também sobre venda presencial em dinheiro/maquininha?
- Domínio.
- Números de WhatsApp (bot + disparo) — antes da fase 2.
