# Transcreve cada áudio com o tempo de cada palavra (faster-whisper, CPU).
import sys, os, json, time
from faster_whisper import WhisperModel
sys.stdout.reconfigure(encoding='utf-8')
saida, modelo, arquivos = sys.argv[1], sys.argv[2], sys.argv[3:]
m = WhisperModel(modelo, device='cpu', compute_type='int8', cpu_threads=10)
for f in arquivos:
    nome = os.path.splitext(os.path.basename(f))[0]
    alvo = os.path.join(saida, nome + '.json')
    if os.path.exists(alvo): continue
    t0 = time.time()
    segs, info = m.transcribe(f, language='pt', word_timestamps=True, vad_filter=False,
                              condition_on_previous_text=False, beam_size=5)
    palavras = []
    for s in segs:
        for w in s.words or []:
            palavras.append([round(w.start, 2), round(w.end, 2), w.word.strip(), round(w.probability, 2)])
    json.dump({'duracao': info.duration, 'palavras': palavras}, open(alvo, 'w', encoding='utf-8'), ensure_ascii=False)
    print(nome, len(palavras), 'palavras', round(time.time() - t0), 's', flush=True)
