# Container Barbearia — site (3 unidades em Imbituba/SC)

**No ar (provisório):** https://container.89-117-79-163.sslip.io/ (VPS antiga, `/var/www/container-barbearia`, nginx + certbot). Deploy: `bash _dev/deploy.sh`. Falta o domínio do cliente.

## v2 (16/11/2026) — a que vale
A v1 (feita na tasteskill, fundo claro) foi reprovada pelo usuário ("feio"); está guardada em `_v1/` só como registro.
Brief da v2: referência = Instagram; pegada **contêiner**; **colmeia de LED** igual ao teto da barbearia; fontes da logo e da fachada; moderno; foco no CTA **Agendar horário**; barbeiros recriados no Codex com o mesmo uniforme e pose; animações sofisticadas.

- **Gerador:** `python _dev/gerar.py` escreve `index.html`, `centro.html`, `vila-nova.html`, `nova-brasilia.html` (todos os dados — preços, horários, barbeiros, galeria — ficam no topo do gerar.py). Não editar os .html à mão.
- **Estilo:** `css/container.css`. **Script:** `js/container.js`. GSAP + ScrollTrigger + Lenis em `js/vendor/`.
  - **Hero da home (16/11):** sem foto. Guincho em SVG/CSS: a lança entra pela direita com o contêiner pendurado, para no meio, baixa (cabo calculado em JS), quica com poeira, solta as lingas, o gancho sobe, a lança sai e o nome aparece sobre o contêiner. Toca em todo carregamento (~3s até o nome).
  - **Animações sempre ligadas:** `calmo = false` no JS e sem bloco `prefers-reduced-motion` no CSS (o Windows do usuário tem "reduzir animações" ligado; era por isso que o fade não aparecia).
  - **Botões:** chapa com canto cortado, rebites, bloco escuro do ícone (`btn--ico`, posto pelo `ico()` do gerador) e faixa zebrada no hover; fantasma = cantoneiras que fecham no hover.
  - **Seções:** fundo de colmeia estático no body; seções de chapa e fotos entram/saem com máscara em degradê; preços = lousa com giz; galeria = mosaico centralizado (`MOSAICO` no gerador); O espaço = fachada escurecida + cards das 3 unidades que abrem o Google Maps.
- **Fotos do Codex:** `_fontes/codex4/` (Erison de braço cruzado com tesoura = `img/erison-tesoura.jpg`; fotos da galeria restauradas; originais guardados lá).
- **Fontes:** Stardos Stencil (letreiro da fachada), Pacifico ("Barbearia" da logo), Montserrat.
- **Retratos:** `img/equipe/*.jpg` gerados no Codex a partir do Instagram (`_fontes/codex-barbeiros/`). Marco tinha foto-fonte minúscula: semelhança incerta.
- Conferência visual: `node .taste-skill/shot.mjs <pagina> <w> <h> <scrollY> <saida.jpg>` (ESPERA=ms opcional) e `.taste-skill/aval.mjs` (EXPR=js).

## Suposições (confirmar com o cliente)
- Horários e preços de Vila Nova e Nova Brasília (copiados do Centro, `data-assumed`).
- Barbeiros da Vila Nova desconhecidos; Nova Brasília sem WhatsApp (botão leva ao Instagram).

## Faltam do cliente
Domínio, fotos de fachada da VN e NB (os cards do mapa usam fotos de corte), nomes e @ dos barbeiros da VN (não acho em lugar público), foto melhor do Marco.
