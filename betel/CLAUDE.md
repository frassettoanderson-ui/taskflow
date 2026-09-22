# Betel — site do Movimento Betel

Site institucional do **Movimento Betel** (`@movimento.betel`), movimento cristão **de mulheres** sediado em **Imbituba/SC**. Nasceu por volta de setembro de 2025 (1 ano em 26/09/2026). Encontro **mensal** pago, com mesa, oração e palavra.

> Escopo decidido pelo cliente: este site fala **do movimento**. As **landing pages de eventos** (com inscrição e pagamento) vêm depois, cada uma na sua pasta.

## Stack

HTML/CSS/JS puro, sem build. Um único `index.html`.

```
index.html              página inteira (o sprite de logos fica inline no <body>)
assets/css/betel.css    folha única, tokens em :root
assets/js/betel.js      nav fixa, menu mobile, revelar no scroll (IntersectionObserver)
assets/fonts/           prata.woff2 (display) + montserrat-var.woff2 (texto), subsetados
assets/img/logo/        SVGs com fill=currentColor
assets/img/fotos/       webp em 2 larguras: nome.webp (1600px) e nome@800.webp (800px)
_dev/gerar-sprite.py    injeta os logos como <symbol> no index.html (idempotente)
_dev/gerar-recorte.py   recorta as mulheres da foto do hero (rembg) -> webp com alfa
_dev/deploy.sh          envia para a VPS por ssh
```

### O hero em camadas (marca ATRÁS das mulheres)

Não há foto de fundo. As mulheres vêm **recortadas com alfa** (`hero-mulheres.webp`, enviado pelo cliente já sem fundo) sobre um degradê quente da paleta, e o logo fica entre os dois:

| z | camada |
|---|---|
| 0 | `.hero__fundo` — degradê breu/marrom com um brilho camel atrás da marca |
| 1 | `.vinha` — plantada pelo JS |
| 2 | `.hero__marca` — lockup **sem "MOVIMENTO"** (`#lg-betel-puro`); a palavra menor sumia atrás das cabeças |
| 3 | `.hero__mulheres` — ocupa sempre os **66% de baixo** do hero, centrada; em tela estreita as laterais saem do quadro |
| 4 | `.hero__veu` — escurece só a base, para o texto |
| 5 | texto e botões |

A marca é ancorada por `bottom:59%` e limitada por altura (37svh) **e** largura (92vw): assim a base das letras fica sempre uns 5% do hero atrás das cabeças, em qualquer tela.

### Jardim: ramos da marca que surgem conforme a página rola

Cada `.hero`/`.secao` tem um `.jardim` (camada absoluta atrás do conteúdo) com 2–3 `.broto` — **só o ramo de oliveira do logo** (`#lg-ramo`), em camel ou sálvia, tamanhos/rotações/espelho por variáveis inline. O JS mede o progresso da seção na janela (0 = topo encostando na base da janela, 1 = base da seção a 40% da janela), suaviza (lerp) e escreve em `--p` no `.jardim`; cada broto tem `--t` e cresce a partir do pé (`scale` + abre a rotação + opacidade) nos 16% de progresso seguintes. É **scrub**: rolar para cima desfaz. Um balanço lento roda no `<use>` interno, para não brigar com o transform do crescimento.

**Histórico (não repetir):** (1) a primeira versão disparava os ramos de uma vez ao cruzar um limiar — o cliente achou estático; (2) a segunda foi uma "vinha" desenhada pelo JS com folhas/flores/botões autorais — o cliente rejeitou a arte ("ficou quadrado"), mesmo depois de redesenhar no estilo do logo. Ele quer **os ramos da marca, e só**, aparecendo com o scroll. Não inventar glifos novos.

Os reveals também são fortes: fotos com zoom + cortina (`clip-path`), rótulos abrindo o tracking, filetes se desenhando a partir do ramo, versos linha a linha.

**`prefers-reduced-motion` NÃO desliga nada disso** (só a entrada automática do hero). Motivo: o painel de preview e, provavelmente, a máquina do cliente reportam "reduzir movimento" (Windows com animações desligadas) — na primeira versão isso desligou todos os reveals e o cliente achou que "faltaram as animações". Reveals e vinha só andam quando a pessoa rola, então ficam ligados.

## Armadilhas já encontradas

- **`aspect-ratio` vs. atributo `height`.** As `<img>` têm `width`/`height` no HTML (bom para evitar layout shift), mas isso vira `height` fixo e **anula o `aspect-ratio` do CSS**. Por isso o reset tem `img{height:auto}`. Se tirar, as fotos voltam a renderizar com 1600px de altura.
- **`<use href="#...">` não herda a proporção do `<symbol>`.** Todo `<svg>` que usa o sprite precisa de `aspect-ratio` no CSS, senão vira 150px de altura (o default). Já declarado para `.nav__marca svg`, `.hero__marca`, `.rodape__marca` e `.ramo`.
- **Grades com `auto-fit`** deixavam cards órfãos em telas médias (3 pilares em 2 colunas, 4 retratos em 3 colunas). As colunas agora são explícitas por breakpoint.
- **Preview pane:** com viewport emulado acima da largura do painel, o screenshot às vezes sai pintado só em parte. Se acontecer, usar a largura nativa do painel ou o preset mobile. O painel também roda como **aba oculta** (`document.hidden = true`): `requestAnimationFrame` vem a ~1 quadro/s e `IntersectionObserver` atrasa — por isso o lerp do jardim usa passo 1 quando a aba está oculta. Para conferir animação de verdade, o cliente abre no navegador dele.
- **Cache de CSS/JS:** o nginx não mandava `Cache-Control` para `.css/.js`, e o navegador do cliente guardou a versão antiga por heurística (viu o site sem as animações novas). Agora `.css/.js` são `no-cache` no nginx **e** os links levam `?v=N` — subir o N a cada deploy que mude CSS/JS.
- **Recorte do hero:** o cliente mandou o recorte pronto (`hero-mulheres.webp`). `_dev/gerar-recorte.py` (rembg) fica como alternativa se trocarem a foto.

## Pendências

- **Nomes da liderança.** Os quatro retratos em "Quem caminha à frente" estão **sem legenda** de propósito — não dá para saber pelas fotos quem é quem. As contas citadas nos posts são `@gessuiporto`, `@jadivignochi`, `@juliana_nunesc` e `@nina.fsouza`. Confirmar com elas antes de legendar (há um `TODO` no HTML).
- **Warbler Banner** na web, se o cliente tiver Creative Cloud.
- Textos de fé e citação bíblica (Gênesis 28.16) foram redigidos a partir das legendas do próprio Instagram; **revisar com a liderança** antes de publicar.

## Voz da marca

Primeira pessoa do plural, íntima, frases curtas quebradas linha a linha (a classe `.verso` existe para isso). Sem jargão religioso, sem emoji, sem tom institucional. O posicionamento é explícito nos posts deles: *"não é sobre religião, aparência ou performance"*.
