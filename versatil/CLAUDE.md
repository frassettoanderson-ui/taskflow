# Projeto Versátil → agora **L3 SALVADOS** — loja de logística reversa (e-commerce + WhatsApp + PDV)

> 🔁 **05/10/2026 — marca trocada (pedido do usuário):** todo nome/logo da Versátil saiu do sistema; a loja agora é **L3 Salvados**. Nome central em `app/src/lib/marca.ts` (+ config `loja_nome`). Sem logo ainda → marca em TEXTO (`components/Marca.tsx`: selo dourado "L3" + "SALVADOS"); ícone/favicon `public/icone-512.png`, `src/app/icon.png` (cópia em `brand/icone-l3-512.png`). Banner 05 refeito (`brand/banners/_ferramentas/inst_texto_l3.py`, "Qualidade com preço justo"). Logos antigas em `brand/_antigo-versatil/` (não usar). Logins de teste: `admin@l3salvados.local`, `caixa@l3salvados.local`. Pasta/repo/banco continuam com nome `versatil` (interno, não aparece). Slogan "Melhor preço da região" era da Versátil — não usar.

> Status: **FASES 1, 2 e LOJA FÍSICA (PDV/caixa/estoque/financeiro) PRONTAS EM DEV** (29/09/2026) — loja + checkout + reserva anti-venda-dupla + painel + **disparo automático nos grupos de WhatsApp**, testado em modo demonstração. **Não está no ar.**
> 🎨 Layout (28/09, pedido do usuário): **inspirado no Mercado Livre**, tema CLARO (loja e painel), dourado + branco. Faixa dourada no topo (logo preta) com degradê dourado→cinza atrás do banner + cards de atalho sobrepostos; cards "poly-card" (texto à ESQUERDA como no ML — exceção à regra de centralizar); preço estilo ML (centavos sobrescritos, peso normal); % OFF e "Retire na loja" em verde #00A650; botão principal preto c/ texto dourado, secundário dourado-claro; fonte Figtree. Página de produto em 3 colunas (galeria c/ miniaturas verticais | info + "O que você precisa saber" | caixa de compra), depois relacionados, Características (tabela zebrada) e Descrição. Listagem /busca com filtros laterais (categoria, condição, preço).
> 🧭 Cabeçalho (28/09): faixa PRETA de ponta a ponta, logo dourada original, menu em branco. Banner principal de ponta a ponta (400px desktop / 500px ≥1700px / 230px celular) com degradê para o cinza; cards de destaque (visto recentemente, também te interessa, conclua sua compra, carrinho, postado por último, oferta do dia, última unidade, mais procurados, mais vendidos, preço baixo + card preto) sobrepostos.
> 🖼️ Artes do banner: usuário vai gerar 7. **Computador 1920×500** (proporção 3,84:1 — 2458×640 também serve; área segura x360–1560, y40–350; parte de baixo termina em #EDEDED; cards sobem 72% em todas as larguras) + **celular 1080×660** opcional (área segura x60–1020, y40–430). Salvar em `UPLOAD_DIR/banners/` como `01.jpg`, `01-mobile.jpg`, `02.jpg`… (servidas por /api/banner); destino de cada um em `links.json` ({"01.jpg": "/busca?cat=ferramentas"}). Sem versão mobile, o celular mostra a arte inteira menor (sem cards por cima). Cópia das artes aplicadas em `brand/banners/` (uploads/ não vai pro git — copiar no deploy). 1ª arte: ferramentas (28/09). Modelos em `brand/modelo-banner-*.png`. Sem artes = slides gerados em código.
> ✅ Rodada 29/09 (usuário ausente, executado sozinho): 7 banners finais (Dreamina/Nano Banana + recomposição local — `brand/banners/_ferramentas/*.py`; institucional com logo real); "Imbituba - SC" embaixo da logo (config `loja_cidade`); login/cadastro de cliente (`/entrar`, `/cadastro`, `/conta`, cookie `vs_cli`, assume ficha antiga só se o CPF bater; checkout preenchido); mini banner do grupo do WhatsApp (config `loja_grupo_whatsapp`); página de produto no padrão ML (barra voltar/compartilhar, vídeo YouTube ou upload mp4 com Range em /api/video, % OFF em selo verde, meios de pagamento, vendedor "Loja oficial", garantias, favoritos, "Adicionar ao carrinho" LARANJA).
> ⏳ Pendente do usuário: link do grupo e WhatsApp da loja em Configurações (sem eles banners 06/07 e mini banner ficam sem clique); endereço da loja; produtos na categoria Brinquedos.
> ⚠️ Decisão do usuário (28/09): **NADA de tema leilão** (sem "lote", "arrematado", martelo animado). É uma **loja online normal**, preto+dourado, com fotos reais e página de produto completa (marca, SKU, aplicação/compatibilidade, especificações). O martelo fica só na logo. Marca: **VERSÁTIL — "Melhor preço da região"**, preto + dourado.

### Loja física — PDV, caixa, estoque, compras, financeiro (feito 29/09, usuário na estrada)
Decisão: construído DENTRO do app Versátil (mesmo banco/estoque), inspirado no FinOpenPOS (MIT) de `C:\dev\pos` — não é sistema separado.
- **PDV** `/painel/pdv`: busca/leitor (EAN, SKU, código "V000123" da etiqueta, Enter adiciona), desconto R$/%, cliente opcional (senão "Consumidor final"), pagamento Dinheiro/Pix/Débito/Crédito com **pagamento misto** e troco (só no dinheiro), Pix com QR estático (BR Code) se `loja_pix_chave` configurada, atalhos F2/F10/Esc, cupom 80mm `/painel/cupom/[id]` (NÃO é documento fiscal). Exige caixa aberto.
- **Caixa** `/painel/caixa`: abrir c/ troco, sangria (validada contra dinheiro na gaveta), suprimento, fechamento com contagem (dinheiro esperado × contado → sobra/falta; Pix/cartão conferidos), relatório `/painel/caixa/[id]` imprimível. Devoluções em dinheiro saem da gaveta.
- **Devolução no balcão**: página do pedido PDV → Estornar (total/parcial), escolhe "devolver em" (dinheiro/Pix/estorno no cartão), itens voltam ao estoque. Só ADMIN estorna.
- **Estoque** `/painel/estoque`: valor de custo/venda, margem, mínimo + filtro "Repor", ajuste de contagem e perda/avaria (com custo), histórico por produto. **Etiquetas** `/painel/etiquetas` (CODE128, 50×30 ou A4).
- **Compras** `/painel/compras`: fornecedores, entrada de mercadoria (NF, custo → **custo médio**, conta a pagar paga/pendente).
- **Financeiro** `/painel/financeiro`: contas a pagar/receber por mês, recorrência (repetir N meses), baixa/reabrir/cancelar, vencidas; vendas/estornos/compras entram sozinhos (`src/lib/registros.ts`). **DRE**: receita (site+balcão) − devoluções − CMV (custo gravado no item na hora da venda; itens devolvidos ao estoque saem do CMV) − despesas pagas − perdas. Compras NÃO são despesa na DRE (viram estoque).
- **Relatórios** `/painel/relatorios` (7/30/90/365 dias: por dia, canal, forma, operador, top produtos, lucro), **Clientes**, **Usuários** (ADMIN × OPERADOR — operador só vê PDV, Caixa e Pedidos; demais páginas redirecionam p/ PDV).
- Núcleo: `src/lib/lojafisica.ts`, `src/lib/pix.ts`, `src/lib/periodo.ts`, ações em `src/app/painel/loja-acoes.ts`.
- Testado 29/09 no navegador + banco: compra (estoque +10, custo médio, despesa pendente), perda, conta fixa 3 meses + baixa, venda dinheiro c/ troco, venda mista Pix+débito, estorno total (Pix) e parcial (dinheiro → sai da gaveta), fechamento com sobra R$ 0,10, operador (redirecionamentos, abre caixa, vende), cupom, etiquetas, DRE. Build de produção ok.
- ⏳ Falta: **NFC-e** (liga no emissor-fiscal; precisa do certificado A1 da loja — só com confirmação do usuário), maquininha integrada (hoje é registro manual), chave Pix/razão social/CNPJ/endereço em Configurações.

## Código (`app/`)
- Next.js 16 (App Router, Turbopack) + Prisma 6 + PostgreSQL + Tailwind 4. Ver `app/README.md` para rodar/deploy.
- Dev: `npm run dev` em `app/` (Postgres embutido na 5433, Next na 3100; launch config `versatil`). Painel `/painel` com usuário do seed (.env).
- Núcleo: `src/lib/pedidos.ts` (reserva atômica `UPDATE ... WHERE disponivel >= q`, status por compare-and-set, expiração, pagamento atrasado → re-reserva ou estorno automático, estorno total/parcial). `src/lib/asaas.ts` (sem chave = modo demo). Webhook `src/app/api/webhooks/asaas`. Job de expiração em `src/instrumentation.ts` (30s) + varredura preguiçosa nas páginas.
- Split = `ASAAS_SPLIT_PERCENT` + `ASAAS_SPLIT_WALLET_ID` no .env do servidor (a loja NÃO edita).
- Testes feitos 28/09: 10 compras simultâneas da última unidade → 1 aprovada/9 recusadas; pagamento após expiração com item já vendido → estorno automático + alerta; estorno total devolve ao estoque; retirada por código; upload de foto (compressão no navegador → WebP).
- Cartão: página hospedada do Asaas (invoiceUrl) — sem parcelamento ainda. Fotos servidas por `/api/img/*` a partir de `UPLOAD_DIR`.

### Fase 2 — disparo nos grupos (feito 28/09)
- `src/lib/disparos.ts` (fila + worker 10s em `instrumentation.ts`), `src/lib/evolution.ts` (Evolution API; sem `EVOLUTION_URL` = modo demo com 3 grupos de teste), `src/lib/mensagem.ts` (mesmo formato do post atual deles: 🔥 título, 💰 de/por, ✔️ aplicação/marca/SKU, link com `?g=<grupo>`; abertura/chamada/fecho variam por grupo — anti-restrição).
- Ritmo padrão (painel → Disparos): 45–120s entre mensagens, 6 min no mesmo grupo, 40/h, 8h–21h. Pausar/retomar, "enviar próximo agora", tirar produto da fila.
- Enfileira ao publicar (checkbox, padrão configurável) ou ao editar ("avisar nos grupos": preço menor = PROMOÇÃO, senão REENVIO). Na hora do envio re-checa estoque — vendido = cancela.
- Imagem vai como JPEG base64 (webp o WhatsApp trata como figurinha). Grupos: botão "Buscar grupos do WhatsApp" importa desativados → ativar um a um.
- Rastreio: `Clique` por grupo (visita com ?g=) + `Pedido.origemGrupo` → painel mostra envios/cliques/vendas/receita por grupo (7 dias).
- Testado: 6 disparos (2 produtos × 3 grupos) com textos diferentes por grupo; venda atribuída ao grupo; clique registrado.
- Produtos de exemplo (seed, só dev): fotos do Unsplash (licença livre) em `app/prisma/demo/` + o comutador Facobras do print do usuário.

- **Conexão do número (29/09):** na própria tela Disparos (quadro de envios): status, botão "Conectar número (QR Code)" — cria a instância na Evolution se não existir (`EVOLUTION_INSTANCE`, padrão `versatil`), mostra o QR, confere a cada 3s e renova o QR a cada 40s; ao conectar já puxa os grupos. "Desconectar / trocar número" = logout. Grupos em LISTA (tabela), só os grupos em que o número está (`Grupo.presente`; os que ele saiu somem e param de receber). Fila segura sozinha enquanto o número estiver desconectado. Testado com Evolution simulada local.
- Decisão do usuário (29/09): usar a **Evolution da primeira VPS**; 1 número que fica em todos os grupos só publicando.

- **Sem código de retirada (decisão do usuário 29/09):** tela "Retirada no balcão" removida; entrega = Pedidos → "Confirmar retirada". Cliente vê "Seu pedido #N — informe seu nome ou o número". Coluna `codigoRetirada` ficou no banco, sem uso.

- **Preço de mercado automático (05/10):** no cadastro de produto, bloco "Preço de mercado automático": foto → Gemini (`GEMINI_API_KEY`/`GEMINI_MODEL`) reconhece título/marca/modelo/EAN/categoria/descrição (preenche só campos vazios) → busca anúncios NOVOS no Mercado Livre → descarta fora de 45–220% da mediana (e filtra pela marca se sobrar ≥3) → mediana vira "preço de mercado" e preço = mediana − `preco_desconto_pct` (30%, em Configurações) terminando em ,90. Também busca por texto. Código: `src/lib/precoMercado.ts`, `src/app/painel/preco-acoes.ts`, `produtos/PesquisaPreco.tsx`, `config/ConexaoML.tsx`. ML exige aplicação (API pública dá 403 desde 2025): `ML_CLIENT_ID`/`ML_CLIENT_SECRET`/`ML_REDIRECT_URI`; tenta client_credentials, senão OAuth com código colado em Configurações (refresh token salvo em Config `ml_refresh_token`). Se /sites/MLB/search for negado, cai para /products/search + /products/{id}/items. Sem credenciais = SIMULAÇÃO (avisa na tela). Testado em simulação; falta testar com chaves reais.

### Pendências → produção
- Chave **sandbox** do Asaas da loja + walletId do Anderson para testar integração real (NÃO reaproveitar chaves da Nauta).
- Conferir no sandbox como o split é revertido no estorno.
- Domínio + VPS (container próprio) + HTTPS; definir % do split.
- WhatsApp: chip dedicado ao disparo + instância Evolution (definir qual Evolution usar — perguntar antes de mexer em Evolution existente) → preencher EVOLUTION_URL/API_KEY/INSTANCE, buscar grupos e ativar.

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
