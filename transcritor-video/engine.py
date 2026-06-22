# -*- coding: utf-8 -*-
"""
engine.py — Motor de transcrição reutilizável (usado pelo app Escriba).

Aceita um link do YouTube OU um arquivo local (áudio ou vídeo), baixa/extrai
o áudio quando necessário e transcreve em português com faster-whisper.
Expõe callbacks para acompanhar o progresso em tempo real (status, %, trechos).
"""

import re
import shutil
import tempfile
from pathlib import Path

IDIOMA = "pt"
PASTA_SAIDA = Path(__file__).resolve().parent / "transcricoes"

# Mapeia os "apelidos" de velocidade da interface para os modelos do Whisper.
MODELOS = {
    "rapido": "small",
    "medio": "medium",
    "preciso": "large-v3",
}


class Cancelado(Exception):
    """Levantada quando o usuário cancela a transcrição."""


def modelo_em_cache(modelo: str) -> bool:
    """Heurística: o modelo já foi baixado pelo faster-whisper (HF cache)?"""
    cache = Path.home() / ".cache" / "huggingface" / "hub"
    if not cache.exists():
        return False
    return any(cache.glob(f"models--*faster-whisper-{modelo}*"))


def sanitizar_nome(titulo: str) -> str:
    """Transforma o título em um nome de arquivo válido."""
    nome = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", titulo)
    nome = re.sub(r"\s+", " ", nome).strip().rstrip(". ")
    return nome[:150].strip() or "transcricao"


def detectar_js_runtimes() -> list[str]:
    """Runtimes JS disponíveis (o yt-dlp precisa de um pra alguns vídeos)."""
    return [rt for rt in ("deno", "node") if shutil.which(rt)]


def garantir_ffmpeg() -> None:
    """
    Garante que o ffmpeg esteja acessível, mesmo quando o app é iniciado sem o
    .bat (que normalmente coloca o ffmpeg no PATH). No Windows, localiza o
    ffmpeg instalado via winget (Gyan.FFmpeg) e o adiciona ao PATH do processo.
    """
    import os
    import glob
    if shutil.which("ffmpeg"):
        return
    base = os.environ.get("LOCALAPPDATA", "")
    if not base:
        return
    padrao = os.path.join(base, r"Microsoft\WinGet\Packages\Gyan.FFmpeg_*",
                          "ffmpeg-*", "bin")
    for binp in glob.glob(padrao):
        if os.path.exists(os.path.join(binp, "ffmpeg.exe")):
            os.environ["PATH"] = binp + os.pathsep + os.environ.get("PATH", "")
            return


def _e_url(fonte: str) -> bool:
    return bool(re.match(r"^https?://", fonte.strip(), re.I))


def baixar_audio(url: str, pasta_tmp: Path, cookies: str | None = None,
                 on_status=None, on_download_progress=None,
                 deve_cancelar=None) -> tuple[Path, str]:
    """Baixa só o áudio do vídeo do YouTube e converte para .mp3."""
    import yt_dlp

    def _hook(d: dict) -> None:
        if deve_cancelar and deve_cancelar():
            raise Cancelado()
        if d.get("status") == "downloading" and on_download_progress:
            tot = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            got = d.get("downloaded_bytes") or 0
            if tot:
                on_download_progress(min(100.0, got / tot * 100.0))

    saida_tmpl = str(pasta_tmp / "%(id)s.%(ext)s")
    opcoes = {
        "format": "bestaudio/best",
        "outtmpl": saida_tmpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "writesubtitles": False,
        "writeautomaticsub": False,
        # Resiliência contra "HTTP 403 Forbidden" / throttling do YouTube:
        "retries": 10,
        "fragment_retries": 10,
        "extractor_retries": 3,
        "http_chunk_size": 10 * 1024 * 1024,  # baixa em blocos de 10 MB
        "progress_hooks": [_hook],
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "128",
        }],
    }
    runtimes = detectar_js_runtimes()
    if runtimes:
        opcoes["js_runtimes"] = {rt: {} for rt in runtimes}
    if cookies and Path(cookies).is_file():
        opcoes["cookiefile"] = cookies

    with yt_dlp.YoutubeDL(opcoes) as ydl:
        info = ydl.extract_info(url, download=True)

    base = Path(ydl.prepare_filename(info)).with_suffix(".mp3")
    if not base.exists():
        candidatos = list(pasta_tmp.glob(f"{info.get('id', '*')}.*"))
        if not candidatos:
            raise RuntimeError("não foi possível localizar o áudio baixado.")
        base = candidatos[0]
    titulo = info.get("title") or info.get("id") or "transcricao"
    return base, titulo


def _e_playlist(url: str) -> bool:
    """Verdadeiro para URLs de playlist (mas não para watch?v=...&list=...)."""
    return "/playlist" in url or ("list=" in url and "v=" not in url)


def listar_videos(url: str) -> list[str]:
    """Se a URL for uma playlist, devolve a lista de vídeos; senão [url]."""
    url = url.strip()
    if not _e_url(url) or not _e_playlist(url):
        return [url]
    import yt_dlp
    opts = {"quiet": True, "no_warnings": True, "extract_flat": True,
            "skip_download": True}
    rt = detectar_js_runtimes()
    if rt:
        opts["js_runtimes"] = {r: {} for r in rt}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception:  # noqa: BLE001
        return [url]
    urls = []
    for e in (info.get("entries") or []):
        if not e:
            continue
        u = e.get("url") or e.get("webpage_url") or e.get("id")
        if u:
            if not str(u).startswith("http"):
                u = "https://www.youtube.com/watch?v=" + str(u)
            urls.append(u)
    return urls or [url]


def amigavel_erro_download(msg: str) -> str:
    """Converte erros crus do yt-dlp em mensagens claras."""
    if "Unsupported URL" in msg or "is not a valid URL" in msg:
        return "Link inválido. Confira o endereço do vídeo."
    if "Sign in to confirm" in msg or "confirm you" in msg.lower():
        return ("O YouTube pediu login para este IP (comum em servidor). "
                "Rode no seu PC, ou use cookies.")
    if "not made this video available" in msg:
        return "Vídeo com restrição na sua região."
    if "Private video" in msg or "Video unavailable" in msg or "unavailable" in msg.lower():
        return "Vídeo indisponível (privado, removido ou restrito)."
    return f"Falha ao baixar: {msg}"


def transcrever_fonte(fonte: str, qualidade: str = "rapido",
                      cookies: str | None = None,
                      on_status=None, on_progress=None, on_segment=None,
                      on_download_progress=None, deve_cancelar=None) -> dict:
    """
    Transcreve uma fonte (URL do YouTube ou caminho de arquivo local).

    Callbacks (todos opcionais):
      on_status(str)    -> 'baixando' | 'carregando_modelo' | 'transcrevendo'
      on_progress(float)-> 0..100
      on_segment(str)   -> cada trecho de texto assim que fica pronto

    Retorna {'titulo', 'texto', 'arquivo'}.
    """
    def status(s):
        if on_status:
            on_status(s)

    modelo = MODELOS.get(qualidade, qualidade)
    garantir_ffmpeg()
    pasta_tmp = Path(tempfile.mkdtemp(prefix="escriba_"))
    try:
        if _e_url(fonte):
            status("baixando")
            try:
                audio_path, titulo = baixar_audio(
                    fonte, pasta_tmp, cookies, on_status,
                    on_download_progress=on_download_progress,
                    deve_cancelar=deve_cancelar)
            except Cancelado:
                raise
            except Exception as exc:  # noqa: BLE001
                raise RuntimeError(amigavel_erro_download(str(exc))) from None
        else:
            audio_path = Path(fonte)
            if not audio_path.exists():
                raise RuntimeError("Arquivo não encontrado.")
            titulo = audio_path.stem

        status("carregando_modelo" if modelo_em_cache(modelo) else "baixando_modelo")
        from faster_whisper import WhisperModel
        model = WhisperModel(modelo, device="cpu", compute_type="int8")

        status("transcrevendo")
        # Rápido usa beam_size=1 (bem mais veloz); Médio/Preciso usam 5 (mais
        # preciso). Em CPU, beam 1 costuma ser ~1,5-2x mais rápido.
        beam = 5 if qualidade in ("medio", "preciso") else 1
        segmentos, info = model.transcribe(
            str(audio_path), language=IDIOMA, beam_size=beam, vad_filter=True,
        )
        duracao = getattr(info, "duration", 0) or 0
        partes: list[str] = []
        for seg in segmentos:
            if deve_cancelar and deve_cancelar():
                raise Cancelado()
            texto = seg.text.strip()
            if texto:
                partes.append(texto)
                if on_segment:
                    on_segment(texto)
            if on_progress and duracao:
                on_progress(min(100.0, seg.end / duracao * 100.0))

        texto_final = re.sub(r"\s+", " ", " ".join(partes)).strip()
        if not texto_final:
            raise RuntimeError("Transcrição vazia (áudio sem fala detectável?).")

        PASTA_SAIDA.mkdir(parents=True, exist_ok=True)
        destino = PASTA_SAIDA / (sanitizar_nome(titulo) + ".txt")
        destino.write_text(texto_final, encoding="utf-8")
        if on_progress:
            on_progress(100.0)

        return {"titulo": titulo, "texto": texto_final, "arquivo": str(destino)}
    finally:
        shutil.rmtree(pasta_tmp, ignore_errors=True)
