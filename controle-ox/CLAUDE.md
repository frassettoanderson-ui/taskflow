# OX Controle — painel único telão/luz/som da OXFITNESS

Agente Python (só stdlib + pyserial opcional) que roda no PC da academia (DESKTOP-NLQHNPL, 192.168.0.210, acesso só via AnyDesk) e serve um painel em `http://192.168.0.210:8710` com PIN.

- `agente/agente.py` — HTTP :8710; OBS via obs-websocket v5 (cliente próprio, senha lida do config do OBS); Lumikit via WebRemote `http://127.0.0.1:5000/services/*`; luz ambiente via serial COM25 (bytes `B6 B6 01 01 03 00 00 0N A9`).
- `agente/config.json` — PIN, janela travada do evento, cenas da COM25, "momentos" (sequências de passos `obs`/`luz`/`blackout`/`ambiente`/`espera`).
- `agente/instalar.ps1` — copia p/ `C:\OXControle`, gera PIN, firewall 8710 (sub-rede local), tarefa agendada "OX Controle" no logon.
- `teste/rodar_teste.py` — simuladores de Lumikit e OBS; launch.json `ox-controle-teste` (:18710, PIN 4321).

## Regra de ouro
O **evento das 21h (seg-sex)** continua no REAPER (`C:\Automacao\RP OX.rpp` + `play_automatico.lua`): COM25 cena 2 → nota MIDI (loopMIDI → Advanced Scene Switcher → cena Institucional) → MTC p/ timeline do Lumikit → COM25 cena 1. O agente **trava todos os comandos** das 20:58 às 21:03 em dias úteis. Migrar o evento p/ o agente só com teste fora do horário e REAPER guardado.

## Pendências
- Mesa Duonn AXIOS16E (192.168.0.231): app WASM com WebSocket binário — falta captura HAR p/ descobrir o protocolo.
- Confirmar o que a COM25 controla (hipótese: luz ambiente) e renomear "Cena 1/2" no config.
- Mapear cenas do Lumikit nos "momentos" (ex.: Sorteio = luz X).
- `levantamento*/` (ignorado no git) guarda os arquivos copiados do PC da academia.
