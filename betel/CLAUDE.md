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

### O hero em camadas (marca ATRAS das mulheres)

O efeito pedido pelo cliente: o logo parece estar atrás das moças. É feito com duas
cópias da mesma foto empilhadas, e o logo no meio:

| z | camada | o que é |
|---|---|---|
| 0 | `.hero__foto img` | a foto inteira |
| 1 | `.hero__sombra` | escurece **só o fundo**, para a marca clara ganhar contraste contra o ciclorama (que é claro) |
| 2 | `.hero__marca` | o logo |
| 3 | `.hero__recorte` | as mulheres + os objetos da frente, recortados com alfa |
| 4 | `.hero__veu` | véu geral, unifica as duas camadas e segura a leitura do texto |
| 5 | texto e botões | sempre nítidos |

Regras que sustentam isso e quebram fácil se mexidas:

- `.hero__conteudo` é `position:relative` **sem `z-index`** de propósito. Se ganhar um `z-index`, vira contexto de empilhamento próprio e o logo não consegue mais ficar atrás do recorte.
- `.hero__recorte` tem que usar **exatamente** o mesmo `object-fit`/`object-position` e as mesmas dimensões da foto de fundo, senão as camadas desencontram.
- A marca do hero tem **keyframe próprio** (`sobe-marca`). Ela fica deslocada com `translateY(var(--marca-sobe))`, e a animação de entrada padrão terminava em `transform:none` — o que zerava o deslocamento.
- O hero usa o lockup **sem "MOVIMENTO"** (`#lg-betel-puro`): a palavra menor sumia inteira atrás das cabeças. O lockup completo segue no topo e no rodapé.

### No ar

**http://89.117.79.163:8120/** — VPS antiga, nginx estatico em `/var/www/betel`, site `/etc/nginx/sites-enabled/betel`. Sem dominio ainda, por isso e servido por porta (o `ufw` da maquina esta inativo, entao a porta responde de fora).

Deploy = `bash _dev/deploy.sh` (tar por ssh; nao mexe em `/var/www/taskflow` nem em nenhum outro app da VPS). Quando houver dominio: trocar o `listen 8120` por 80/443 + `server_name` e rodar o certbot.

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

### Jardim: ramos e flores que nascem ao rolar

Cada `.secao` tem um `.jardim` (camada absoluta atrás do `.container`, que ganhou `z-index:1`) com vários `.broto` — o ramo da marca (`#lg-ramo`) e uma margarida desenhada no mesmo espírito (`assets/img/logo/flor.svg`, `#lg-flor`). Posição, tamanho, rotação e espelho vêm de variáveis inline (`--tam`, `--rot`, `--esp`), e cada broto tem um `data-inicio` (0..1): o JS calcula o quanto a seção já entrou na tela e, ao passar desse ponto, adiciona `.nasceu`. A transição com overshoot faz o "brotar" a partir do pé; depois um `@keyframes balanca` lento mantém tudo vivo. Uma vez nascido, não volta à semente ao rolar para cima. Os atrasos do balanço são ≥ 1.9s de propósito — um atraso negativo atropelaria a transição de crescimento.

Os reveals também foram reforçados: fotos entram com zoom leve e "cortina" (`clip-path`), rótulos abrem o tracking, os filetes se desenham a partir do ramo, os versos sobem linha a linha. Tudo desliga em `prefers-reduced-motion`.

## Armadilhas já encontradas

- **`aspect-ratio` vs. atributo `height`.** As `<img>` têm `width`/`height` no HTML (bom para evitar layout shift), mas isso vira `height` fixo e **anula o `aspect-ratio` do CSS**. Por isso o reset tem `img{height:auto}`. Se tirar, as fotos voltam a renderizar com 1600px de altura.
- **`<use href="#...">` não herda a proporção do `<symbol>`.** Todo `<svg>` que usa o sprite precisa de `aspect-ratio` no CSS, senão vira 150px de altura (o default). Já declarado para `.nav__marca svg`, `.hero__marca`, `.rodape__marca` e `.ramo`.
- **Grades com `auto-fit`** deixavam cards órfãos em telas médias (3 pilares em 2 colunas, 4 retratos em 3 colunas). As colunas agora são explícitas por breakpoint.
- **Preview pane:** com viewport emulado acima da largura do painel, o screenshot às vezes sai pintado só em parte. Se acontecer, usar a largura nativa do painel ou o preset mobile.
- **Recorte do hero:** foi feito com `rembg` (isnet-general-use + alpha matting) rodando local, e **não** com API generativa de imagem — essas redesenham a foto, e aqui o recorte precisa bater pixel a pixel com o fundo. O modelo baixa ~179MB na primeira execução.

## Pendências

- **Nomes da liderança.** Os quatro retratos em "Quem caminha à frente" estão **sem legenda** de propósito — não dá para saber pelas fotos quem é quem. As contas citadas nos posts são `@gessuiporto`, `@jadivignochi`, `@juliana_nunesc` e `@nina.fsouza`. Confirmar com elas antes de legendar (há um `TODO` no HTML).
- **Domínio.** As URLs absolutas (`canonical`, `og:image`, JSON-LD, `sitemap.xml`, `robots.txt`) estão com `https://movimentobetel.com.br/` como palpite — **trocar quando o domínio for decidido**. Enquanto isso o site responde por IP:porta, o que serve para revisão mas não para divulgar.
- **Warbler Banner** na web, se o cliente tiver Creative Cloud.
- Textos de fé e citação bíblica (Gênesis 28.16) foram redigidos a partir das legendas do próprio Instagram; **revisar com a liderança** antes de publicar.

## Voz da marca

Primeira pessoa do plural, íntima, frases curtas quebradas linha a linha (a classe `.verso` existe para isso). Sem jargão religioso, sem emoji, sem tom institucional. O posicionamento é explícito nos posts deles: *"não é sobre religião, aparência ou performance"*.
