#!/bin/bash
# Alinha todas as músicas que já têm transcrição. Uso: bash rodar_todos.sh
S='C:/Users/ander/AppData/Local/Temp/claude/5183d2c0a1e05a70/3997db0b-cc99-4d54-90ba-f94d2358a677/scratchpad'
while read -r nome id bpm wav; do
  [ -f "$S/sync/whisper/$nome.json" ] || { echo "$nome: sem transcrição ainda"; continue; }
  python "$S/sync/alinhar.py" "$S/sync/cifras.json" "$S/sync/whisper/$nome.json" "$S/$wav" "$id" "$bpm" 1 "$S/sync/mapas/$nome.json" 2>&1 | grep -v -i warn | tail -2
done <<'LISTA'
perda felipe-rodrigues--tudo-e-perda 63 audios/perda.wav
sublime florianopolis-house-of-prayer--sublime 63 completos/sublime.wav
meama diante-do-trono--me-ama- 51 audios/meama.wav
porqueelevive harpa-crista--porque-ele-vive 80 audios/porqueelevive.wav
tudosobre ministerio-morada--e-tudo-sobre-voce 69 audios/tudosobre.wav
grande adhemar-de-campos--grande-o-senhor 58 audios/grande.wav
bondade isaias-saad--bondade-de-deus 64 audios/bondade.wav
sotuessanto ministerio-morada--so-tu-s-santo 62 audios/sotuessanto.wav
aeleagloria diante-do-trono--a-ele-gloria 53 audios/aeleagloria.wav
LISTA
