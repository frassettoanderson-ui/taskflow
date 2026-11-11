# Prévia de cada música: baixa o áudio da gravação original (o vídeo `yt` de app/js/dados/ritmos.js),
# corta 30 s a partir do refrão, com fade in e fade out, e salva em app/dados-teste/previas/<id>.m4a
# (fora do git, junto das cifras de teste).
#
# Uso (de dentro de sonoridade/):  python _ferramentas/previas.py [pasta-temporaria]
#   refaz só as que ainda não existem; apague o .m4a para refazer uma.
import os, re, subprocess, sys, tempfile
import yt_dlp

TRECHO = 30.0     # segundos
ANTES = 1.0       # começa um pouco antes do refrão
FADE_IN = 1.5
FADE_OUT = 3.0

texto = open('app/js/dados/ritmos.js', encoding='utf-8').read()
musicas = []
for bloco in re.finditer(r"'([^']+)':\s*\{(.*?)\n  \}", texto, re.S):
    corpo = bloco.group(2)
    yt = re.search(r"yt:\s*'([^']+)'", corpo)
    ref = re.search(r"refrao:\s*([\d.]+)", corpo)
    if yt:
        musicas.append((bloco.group(1), yt.group(1), float(ref.group(1)) if ref else 40.0))

def baixar(yt, bruto):
    # mesmas defesas do transcritor contra o 403 do YouTube: node para o desafio JS, blocos de 10 MB,
    # novas tentativas e, se ainda falhar, o cliente 'android'
    base = {'format': 'bestaudio/best', 'outtmpl': bruto, 'quiet': True, 'no_warnings': True,
            'retries': 10, 'fragment_retries': 10, 'extractor_retries': 3,
            'http_chunk_size': 10 * 1024 * 1024, 'js_runtimes': {'node': {}}}
    erro = None
    for cliente in (None, 'android', 'web_safari'):
        op = dict(base)
        if cliente:
            op['extractor_args'] = {'youtube': {'player_client': [cliente]}}
        try:
            with yt_dlp.YoutubeDL(op) as y:
                info = y.extract_info(f'https://www.youtube.com/watch?v={yt}')
                return y.prepare_filename(info)
        except Exception as e:  # noqa: BLE001
            erro = e
    raise erro

destino = 'app/dados-teste/previas'
os.makedirs(destino, exist_ok=True)
tmp = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()

for id_, yt, refrao in musicas:
    alvo = os.path.join(destino, f'{id_}.m4a')
    if os.path.exists(alvo):
        print('já existe', alvo)
        continue
    bruto = os.path.join(tmp, f'{yt}.%(ext)s')
    arquivo = baixar(yt, bruto)
    ini = max(0.0, refrao - ANTES)
    filtro = f'afade=t=in:st=0:d={FADE_IN},afade=t=out:st={TRECHO - FADE_OUT}:d={FADE_OUT},loudnorm=I=-16:TP=-1.5'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{ini:.2f}', '-t', f'{TRECHO}', '-i', arquivo, '-vn',
                    '-af', filtro, '-ac', '2', '-ar', '44100', '-c:a', 'aac', '-b:a', '112k', '-movflags', '+faststart', alvo],
                   check=True)
    print('ok', alvo, os.path.getsize(alvo) // 1024, 'KB')
