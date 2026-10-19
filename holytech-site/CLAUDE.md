# HolyTech Solutions — site institucional

Site da software house + landing de cada produto (Holyshop, Holycar, Holybarber, Holyweb).
**No ar desde 15/10/2026 em https://holytechsolution.com.br** (mesmo domínio do sistema HolyTech).

## Estrutura
- `src/pages/*.html` — uma página por arquivo, com meta JSON na 1ª linha (`titulo`, `descricao`, `saida`, `tema`, `mensagem`).
- `src/partials/` — head, header (menu), footer.
- `src/_ht/` — CSS, JS, logos, fotos (Dreamina), vídeo (Remotion). Tudo publicado em `/_ht/` (prefixo próprio para não colidir com o app).
- `config.json` — **contatos** (WhatsApp, e-mail, Instagram). WhatsApp vazio → botões abrem e-mail. Preencher e rodar o build.
- `build.mjs` — `node build.mjs` gera `dist/` (inclui sitemap.xml e robots.txt).
- Temas por produto: classe no body `t-shop` (verde #05A064), `t-car` (azul #0057FF), `t-barber` (vermelho #E2402B), `t-web` (roxo #7634F0); home = amarelo #F9B800.
- Fontes: Archivo (display, wdth 112), Geist (texto), Geist Mono (rótulos).

## URLs
`/` · `/solucoes/holyshop/` · `/solucoes/holycar/` · `/solucoes/holybarber/` · `/solucoes/holyweb/` · `/sob-medida/` · `/automacao-e-ia/`
⚠️ NÃO usar `/holyshop`, `/holycar`, `/painel`, `/login`, `/servicos` etc. — são rotas do sistema.

## Deploy (VPS 89.117.79.163)
- Arquivos em `/var/www/holytech-site`. nginx: `/etc/nginx/sites-available/holytech-dominio` (backup do original em `/root/nginx-holytech-dominio-bak-20261015-0259`).
- Raiz `/`: SEMPRE o site (desde 19/10/2026; backup do nginx anterior em `/root/nginx-holytech-dominio-bak-20261019-raiz`). O início do sistema é `/inicio` (app 127.0.0.1:3210); só navegação interna do Next (cabeçalho `RSC`) para `/` ainda vai ao app. Demais rotas do site são locations próprias; o resto vai pro app.
- Publicar de novo (PowerShell, na pasta holytech-site):
  `node build.mjs; tar czf $env:TEMP\hs.tgz -C dist .; scp $env:TEMP\hs.tgz root@89.117.79.163:/tmp/` e na VPS
  `rm -rf /var/www/holytech-site/* && tar xzf /tmp/hs.tgz -C /var/www/holytech-site && chown -R www-data:www-data /var/www/holytech-site`

## Mídia
- Fotos: Dreamina (seedream_5.0_pro, canvas "HolyTech Site"), originais 2560px em `raw/` (fora do git).
- Vídeo: composição `HolytechReel` em `C:\Users\ander\julius-videos\src\HolytechReel.tsx` → `npx remotion render src/index.ts HolytechReel <saida>.mp4 --codec=h264 --crf=24 --scale=0.75 --muted`.
- Logos originais: `C:\Users\ander\Downloads\holytech\` (PNG transparentes); `tools_logos.py` gera recortes/ícones/versão escura.
- Prints de conferência: `bash shot.sh <caminho> <largura> <altura> <arquivo.png>` (Chrome headless; largura mínima ~500px).

## Pendências
- Contatos reais em `config.json` (WhatsApp/Instagram) + caixa de e-mail contato@holytechsolution.com.br (não verificado se existe).
- Cada produto terá domínio próprio depois → trocar links das landings.
