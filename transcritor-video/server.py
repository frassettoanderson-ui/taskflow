# -*- coding: utf-8 -*-
"""
server.py — Backend do app Escriba.

Sobe um pequeno servidor local (Flask), serve a interface (web/index.html) e
roda a transcrição numa thread, enquanto a tela acompanha o progresso por
polling. Abre a interface numa janela "modo app" do Edge/Chrome.
"""

import os
import sys
import time
import socket
import threading
import subprocess
from pathlib import Path

# Saída do console sempre em UTF-8 (evita quebrar com títulos acentuados).
for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

from flask import Flask, request, jsonify, send_from_directory
import engine

BASE = Path(__file__).resolve().parent
PORT = 8765
URL = f"http://127.0.0.1:{PORT}"

# Sob pythonw.exe (sem console) não existe stdout/stderr; manda os logs para um
# arquivo, senão o Flask quebra ao tentar imprimir.
if sys.stdout is None or sys.stderr is None:
    _log = open(BASE / "escriba_log.txt", "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stdout or _log
    sys.stderr = sys.stderr or _log

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = None  # permite enviar vídeos grandes

_lock = threading.Lock()
estado = {
    "status": "ocioso",   # ocioso | baixando | carregando_modelo | transcrevendo | concluido | erro
    "progress": 0,
    "texto": "",
    "titulo": "",
    "arquivo": "",
    "erro": "",
    "rodando": False,
    "fila": [],        # itens: {"titulo", "status": na_fila|atual|ok|erro|cancelado, "arquivo", "erro"}
    "fila_idx": 0,     # índice do item atual
    "fila_total": 0,
}


_ultimo_contato = time.time()  # heartbeat: quando a página falou conosco pela última vez
_cancelar = threading.Event()  # sinaliza para a transcrição em andamento parar


def _set(**kw):
    with _lock:
        estado.update(kw)


def _fmt_dur(seg) -> str:
    seg = int(seg or 0)
    h, m, s = seg // 3600, (seg % 3600) // 60, seg % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def _set_fila_item(idx, **kw):
    with _lock:
        if 0 <= idx < len(estado["fila"]):
            estado["fila"][idx].update(kw)


def _run(fontes, qualidade):
    _cancelar.clear()
    try:
        _set(status="iniciando", progress=0, texto="", titulo="", arquivo="",
             erro="", rodando=True, fila=[], fila_idx=0, fila_total=0)

        # Expande playlists e monta a lista final de vídeos/arquivos.
        urls = []
        for f in fontes:
            f = (f or "").strip()
            if not f:
                continue
            urls.extend(engine.listar_videos(f))
        if not urls:
            _set(status="erro", erro="Nenhum link válido.", rodando=False)
            return

        fila = [{"titulo": u, "status": "na_fila", "arquivo": "", "erro": ""}
                for u in urls]
        _set(fila=fila, fila_total=len(urls), fila_idx=0)

        def on_status(s):
            _set(status=s)
            if s == "transcrevendo":
                _set(progress=0)

        def on_progress(p):
            _set(progress=round(p))

        def on_segment(t):
            with _lock:
                estado["texto"] = (estado["texto"] + " " + t).strip()

        for idx, url in enumerate(urls):
            if _cancelar.is_set():
                for j in range(idx, len(urls)):
                    _set_fila_item(j, status="cancelado")
                _set(status="cancelado", rodando=False)
                return
            _set(fila_idx=idx, texto="", titulo="", progress=0, arquivo="", erro="")
            _set_fila_item(idx, status="atual")
            try:
                r = engine.transcrever_fonte(
                    url, qualidade,
                    on_status=on_status, on_progress=on_progress,
                    on_segment=on_segment, on_download_progress=on_progress,
                    deve_cancelar=_cancelar.is_set,
                )
                _set(titulo=r["titulo"], arquivo=r["arquivo"])
                _set_fila_item(idx, status="ok", titulo=r["titulo"],
                               arquivo=r["arquivo"])
            except engine.Cancelado:
                for j in range(idx, len(urls)):
                    _set_fila_item(j, status="cancelado")
                _set(status="cancelado", rodando=False)
                return
            except Exception as exc:  # noqa: BLE001 — segue para o próximo
                _set_fila_item(idx, status="erro", erro=str(exc))

        # Fim da fila.
        erros = [it for it in estado["fila"] if it["status"] == "erro"]
        if len(urls) == 1 and erros:
            _set(status="erro", erro=erros[0]["erro"], rodando=False)
        else:
            _set(status="concluido", progress=100, rodando=False)
    except Exception as exc:  # noqa: BLE001
        _set(status="erro", erro=str(exc), rodando=False)


@app.route("/")
def index():
    return send_from_directory(BASE / "web", "index.html")


@app.route("/icone.svg")
def icone():
    return send_from_directory(BASE / "web", "icone.svg")


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(BASE / "web", "escriba.ico")


@app.route("/iniciar", methods=["POST"])
def iniciar():
    if estado["rodando"]:
        return jsonify(ok=False, erro="Já há uma transcrição em andamento."), 409
    data = request.get_json(force=True, silent=True) or {}
    qualidade = data.get("qualidade", "rapido")
    fontes = data.get("fontes")
    if not fontes:
        f = (data.get("fonte") or "").strip()
        fontes = [f] if f else []
    fontes = [x.strip() for x in fontes if x and x.strip()]
    if not fontes:
        return jsonify(ok=False, erro="Cole um link do YouTube."), 400
    threading.Thread(target=_run, args=(fontes, qualidade), daemon=True).start()
    return jsonify(ok=True)


@app.route("/iniciar_arquivo", methods=["POST"])
def iniciar_arquivo():
    if estado["rodando"]:
        return jsonify(ok=False, erro="Já há uma transcrição em andamento."), 409
    f = request.files.get("arquivo")
    qualidade = request.form.get("qualidade", "rapido")
    if not f or not f.filename:
        return jsonify(ok=False, erro="Nenhum arquivo selecionado."), 400
    tmp = BASE / "_uploads"
    tmp.mkdir(exist_ok=True)
    # Sanitiza o nome, mantendo a extensão original do arquivo enviado.
    nome = engine.sanitizar_nome(Path(f.filename).stem) + Path(f.filename).suffix
    destino = tmp / nome
    f.save(str(destino))
    threading.Thread(target=_run, args=([str(destino)], qualidade), daemon=True).start()
    return jsonify(ok=True)


@app.route("/cancelar", methods=["POST"])
def cancelar():
    _cancelar.set()
    return jsonify(ok=True)


@app.route("/estado")
def get_estado():
    with _lock:
        return jsonify(estado)


@app.before_request
def _heartbeat():
    # Toda requisição da página conta como "a janela ainda está aberta".
    global _ultimo_contato
    _ultimo_contato = time.time()
    if request.path not in ("/ping", "/estado"):
        print(f"[{time.strftime('%H:%M:%S')}] {request.method} {request.path}", flush=True)


@app.route("/encerrar", methods=["POST", "GET"])
def encerrar():
    """Chamado quando a janela fecha (sendBeacon). Encerra o servidor."""
    threading.Timer(0.3, lambda: os._exit(0)).start()
    return jsonify(ok=True)


@app.after_request
def _sem_cache(resp):
    # Nunca cachear: garante que ao reabrir o app sempre vem a versão nova.
    resp.headers["Cache-Control"] = "no-store, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp


@app.route("/ping")
def ping():
    return jsonify(ok=True)


@app.route("/info")
def info():
    """Metadados do vídeo (sem baixar): título, duração, miniatura, canal."""
    url = (request.args.get("url") or "").strip()
    if not url:
        return jsonify(ok=False, erro="sem url"), 400
    import yt_dlp
    opts = {"quiet": True, "no_warnings": True, "skip_download": True,
            "noplaylist": True}
    rt = engine.detectar_js_runtimes()
    if rt:
        opts["js_runtimes"] = {r: {} for r in rt}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            i = ydl.extract_info(url, download=False)
    except Exception as exc:  # noqa: BLE001
        return jsonify(ok=False, erro=engine.amigavel_erro_download(str(exc)))
    dur = i.get("duration") or 0
    return jsonify(
        ok=True,
        titulo=i.get("title") or "",
        duracao=dur,
        duracao_fmt=_fmt_dur(dur),
        canal=i.get("uploader") or i.get("channel") or "",
        thumb=i.get("thumbnail") or "",
    )


@app.route("/abrir_pasta", methods=["POST"])
def abrir_pasta():
    pasta = engine.PASTA_SAIDA
    pasta.mkdir(parents=True, exist_ok=True)
    try:
        os.startfile(str(pasta))  # noqa: S606 (Windows)
    except Exception as exc:  # noqa: BLE001
        return jsonify(ok=False, erro=str(exc))
    return jsonify(ok=True)


def abrir_janela():
    """Abre a interface numa janela 'modo app' do Edge/Chrome (sem cara de navegador)."""
    # URL com versão única a cada abertura: evita que o navegador sirva uma
    # página antiga em cache.
    url = f"{URL}/?v={int(time.time())}"
    candidatos = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    perfil = str(BASE / "_appwin")
    for exe in candidatos:
        if Path(exe).exists():
            subprocess.Popen([
                exe, f"--app={url}",
                f"--user-data-dir={perfil}",
                "--window-size=1024,680",
            ])
            return
    import webbrowser
    webbrowser.open(url)


def _porta_em_uso() -> bool:
    """Verdadeiro se já há um Escriba escutando na porta (instância única)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", PORT)) == 0


def _watchdog():
    """
    Rede de segurança: encerra o servidor se ficar MUITO tempo sem nenhum sinal
    da página (10 min) e sem transcrição rodando. O fechamento normal da janela
    é detectado na hora pelo /encerrar (sendBeacon); este watchdog só cobre o
    caso de a página sumir sem avisar. Folga grande de propósito, porque o
    navegador estrangula os timers de janelas em segundo plano.
    """
    while True:
        time.sleep(15)
        ocioso = (time.time() - _ultimo_contato) > 600
        if ocioso and not estado["rodando"]:
            os._exit(0)


if __name__ == "__main__":
    SEM_JANELA = bool(os.environ.get("ESCRIBA_NO_WINDOW")) or ("--no-window" in sys.argv)

    # Instância única: se já existe um Escriba rodando, só abre a janela e sai.
    if _porta_em_uso():
        if not SEM_JANELA:
            abrir_janela()
        sys.exit(0)

    if not SEM_JANELA:
        threading.Timer(1.2, abrir_janela).start()
        threading.Thread(target=_watchdog, daemon=True).start()

    # waitress: servidor WSGI robusto (sem as instabilidades do dev server).
    from waitress import serve
    serve(app, host="127.0.0.1", port=PORT, threads=8)
