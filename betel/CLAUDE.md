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
```

### Servidor de desenvolvimento

`preview_start` com o nome **`betel`** (definido em `.claude/launch.json` na raiz do repo) — sobe em `http://localhost:8120`. Nunca rodar servidor pelo Bash.

## Identidade

**Paleta oficial** (a mesma dos SVGs de logo entregues pelo designer):

| token | hex | uso |
|---|---|---|
| `--creme` | `#F5EEE7` | fundo principal |
| `--bege` | `#E7DCCF` | seções alternadas |
| `--camel` | `#C8A977` | acento, rótulos, CTA |
| `--salvia` | `#8A9572` | acento secundário |
| `--marrom` | `#5A4637` | texto |
| `--breu` | `#241C15` | derivado, seções escuras e rodapé |

Existe **uma segunda paleta**, do selo de evento **"Betel — Mulheres de Águas Vivas"** (`#32493F`, `#587465`, `#849A8D`, `#C8B094`, `#E6DED1`), já declarada em `:root` como `--agua-*`. É para as landing pages de evento, **não** para o institucional.

**Tipografia.** A fonte real do logo é **Warbler Banner**, que é da **Adobe Fonts** — só pode ir para a web via web project do Adobe Fonts (precisa de conta Creative Cloud). Enquanto isso o display é **Prata** (Google Fonts, licença OFL), escolhido por comparação lado a lado com o logo. Trocar = mudar só `--f-display`. O texto é **Montserrat**, que é a fonte do próprio lockup ("MOVIMENTO").

**Logos.** Os SVGs originais vieram com o logo pequeno dentro de um quadro 1920×1080; foram recortados no bounding box real e passados para `fill="currentColor"`, então a cor vem do CSS. Variantes geradas: `betel-movimento.svg` (lockup completo), `betel.svg` (só "Betel" + ramo), `simbolo.svg` (só o ramo, usado como favicon e ornamento) e `betel-aguas-vivas.svg` (selo de evento).

## Armadilhas já encontradas

- **`aspect-ratio` vs. atributo `height`.** As `<img>` têm `width`/`height` no HTML (bom para evitar layout shift), mas isso vira `height` fixo e **anula o `aspect-ratio` do CSS**. Por isso o reset tem `img{height:auto}`. Se tirar, as fotos voltam a renderizar com 1600px de altura.
- **`<use href="#...">` não herda a proporção do `<symbol>`.** Todo `<svg>` que usa o sprite precisa de `aspect-ratio` no CSS, senão vira 150px de altura (o default). Já declarado para `.nav__marca svg`, `.hero__marca`, `.rodape__marca` e `.ramo`.
- **Grades com `auto-fit`** deixavam cards órfãos em telas médias (3 pilares em 2 colunas, 4 retratos em 3 colunas). As colunas agora são explícitas por breakpoint.
- **Preview pane:** com viewport emulado acima da largura do painel, o screenshot sai pintado só em parte. Para conferir visual, usar a largura nativa do painel ou o preset mobile.

## Pendências

- **Nomes da liderança.** Os quatro retratos em "Quem caminha à frente" estão **sem legenda** de propósito — não dá para saber pelas fotos quem é quem. As contas citadas nos posts são `@gessuiporto`, `@jadivignochi`, `@juliana_nunesc` e `@nina.fsouza`. Confirmar com elas antes de legendar (há um `TODO` no HTML).
- **Domínio e hospedagem** ainda não definidos. As URLs absolutas (`canonical`, `og:image`, JSON-LD, `sitemap.xml`, `robots.txt`) estão com `https://movimentobetel.com.br/` como palpite — **trocar quando o domínio for decidido**.
- **Warbler Banner** na web, se o cliente tiver Creative Cloud.
- Textos de fé e citação bíblica (Gênesis 28.16) foram redigidos a partir das legendas do próprio Instagram; **revisar com a liderança** antes de publicar.

## Voz da marca

Primeira pessoa do plural, íntima, frases curtas quebradas linha a linha (a classe `.verso` existe para isso). Sem jargão religioso, sem emoji, sem tom institucional. O posicionamento é explícito nos posts deles: *"não é sobre religião, aparência ou performance"*.
