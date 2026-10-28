# OX Show — telão, música, luz e luz ambiente da OXFITNESS num lugar só

Substitui a corrente frágil OBS + REAPER + loopMIDI + scripts Python + Advanced Scene Switcher por **um programa só** (Python stdlib + pyserial opcional) que roda no PC da academia (DESKTOP-NLQHNPL, 192.168.0.210, acesso só via AnyDesk; usuário roda os scripts que eu mando). O Lumikit continua, minimizado, comandado pela API WebRemote.

## Arquivos (`oxshow/`)
- `oxshow.py` — servidor :8710. Painel `/` (PIN; localhost dispensa), telão `/telao` (só localhost), mídia `/midia/*` com Range, SSE `/telao/sse`.
  - **Telão**: página em Edge/Chrome `--kiosk` no monitor secundário (LED). Estado empurrado por SSE; vídeo uma vez volta para a "tela padrão". Vigia reabre o navegador se `telao.abrir_automatico`.
  - **Música**: playlists = pastas em `midia/musicas/`; programação por horário/dia/volume; tocada pelo `<audio>` da página do telão (rampa de volume).
  - **Luz**: Lumikit `/services/edmx_change_scene/p/i`, `timeline_play/i`, `main_set_blackout_on|off`.
  - **Ambiente**: COM25 bytes `B6 B6 01 01 03 00 00 0N A9` (1 = normal, 2 = show — hipótese, confirmar).
  - **Cenas** (passos imediatos), **Eventos** (passos com `em` segundos), **Agenda** (dia/hora, tolerância 120 s, verificação 5 min antes), **Registro** (`registro.json`).
- `config.json` (equipamentos, PIN, janela protegida) e `dados.json` (cenas/eventos/agenda/música/tela padrão — editado pelo painel). O instalador só copia esses dois na primeira vez.
- `instalar.ps1` — `C:\OXShow`, copia os 2 vídeos do OBS (renomeia p/ `Red Zone.mp4` e `telao int03.mp4`), PIN, firewall 8710 LocalSubnet, tarefa "OX Show" no logon.
- Teste local: launch.json `oxshow-teste` (:18720) = `teste/oxshow_teste.py` (Lumikit falso :15000) + mídia gerada com ffmpeg no scratchpad (`OXSHOW_TESTE`).

## Painel de qualquer rede: oxfitnesstrainingcenter.com.br/show
- Página própria `web/index.html` (login + barra de status + iframe do `painel.html`), login único do usuário (credenciais com o usuário; no `.env` da VPS OX como `SHOW_LOGIN_USUARIO` / `SHOW_LOGIN_SENHA` = `sal:hash` scrypt N=16384 r=8 p=1 dklen 64). Não fica mais dentro do OX Cloud (removido a pedido em 28/10).
- Hospedagem: o domínio do site ainda aponta para a **VPS antiga** (`root@89.117.79.163`): arquivos em `/var/www/oxshow-web/` (index.html + painel.html), nginx `sites-available/oxfitness-dominio` com `location /show/` (alias) e `/show/api/` → proxy `https://oxcloudbr.com.br/api/show/`. **Ao mudar `painel.html` ou `web/index.html`, copiar para lá (scp).** Se o domínio migrar para a VPS OX, levar essas duas locations.
- API/relay no repo raniandark-pdv: `server/src/modules/show/show.routes.ts` (`/show/login`, `/show/status`, `/show/proxy/*`, agente `/show/agente/fila|resposta`). Token do painel assinado com `JWT_SECRET + ":oxshow"` (não vale no OX Cloud).
- O `oxshow.py` abre conexão de SAÍDA (`laco_nuvem`, long-poll com `X-Agente-Token` = `SHOW_AGENTE_TOKEN` do `.env` da VPS OX / `nuvem.token` no `config.json` da academia) e repassa cada pedido para `127.0.0.1:8710` (só `/api/`), com `X-Usuario` → registro mostra "OX Cloud: usuário". Atualizar o PC: `atualizar.ps1` (zip com `token-nuvem.txt`, gitignored).

## Regra de ouro
O **evento das 21h (seg-sex)** continua no REAPER até a migração. Por isso: agenda vem **desativada**, `telao.abrir_automatico=false`, e `janela_protegida` trava comandos manuais 20:58–21:03 em dias úteis. Migração = testar fora do horário → desligar REAPER/OBS do início do Windows + tarefas `Mudar_Para_Cena_*` → ativar agenda e `abrir_automatico` → tirar `janela_protegida`.

## Pendências
- Instalar e testar no PC real (monitor do LED, autoplay com som, Lumikit `timeline_play` sem MTC — se não tocar, gerar MTC via winmm/loopMIDI).
- Confirmar o que a COM25 faz; índice da timeline do show no Lumikit.
- Música: cliente precisa licença ECAD; arquivos próprios (não Spotify).
- Mesa Duonn AXIOS16E: protocolo WebSocket binário (falta HAR).
- Fase 2: alerta WhatsApp (chip de avisos do OX Cloud); fase 3 opcional: DMX próprio sem Lumikit.
