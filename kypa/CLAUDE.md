# Kypá Cosméticos — remodelação do site (DEMO)

Proposta de novo site para https://kypacosmeticos.com.br/ (loja Shopify atual). **Só demonstração** — sacola funciona em localStorage, checkout não existe.

## Stack
HTML/CSS/JS puro + GSAP/ScrollTrigger (cdnjs). Preview: `.claude/launch.json` → `kypa` (python http.server :8130).

## Identidade (extraída do site + Instagram @kypacosmeticos)
- Verde da marca `#6E9B22` (logo). Selo oficial: K com folha + "Kypá Cosméticos. Essência que vem da natureza."
- **Motivo central:** a faixa diagonal colorida da embalagem (ângulo `--tilt: -26deg`). Cada linha tem sua cor; o site "veste" a cor da linha ativa via `--c`.
- Cores das linhas estão em `LINHAS` (assets/js/app.js), amostradas das embalagens.
- Fontes: Fraunces (display, SOFT) + Hanken Grotesk.

## Assets
- `assets/js/produtos.js` — 57 produtos reais (products.json da Shopify: nome, preço, linha, benefícios).
- `assets/img/recortes/*.webp` — frascos recortados (rembg isnet) — kits usam `produtos/kit-*.jpg` (potes semitransparentes no recorte).
- `logo-mask.png`, `selo-ring-mask.png`, `selo-k-mask.png` — máscaras CSS (colorir via background).

- `assets/img/ambiente/` — 4 imagens geradas no Dreamina (Nano Banana Pro, 840 créditos, 28/09) no canvas "Kypá — site" (project 67ad601f-0e8b-4249-a710-3f8e0fa40e10): bancada (seção .scene) + jaborandi/mandioca/tutano (dentro do selo da seção essência). Letras miúdas dos rótulos saem embaralhadas — não usar em close grande.
- `assets/video/bancada-loop.{webm,mp4}` — loop 7,7s gerado no Dreamina (Seedance 2.0 Fast 720p, 320 créditos, primeiro=último quadro) + crossfade 0,4s no ffmpeg; poster = bancada.webp.

## Pendências
- Definir se vira tema Shopify (Liquid) ou outra plataforma na versão real.
