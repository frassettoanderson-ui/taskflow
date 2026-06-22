#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
transcrever.py — Transcreve o áudio de vídeos do YouTube para texto.

Funciona em Linux (VPS, sem interface gráfica). É 100% gratuito e local:
  - Baixa apenas o áudio do vídeo com yt-dlp (+ ffmpeg para extrair o áudio).
  - Transcreve com faster-whisper rodando em CPU (idioma fixo: português).
  - Salva um .txt limpo (texto corrido, sem marcações de tempo) em transcricoes/.

Uso:
    python transcrever.py "https://www.youtube.com/watch?v=XXXX"
    python transcrever.py "https://youtu.be/XXXX" --modelo medium
    python transcrever.py "URL" --manter-audio
"""

import argparse
import re
import shutil
import sys
import tempfile
from pathlib import Path

# Garante que as mensagens no terminal usem UTF-8 e nunca quebrem por causa de
# caracteres especiais (acentos, nomes estrangeiros). No Linux o terminal já é
# UTF-8; isto é só uma rede de segurança (especialmente útil no Windows).
for _fluxo in (sys.stdout, sys.stderr):
    try:
        _fluxo.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

# Pasta onde as transcrições (.txt) são salvas.
PASTA_SAIDA = Path("transcricoes")

# Idioma fixado em português, conforme o requisito.
IDIOMA = "pt"


# --------------------------------------------------------------------------- #
# Utilidades
# --------------------------------------------------------------------------- #
def log(etapa: str, mensagem: str = "") -> None:
    """Imprime o progresso no terminal de forma uniforme (vai para stderr)."""
    if mensagem:
        print(f"[{etapa}] {mensagem}", file=sys.stderr, flush=True)
    else:
        print(f"[{etapa}]", file=sys.stderr, flush=True)


def erro_e_sai(mensagem: str, codigo: int = 1) -> None:
    """Mostra uma mensagem de erro clara e encerra o programa."""
    print(f"\nERRO: {mensagem}", file=sys.stderr, flush=True)
    sys.exit(codigo)


def sanitizar_nome(titulo: str) -> str:
    """
    Transforma o título do vídeo em um nome de arquivo válido.

    Remove caracteres proibidos em nomes de arquivo (no Linux e no Windows),
    colapsa espaços e limita o tamanho para evitar nomes gigantes.
    """
    # Remove caracteres inválidos para nome de arquivo.
    nome = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", titulo)
    # Colapsa espaços em branco repetidos.
    nome = re.sub(r"\s+", " ", nome).strip()
    # Remove pontos/espaços no fim (problemáticos em alguns sistemas).
    nome = nome.rstrip(". ")
    # Limita o tamanho (deixa margem para a extensão).
    nome = nome[:150].strip()
    return nome or "transcricao"


def verificar_ffmpeg() -> None:
    """Garante que o ffmpeg está instalado (necessário para extrair o áudio)."""
    if shutil.which("ffmpeg") is None:
        erro_e_sai(
            "ffmpeg não encontrado no sistema.\n"
            "       Instale com:  sudo apt update && sudo apt install -y ffmpeg"
        )


def detectar_js_runtimes() -> list[str]:
    """
    Descobre quais runtimes JavaScript estão instalados (deno/node).

    O YouTube hoje exige um runtime JS para extrair muitos vídeos, mas o yt-dlp
    só ativa o 'deno' por padrão. Aqui ativamos também o 'node' se ele existir
    (comum em VPS), evitando o aviso "No supported JavaScript runtime".
    """
    return [rt for rt in ("deno", "node") if shutil.which(rt)]


# --------------------------------------------------------------------------- #
# Etapa 1 — Download do áudio
# --------------------------------------------------------------------------- #
def baixar_audio(url: str, pasta_tmp: Path,
                 cookies: str | None = None) -> tuple[Path, str]:
    """
    Baixa apenas o áudio do vídeo e converte para .mp3 (formato leve).

    Retorna (caminho_do_audio, titulo_do_video).
    Levanta exceções de yt-dlp quando a URL é inválida/indisponível.

    `cookies` é o caminho de um arquivo cookies.txt (formato Netscape) exportado
    do navegador. Em VPS/servidor, o YouTube costuma exigir login ("Sign in to
    confirm you're not a bot"); passar cookies resolve isso.
    """
    try:
        import yt_dlp
    except ImportError:
        erro_e_sai(
            "biblioteca 'yt-dlp' não instalada.\n"
            "       Instale com:  pip install -r requirements.txt"
        )

    def _hook(d: dict) -> None:
        """Mostra o progresso do download na mesma linha."""
        if d.get("status") == "downloading":
            pct = d.get("_percent_str", "").strip()
            velocidade = d.get("_speed_str", "").strip()
            print(f"\r[baixando] {pct}  {velocidade}      ",
                  end="", file=sys.stderr, flush=True)
        elif d.get("status") == "finished":
            print("\r[baixando] download concluído, extraindo áudio...   ",
                  file=sys.stderr, flush=True)

    # Salva o áudio temporário usando o ID do vídeo (evita problemas com
    # títulos que tenham caracteres especiais).
    saida_tmpl = str(pasta_tmp / "%(id)s.%(ext)s")

    opcoes = {
        "format": "bestaudio/best",       # menor faixa de áudio disponível
        "outtmpl": saida_tmpl,
        "noplaylist": True,               # baixa só o vídeo, nunca a playlist
        "quiet": True,
        "no_warnings": True,
        "writesubtitles": False,          # NUNCA baixar legendas do YouTube;
        "writeautomaticsub": False,       # a transcrição vem sempre do áudio.
        "progress_hooks": [_hook],
        "postprocessors": [{
            "key": "FFmpegExtractAudio",  # extrai só o áudio via ffmpeg
            "preferredcodec": "mp3",
            "preferredquality": "128",    # 128 kbps basta para transcrição
        }],
    }

    # Ativa também o 'node' como runtime JS quando disponível (além do 'deno').
    # Na API do yt-dlp esse parâmetro é um dict {runtime: {config}}.
    runtimes = detectar_js_runtimes()
    if runtimes:
        opcoes["js_runtimes"] = {rt: {} for rt in runtimes}

    # Cookies do navegador — necessários quando o YouTube pede login (VPS).
    if cookies:
        if not Path(cookies).is_file():
            erro_e_sai(f"arquivo de cookies não encontrado: {cookies}")
        opcoes["cookiefile"] = cookies

    with yt_dlp.YoutubeDL(opcoes) as ydl:
        info = ydl.extract_info(url, download=True)

    # Com a extração de áudio para mp3, o arquivo final é <id>.mp3.
    base = Path(ydl.prepare_filename(info)).with_suffix(".mp3")
    if not base.exists():
        # Fallback: procura qualquer áudio gerado na pasta temporária.
        candidatos = list(pasta_tmp.glob(f"{info.get('id', '*')}.*"))
        if not candidatos:
            erro_e_sai("não foi possível localizar o arquivo de áudio baixado.")
        base = candidatos[0]

    titulo = info.get("title") or info.get("id") or "transcricao"
    return base, titulo


# --------------------------------------------------------------------------- #
# Etapa 2 — Transcrição
# --------------------------------------------------------------------------- #
def transcrever_audio(caminho_audio: Path, modelo: str) -> str:
    """
    Transcreve o áudio usando faster-whisper (CPU).

    O faster-whisper processa o áudio em trechos (segmentos), então vídeos
    longos (1h+) são tratados sem estourar a memória: iteramos os segmentos
    em streaming e vamos acumulando o texto.
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        erro_e_sai(
            "biblioteca 'faster-whisper' não instalada.\n"
            "       Instale com:  pip install -r requirements.txt"
        )

    log("modelo", f"carregando modelo '{modelo}' (pode baixar na 1ª vez)...")
    try:
        # int8 = mais rápido e com menor uso de memória em CPU.
        modelo_whisper = WhisperModel(modelo, device="cpu", compute_type="int8")
    except Exception as exc:  # noqa: BLE001 — queremos uma mensagem amigável
        erro_e_sai(
            f"falha ao carregar o modelo '{modelo}': {exc}\n"
            "       Modelos válidos: tiny, base, small, medium, large-v3."
        )

    log("transcrevendo", "iniciando (idioma: português)...")
    segmentos, info = modelo_whisper.transcribe(
        str(caminho_audio),
        language=IDIOMA,
        beam_size=5,
        vad_filter=True,   # remove silêncios; ajuda em áudios longos
    )

    duracao = getattr(info, "duration", 0) or 0
    partes: list[str] = []

    # Iteração em streaming: cada segmento é processado e descartado.
    for seg in segmentos:
        texto = seg.text.strip()
        if texto:
            partes.append(texto)

        # Progresso aproximado com base no tempo já transcrito.
        if duracao:
            pct = min(100, (seg.end / duracao) * 100)
            print(f"\r[transcrevendo] {pct:5.1f}%   ",
                  end="", file=sys.stderr, flush=True)

    print("", file=sys.stderr, flush=True)  # quebra a linha do progresso

    # Junta tudo em texto corrido (sem marcações de tempo) e normaliza espaços.
    texto_final = " ".join(partes)
    texto_final = re.sub(r"\s+", " ", texto_final).strip()
    return texto_final


# --------------------------------------------------------------------------- #
# Programa principal
# --------------------------------------------------------------------------- #
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transcreve o áudio de um vídeo do YouTube para .txt "
                    "(local, gratuito, em português).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Exemplos:\n"
            '  python transcrever.py "https://www.youtube.com/watch?v=XXXX"\n'
            '  python transcrever.py "https://youtu.be/XXXX" --modelo medium\n'
            '  python transcrever.py "URL" --manter-audio\n'
            '  python transcrever.py "URL" --cookies cookies.txt   # em VPS\n'
        ),
    )
    parser.add_argument("url", help="URL do vídeo do YouTube (obrigatório).")
    parser.add_argument(
        "--modelo",
        default="medium",
        help="Modelo do Whisper (padrão: medium). Opções comuns: "
             "tiny, base, small, medium, large-v3.",
    )
    parser.add_argument(
        "--manter-audio",
        action="store_true",
        help="Não apaga o arquivo de áudio temporário ao final.",
    )
    parser.add_argument(
        "--cookies",
        default=None,
        metavar="ARQUIVO",
        help="Caminho de um cookies.txt (formato Netscape) exportado do "
             "navegador. Use quando o YouTube pedir login no servidor/VPS "
             "('Sign in to confirm you're not a bot').",
    )
    args = parser.parse_args()

    # Pré-checagem: ffmpeg é necessário para extrair o áudio.
    verificar_ffmpeg()

    # Garante a pasta de saída.
    PASTA_SAIDA.mkdir(parents=True, exist_ok=True)

    # Pasta temporária para o áudio (limpa automaticamente no final).
    pasta_tmp = Path(tempfile.mkdtemp(prefix="transcrever_"))

    audio_path: Path | None = None
    try:
        # ---- Etapa 1: baixar áudio ----
        log("baixando", f"obtendo áudio de: {args.url}")
        try:
            audio_path, titulo = baixar_audio(args.url, pasta_tmp, args.cookies)
        except Exception as exc:  # noqa: BLE001
            # Mensagens mais amigáveis para os erros mais comuns do yt-dlp.
            msg = str(exc)
            if "Unsupported URL" in msg or "is not a valid URL" in msg:
                erro_e_sai("URL inválida. Verifique o link do vídeo.")
            elif "Sign in to confirm" in msg or "confirm you" in msg.lower():
                erro_e_sai(
                    "o YouTube pediu login para este IP (comum em VPS).\n"
                    "       Exporte um cookies.txt do navegador e rode de novo "
                    "com:  --cookies cookies.txt\n"
                    "       (veja a seção 'Rodando em VPS' no README)."
                )
            elif "not made this video available" in msg:
                erro_e_sai("vídeo com restrição regional (bloqueado no país "
                           "deste servidor).")
            elif ("Video unavailable" in msg or "Private video" in msg
                  or "unavailable" in msg.lower()):
                erro_e_sai("vídeo indisponível (privado, removido ou com "
                           "restrição regional).")
            else:
                erro_e_sai(f"falha ao baixar o áudio: {msg}")

        log("baixando", f"vídeo: {titulo}")

        # ---- Etapa 2: transcrever ----
        texto = transcrever_audio(audio_path, args.modelo)
        if not texto:
            erro_e_sai("a transcrição ficou vazia (áudio sem fala detectável?).")

        # ---- Etapa 3: salvar .txt ----
        nome_arquivo = sanitizar_nome(titulo) + ".txt"
        destino = PASTA_SAIDA / nome_arquivo
        log("salvando", f"gravando transcrição em: {destino}")
        destino.write_text(texto, encoding="utf-8")

        # ---- Áudio temporário ----
        if args.manter_audio:
            destino_audio = PASTA_SAIDA / (sanitizar_nome(titulo) + audio_path.suffix)
            shutil.move(str(audio_path), str(destino_audio))
            log("audio", f"áudio mantido em: {destino_audio}")

        print(f"\nPronto! Transcrição salva em: {destino}", flush=True)

    finally:
        # Limpa a pasta temporária (e o áudio, se não for para manter).
        shutil.rmtree(pasta_tmp, ignore_errors=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        erro_e_sai("interrompido pelo usuário.", codigo=130)
