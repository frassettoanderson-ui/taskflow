# Sincronia cifra × gravação original

Gera `app/dados-teste/sincronia.json` (quando cada acorde toca no vídeo oficial) e o segundo do refrão em `app/js/dados/ritmos.js`.

1. Baixar o áudio do vídeo de `ritmos.js` (campo `yt`) em WAV mono 22050 Hz.
2. `transcrever.py <saida> medium <wav...>`: letra cantada com o tempo de cada palavra (faster-whisper do `transcritor-video/venv`).
3. `node exportar.mjs <pasta app> cifras.json`: a cifra principal em linhas, com o número de cada acorde igual ao da tela.
4. `alinhar.py cifras.json <whisper.json> <wav> <id> <bpm> 1 <mapa.json>`: casa a letra com a cifra, dá tempo a cada acorde e confere pelo croma do áudio (imprime a % de acerto).
5. `juntar.py <pasta de trabalho> <pasta app>`: junta os mapas e grava o refrão.

`rodar_todos.sh` e `juntar.py` têm o caminho da pasta de trabalho (scratchpad da sessão de 11/11/2026) escrito dentro: trocar antes de usar de novo.
