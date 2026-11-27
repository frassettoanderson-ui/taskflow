"""OX Show - telão, música, luz e luz ambiente da OXFITNESS num lugar só.

Roda no PC da academia. Serve:
  /        painel de controle (PIN)
  /telao   página que vai em tela cheia no painel de LED (vídeo, site, imagem e a música do dia)
Só usa a biblioteca padrão do Python; pyserial é opcional (luz ambiente na COM).
"""
import base64
import hashlib
import ctypes
import http.client
import queue
import datetime
import json
import logging
import mimetypes
import os
import random
import re
import socket
import struct
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from logging.handlers import RotatingFileHandler
from urllib.parse import quote, unquote, urlencode, urlparse, parse_qs

PASTA = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.environ.get("OX_CONFIG") or os.path.join(PASTA, "config.json")

log = logging.getLogger("oxshow")
log.setLevel(logging.INFO)
_h = RotatingFileHandler(os.path.join(PASTA, "oxshow.log"), maxBytes=2_000_000, backupCount=3, encoding="utf-8")
_h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
log.addHandler(_h)
if sys.stderr:  # pythonw não tem console
    log.addHandler(logging.StreamHandler())


def ler_json(caminho, padrao=None):
    try:
        with open(caminho, encoding="utf-8-sig") as f:
            return json.load(f)
    except FileNotFoundError:
        return padrao


def gravar_json(caminho, obj):
    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, caminho)


CFG = ler_json(CONFIG_PATH)
BASE = os.path.dirname(CONFIG_PATH)
MIDIA = os.path.abspath(os.path.join(BASE, CFG.get("pasta_midia", "midia")))
DADOS_PATH = os.path.join(BASE, CFG.get("arquivo_dados", "dados.json"))
REGISTRO_PATH = os.path.join(BASE, "registro.json")
DADOS_LOCK = threading.Lock()
DADOS = ler_json(DADOS_PATH, {})
for _k, _v in (("cenas", []), ("eventos", []), ("agenda", []), ("musica", {"programacao": []}),
               ("telao_padrao", {"modo": "preto"}), ("videos", {}),
               ("telao_template", {"ativo": False, "troca_banner": 12, "cidade": "Tubarão", "lat": -28.4667, "lon": -49.0069}),
               ("telao_config", {"funcionamento": {"0": ["05:00", "23:59"], "1": ["05:00", "23:59"], "2": ["05:00", "23:59"],
                                                   "3": ["05:00", "23:59"], "4": ["05:00", "23:59"], "5": ["08:00", "17:00"],
                                                   "6": ["08:00", "14:00"]},
                                 "volume_musica_com_video": 10})):
    DADOS.setdefault(_k, _v)

EXT_VIDEO = {".mp4", ".webm", ".mov", ".m4v"}
EXT_IMAGEM = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
EXT_AUDIO = {".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac"}


def agora():
    return datetime.datetime.now()


# ================================================================ estado compartilhado com o telão

class Estado:
    """Estado que a página do telão espelha. Cada mudança acorda quem está ouvindo (SSE)."""

    def __init__(self):
        self.cond = threading.Condition()
        self.versao = 0
        self.telao = {"modo": "padrao", "id": 0}
        self.musica = {"faixa": None, "id": 0, "volume": 0, "tocando": False}
        self.controle = {"pausado": False, "volume": 100}
        self.clientes = 0
        self.ultimo_contato = 0.0

    def publicar(self):
        with self.cond:
            self.versao += 1
            self.cond.notify_all()

    def foto(self):
        t = self.telao_efetivo()
        return {"telao": t, "musica": dict(self.musica), "controle": dict(self.controle),
                "template": {"ativo": False} if t.get("tela_cheia") else template_atual()}

    def telao_efetivo(self):
        t = dict(self.telao)
        if t.get("modo") == "padrao":
            p = dict(DADOS.get("telao_padrao") or {"modo": "preto"})
            if p.get("modo") == "rodizio":
                loops = videos_em_loop()
                if not loops:
                    return {"modo": "preto", "id": t["id"], "padrao": True, "rodizio": True}
                arq = loops[RODIZIO["i"] % len(loops)]
                return {"modo": "video", "arquivo": arq, "repetir": len(loops) == 1, "mudo": not video_cfg(arq).get("som"),
                        "id": t["id"] + RODIZIO["n"], "padrao": True, "rodizio": True}
            p["id"] = t["id"]
            p["padrao"] = True
            return p
        return t


ESTADO = Estado()
_seq = [0]


def proximo_id():
    _seq[0] += 1
    return int(time.time() * 1000) * 10 + _seq[0] % 10


RODIZIO = {"i": 0, "n": 0}


def video_cfg(arquivo):
    return (DADOS.get("videos") or {}).get(arquivo) or {}


def videos_em_loop():
    return [v for v in listar("videos", EXT_VIDEO) if video_cfg(v).get("tipo") == "loop"]


DUCK = {"ativo": False, "pausou_externa": False}


def atualizar_som_video():
    """Vídeo com som no telão: a música baixa (ou o rádio do navegador pausa) enquanto ele passa; depois volta."""
    t = ESTADO.telao_efetivo()
    quer = t.get("modo") == "video" and not t.get("mudo") and ESTADO.clientes > 0
    if quer == DUCK["ativo"]:
        return
    DUCK["ativo"] = quer
    MUSICA.publicar()
    if not ESTADO.musica.get("faixa"):  # música do dia ainda no navegador (Vymber): pausa e retoma
        if quer:
            def pausar():
                try:
                    if vymber_aberto():
                        vymber_comando({"tipo": "pausar"})
                    else:
                        midia_windows_comando("pausar")
                    DUCK["pausou_externa"] = True
                except Exception as e:
                    log.info("vídeo com som: não pausei o rádio (%s)", e)
            threading.Thread(target=pausar, daemon=True).start()
        elif DUCK["pausou_externa"]:
            DUCK["pausou_externa"] = False
            threading.Thread(target=lambda: vymber_comando({"tipo": "tocar"}) if vymber_aberto() else midia_windows_comando("retomar"),
                             daemon=True).start()


def telao_mostrar(passo):
    modo = passo.get("modo", "padrao")
    novo = {"modo": modo, "id": proximo_id()}
    if modo == "video":
        novo.update(arquivo=passo["arquivo"], repetir=bool(passo.get("repetir")), mudo=bool(passo.get("mudo")),
                    tela_cheia=bool(passo.get("tela_cheia")))
        if not os.path.isfile(caminho_midia("videos", passo["arquivo"])):
            raise FileNotFoundError(f"Vídeo não encontrado: {passo['arquivo']}")
    elif modo == "imagem":
        novo.update(arquivo=passo["arquivo"])
    elif modo == "site":
        novo.update(url=passo["url"])
    elif modo not in ("padrao", "preto"):
        raise ValueError(f"Modo de telão desconhecido: {modo}")
    ESTADO.telao = novo
    ESTADO.controle["pausado"] = False  # vídeo novo sempre começa tocando
    ESTADO.publicar()
    atualizar_som_video()


def telao_controle(p):
    a = p.get("acao")
    if a == "volume":
        ESTADO.controle["volume"] = max(0, min(100, int(p["volume"])))
    elif a in ("pausar", "tocar"):
        ESTADO.controle["pausado"] = a == "pausar"
    elif a in ("proximo", "anterior"):
        videos = listar("videos", EXT_VIDEO)
        if not videos:
            raise ValueError("Nenhum vídeo na pasta de vídeos")
        t = ESTADO.telao_efetivo()
        atual = t.get("arquivo") if t.get("modo") == "video" else None
        i = videos.index(atual) if atual in videos else -1
        i = (i + (1 if a == "proximo" else -1)) % len(videos)
        ESTADO.controle["pausado"] = False
        telao_mostrar({"modo": "video", "arquivo": videos[i]})
    else:
        raise ValueError(f"Ação de telão desconhecida: {a}")
    ESTADO.publicar()
    if ESTADO.clientes == 0:
        raise ValueError("Comando guardado, mas o telão ainda está no OBS: a janela do OX Show não está aberta no LED")


def caminho_midia(sub, nome):
    p = os.path.abspath(os.path.join(MIDIA, sub, nome))
    if not p.startswith(MIDIA + os.sep):
        raise ValueError("Caminho inválido")
    return p


def listar(sub, exts):
    pasta = os.path.join(MIDIA, sub)
    if not os.path.isdir(pasta):
        return []
    return sorted(f for f in os.listdir(pasta) if os.path.splitext(f)[1].lower() in exts)


def template_atual():
    """Moldura do telão: vídeo dentro + relógio, clima, banners (midia/template/banners) e parceiros (midia/template/parceiros)."""
    t = dict(DADOS.get("telao_template") or {})
    t["banners"] = listar(os.path.join("template", "banners"), EXT_IMAGEM)
    t["parceiros"] = listar(os.path.join("template", "parceiros"), EXT_IMAGEM)
    t["logo"] = next((f for f in listar("template", EXT_IMAGEM) if f.lower().startswith("logo")), None)
    return t


def listar_midia():
    musicas = os.path.join(MIDIA, "musicas")
    playlists = {}
    if os.path.isdir(musicas):
        for nome in sorted(os.listdir(musicas)):
            if os.path.isdir(os.path.join(musicas, nome)):
                playlists[nome] = len(listar(os.path.join("musicas", nome), EXT_AUDIO))
    tpl = template_atual()
    return {"videos": listar("videos", EXT_VIDEO), "imagens": listar("imagens", EXT_IMAGEM), "playlists": playlists,
            "banners": tpl["banners"], "parceiros": tpl["parceiros"]}


# ================================================================ música do dia

class Musica:
    def __init__(self):
        self.lock = threading.RLock()
        self.playlist = None       # playlist tocando agora
        self.manual = None         # playlist escolhida na mão (vale até a próxima faixa de horário)
        self.faixa_horario = None  # índice da faixa de horário ativa
        self.volume_base = 60
        self.volume_manual = None
        self.pausada = False
        self.fila = []
        self.atual = None
        self.historico = []

    def faixa_ativa(self):
        hm = agora().strftime("%H:%M")
        for i, f in enumerate(DADOS["musica"].get("programacao", [])):
            if f.get("ativo", True) is False:
                continue
            dias = f.get("dias", [0, 1, 2, 3, 4, 5, 6])
            if agora().weekday() in dias and f["inicio"] <= hm < f["fim"]:
                return i, f
        return None, None

    def tick(self):
        with self.lock:
            i, f = self.faixa_ativa()
            if i != self.faixa_horario:
                self.faixa_horario = i
                self.manual, self.volume_manual = None, None
                if f:
                    self.volume_base = int(f.get("volume", 60))
                    self.trocar_playlist(f["playlist"])
                else:
                    self.trocar_playlist(None)

    def trocar_playlist(self, nome):
        self.playlist, self.fila, self.historico = nome, [], []
        self.proxima()

    def faixas(self, nome):
        return listar(os.path.join("musicas", nome), EXT_AUDIO) if nome else []

    def proxima(self):
        with self.lock:
            nome = self.manual or self.playlist
            if nome and not self.fila:
                self.fila = self.faixas(nome)
                random.shuffle(self.fila)
            if self.atual:
                self.historico = (self.historico + [self.atual])[-50:]
            self.atual = self.fila.pop(0) if nome and self.fila else None
            self.publicar(nova=True)

    def publicar(self, nova=False):
        nome = self.manual or self.playlist
        m = ESTADO.musica
        if nova:
            m["id"] = proximo_id()
        m["faixa"] = f"musicas/{nome}/{self.atual}" if self.atual else None
        m["nome"] = os.path.splitext(self.atual)[0] if self.atual else None
        m["playlist"] = nome
        m["volume"] = self.volume_manual if self.volume_manual is not None else self.volume_base
        if DUCK["ativo"]:
            m["volume"] = min(m["volume"], int((DADOS.get("telao_config") or {}).get("volume_musica_com_video", 10)))
        m["tocando"] = bool(self.atual) and not self.pausada
        ESTADO.publicar()

    def acao(self, passo):
        with self.lock:
            a = passo.get("acao")
            if a == "pausar":
                self.pausada = True
            elif a == "retomar":
                self.pausada = False
            elif a == "volume":
                self.volume_manual = max(0, min(100, int(passo["volume"])))
            elif a == "proxima":
                self.pausada = False
                self.proxima()
                return
            elif a == "anterior":
                if not self.historico:
                    raise ValueError("Não tem música anterior nesta playlist")
                if self.atual:
                    self.fila.insert(0, self.atual)
                self.atual = self.historico.pop()
                self.pausada = False
                self.publicar(nova=True)
                return
            elif a == "playlist":
                if passo["playlist"] not in listar_midia()["playlists"]:
                    raise ValueError(f"Playlist não encontrada: {passo['playlist']}")
                self.manual, self.fila = passo["playlist"], []
                self.pausada = False
                self.proxima()
                return
            elif a == "programacao":
                self.manual, self.volume_manual, self.fila = None, None, []
                self.faixa_horario = -1
                self.tick()
                return
            else:
                raise ValueError(f"Ação de música desconhecida: {a}")
            self.publicar()


MUSICA = Musica()


# ================================================================ Lumikit (luz do palco, pela API WebRemote)

def lumikit(caminho):
    url = CFG["lumikit"].get("url", "http://127.0.0.1:5000").rstrip("/") + "/services/" + caminho
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            return json.loads(r.read().decode("utf-8-sig")).get("data")
    except OSError as e:
        raise ConnectionError(f"Lumikit não respondeu ({e})")


def nome_item(x):
    return x.get("name", "") if isinstance(x, dict) else str(x)


def luz_info(pagina):
    cenas = lumikit(f"edmx_get_scenes_status/{int(pagina)}") or []
    ativa = (lumikit("edmx_get_active_scene") or [{}])[0]
    blackout = (lumikit("main_is_blackout_on") or [{}])[0].get("blackout")
    try:
        timelines = [nome_item(t) for t in (lumikit("timeline_get_names") or [])]
    except ConnectionError:
        timelines = []
    return {
        "ok": True, "pagina": int(pagina),
        "cenas": [{"nome": c.get("name", ""), "cor": c.get("color")} for c in cenas],
        "ativa": {"pagina": int(ativa.get("activePage", -1)), "cena": int(ativa.get("activeScene", -1))},
        "blackout": str(blackout).lower() == "true",
        "timelines": timelines,
    }


# ================================================================ luz ambiente (COM)

COM_LOCK = threading.Lock()


def ambiente_enviar(cena_id):
    amb = CFG["ambiente"]
    cena = next((c for c in amb["cenas"] if str(c["id"]) == str(cena_id)), None)
    if not cena:
        raise ValueError(f"Cena de ambiente {cena_id} não cadastrada")
    try:
        import serial
    except ImportError:
        raise ConnectionError("pyserial não instalado (luz ambiente indisponível)")
    dados = bytes.fromhex(cena["bytes"])
    erros = []
    with COM_LOCK:
        for vel in amb.get("velocidades", [9600, 115200]):
            try:
                with serial.Serial(amb["porta"], vel, timeout=1) as ser:
                    time.sleep(0.5)
                    ser.write(dados)
                return
            except Exception as e:
                erros.append(f"{vel}: {e}")
    raise ConnectionError(f"Não consegui usar a {amb['porta']} ({'; '.join(erros)})")


def porta_com_existe():
    try:
        from serial.tools import list_ports
        return any(p.device.upper() == CFG["ambiente"]["porta"].upper() for p in list_ports.comports())
    except ImportError:
        return False


# ================================================================ MIDI timecode (luz do show das 21h)
# O Lumikit roda a timeline do show presa ao timecode que chega pelo loopMIDI. Antes vinha do REAPER
# (projeto RP OX: gerador de 94,5 s, 25 quadros/s, começando em 00:00:00:00). Aqui: quarter-frames F1 + full frame.

MTC = {"t": None, "parar": threading.Event(), "estado": "parado"}


def _midi_porta(trecho):
    w = ctypes.windll.winmm

    class CAPS(ctypes.Structure):
        _fields_ = [("wMid", ctypes.c_ushort), ("wPid", ctypes.c_ushort), ("v", ctypes.c_uint), ("nome", ctypes.c_wchar * 32),
                    ("t", ctypes.c_ushort), ("vo", ctypes.c_ushort), ("no", ctypes.c_ushort), ("cm", ctypes.c_ushort), ("sup", ctypes.c_uint)]
    for i in range(w.midiOutGetNumDevs()):
        c = CAPS()
        w.midiOutGetDevCapsW(i, ctypes.byref(c), ctypes.sizeof(c))
        if trecho.lower() in c.nome.lower():
            return i, c.nome
    raise ConnectionError(f"Porta MIDI '{trecho}' não encontrada (o loopMIDI está aberto?)")


def _mtc_rodar(segundos, fps, porta):
    w = ctypes.windll.winmm
    idx, nome = _midi_porta(porta)
    h = ctypes.c_void_p()
    r = w.midiOutOpen(ctypes.byref(h), idx, None, None, 0)
    if r:
        raise ConnectionError(f"Não abri a porta MIDI {nome} (erro {r})")
    taxa = {24: 0, 25: 1, 29: 2, 30: 3}.get(fps, 1)
    w.timeBeginPeriod(1)
    try:
        # full frame 00:00:00:00 (posiciona o receptor)
        sx = (ctypes.c_ubyte * 10)(0xF0, 0x7F, 0x7F, 0x01, 0x01, taxa << 5, 0, 0, 0, 0xF7)

        class HDR(ctypes.Structure):
            _fields_ = [("lpData", ctypes.c_void_p), ("len", ctypes.c_ulong), ("rec", ctypes.c_ulong), ("user", ctypes.c_void_p),
                        ("flags", ctypes.c_ulong), ("next", ctypes.c_void_p), ("res", ctypes.c_void_p), ("off", ctypes.c_ulong),
                        ("resv", ctypes.c_void_p * 8)]
        hd = HDR(ctypes.cast(sx, ctypes.c_void_p), 10)
        if not w.midiOutPrepareHeader(h, ctypes.byref(hd), ctypes.sizeof(hd)):
            w.midiOutLongMsg(h, ctypes.byref(hd), ctypes.sizeof(hd))
            time.sleep(0.02)
            w.midiOutUnprepareHeader(h, ctypes.byref(hd), ctypes.sizeof(hd))
        dt = 1.0 / (fps * 4)
        t0 = time.perf_counter()
        k = 0
        total = int(segundos * fps * 4)
        MTC["estado"] = "tocando"
        while k < total and not MTC["parar"].is_set():
            espera = t0 + k * dt - time.perf_counter()
            if espera > 0.002:
                time.sleep(espera - 0.001)
            while time.perf_counter() < t0 + k * dt:
                pass
            quadro = (k // 8) * 2
            ff, ss = quadro % fps, (quadro // fps) % 60
            mm, hh = (quadro // (fps * 60)) % 60, quadro // (fps * 3600)
            peca = k % 8
            val = [ff & 15, ff >> 4, ss & 15, ss >> 4, mm & 15, mm >> 4, hh & 15, (taxa << 1) | ((hh >> 4) & 1)][peca]
            w.midiOutShortMsg(h, 0xF1 | (((peca << 4) | val) << 8))
            k += 1
        log.info("timecode: %.1f s enviados em %s", k * dt, nome)
    finally:
        w.timeEndPeriod(1)
        w.midiOutReset(h)
        w.midiOutClose(h)
        MTC["estado"] = "parado"


def mtc_iniciar(segundos, fps=25, porta="loopMIDI"):
    if os.name != "nt":
        raise ValueError("Timecode só no Windows")
    t = MTC["t"]
    if t and t.is_alive():
        MTC["parar"].set()
        t.join(2)
    _midi_porta(porta)  # falha já aqui (aparece no registro) se o loopMIDI não estiver aberto
    MTC["parar"] = threading.Event()

    def rodar():
        try:
            _mtc_rodar(segundos, fps, porta)
        except Exception:
            log.exception("timecode")
    MTC["t"] = threading.Thread(target=rodar, daemon=True, name="mtc")
    MTC["t"].start()


# ================================================================ passos, cenas e eventos

def executar_passo(p, profundidade=0):
    tipo = p.get("tipo")
    if tipo == "telao":
        telao_mostrar(p)
    elif tipo == "musica":
        if not ESTADO.musica.get("faixa") and p.get("acao") in ("pausar", "retomar") and vymber_aberto():
            # música do dia = Vymber: pausa/retoma pelo próprio player (sem tecla de mídia do Windows)
            vymber_comando({"tipo": "pausar" if p["acao"] == "pausar" else "tocar"})
        elif not ESTADO.musica.get("faixa") and p.get("acao") in ("pausar", "retomar", "proxima", "anterior"):
            midia_windows_comando(p["acao"])  # música do dia ainda vem do rádio no navegador
        else:
            MUSICA.acao(p)
    elif tipo == "telao_controle":
        telao_controle(p)
    elif tipo == "luz":
        lumikit(f"edmx_change_scene/{int(p.get('pagina', 0))}/{int(p['cena'])}")
    elif tipo == "luz_timeline":
        if p.get("acao") == "parar":
            lumikit("timeline_stop")
        else:
            lumikit(f"timeline_play/{int(p.get('indice', 0))}")
    elif tipo == "timecode":
        mtc_iniciar(float(p.get("segundos", 94.5)), int(p.get("fps", 25)), p.get("porta") or "loopMIDI")
    elif tipo == "blackout":
        lumikit("main_set_blackout_" + ("on" if p.get("ligar", True) else "off"))
    elif tipo == "ambiente":
        ambiente_enviar(p["cena"])
    elif tipo == "espera":
        time.sleep(min(float(p.get("segundos", 1)), 60))
    elif tipo == "cena":
        if profundidade > 3:
            raise ValueError("Cenas chamando cenas demais")
        rodar_cena(p["id"], profundidade + 1)
    else:
        raise ValueError(f"Passo desconhecido: {tipo}")


def achar(colecao, iid):
    item = next((x for x in DADOS.get(colecao, []) if x.get("id") == iid), None)
    if not item:
        raise ValueError(f"Não encontrei '{iid}' em {colecao}")
    return item


CENA_ATUAL = {"id": None}


def rodar_cena(iid, profundidade=0, origem=""):
    cena = achar("cenas", iid)
    falhas = []
    for p in cena.get("passos", []):
        try:
            executar_passo(p, profundidade)
        except Exception as e:
            falhas.append(str(e))
    registrar("cena", cena["nome"], falhas, origem)
    if profundidade == 0 and not falhas:
        CENA_ATUAL["id"] = iid
    return falhas


class Execucao(threading.Thread):
    def __init__(self, evento, origem):
        super().__init__(daemon=True)
        self.evento, self.origem = evento, origem
        self.parar = threading.Event()
        self.inicio = time.time()
        self.feitos, self.falhas = 0, []
        passos = self.evento.get("passos", [])
        self.duracao = max([float(p.get("em", 0)) for p in passos] or [0])

    def run(self):
        log.info("evento '%s' começou (%s)", self.evento["nome"], self.origem)
        for p in sorted(self.evento.get("passos", []), key=lambda p: float(p.get("em", 0))):
            espera = self.inicio + float(p.get("em", 0)) - time.time()
            if espera > 0 and self.parar.wait(espera):
                break
            try:
                executar_passo(p)
            except Exception as e:
                self.falhas.append(f"{p.get('em', 0)}s {p.get('tipo')}: {e}")
                log.warning("evento '%s' passo falhou: %s", self.evento["nome"], e)
            self.feitos += 1
        situacao = "interrompido" if self.parar.is_set() else "concluído"
        registrar("evento", self.evento["nome"], self.falhas, f"{situacao} ({self.origem})")

    def info(self):
        return {"id": self.evento["id"], "nome": self.evento["nome"], "origem": self.origem,
                "decorrido": round(time.time() - self.inicio, 1), "duracao": self.duracao,
                "feitos": self.feitos, "total": len(self.evento.get("passos", [])), "falhas": self.falhas}


EXEC = {"atual": None}
EXEC_LOCK = threading.Lock()


def iniciar_evento(iid, origem):
    evento = achar("eventos", iid)
    with EXEC_LOCK:
        atual = EXEC["atual"]
        if atual and atual.is_alive():
            if origem == "agenda":
                atual.parar.set()
            else:
                raise RuntimeError(f"Já tem um evento rodando: {atual.evento['nome']}")
        ex = Execucao(evento, origem)
        EXEC["atual"] = ex
        ex.start()


def parar_evento():
    MTC["parar"].set()
    atual = EXEC["atual"]
    if atual and atual.is_alive():
        atual.parar.set()


# ================================================================ registro (histórico)

REGISTRO = ler_json(REGISTRO_PATH, []) or []
REG_LOCK = threading.Lock()


def registrar(tipo, nome, falhas, obs=""):
    item = {"quando": agora().strftime("%d/%m %H:%M:%S"), "tipo": tipo, "nome": nome,
            "ok": not falhas, "falhas": falhas, "obs": obs}
    with REG_LOCK:
        REGISTRO.insert(0, item)
        del REGISTRO[200:]
        try:
            gravar_json(REGISTRO_PATH, REGISTRO)
        except OSError:
            pass
    (log.warning if falhas else log.info)("%s '%s' %s %s", tipo, nome, obs, falhas or "ok")


# ================================================================ agenda

DISPAROS_PATH = os.path.join(BASE, "disparos.json")
DISPAROS = ler_json(DISPAROS_PATH, {}) or {}
TOLERANCIA = 120  # segundos: se o PC engasgar, o evento ainda roda dentro dessa janela
VERIFICACAO = {"quando": None, "item": None, "ok": True, "falhas": []}


def hora_do_dia(txt):
    partes = [int(x) for x in txt.split(":")] + [0, 0]
    return partes[0] * 3600 + partes[1] * 60 + partes[2]


def verificar_antes(item):
    falhas = []
    if item.get("tipo") == "evento":
        try:
            ev = achar("eventos", item["alvo"])
        except ValueError as e:
            ev, falhas = None, [str(e)]
        passos = ev.get("passos", []) if ev else []
        tipos = {p.get("tipo") for p in passos}
        for p in passos:
            if p.get("tipo") == "telao" and p.get("modo") == "video" and not os.path.isfile(caminho_midia("videos", p["arquivo"])):
                falhas.append(f"vídeo sumiu: {p['arquivo']}")
        if tipos & {"luz", "luz_timeline", "blackout"}:
            try:
                lumikit("edmx_get_active_scene")
            except ConnectionError as e:
                falhas.append(str(e))
        if "ambiente" in tipos and not porta_com_existe():
            falhas.append(f"porta {CFG['ambiente']['porta']} não encontrada")
        if tipos & {"telao", "musica"} and ESTADO.clientes == 0:
            falhas.append("telão desconectado")
    VERIFICACAO.update(quando=agora().strftime("%d/%m %H:%M:%S"), item=item["nome"], ok=not falhas, falhas=falhas)
    if falhas:
        registrar("verificação", item["nome"], falhas, "5 min antes")


def disparar(item):
    try:
        if item["tipo"] == "evento":
            iniciar_evento(item["alvo"], "agenda")
        else:
            threading.Thread(target=rodar_cena, args=(item["alvo"],), daemon=True).start()
    except Exception as e:
        registrar("agenda", item["nome"], [str(e)])


def proximos(limite=6):
    agora_ = agora()
    lista = []
    for item in DADOS["agenda"]:
        if not item.get("ativo"):
            continue
        for d in range(8):
            dia = agora_.date() + datetime.timedelta(days=d)
            if dia.weekday() not in item.get("dias", []):
                continue
            quando = datetime.datetime.combine(dia, datetime.time()) + datetime.timedelta(seconds=hora_do_dia(item["hora"]))
            if quando > agora_:
                lista.append((quando, item))
                break
    lista.sort(key=lambda x: x[0])
    dias = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]
    return [{"quando": f"{dias[q.weekday()]} {q:%d/%m %H:%M:%S}", "nome": i["nome"], "tipo": i.get("tipo"), "alvo": i.get("alvo"),
             "dia": dias[q.weekday()], "hora": f"{q:%H:%M}", "faltam": int((q - agora_).total_seconds())} for q, i in lista[:limite]]


def laco_agenda():
    while True:
        try:
            agora_ = agora()
            seg = agora_.hour * 3600 + agora_.minute * 60 + agora_.second
            hoje = agora_.date().isoformat()
            for item in list(DADOS["agenda"]):
                if not item.get("ativo") or agora_.weekday() not in item.get("dias", []):
                    continue
                alvo = hora_do_dia(item["hora"])
                chave = f"{item['id']}@{hoje}"
                if 0 < alvo - seg <= 300 and DISPAROS.get("v:" + chave) is None:
                    DISPAROS["v:" + chave] = True
                    threading.Thread(target=verificar_antes, args=(item,), daemon=True).start()
                if 0 <= seg - alvo <= TOLERANCIA and not DISPAROS.get(chave):
                    DISPAROS[chave] = agora_.strftime("%H:%M:%S")
                    for k in [k for k in DISPAROS if not k.endswith(hoje)]:
                        DISPAROS.pop(k, None)
                    gravar_json(DISPAROS_PATH, DISPAROS)
                    atraso = seg - alvo
                    log.info("agenda: %s (atraso %ss)", item["nome"], atraso)
                    disparar(item)
            MUSICA.tick()
        except Exception:
            log.exception("erro no laço da agenda")
        time.sleep(0.25)


# ================================================================ janela do telão (navegador em tela cheia)

def monitores():
    if os.name != "nt":
        return []
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass

    class MONITORINFO(ctypes.Structure):
        _fields_ = [("cbSize", wintypes.DWORD), ("rcMonitor", wintypes.RECT),
                    ("rcWork", wintypes.RECT), ("dwFlags", wintypes.DWORD)]

    lista = []
    PROC = ctypes.WINFUNCTYPE(ctypes.c_int, wintypes.HMONITOR, wintypes.HDC, ctypes.POINTER(wintypes.RECT), wintypes.LPARAM)

    def cb(h, _hdc, _r, _lp):
        mi = MONITORINFO()
        mi.cbSize = ctypes.sizeof(MONITORINFO)
        user32.GetMonitorInfoW(h, ctypes.byref(mi))
        rc = mi.rcMonitor
        lista.append({"x": rc.left, "y": rc.top, "w": rc.right - rc.left, "h": rc.bottom - rc.top,
                      "principal": bool(mi.dwFlags & 1)})
        return 1

    user32.EnumDisplayMonitors(None, None, PROC(cb), 0)
    return lista


def achar_navegador():
    candidatos = [CFG["telao"].get("navegador") or "",
                  r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                  r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                  r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                  os.path.join(os.environ.get("LOCALAPPDATA", ""), r"Google\Chrome\Application\chrome.exe")]
    return next((c for c in candidatos if c and os.path.isfile(c)), None)


TELAO_PROC = {"p": None}


def abrir_telao():
    nav = achar_navegador()
    if not nav:
        raise RuntimeError("Não achei o Edge nem o Chrome")
    m = monitor_do_telao() or {"x": 0, "y": 0}
    saida = CFG["telao"].get("saida_som", "MBS16CH")
    url = f"http://127.0.0.1:{CFG.get('porta_painel', 8710)}/telao" + (f"?saida={quote(saida)}" if saida else "")
    args = [nav, f"--kiosk", url, "--edge-kiosk-type=fullscreen", "--no-first-run", "--no-default-browser-check",
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required", "--disable-features=Translate,TranslateUI",
            "--noerrdialogs", "--disable-session-crashed-bubble", "--disable-infobars",
            f"--user-data-dir={os.path.join(BASE, 'navegador')}", f"--window-position={m['x']},{m['y']}"]
    fechar_telao()
    TELAO_PROC["p"] = subprocess.Popen(args)
    log.info("telão aberto no monitor %s", m)


def fechar_telao():
    p = TELAO_PROC["p"]
    if p and p.poll() is None:
        p.terminate()
    TELAO_PROC["p"] = None
    if os.name == "nt":  # o Edge pode ter deixado filhos com o nosso perfil
        perfil = os.path.join(BASE, "navegador")
        subprocess.run(["powershell", "-NoProfile", "-Command",
                        "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*" + perfil.replace("'", "''") +
                        "*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],
                       capture_output=True, timeout=20)


# ---------------------------------------------------------- VYMBER (janela própria, espelhada no painel)
# O OX Show abre o Vymber num Edge só dele (perfil em C:\OXShow\vymber) com a porta de depuração
# presa ao 127.0.0.1. O painel vê a tela por captura e manda cliques, rolagem e teclas por ela.
VYMBER = {"p": None, "ws": None, "alvo": None, "trava": threading.Lock(), "foto": None, "foto_t": 0.0, "n": 0,
          "porta": lambda: vymber_cfg()["porta"], "filtro": "vymber"}


def vymber_cfg():
    c = CFG.get("vymber") or {}
    return {"url": c.get("url") or "https://play.vymber.com.br/", "porta": int(c.get("porta_cdp") or 9334),
            "largura": int(c.get("largura") or 1280), "altura": int(c.get("altura") or 800)}


def _cdp_http(caminho, timeout=2, s=None):
    s = s or VYMBER
    with urllib.request.urlopen(f"http://127.0.0.1:{s['porta']()}{caminho}", timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def vymber_aberto():
    try:
        _cdp_http("/json/version", 1)
        return True
    except Exception:
        return False


def abrir_vymber():
    if vymber_aberto():
        return
    nav = achar_navegador()
    if not nav:
        raise RuntimeError("Não achei o Edge nem o Chrome")
    c = vymber_cfg()
    principal = next((m for m in monitores() if m["principal"]), None) or {"x": 0, "y": 0}
    args = [nav, f"--app={c['url']}", f"--user-data-dir={os.path.join(BASE, 'vymber')}",
            f"--remote-debugging-port={c['porta']}", "--remote-debugging-address=127.0.0.1",
            "--autoplay-policy=no-user-gesture-required", "--no-first-run", "--no-default-browser-check",
            "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
            "--disable-background-timer-throttling", "--disable-features=Translate,TranslateUI,CalculateNativeWinOcclusion",
            "--disable-session-crashed-bubble", "--noerrdialogs",
            f"--window-size={c['largura']},{c['altura']}", f"--window-position={principal['x'] + 40},{principal['y'] + 40}"]
    VYMBER["p"] = subprocess.Popen(args)
    for _ in range(40):
        if vymber_aberto():
            break
        time.sleep(0.25)
    registrar("música", "Vymber aberto no OX Show", [])


def laco_vymber_auto():
    """vymber.abrir_automatico: ao ligar o PC (sem o OBS), o OX Show abre o Vymber e dá play; se a janela
    fechar ou cair, abre de novo e volta a tocar. Pausa feita de propósito (painel, vídeo com som, YouTube) é respeitada."""
    time.sleep(20)
    while True:
        try:
            if (CFG.get("vymber") or {}).get("abrir_automatico") and not vymber_aberto() and not youtube_aberto():
                abrir_vymber()
                for _ in range(30):  # a página demora a montar o player
                    time.sleep(2)
                    try:
                        e = vymber_estado()
                        if e.get("tocando"):
                            break
                        if e.get("logado") and e.get("faixa"):
                            vymber_comando({"tipo": "tocar"})
                    except Exception:
                        pass
                registrar("música", "Vymber aberto e tocando (automático)", [])
        except Exception:
            log.exception("vymber automático")
        time.sleep(30)


def fechar_vymber():
    _ws_fechar()
    p = VYMBER["p"]
    if p and p.poll() is None:
        p.terminate()
    VYMBER["p"] = None
    if os.name == "nt":
        perfil = os.path.join(BASE, "vymber")
        subprocess.run(["powershell", "-NoProfile", "-Command",
                        "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*" + perfil.replace("'", "''") +
                        "*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],
                       capture_output=True, timeout=20, creationflags=0x08000000)
    registrar("música", "Vymber do OX Show fechado", [])


# --- websocket mínimo (cliente) só para o protocolo de depuração do navegador
def _ws_fechar(sess=None):
    sess = sess or VYMBER
    s = sess.get("ws")
    sess["ws"] = None
    sess["alvo"] = None
    if s:
        try:
            s.close()
        except Exception:
            pass


def _ws_ler_exato(s, n):
    buf = b""
    while len(buf) < n:
        parte = s.recv(n - len(buf))
        if not parte:
            raise ConnectionError("conexão fechada")
        buf += parte
    return buf


def _ws_enviar(s, texto):
    dados = texto.encode("utf-8")
    cab = bytearray([0x81])
    n = len(dados)
    if n < 126:
        cab.append(0x80 | n)
    elif n < 65536:
        cab.append(0x80 | 126)
        cab += struct.pack(">H", n)
    else:
        cab.append(0x80 | 127)
        cab += struct.pack(">Q", n)
    mascara = os.urandom(4)
    cab += mascara
    s.sendall(bytes(cab) + bytes(b ^ mascara[i % 4] for i, b in enumerate(dados)))


def _ws_receber(s):
    msg = b""
    while True:
        b1, b2 = _ws_ler_exato(s, 2)
        op, n = b1 & 0x0F, b2 & 0x7F
        if n == 126:
            n = struct.unpack(">H", _ws_ler_exato(s, 2))[0]
        elif n == 127:
            n = struct.unpack(">Q", _ws_ler_exato(s, 8))[0]
        mascara = _ws_ler_exato(s, 4) if b2 & 0x80 else None
        dados = _ws_ler_exato(s, n)
        if mascara:
            dados = bytes(b ^ mascara[i % 4] for i, b in enumerate(dados))
        if op == 0x8:
            raise ConnectionError("conexão fechada")
        if op == 0x9:  # ping
            continue
        if op in (0x0, 0x1, 0x2):
            msg += dados
            if b1 & 0x80:
                return msg.decode("utf-8")


def _ws_conectar(sess=None):
    sess = sess or VYMBER
    paginas = [p for p in _cdp_http("/json/list", s=sess) if p.get("type") == "page"]
    if not paginas:
        raise RuntimeError("A janela não tem página aberta")
    pag = next((p for p in paginas if sess["filtro"] in (p.get("url") or "")), paginas[0])
    u = urlparse(pag["webSocketDebuggerUrl"])
    s = socket.create_connection((u.hostname, u.port), timeout=8)
    chave = base64.b64encode(os.urandom(16)).decode()
    s.sendall((f"GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {chave}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
    resp = b""
    while b"\r\n\r\n" not in resp:
        parte = s.recv(4096)
        if not parte:
            raise ConnectionError("o navegador recusou a conexão")
        resp += parte
    esperado = base64.b64encode(hashlib.sha1((chave + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()).decode()
    if b" 101 " not in resp.split(b"\r\n", 1)[0] or esperado.encode() not in resp:
        s.close()
        raise ConnectionError("o navegador recusou a conexão")
    sess["ws"], sess["alvo"] = s, pag["id"]


def cdp(metodo, params=None, tentativa=True, sess=None):
    sess = sess or VYMBER
    with sess["trava"]:
        try:
            if not sess["ws"]:
                _ws_conectar(sess)
            s = sess["ws"]
            sess["n"] += 1
            n = sess["n"]
            _ws_enviar(s, json.dumps({"id": n, "method": metodo, "params": params or {}}))
            fim = time.time() + 8
            while time.time() < fim:
                m = json.loads(_ws_receber(s))
                if m.get("id") == n:
                    if "error" in m:
                        raise RuntimeError(m["error"].get("message", "erro do navegador"))
                    return m.get("result") or {}
            raise TimeoutError("a janela não respondeu")
        except (OSError, ConnectionError, TimeoutError, ValueError):
            _ws_fechar(sess)
            if not tentativa:
                raise
    return cdp(metodo, params, tentativa=False, sess=sess)


def _vy_desminimizar():
    """Minimizada, a página para de desenhar e cada foto leva ~2,5 s. Ao olhar a tela, volta ao normal."""
    if time.time() - VYMBER.get("janela_t", 0) < 3 or not VYMBER.get("alvo"):
        return
    VYMBER["janela_t"] = time.time()
    try:
        w = cdp("Browser.getWindowForTarget", {"targetId": VYMBER["alvo"]})
        if (w.get("bounds") or {}).get("windowState") == "minimized":
            cdp("Browser.setWindowBounds", {"windowId": w["windowId"], "bounds": {"windowState": "normal"}})
            time.sleep(0.3)
    except Exception as e:
        log.info("Vymber: não consegui desminimizar (%s)", e)


VY_MUDOU = threading.Event()


def vymber_tela(v=None, esperar=0):
    """Foto da janela do Vymber + tamanho da página (para mapear os cliques).
    Com `v` (versão que o painel já tem): espera até `esperar` s a tela mudar; se não mudar, volta sem a foto."""
    limite = time.time() + min(max(float(esperar or 0), 0), 8)
    while True:
        r = _vymber_foto()
        if not v or not r.get("aberto") or r.get("v") != v:
            return r
        if time.time() >= limite:
            return {"aberto": True, "igual": True, "v": v}
        VY_MUDOU.wait(0.35)
        if VY_MUDOU.is_set():
            VY_MUDOU.clear()
            time.sleep(0.15)  # dá tempo da página reagir ao clique


def _vymber_foto():
    if not vymber_aberto():
        return {"aberto": False}
    agora = time.time()
    if VYMBER["foto"] and agora - VYMBER["foto_t"] < 0.25:
        return VYMBER["foto"]
    m = cdp("Page.getLayoutMetrics")
    _vy_desminimizar()
    v = m.get("cssVisualViewport") or m.get("visualViewport") or {}
    w, h = v.get("clientWidth") or 1280, v.get("clientHeight") or 800
    escala = min(1.0, 1000 / max(w, 1))
    r = cdp("Page.captureScreenshot", {"format": "webp", "quality": 50, "fromSurface": True,
                                       "clip": {"x": v.get("pageX", 0), "y": v.get("pageY", 0), "width": w, "height": h, "scale": escala}})
    info = cdp("Runtime.evaluate", {"expression": "[location.href, document.title]", "returnByValue": True})
    href, titulo = ((info.get("result") or {}).get("value") or ["", ""])
    foto = r.get("data") or ""
    VYMBER["foto"] = {"aberto": True, "foto": foto, "tipo": "webp", "largura": w, "altura": h, "url": href, "titulo": titulo,
                      "v": hashlib.md5((foto + href).encode()).hexdigest()[:12]}
    VYMBER["foto_t"] = agora
    return VYMBER["foto"]


TECLAS_CDP = {"Enter": 13, "Backspace": 8, "Tab": 9, "Escape": 27, "Delete": 46, "ArrowLeft": 37, "ArrowUp": 38,
              "ArrowRight": 39, "ArrowDown": 40, "Home": 36, "End": 35, "PageUp": 33, "PageDown": 34, " ": 32}


def vymber_acao(c):
    if not vymber_aberto():
        raise RuntimeError("O Vymber não está aberto no OX Show")
    tipo = c.get("tipo")
    VYMBER["foto_t"] = 0
    VY_MUDOU.set()
    if tipo in ("clique", "rolar", "mover"):
        tela = VYMBER["foto"] or vymber_tela()
        x = max(0.0, min(1.0, float(c.get("x", 0)))) * tela["largura"]
        y = max(0.0, min(1.0, float(c.get("y", 0)))) * tela["altura"]
        if tipo == "rolar":
            cdp("Input.dispatchMouseEvent", {"type": "mouseWheel", "x": x, "y": y, "deltaX": 0,
                                             "deltaY": max(-3000, min(3000, float(c.get("dy", 0))))})
        elif tipo == "mover":
            cdp("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x, "y": y})
        else:
            cdp("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x, "y": y})
            for t in ("mousePressed", "mouseReleased"):
                cdp("Input.dispatchMouseEvent", {"type": t, "x": x, "y": y, "button": "left", "buttons": 1 if t == "mousePressed" else 0,
                                                 "clickCount": 1})
    elif tipo == "texto":
        texto = str(c.get("texto") or "")[:500]
        if texto:
            cdp("Input.insertText", {"text": texto})
    elif tipo == "tecla":
        tecla = str(c.get("tecla") or "")
        if tecla not in TECLAS_CDP:
            raise ValueError("Tecla não suportada")
        base = {"key": tecla, "code": "Space" if tecla == " " else tecla, "windowsVirtualKeyCode": TECLAS_CDP[tecla],
                "nativeVirtualKeyCode": TECLAS_CDP[tecla]}
        cdp("Input.dispatchKeyEvent", {"type": "rawKeyDown", **base})
        if tecla in ("Enter", " "):
            cdp("Input.dispatchKeyEvent", {"type": "char", "text": "\r" if tecla == "Enter" else " ", **base})
        cdp("Input.dispatchKeyEvent", {"type": "keyUp", **base})
    elif tipo == "voltar":
        cdp("Runtime.evaluate", {"expression": "history.back()"})
    elif tipo == "recarregar":
        cdp("Page.reload")
    elif tipo == "inicio":
        cdp("Page.navigate", {"url": vymber_cfg()["url"]})
    else:
        raise ValueError("Ação inválida")
    return {"ok": True}


# --- controle nativo do Vymber: lê o player da página e chama as funções dele (sem espelhar a tela)
_VY_LER = r"""(() => {
  const tx = e => (e ? e.textContent : "").replace(/\s+/g, " ").trim();
  const q = s => tx(document.querySelector(s));
  const logado = !!document.querySelector(".player-controls");
  if (!logado) return { logado: false };
  const jp = window.jQuery && jQuery(".player").data("jPlayer");
  const itens = [...document.querySelectorAll(".playlist-musicas .itens")];
  const ia = itens.findIndex(e => e.classList.contains("active"));
  const fila = (ia >= 0 ? itens.slice(ia + 1, ia + 11) : itens.slice(0, 10)).map(e => ({
    item: String(e.dataset.item), nome: tx(e.querySelector(".track")) || e.title || tx(e), tempo: tx(e.querySelector(".time")), spot: e.classList.contains("spot") }));
  const pls = [], vistos = new Set();
  for (const e of document.querySelectorAll("[onclick]")) {
    const oc = e.getAttribute("onclick") || ""; let m, k = null;
    if ((m = oc.match(/setMinhaPlaylist\((\d+)\)/))) k = { tipo: "minha", id: +m[1], setor: "" };
    else if ((m = oc.match(/setPlaylistPadrao\((\d+),\s*'(sugeridas|livres|tematicas)'\)/))) k = { tipo: "padrao", id: +m[1], setor: m[2] };
    else if ((m = oc.match(/setGenero\((\d+)\)/))) k = { tipo: "genero", id: +m[1], setor: "" };
    if (!k) continue;
    const ch = k.tipo + ":" + k.id + ":" + k.setor; if (vistos.has(ch)) continue; vistos.add(ch);
    const d = e.closest(".descricao-playlists-lista");
    k.nome = tx(d ? d.querySelector("p") : e.parentElement).slice(0, 70);
    if (k.nome) pls.push(k);
  }
  return { logado: true, tocando: typeof statusPlayer === "function" && statusPlayer() === "playing",
    faixa: q(".player-current-track"), tempo: q(".jp-current-time"), duracao: q(".jp-duration"),
    spot: ia >= 0 && itens[ia].classList.contains("spot"), playlist: q(".titulo-playlist-execucao"),
    volume: jp ? Math.round(jp.options.volume * 100) : null, fila, playlists: pls };
})()"""


def _vy_js(expr):
    r = cdp("Runtime.evaluate", {"expression": expr, "returnByValue": True})
    if r.get("exceptionDetails"):
        raise RuntimeError("O Vymber não aceitou o comando")
    return (r.get("result") or {}).get("value")


def vymber_estado():
    if not vymber_aberto():
        return {"aberto": False}
    e = _vy_js(_VY_LER) or {"logado": False}
    # a página do Vymber só mostra parte das playlists de cada vez (a tela inicial tem os cartões royalty free,
    # gêneros e temáticas): junta tudo o que já foi visto para o painel ter a lista completa
    vistas = VYMBER.setdefault("playlists", {})
    lidas = e.get("playlists") or []
    # "Minhas playlists" ficam sempre na barra lateral: a leitura atual manda (some a que foi apagada no Vymber)
    if any(p["tipo"] == "minha" for p in lidas):
        for k in [k for k in vistas if k[0] == "minha"]:
            del vistas[k]
    for p in lidas:
        vistas[(p["tipo"], p["id"], p["setor"])] = p
    if e.get("logado"):
        e["playlists"] = list(vistas.values())
    e["aberto"] = True
    return e


def vymber_comando(c):
    if not vymber_aberto():
        raise RuntimeError("O Vymber não está aberto no PC")
    tipo = c.get("tipo")
    botoes = {"tocar": ".player-play", "pausar": ".player-pause", "proxima": ".player-next", "anterior": ".player-prev"}
    if tipo in botoes:
        js = f"(() => {{ const b = document.querySelector('{botoes[tipo]}'); if (!b) return false; b.click(); return true; }})()"
    elif tipo == "faixa":
        js = f"setCurrent('{int(c.get('item'))}')"
    elif tipo == "volume":
        v = max(0, min(100, int(c.get("volume", 0))))
        js = f"(() => {{ jQuery('.player').jPlayer('volume', {v / 100}); try {{ jQuery('.bar-volume').slider('value', {v}); }} catch (e) {{}} return true; }})()"
    elif tipo == "embaralhar":
        js = "embaralharPlaylist()"
    elif tipo == "playlist":
        pid, qual = int(c.get("id")), c.get("qual")
        if qual == "minha":
            js = f"setMinhaPlaylist({pid})"
        elif qual == "genero":
            js = f"setGenero({pid})"
        elif qual == "padrao" and c.get("setor") in ("sugeridas", "livres", "tematicas"):
            js = f"setPlaylistPadrao({pid},'{c['setor']}')"
        else:
            raise ValueError("Playlist inválida")
    else:
        raise ValueError("Comando inválido")
    if tipo == "tocar" and youtube_aberto():  # o Vymber volta: o YouTube para
        fechar_youtube(retomar_vymber=False)
    if _vy_js(js) is False:
        raise RuntimeError("O botão não está disponível agora no Vymber")
    if tipo in ("playlist", "embaralhar"):
        registrar("música", f"Vymber: playlist {c.get('nome') or c.get('id') or 'embaralhada'}", [])
    VYMBER["foto_t"] = 0
    return {"ok": True}


# ---------------------------------------------------------- YOUTUBE (vídeo ou playlist no som da academia)
# Janela própria do Edge (perfil C:\OXShow\youtube, depuração na 9335). Enquanto toca, o Vymber fica pausado;
# ao parar (ou se a janela for fechada), o Vymber volta. Quando começa o show das 21h, o YouTube pausa sozinho.
YT = {"p": None, "ws": None, "alvo": None, "trava": threading.Lock(), "n": 0, "filtro": "youtube",
      "porta": lambda: int((CFG.get("youtube") or {}).get("porta_cdp") or 9335), "pausou_vymber": False, "protegido": False}
HOSTS_YT = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}


def youtube_aberto():
    try:
        _cdp_http("/json/version", 1, YT)
        return True
    except Exception:
        return False


def _yt_link(u):
    """Aceita link de vídeo, playlist, youtu.be e YouTube Music; devolve (url para abrir, tem_video)."""
    u = (u or "").strip()
    if not u.startswith("http"):
        u = "https://" + u
    pu = urlparse(u)
    host = (pu.hostname or "").lower()
    if host not in HOSTS_YT:
        raise ValueError("Cole um link do YouTube (youtube.com ou youtu.be)")
    q = parse_qs(pu.query)
    lista = re.sub(r"[^\w-]", "", (q.get("list") or [""])[0])
    video = re.sub(r"[^\w-]", "", pu.path.strip("/") if host == "youtu.be" else (q.get("v") or [""])[0])
    if not lista and not video:
        raise ValueError("Esse link não tem vídeo nem playlist")
    if video:
        return f"https://www.youtube.com/watch?v={video}" + (f"&list={lista}" if lista else ""), True
    return f"https://www.youtube.com/playlist?list={lista}", False


def _yt_js(expr):
    r = cdp("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, sess=YT)
    if r.get("exceptionDetails"):
        raise RuntimeError("O YouTube não aceitou o comando")
    return (r.get("result") or {}).get("value")


def _yt_saida():
    """O padrão do Windows é o HDMI do telão; a mesa (MBS16CH) só recebe o Vymber via OBS.
    Então o som do YouTube vai direto para a placa da mesa."""
    nome = (CFG.get("youtube") or {}).get("saida") or "MBS16CH"
    for perm in ("audioCapture", "speakerSelection"):
        try:
            cdp("Browser.grantPermissions", {"origin": "https://www.youtube.com", "permissions": [perm]}, sess=YT)
        except Exception:
            pass
    return _yt_js("""(async () => {
  const d = (await navigator.mediaDevices.enumerateDevices()).find(x => x.kind == 'audiooutput'
    && x.deviceId != 'default' && x.deviceId != 'communications' && x.label.includes(%s));
  if (!d) return 'sem saída';
  const m = [...document.querySelectorAll('video, audio')];
  if (!m.length) return 'sem player';
  for (const e of m) if (e.sinkId !== d.deviceId) await e.setSinkId(d.deviceId);
  return 'ok';
})()""" % json.dumps(nome))


def _vy_saida():
    """Sem o OBS: o som do Vymber vai direto para a mesa (vymber.saida, ex. "MBS16CH"), e só ele;
    o resto do PC continua no padrão do Windows. Vazio = não mexe (fase em que o OBS ainda captura o Vymber)."""
    nome = (CFG.get("vymber") or {}).get("saida")
    if not nome or not vymber_aberto():
        return None
    for perm in ("audioCapture", "speakerSelection"):
        try:
            cdp("Browser.grantPermissions", {"origin": "/".join(vymber_cfg()["url"].split("/")[:3]), "permissions": [perm]})
        except Exception:
            pass
    r = cdp("Runtime.evaluate", {"returnByValue": True, "awaitPromise": True, "expression": """(async () => {
  let ds = await navigator.mediaDevices.enumerateDevices();
  if (!ds.some(x => x.label)) { try { const st = await navigator.mediaDevices.getUserMedia({audio: true}); st.getTracks().forEach(t => t.stop()); } catch (e) {} ds = await navigator.mediaDevices.enumerateDevices(); }
  const d = ds.find(x => x.kind == 'audiooutput' && x.deviceId != 'default' && x.deviceId != 'communications' && x.label.includes(%s));
  if (!d) return 'sem saída';
  const m = [...document.querySelectorAll('video, audio')];
  if (!m.length) return 'sem player';
  for (const e of m) if (e.sinkId !== d.deviceId) await e.setSinkId(d.deviceId);
  return 'ok';
})()""" % json.dumps(nome)})
    return (r.get("result") or {}).get("value")


def laco_saida_som():
    """Confere a cada 10 s que o Vymber continua saindo na mesa (a página pode recarregar e perder a escolha)."""
    ultimo = None
    while True:
        time.sleep(10)
        try:
            r = _vy_saida()
        except Exception as e:
            r = f"erro: {e}"
        if r != ultimo and r is not None:
            log.info("saída de som do Vymber: %s", r)
        ultimo = r


def _yt_garantir_saida():
    r = None
    for _ in range(40):
        try:
            r = _yt_saida()
            if r == "ok":
                return
        except Exception as e:
            r = str(e)
        time.sleep(0.5)
    log.warning("YouTube: não consegui mandar o som para a mesa (%s)", r)


def _yt_comecar(sem_video):
    """Link só de playlist: espera a página e entra no primeiro vídeo dela (aí toca a lista inteira)."""
    if not sem_video:
        return
    for _ in range(40):
        time.sleep(0.5)
        try:
            href = _yt_js("(() => { const a = document.querySelector('a[href*=\"/watch?v=\"][href*=\"list=\"]'); return a ? a.href : null; })()")
        except Exception:
            href = None
        if href:
            cdp("Page.navigate", {"url": href}, sess=YT)
            return


def _pausar_vymber_pelo_youtube():
    try:
        if vymber_aberto() and (_vy_js(_VY_LER) or {}).get("tocando"):
            vymber_comando({"tipo": "pausar"})
            YT["pausou_vymber"] = True
    except Exception as e:
        log.info("YouTube: não pausei o Vymber (%s)", e)


def abrir_youtube(link):
    if janela_protegida():
        raise PermissionError("Evento das 21h (REAPER) em andamento: comandos travados alguns minutos.")
    url, tem_video = _yt_link(link)
    if youtube_aberto():
        cdp("Page.navigate", {"url": url}, sess=YT)
    else:
        nav = achar_navegador()
        if not nav:
            raise RuntimeError("Não achei o Edge nem o Chrome")
        principal = next((m for m in monitores() if m["principal"]), None) or {"x": 0, "y": 0}
        args = [nav, f"--app={url}", f"--user-data-dir={os.path.join(BASE, 'youtube')}",
                f"--remote-debugging-port={YT['porta']()}", "--remote-debugging-address=127.0.0.1",
                "--autoplay-policy=no-user-gesture-required", "--no-first-run", "--no-default-browser-check",
                "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
                "--disable-background-timer-throttling", "--disable-features=Translate,TranslateUI,CalculateNativeWinOcclusion",
                "--disable-session-crashed-bubble", "--noerrdialogs",
                "--window-size=1280,800", f"--window-position={principal['x'] + 80},{principal['y'] + 80}"]
        YT["p"] = subprocess.Popen(args)
        for _ in range(40):
            if youtube_aberto():
                break
            time.sleep(0.25)
    _pausar_vymber_pelo_youtube()
    threading.Thread(target=_yt_garantir_saida, daemon=True).start()
    threading.Thread(target=_yt_comecar, args=(not tem_video,), daemon=True).start()
    registrar("música", "YouTube tocando no som da academia", [], obs=url)
    return {"ok": True}


def _matar_perfil(pasta):
    if os.name == "nt":
        perfil = os.path.join(BASE, pasta)
        subprocess.run(["powershell", "-NoProfile", "-Command",
                        "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*" + perfil.replace("'", "''") +
                        "*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],
                       capture_output=True, timeout=20, creationflags=0x08000000)


def fechar_youtube(retomar_vymber=True):
    _ws_fechar(YT)
    p = YT["p"]
    if p and p.poll() is None:
        p.terminate()
    YT["p"] = None
    _matar_perfil("youtube")
    voltar = retomar_vymber and YT["pausou_vymber"]
    YT["pausou_vymber"] = False
    if voltar:
        try:
            vymber_comando({"tipo": "tocar"})
        except Exception as e:
            log.info("YouTube parou mas o Vymber não voltou (%s)", e)
    registrar("música", "YouTube parado" + (", Vymber de volta" if voltar else ""), [])
    return {"ok": True}


_YT_LER = r"""(() => {
  const p = document.getElementById("movie_player"), v = document.querySelector("video");
  const d = p && p.getVideoData ? p.getVideoData() : {};
  const lista = p && p.getPlaylist ? p.getPlaylist() : null;
  const tit = s => (document.querySelector(s)?.textContent || "").replace(/\s+/g, " ").trim();
  return { url: location.href, assistindo: location.pathname === "/watch", titulo: d.title || document.title.replace(/ - YouTube$/, ""),
    autor: d.author || "", tocando: !!(v && !v.paused && !v.ended), tempo: v ? v.currentTime : 0, duracao: v && isFinite(v.duration) ? v.duration : 0,
    volume: p && p.getVolume ? p.getVolume() : null, mudo: p && p.isMuted ? p.isMuted() : false,
    anuncio: !!document.querySelector(".ad-showing"), pular: !!document.querySelector(".ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button"),
    posicao: p && p.getPlaylistIndex ? p.getPlaylistIndex() : -1, total: lista ? lista.length : 0,
    playlist: tit("ytd-playlist-panel-renderer #header-description h3") || tit("ytd-playlist-panel-renderer .title") };
})()"""


def youtube_estado():
    if not youtube_aberto():
        return {"aberto": False}
    e = _yt_js(_YT_LER) or {}
    e["aberto"] = True
    e["vymberPausado"] = YT["pausou_vymber"]
    return e


def youtube_comando(c):
    if not youtube_aberto():
        raise RuntimeError("O YouTube não está tocando no PC")
    tipo = c.get("tipo")
    acoes = {"tocar": "movie_player.playVideo()", "pausar": "movie_player.pauseVideo()",
             "proxima": "movie_player.nextVideo()", "anterior": "movie_player.previousVideo()",
             "pular": "(() => { const b = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button'); if (!b) return false; b.click(); return true; })()"}
    if tipo in acoes:
        js = acoes[tipo]
    elif tipo == "volume":
        v = max(0, min(100, int(c.get("volume", 0))))
        js = f"(() => {{ movie_player.unMute(); movie_player.setVolume({v}); return true; }})()"
    else:
        raise ValueError("Comando inválido")
    if tipo == "tocar" and janela_protegida():
        raise PermissionError("Evento das 21h (REAPER) em andamento: comandos travados alguns minutos.")
    if _yt_js(js) is False:
        raise RuntimeError("Não deu para fazer isso agora no YouTube")
    if tipo == "tocar" and not YT["pausou_vymber"]:
        _pausar_vymber_pelo_youtube()
    return {"ok": True}


def laco_youtube():
    """Janela do YouTube fechada por fora: o Vymber volta. Show das 21h começando: o YouTube pausa."""
    while True:
        time.sleep(5)
        try:
            prot = janela_protegida()
            if prot and not YT["protegido"] and youtube_aberto():
                _yt_js("movie_player.pauseVideo()")
                registrar("música", "YouTube pausado para o show das 21h", [])
            YT["protegido"] = prot
            if youtube_aberto():
                _yt_saida()
            if YT["pausou_vymber"] and not youtube_aberto():
                YT["pausou_vymber"] = False
                vymber_comando({"tipo": "tocar"})
                registrar("música", "YouTube fechado, Vymber de volta", [])
        except Exception as e:
            log.info("laço do YouTube: %s", e)


def laco_vigia():
    """Se o telão sumir (navegador fechado/travado), abre de novo."""
    while True:
        time.sleep(5)
        try:
            if not CFG["telao"].get("abrir_automatico") or em_janela_21h():
                continue
            sem_contato = time.time() - ESTADO.ultimo_contato > 20
            if ESTADO.clientes == 0 and sem_contato:
                log.warning("telão sem contato, abrindo de novo")
                abrir_telao()
                time.sleep(25)
        except Exception:
            log.exception("vigia do telão")


def em_janela_21h():
    """Seg-sex 20:57-21:03, enquanto o show das 21h ainda é do REAPER/OBS (telao.ceder_21h)."""
    if not CFG["telao"].get("ceder_21h", True):
        return False
    agora = datetime.datetime.now()
    m = agora.hour * 60 + agora.minute
    return agora.weekday() < 5 and 20 * 60 + 57 <= m < 21 * 60 + 3


def laco_ceder_21h():
    """Enquanto o show das 21h ainda é do REAPER/OBS: a janela do OX Show sai do LED das 20:57 às 21:03
    (seg-sex) para não tampar o vídeo do OBS, e volta depois se estava aberta. telao.ceder_21h=false desliga."""
    cedido = False
    while True:
        time.sleep(10)
        try:
            janela = em_janela_21h()
            p = TELAO_PROC["p"]
            aberto = (p is not None and p.poll() is None) or ESTADO.clientes > 0
            if janela and aberto:
                log.info("show das 21h: telão do OX Show sai do LED (OBS assume)")
                fechar_telao()
                cedido = True
            elif cedido and not janela:
                log.info("show das 21h acabou: telão do OX Show volta ao LED")
                abrir_telao()
                cedido = False
        except Exception:
            log.exception("ceder 21h")


# ================================================================ prévia do telão (foto do monitor do LED + música)
# O painel mostra quase ao vivo o que está no LED: uma foto pequena do monitor a cada ~1 s.
# Funciona com o OBS ainda no comando (é foto da tela, não depende de quem desenha nela).

def monitor_do_telao():
    mons = monitores()
    escolha = CFG["telao"].get("monitor", "secundario")
    if isinstance(escolha, int) and 1 <= escolha <= len(mons):
        return mons[escolha - 1]
    return next((x for x in mons if not x["principal"]), mons[0] if mons else None)


class _GUID(ctypes.Structure):
    _fields_ = [("d1", ctypes.c_uint32), ("d2", ctypes.c_uint16), ("d3", ctypes.c_uint16), ("d4", ctypes.c_ubyte * 8)]

    @classmethod
    def de(cls, texto):
        import uuid
        return cls.from_buffer_copy(uuid.UUID(texto).bytes_le)


_GDIP = {"token": None}


def _jpeg_gdiplus(hbmp, qualidade=72):
    """HBITMAP -> bytes JPEG pelo GDI+ do Windows (sem Pillow)."""
    import tempfile
    from ctypes import wintypes
    gp = ctypes.windll.gdiplus
    if _GDIP["token"] is None:
        class Entrada(ctypes.Structure):
            _fields_ = [("versao", ctypes.c_uint32), ("cb", ctypes.c_void_p), ("sem_thread", wintypes.BOOL), ("sem_codecs", wintypes.BOOL)]
        tok = ctypes.c_size_t()
        if gp.GdiplusStartup(ctypes.byref(tok), ctypes.byref(Entrada(1, None, False, False)), None) != 0:
            raise OSError("GDI+ não iniciou")
        _GDIP["token"] = tok

    class Param(ctypes.Structure):
        _fields_ = [("guid", _GUID), ("n", ctypes.c_ulong), ("tipo", ctypes.c_ulong), ("valor", ctypes.c_void_p)]

    class Params(ctypes.Structure):
        _fields_ = [("qtd", ctypes.c_uint), ("p", Param * 1)]

    img = ctypes.c_void_p()
    if gp.GdipCreateBitmapFromHBITMAP(ctypes.c_void_p(hbmp), None, ctypes.byref(img)) != 0:
        raise OSError("GDI+ não leu a imagem")
    q = ctypes.c_ulong(qualidade)
    ps = Params(1, (Param * 1)(Param(_GUID.de("1d5be4b5-fa4a-452d-9cdd-5db35105e7eb"), 1, 4, ctypes.cast(ctypes.byref(q), ctypes.c_void_p))))
    clsid = _GUID.de("557cf401-1a04-11d3-9a73-0000f81ef32e")  # codificador JPEG
    fd, arq = tempfile.mkstemp(suffix=".jpg", prefix="oxshow-previa-")
    os.close(fd)
    try:
        st = gp.GdipSaveImageToFile(img, ctypes.c_wchar_p(arq), ctypes.byref(clsid), ctypes.byref(ps))
        if st != 0:
            raise OSError(f"GDI+ não gravou o JPEG ({st})")
        with open(arq, "rb") as f:
            return f.read()
    finally:
        gp.GdipDisposeImage(img)
        try:
            os.remove(arq)
        except OSError:
            pass


def capturar_monitor(m, largura=640):
    from ctypes import wintypes
    u, g = ctypes.windll.user32, ctypes.windll.gdi32
    H = ctypes.c_void_p
    u.GetDC.restype = H
    u.GetDC.argtypes = [H]
    u.ReleaseDC.argtypes = [H, H]
    g.CreateCompatibleDC.restype = H
    g.CreateCompatibleDC.argtypes = [H]
    g.CreateCompatibleBitmap.restype = H
    g.CreateCompatibleBitmap.argtypes = [H, ctypes.c_int, ctypes.c_int]
    g.SelectObject.restype = H
    g.SelectObject.argtypes = [H, H]
    g.SetStretchBltMode.argtypes = [H, ctypes.c_int]
    g.SetBrushOrgEx.argtypes = [H, ctypes.c_int, ctypes.c_int, H]
    g.StretchBlt.argtypes = [H, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, H,
                             ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.DWORD]
    g.DeleteObject.argtypes = [H]
    g.DeleteDC.argtypes = [H]
    w, h = m["w"], m["h"]
    lw = min(largura, w)
    lh = max(1, round(h * lw / w))
    tela = u.GetDC(None)
    mem = g.CreateCompatibleDC(tela)
    bmp = g.CreateCompatibleBitmap(tela, lw, lh)
    antigo = g.SelectObject(mem, bmp)
    try:
        g.SetStretchBltMode(mem, 4)  # HALFTONE: reduz sem serrilhar
        g.SetBrushOrgEx(mem, 0, 0, None)
        if not g.StretchBlt(mem, 0, 0, lw, lh, tela, m["x"], m["y"], w, h, 0x00CC0020):
            raise OSError("não consegui copiar a tela")
        g.SelectObject(mem, antigo)
        return _jpeg_gdiplus(bmp), lw, lh
    finally:
        g.DeleteObject(bmp)
        g.DeleteDC(mem)
        u.ReleaseDC(None, tela)


def titulos_janelas():
    if os.name != "nt":
        return []
    from ctypes import wintypes
    u = ctypes.windll.user32
    titulos = []
    PROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def cb(hwnd, _lp):
        if u.IsWindowVisible(hwnd):
            n = u.GetWindowTextLengthW(hwnd)
            if n:
                buf = ctypes.create_unicode_buffer(n + 1)
                u.GetWindowTextW(hwnd, buf, n + 1)
                titulos.append(buf.value)
        return True

    u.EnumWindows(PROC(cb), 0)
    return titulos


# Música tocando fora do OX Show (rádio indoor no Edge: Vymber, Sonvra...). O Windows sabe o que está
# tocando (controle de mídia do sistema, o mesmo da tecla de música); lemos por um PowerShell rápido.
_PS_MIDIA = r"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Esperar($op, $tipo) { $t = $asTask.MakeGenericMethod($tipo).Invoke($null, @($op)); $t.Wait(5000) | Out-Null; $t.Result }
$M = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$P = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$ger = Esperar ($M::RequestAsync()) $M
$lista = @(foreach ($s in $ger.GetSessions()) {
  $p = Esperar ($s.TryGetMediaPropertiesAsync()) $P
  [pscustomobject]@{ app = $s.SourceAppUserModelId; titulo = $p.Title; artista = $p.Artist; status = [string]$s.GetPlaybackInfo().PlaybackStatus }
})
ConvertTo-Json -Compress -InputObject $lista
"""
_MIDIA_WIN = {"t": 0.0, "lista": [], "rodando": False}


def _ler_midia_windows():
    try:
        import base64 as b64
        cod = b64.b64encode(_PS_MIDIA.encode("utf-16-le")).decode("ascii")
        r = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand", cod], capture_output=True,
                           timeout=20, creationflags=0x08000000)  # sem janela piscando no telão
        txt = r.stdout.decode("utf-8", "replace").strip()
        inicio = txt.find("[")
        _MIDIA_WIN["lista"] = json.loads(txt[inicio:]) if inicio >= 0 else []
    except Exception as e:
        log.warning("mídia do Windows: %s", e)
    finally:
        _MIDIA_WIN["t"] = time.time()
        _MIDIA_WIN["rodando"] = False


_PS_COMANDO = r"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Esperar($op, $tipo) { $t = $asTask.MakeGenericMethod($tipo).Invoke($null, @($op)); $t.Wait(5000) | Out-Null; $t.Result }
$M = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$ger = Esperar ($M::RequestAsync()) $M
$s = @($ger.GetSessions()) | Sort-Object { $_.SourceAppUserModelId -notmatch 'Edge' } | Select-Object -First 1
if (-not $s) { 'SEM'; exit }
$op = switch ('ACAO') { 'pausar' { $s.TryPauseAsync() } 'retomar' { $s.TryPlayAsync() } 'proxima' { $s.TrySkipNextAsync() } 'anterior' { $s.TrySkipPreviousAsync() } }
if (Esperar $op ([bool])) { 'OK' } else { 'NAO' }
"""


def midia_windows_comando(acao):
    if os.name != "nt":
        raise ValueError("Sem música tocando")
    cod = base64.b64encode(_PS_COMANDO.replace("ACAO", acao).encode("utf-16-le")).decode("ascii")
    r = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand", cod], capture_output=True,
                       timeout=20, creationflags=0x08000000)
    saida = r.stdout.decode("utf-8", "replace").strip().splitlines()
    res = saida[-1].strip() if saida else ""
    _MIDIA_WIN["t"] = 0  # relê o que está tocando
    site = site_de_musica() or "rádio do navegador"
    if res == "SEM":
        raise ValueError("Nenhuma música tocando no PC")
    if res != "OK":
        nomes = {"pausar": "pausar", "retomar": "dar play", "proxima": "avançar", "anterior": "voltar"}
        raise ValueError(f"O {site} não aceitou {nomes.get(acao, acao)}")


def midia_windows():
    """Último resultado (no máximo ~5 s de atraso); a leitura roda por fora para não segurar o painel."""
    if os.name == "nt" and not _MIDIA_WIN["rodando"] and time.time() - _MIDIA_WIN["t"] > 4:
        _MIDIA_WIN["rodando"] = True
        threading.Thread(target=_ler_midia_windows, daemon=True).start()
    return _MIDIA_WIN["lista"]


def site_de_musica():
    """Nome do site de rádio aberto no navegador (para mostrar a fonte)."""
    chaves = (CFG.get("musica_externa") or {}).get("sites") or ["Vymber", "Sonvra"]
    for t in titulos_janelas():
        for c in chaves:
            if c.lower() in t.lower():
                return c
    return None


def musica_externa():
    lista = [x for x in midia_windows() if isinstance(x, dict) and (x.get("titulo") or "").strip()]
    lista.sort(key=lambda x: (x.get("status") != "Playing", "edge" not in (x.get("app") or "").lower()))
    site = site_de_musica()
    if site:  # o site manda só o nome dele no lugar da música: não serve como nome de música
        lista = [x for x in lista if site.lower() not in x["titulo"].lower()]
    if lista:
        x = lista[0]
        nome = x["titulo"].strip() + (" · " + x["artista"].strip() if (x.get("artista") or "").strip() else "")
        return {"atual": nome, "tocando": x.get("status") == "Playing", "site": site}
    if site:
        return {"atual": None, "tocando": any(x.get("status") == "Playing" for x in midia_windows()), "site": site}
    return None


def _videos_dos_passos(passos, prof=0):
    for p in passos or []:
        if p.get("tipo") == "telao" and p.get("modo") == "video" and p.get("arquivo"):
            yield p["arquivo"]
        elif p.get("tipo") == "cena" and prof < 3:
            c = next((x for x in DADOS.get("cenas", []) if x.get("id") == p.get("id")), None)
            if c:
                yield from _videos_dos_passos(c.get("passos"), prof + 1)


def proximo_video():
    for p in proximos(12):
        col = "eventos" if p.get("tipo") == "evento" else "cenas"
        item = next((x for x in DADOS.get(col, []) if x.get("id") == p.get("alvo")), None)
        arq = next(_videos_dos_passos(item.get("passos")), None) if item else None
        if arq:
            return {"nome": os.path.splitext(arq)[0], "dia": p["dia"], "hora": p["hora"], "faltam": p["faltam"], "origem": p["nome"]}
    return None


_PREVIA = {"t": 0.0, "foto": None, "erro": None, "lock": threading.Lock()}


def foto_do_telao():
    with _PREVIA["lock"]:
        if time.time() - _PREVIA["t"] < 0.8:
            return _PREVIA["foto"], _PREVIA["erro"]
        _PREVIA["t"] = time.time()
        try:
            if os.name != "nt":
                raise OSError("prévia só no Windows")
            m = monitor_do_telao()
            if not m:
                raise OSError("monitor do telão não encontrado")
            jpg, w, h = capturar_monitor(m)
            _PREVIA["foto"] = {"src": "data:image/jpeg;base64," + base64.b64encode(jpg).decode("ascii"), "w": w, "h": h,
                               "hora": agora().strftime("%H:%M:%S")}
            _PREVIA["erro"] = None
        except Exception as e:
            _PREVIA["foto"], _PREVIA["erro"] = None, str(e)
        return _PREVIA["foto"], _PREVIA["erro"]


def previa(com_foto=True, janelas=False):
    foto, erro = foto_do_telao() if com_foto else (None, None)
    m = dict(ESTADO.musica)
    with MUSICA.lock:
        prox_faixa = os.path.splitext(MUSICA.fila[0])[0] if (m.get("playlist") and MUSICA.fila) else None
    if m.get("nome"):
        musica = {"atual": m["nome"], "fonte": "Playlist " + m["playlist"], "externa": False, "tocando": bool(m.get("tocando")), "volume": m.get("volume"),
                  "proxima": prox_faixa, "proxima_obs": None if prox_faixa else "A playlist recomeça embaralhada"}
    else:
        ext = musica_externa() or {}
        site = ext.get("site")
        musica = {"atual": ext.get("atual"), "site": site, "externa": bool(site or ext.get("atual")),
                  "fonte": site or ("Player do Windows" if ext.get("atual") else None),
                  "volume": m.get("volume"),
                  "tocando": bool(ext.get("tocando")),
                  "proxima": None, "proxima_obs": f"O {site} não informa a próxima música" if site else None}
    if ESTADO.clientes > 0:
        t = ESTADO.telao_efetivo()
        nome = os.path.splitext(t.get("arquivo") or "")[0]
        atual = {"video": "Vídeo " + nome, "imagem": "Imagem " + nome, "site": "Site " + str(t.get("url", "")),
                 "preto": "Tela preta"}.get(t.get("modo"), "Tela padrão")
        quem = "OX Show"
    else:
        atual, quem = "Vídeo do dia em loop", "OBS"
    led = CFG["telao"].get("led") or {"largura": 2816, "altura": 976}
    r = {"foto": foto, "foto_erro": erro, "telao": {"atual": atual, "quem": quem, **ESTADO.controle}, "led": led,
         "proximo_video": proximo_video(),
         "musica": musica, "relogio": agora().strftime("%H:%M:%S")}
    if janelas:
        r["janelas"] = titulos_janelas()
    return r


# ================================================================ vídeos do telão: envio, configuração e "X vezes por dia"
def minutos(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def horarios_do_dia(vezes, dia, ordem=0, total=1):
    """Espalha N passagens no horário da academia daquele dia. 'ordem' desloca um pouco cada vídeo para não baterem juntos."""
    func = ((DADOS.get("telao_config") or {}).get("funcionamento") or {}).get(str(dia.weekday()))
    if not func or not vezes:
        return []
    ini, fim = minutos(func[0]), minutos(func[1])
    if fim <= ini:
        return []
    passo = (fim - ini) / vezes
    desloc = passo * ordem / max(total, 1) / 2
    lista = []
    for i in range(int(vezes)):
        m = int(ini + passo * i + passo / 2 + desloc) % (24 * 60)
        lista.append(f"{m // 60:02d}:{m % 60:02d}")
    return lista


def videos_vezes():
    return [v for v in listar("videos", EXT_VIDEO) if video_cfg(v).get("tipo") == "vezes" and int(video_cfg(v).get("vezes") or 0) > 0]


def agenda_insercoes(dia):
    vs = videos_vezes()
    lista = []
    for ordem, v in enumerate(vs):
        for i, h in enumerate(horarios_do_dia(int(video_cfg(v)["vezes"]), dia, ordem, len(vs))):
            lista.append((h, v, i))
    return sorted(lista)


INSERCOES = {"dia": None, "feitas": set(), "fila": []}


def telao_livre():
    ex = EXEC["atual"]
    return (ESTADO.telao.get("modo") == "padrao" and not (ex and ex.is_alive()) and not janela_protegida())


def laco_insercoes():
    while True:
        time.sleep(10)
        try:
            if ESTADO.clientes == 0:  # o telão ainda está no OBS: o OX Show não mexe em nada
                continue
            hoje = agora().date()
            if INSERCOES["dia"] != hoje:
                INSERCOES.update(dia=hoje, feitas=set(), fila=[])
            hm = agora().strftime("%H:%M")
            agora_min = minutos(hm)
            for h, v, i in agenda_insercoes(hoje):
                chave = f"{v}|{i}"
                if h <= hm and chave not in INSERCOES["feitas"] and 0 <= agora_min - minutos(h) <= 15:
                    INSERCOES["feitas"].add(chave)
                    INSERCOES["fila"].append((time.time(), v, i))
            INSERCOES["fila"] = [x for x in INSERCOES["fila"] if time.time() - x[0] < 15 * 60]
            if INSERCOES["fila"] and telao_livre():
                _t, v, i = INSERCOES["fila"].pop(0)
                telao_mostrar({"modo": "video", "arquivo": v, "mudo": not video_cfg(v).get("som")})
                registrar("telão", os.path.splitext(v)[0], [], f"{i + 1}ª passagem do dia")
        except Exception:
            log.exception("inserções do telão")


def nome_seguro(nome):
    base, ext = os.path.splitext(os.path.basename(str(nome or "")))
    base = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', " ", base).strip(" .")[:80] or "video"
    ext = ext.lower()
    if ext not in EXT_VIDEO:
        raise ValueError("Formato de vídeo não aceito (use mp4, webm, mov ou m4v)")
    return base, ext


ENVIOS = {}


def receber_parte(corpo):
    eid = str(corpo.get("id") or "")
    if not re.fullmatch(r"[A-Za-z0-9]{6,40}", eid):
        raise ValueError("Envio inválido")
    base, ext = nome_seguro(corpo.get("nome"))
    parte, total = int(corpo.get("parte", -1)), int(corpo.get("total", 0))
    if not (0 <= parte < total):
        raise ValueError("Parte inválida")
    pasta = os.path.join(MIDIA, "videos")
    tmp = os.path.join(pasta, f".envio-{eid}.part")
    esperado = ENVIOS.get(eid, 0)
    if parte == esperado - 1:  # repetição da última parte (a rede caiu na resposta): já está gravada
        return {"ok": True, "parte": parte}
    if parte != esperado:
        raise ValueError(f"Parte fora de ordem (esperava {esperado + 1}, veio {parte + 1})")
    dados = base64.b64decode(corpo.get("dados") or "")
    with open(tmp, "wb" if parte == 0 else "ab") as f:
        f.write(dados)
    ENVIOS[eid] = parte + 1
    if parte + 1 < total:
        return {"ok": True, "parte": parte}
    ENVIOS.pop(eid, None)
    final, n = base + ext, 2
    while os.path.exists(os.path.join(pasta, final)):
        final, n = f"{base} ({n}){ext}", n + 1
    os.replace(tmp, os.path.join(pasta, final))
    with DADOS_LOCK:
        DADOS.setdefault("videos", {})[final] = {"tipo": "manual", "vezes": 4, "som": False}
        gravar_json(DADOS_PATH, DADOS)
    log.info("vídeo recebido: %s (%s bytes)", final, os.path.getsize(os.path.join(pasta, final)))
    return {"ok": True, "arquivo": final}


def apagar_video(arquivo):
    origem = caminho_midia("videos", arquivo)
    if not os.path.isfile(origem):
        raise FileNotFoundError("Vídeo não encontrado")
    t = ESTADO.telao_efetivo()
    if t.get("modo") == "video" and t.get("arquivo") == arquivo:
        raise ValueError("Esse vídeo está no ar agora. Troque o telão antes de apagar.")
    lixeira = os.path.join(MIDIA, "lixeira")
    os.makedirs(lixeira, exist_ok=True)
    destino = os.path.join(lixeira, agora().strftime("%Y%m%d-%H%M%S ") + arquivo)
    os.replace(origem, destino)  # vai para a lixeira, não some de vez
    with DADOS_LOCK:
        (DADOS.get("videos") or {}).pop(arquivo, None)
        gravar_json(DADOS_PATH, DADOS)
    log.info("vídeo para a lixeira: %s", arquivo)


def lista_videos():
    hoje = agora().date()
    hm = agora().strftime("%H:%M")
    agenda = agenda_insercoes(hoje)
    r = []
    for v in listar("videos", EXT_VIDEO):
        c = video_cfg(v)
        horas = [h for h, a, _i in agenda if a == v]
        r.append({"arquivo": v, "tamanho": os.path.getsize(caminho_midia("videos", v)), "tipo": c.get("tipo", "manual"),
                  "vezes": int(c.get("vezes") or 4), "som": bool(c.get("som")), "horarios": horas,
                  "proximos": [h for h in horas if h > hm][:4]})
    return r


# ================================================================ sorteio (ponte para o servidor do sorteio no OX Cloud)
# O painel fala só com o OX Show; a chave do sorteio fica no config.json deste PC e nunca vai para o navegador.
SORTEIO_ROTAS = {"state": "GET", "treinando": "GET", "participantes": "GET", "cmd": "POST", "excluir": "POST", "restaurar": "POST"}
SORTEIO_CMDS = {"geral", "aovivo", "next", "mute", "fullscreen", "home", "reset"}


def sorteio_no_telao():
    t = ESTADO.telao_efetivo()
    return t.get("modo") == "site" and "/sorteio" in str(t.get("url", ""))


def sorteio_api(ep, metodo, params):
    if SORTEIO_ROTAS.get(ep) != metodo:
        raise ValueError("Comando de sorteio inválido")
    if ep == "cmd" and params.get("c") not in SORTEIO_CMDS:
        raise ValueError("Comando de sorteio inválido")
    if ep == "cmd" and params.get("c") in ("geral", "aovivo") and not sorteio_no_telao():
        raise ValueError("Primeiro toque em \"Mostrar sorteio no telão\"")
    link = (CFG.get("sorteio") or {}).get("controle") or ""
    if not link:
        raise ValueError("O sorteio não está configurado neste PC")
    u = urlparse(link)
    chave = parse_qs(u.query).get("k", [""])[0]
    q = {k: str(v) for k, v in params.items() if k in ("c", "nome")}
    q["k"] = chave
    url = f"{u.scheme}://{u.netloc}/sorteio/api/{ep}?{urlencode(q)}"
    req = urllib.request.Request(url, data=b"" if metodo == "POST" else None, method=metodo,
                                 headers={"User-Agent": "OXShow/" + VERSAO, "Cache-Control": "no-store"})
    try:
        with urllib.request.urlopen(req, timeout=14) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except OSError as e:
        return 502, json.dumps({"ok": False, "erro": f"Servidor do sorteio não respondeu ({e})"}).encode("utf-8")


# ================================================================ trava enquanto o REAPER ainda faz o evento

def janela_protegida():
    ev = CFG.get("janela_protegida") or {}
    if not ev.get("ativo"):
        return False
    a = agora()
    return a.weekday() in ev.get("dias", []) and ev["inicio"] <= a.strftime("%H:%M:%S") <= ev["fim"]


# ================================================================ HTTP

COLECOES = {"cenas", "eventos", "agenda", "musica", "telao_padrao", "videos", "telao_config", "telao_template"}


def validar(colecao, valor):
    if colecao in ("cenas", "eventos", "agenda"):
        if not isinstance(valor, list) or any(not isinstance(x, dict) or not x.get("id") or not x.get("nome") for x in valor):
            raise ValueError("Lista inválida")
        if len({x["id"] for x in valor}) != len(valor):
            raise ValueError("Ids repetidos")
        if colecao == "agenda":
            for x in valor:
                if not re.fullmatch(r"\d{2}:\d{2}(:\d{2})?", x.get("hora", "")):
                    raise ValueError(f"Hora inválida em '{x['nome']}'")
                if x.get("tipo") not in ("evento", "cena"):
                    raise ValueError(f"Tipo inválido em '{x['nome']}'")
    elif colecao == "musica":
        if not isinstance(valor, dict) or not isinstance(valor.get("programacao"), list):
            raise ValueError("Programação inválida")
        for f in valor["programacao"]:
            if not (re.fullmatch(r"\d{2}:\d{2}", f.get("inicio", "")) and re.fullmatch(r"\d{2}:\d{2}", f.get("fim", ""))):
                raise ValueError("Horário de música inválido (use HH:MM)")
    elif colecao == "telao_padrao":
        if not isinstance(valor, dict) or valor.get("modo") not in ("video", "imagem", "site", "preto", "rodizio"):
            raise ValueError("Telão padrão inválido")
    elif colecao == "videos":
        if not isinstance(valor, dict):
            raise ValueError("Lista de vídeos inválida")
        for nome, c in valor.items():
            if not isinstance(c, dict) or c.get("tipo") not in ("loop", "vezes", "manual"):
                raise ValueError(f"Tipo inválido em '{nome}'")
            if c.get("tipo") == "vezes" and not (1 <= int(c.get("vezes") or 0) <= 96):
                raise ValueError(f"Número de vezes inválido em '{nome}' (1 a 96)")
    elif colecao == "telao_template":
        if not isinstance(valor, dict) or not isinstance(valor.get("ativo"), bool):
            raise ValueError("Template inválido")
        if not (4 <= int(valor.get("troca_banner") or 12) <= 120):
            raise ValueError("Troca do banner: de 4 a 120 segundos")
    elif colecao == "telao_config":
        func = (valor or {}).get("funcionamento")
        if not isinstance(func, dict):
            raise ValueError("Horário inválido")
        for d, h in func.items():
            if h and not (isinstance(h, list) and len(h) == 2 and all(re.fullmatch(r"\d{2}:\d{2}", x or "") for x in h)):
                raise ValueError("Horário da academia inválido (use HH:MM)")
        if not (0 <= int(valor.get("volume_musica_com_video", 10)) <= 100):
            raise ValueError("Volume inválido")


def estado_painel():
    ex = EXEC["atual"]
    luz = None
    try:
        lumikit("edmx_get_active_scene")
        luz = {"ok": True}
    except ConnectionError as e:
        luz = {"ok": False, "erro": str(e)}
    return {
        "telao": {**ESTADO.telao_efetivo(), "conectado": ESTADO.clientes > 0},
        "musica": dict(ESTADO.musica),
        "luz": luz,
        "ambiente": {"porta": CFG["ambiente"]["porta"], "cenas": [{"id": c["id"], "nome": c["nome"]} for c in CFG["ambiente"]["cenas"]]},
        "evento": ex.info() if ex and ex.is_alive() else None,
        "proximos": proximos(),
        "cena": CENA_ATUAL["id"],
        "verificacao": VERIFICACAO,
        "protegido": janela_protegida(),
        "relogio": agora().strftime("%H:%M:%S"),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "OXShow/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    # ---------- respostas
    def _corpo(self, codigo, corpo, tipo):
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def _json(self, codigo, obj):
        self._corpo(codigo, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def _local(self):
        return self.client_address[0] in ("127.0.0.1", "::1", "::ffff:127.0.0.1")

    def _pin_ok(self):
        pin = str(CFG.get("pin") or "")
        return not pin or self.headers.get("X-Pin", "") == pin or self._local() and not CFG.get("pin_local")

    def _origem(self):
        u = self.headers.get("X-Usuario")
        return f"OX Cloud: {unquote(u)}" if u else "manual"

    def _ler(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}") if n else {}

    def _arquivo_html(self, nome):
        with open(os.path.join(PASTA, nome), "rb") as f:
            self._corpo(200, f.read(), "text/html; charset=utf-8")

    # ---------- mídia com suporte a Range (o navegador pede pedaços do vídeo)
    def _midia(self, rel):
        try:
            caminho = os.path.abspath(os.path.join(MIDIA, unquote(rel)))
            if not caminho.startswith(MIDIA + os.sep) or not os.path.isfile(caminho):
                return self._json(404, {"erro": "arquivo não encontrado"})
        except ValueError:
            return self._json(404, {"erro": "arquivo não encontrado"})
        tam = os.path.getsize(caminho)
        tipo = mimetypes.guess_type(caminho)[0] or "application/octet-stream"
        ini, fim = 0, tam - 1
        faixa = self.headers.get("Range")
        if faixa:
            m = re.match(r"bytes=(\d*)-(\d*)", faixa)
            if m:
                if m.group(1):
                    ini = int(m.group(1))
                    fim = int(m.group(2)) if m.group(2) else tam - 1
                elif m.group(2):
                    ini = max(0, tam - int(m.group(2)))
            fim = min(fim, tam - 1)
            if ini > fim:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{tam}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
        self.send_response(206 if faixa else 200)
        self.send_header("Content-Type", tipo)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(fim - ini + 1))
        if faixa:
            self.send_header("Content-Range", f"bytes {ini}-{fim}/{tam}")
        self.end_headers()
        with open(caminho, "rb") as f:
            f.seek(ini)
            resta = fim - ini + 1
            try:
                while resta > 0:
                    bloco = f.read(min(256 * 1024, resta))
                    if not bloco:
                        break
                    self.wfile.write(bloco)
                    resta -= len(bloco)
            except (ConnectionError, OSError):
                pass

    # ---------- canal do telão (Server-Sent Events)
    def _sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        self.close_connection = True
        with ESTADO.cond:
            ESTADO.clientes += 1
        ESTADO.ultimo_contato = time.time()
        enviada = -1
        try:
            while True:
                with ESTADO.cond:
                    if ESTADO.versao == enviada:
                        ESTADO.cond.wait(10)
                    versao = ESTADO.versao
                if versao != enviada:
                    dados = json.dumps(ESTADO.foto(), ensure_ascii=False)
                    self.wfile.write(f"data: {dados}\n\n".encode("utf-8"))
                    enviada = versao
                else:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
                ESTADO.ultimo_contato = time.time()
        except (ConnectionError, OSError):
            pass
        finally:
            with ESTADO.cond:
                ESTADO.clientes -= 1

    # ---------- GET
    def do_GET(self):
        url = urlparse(self.path)
        rota = url.path
        if rota in ("/", "/index.html"):
            return self._arquivo_html("painel.html")
        if rota == "/telao":
            return self._arquivo_html("telao.html")
        if rota == "/telao/sse":
            return self._sse() if self._local() else self._json(403, {"erro": "só no próprio PC"})
        if rota.startswith("/midia/"):
            return self._midia(rota[len("/midia/"):]) if self._local() else self._json(403, {"erro": "só no próprio PC"})
        if not rota.startswith("/api/"):
            return self._json(404, {"erro": "não encontrado"})
        if not self._pin_ok():
            return self._json(401, {"erro": "PIN inválido"})
        if rota == "/api/estado":
            return self._json(200, estado_painel())
        if rota == "/api/videos":
            return self._json(200, lista_videos())
        if rota.startswith("/api/sorteio/"):
            try:
                st, corpo = sorteio_api(rota[len("/api/sorteio/"):], "GET", {k: v[0] for k, v in parse_qs(url.query).items()})
            except ValueError as e:
                return self._json(400, {"ok": False, "erro": str(e)})
            return self._corpo(st, corpo, "application/json; charset=utf-8")
        if rota == "/api/vymber/tela":
            try:
                q = parse_qs(url.query)
                return self._json(200, vymber_tela((q.get("v") or [""])[0], (q.get("esperar") or ["0"])[0]))
            except Exception as e:
                return self._json(200, {"aberto": vymber_aberto(), "erro": str(e)})
        if rota == "/api/youtube/estado":
            try:
                return self._json(200, youtube_estado())
            except Exception as e:
                return self._json(200, {"aberto": youtube_aberto(), "erro": str(e)})
        if rota == "/api/vymber/estado":
            try:
                return self._json(200, vymber_estado())
            except Exception as e:
                return self._json(200, {"aberto": vymber_aberto(), "erro": str(e)})
        if rota == "/api/previa":
            q = parse_qs(url.query)
            return self._json(200, previa(com_foto=q.get("foto", ["1"])[0] != "0", janelas="janelas" in q))
        if rota == "/api/dados":
            return self._json(200, {k: DADOS[k] for k in COLECOES})
        if rota == "/api/midia":
            return self._json(200, listar_midia())
        if rota == "/api/registro":
            return self._json(200, REGISTRO[:100])
        if rota == "/api/luz":
            pagina = int((parse_qs(url.query).get("pagina") or ["0"])[0])
            try:
                return self._json(200, luz_info(pagina))
            except ConnectionError as e:
                return self._json(200, {"ok": False, "erro": str(e)})
        return self._json(404, {"erro": "não encontrado"})

    # ---------- POST / PUT
    def do_POST(self):
        rota = urlparse(self.path).path
        try:
            corpo = self._ler()
        except ValueError:
            return self._json(400, {"erro": "JSON inválido"})
        if rota.startswith("/telao/"):
            if not self._local():
                return self._json(403, {"erro": "só no próprio PC"})
            ESTADO.ultimo_contato = time.time()
            if rota == "/telao/fim" and corpo.get("id") == ESTADO.telao.get("id") and ESTADO.telao.get("modo") == "video":
                ESTADO.telao = {"modo": "padrao", "id": proximo_id()}
                ESTADO.publicar()
                atualizar_som_video()
            elif rota == "/telao/fim" and ESTADO.telao.get("modo") == "padrao" and corpo.get("id") == ESTADO.telao_efetivo().get("id"):
                RODIZIO["i"] += 1
                RODIZIO["n"] += 1
                ESTADO.publicar()
                atualizar_som_video()
            elif rota == "/telao/musica-fim" and corpo.get("id") == ESTADO.musica.get("id"):
                MUSICA.proxima()
            elif rota == "/telao/erro":
                log.warning("telão: %s", corpo.get("msg"))
                if corpo.get("musica") and corpo.get("id") == ESTADO.musica.get("id"):
                    MUSICA.proxima()
            return self._json(200, {"ok": True})
        if not self._pin_ok():
            return self._json(401, {"erro": "PIN inválido"})
        if rota.startswith("/api/sorteio/"):
            try:
                params = {k: v[0] for k, v in parse_qs(urlparse(self.path).query).items()}
                params.update({k: v for k, v in corpo.items() if k in ("c", "nome")})
                st, resp = sorteio_api(rota[len("/api/sorteio/"):], "POST", params)
            except ValueError as e:
                return self._json(400, {"ok": False, "erro": str(e)})
            if st == 200 and params.get("c"):
                log.info("sorteio: %s (%s)", params["c"], self._origem())
            return self._corpo(st, resp, "application/json; charset=utf-8")
        try:
            if rota == "/api/executar":
                if janela_protegida() and corpo.get("tipo") != "evento-parar":
                    raise PermissionError("Evento das 21h (REAPER) em andamento: comandos travados alguns minutos.")
                if corpo["tipo"] == "cena":
                    falhas = rodar_cena(corpo["id"], origem=self._origem())
                    if falhas:
                        return self._json(207, {"ok": False, "erro": " | ".join(falhas)})
                elif corpo["tipo"] == "evento":
                    iniciar_evento(corpo["id"], self._origem())
                else:
                    raise ValueError("tipo inválido")
            elif rota == "/api/passo":
                if janela_protegida():
                    raise PermissionError("Evento das 21h (REAPER) em andamento: comandos travados alguns minutos.")
                executar_passo(corpo)
            elif rota == "/api/parar":
                parar_evento()
            elif rota == "/api/videos/enviar":
                return self._json(200, receber_parte(corpo))
            elif rota == "/api/videos/apagar":
                apagar_video(corpo.get("arquivo", ""))
            elif rota == "/api/vymber/abrir":
                abrir_vymber()
            elif rota == "/api/vymber/fechar":
                fechar_vymber()
            elif rota == "/api/vymber/acao":
                return self._json(200, vymber_acao(corpo))
            elif rota == "/api/vymber/comando":
                return self._json(200, vymber_comando(corpo))
            elif rota == "/api/youtube/tocar":
                return self._json(200, abrir_youtube(corpo.get("link", "")))
            elif rota == "/api/youtube/parar":
                return self._json(200, fechar_youtube())
            elif rota == "/api/youtube/comando":
                return self._json(200, youtube_comando(corpo))
            elif rota == "/api/telao/abrir":
                abrir_telao()
            elif rota == "/api/telao/fechar":
                fechar_telao()
            else:
                return self._json(404, {"erro": "não encontrado"})
            return self._json(200, {"ok": True})
        except PermissionError as e:
            return self._json(423, {"ok": False, "erro": str(e)})
        except (KeyError, ValueError, FileNotFoundError) as e:
            return self._json(400, {"ok": False, "erro": str(e)})
        except Exception as e:
            log.warning("%s falhou: %s", rota, e)
            return self._json(502, {"ok": False, "erro": str(e)})

    def do_PUT(self):
        rota = urlparse(self.path).path
        if not self._pin_ok():
            return self._json(401, {"erro": "PIN inválido"})
        colecao = rota[len("/api/dados/"):] if rota.startswith("/api/dados/") else ""
        if colecao not in COLECOES:
            return self._json(404, {"erro": "não encontrado"})
        try:
            valor = self._ler()
            validar(colecao, valor)
        except ValueError as e:
            return self._json(400, {"ok": False, "erro": str(e)})
        with DADOS_LOCK:
            DADOS[colecao] = valor
            gravar_json(DADOS_PATH, DADOS)
        if colecao == "musica":
            MUSICA.acao({"acao": "programacao"})
        if colecao in ("telao_padrao", "videos", "telao_template"):
            ESTADO.publicar()
            atualizar_som_video()
        log.info("dados '%s' salvos pelo painel (%s)", colecao, self._origem())
        return self._json(200, {"ok": True})


# ---------------------------------------------------------- OX Cloud (painel de qualquer rede)
# Conexão de SAÍDA para o OX Cloud (long-poll): busca os comandos do painel de lá, executa aqui
# como se fosse o painel local e devolve a resposta. Não precisa abrir porta no roteador.
VERSAO = "1.7"


class Conexoes:
    """Conexões HTTPS reaproveitadas (keep-alive) com o OX Cloud."""

    def __init__(self, base):
        u = urlparse(base)
        self.https, self.host, self.porta = u.scheme == "https", u.hostname, u.port
        self.prefixo = u.path.rstrip("/")
        self.livres = queue.LifoQueue()

    def _nova(self, timeout):
        cls = http.client.HTTPSConnection if self.https else http.client.HTTPConnection
        return cls(self.host, self.porta, timeout=timeout)

    def pedir(self, metodo, caminho, corpo=None, cab=None, timeout=15):
        for tentativa in (1, 2):
            try:
                c = self.livres.get_nowait() if tentativa == 1 else self._nova(timeout)
            except queue.Empty:
                c = self._nova(timeout)
            try:
                c.timeout = timeout
                if c.sock:
                    c.sock.settimeout(timeout)
                c.request(metodo, self.prefixo + caminho, body=corpo, headers=cab or {})
                r = c.getresponse()
                dados = r.read()
                if r.will_close:
                    c.close()
                else:
                    self.livres.put(c)
                return r.status, dados
            except Exception:
                try:
                    c.close()
                except Exception:
                    pass
                if tentativa == 2:
                    raise


NUVEM_CONEXOES = {}


def laco_nuvem():
    nuvem = CFG.get("nuvem") or {}
    url, token = (nuvem.get("url") or "").rstrip("/"), nuvem.get("token") or ""
    if not url or not token:
        return
    cab = {"X-Agente-Token": token, "X-Agente-Versao": VERSAO, "X-Agente-Maquina": os.environ.get("COMPUTERNAME", "")}
    log.info("OX Cloud: conectando em %s", url)
    fila, respostas = Conexoes(url), Conexoes(url)
    NUVEM_CONEXOES["respostas"] = respostas
    falhas = 0
    while True:
        try:
            st, corpo = fila.pedir("GET", "/api/show/agente/fila", cab=cab, timeout=40)
            if st != 200:
                raise RuntimeError(f"HTTP {st}")
            pedidos = json.loads(corpo or b"{}").get("pedidos") or []
            if falhas:
                log.info("OX Cloud: reconectado")
            falhas = 0
            for p in pedidos:
                threading.Thread(target=atender_nuvem, args=(url, cab, p), daemon=True).start()
        except Exception as e:
            falhas += 1
            if falhas in (1, 10) or falhas % 120 == 0:
                log.warning("OX Cloud sem conexão (%s): %s", falhas, e)
            time.sleep(5)


def atender_nuvem(url, cab, p):
    caminho = str(p.get("caminho") or "")
    if not caminho.startswith("/api/"):
        status, corpo = 403, json.dumps({"erro": "caminho não permitido"})
    else:
        dados = None if p.get("corpo") is None else json.dumps(p["corpo"]).encode("utf-8")
        h = {"X-Pin": str(CFG.get("pin") or ""), "X-Usuario": quote(str(p.get("usuario") or "OX Cloud"))}
        if dados is not None:
            h["Content-Type"] = "application/json"
        porta = int(CFG.get("porta_painel", 8710))
        req = urllib.request.Request(f"http://127.0.0.1:{porta}{caminho}", data=dados, headers=h, method=p.get("metodo") or "GET")
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                status, corpo = r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            status, corpo = e.code, e.read().decode("utf-8", "replace")
        except Exception as e:
            status, corpo = 502, json.dumps({"erro": f"OX Show não respondeu: {e}"})
    try:
        resp = json.dumps({"id": p.get("id"), "status": status, "corpo": corpo}).encode("utf-8")
        conn = NUVEM_CONEXOES.get("respostas") or Conexoes(url)
        st, _ = conn.pedir("POST", "/api/show/agente/resposta", resp, {**cab, "Content-Type": "application/json"}, timeout=15)
        if st >= 400:
            raise RuntimeError(f"HTTP {st}")
    except Exception as e:
        log.warning("OX Cloud: falha ao devolver resposta: %s", e)


def main():
    for sub in ("videos", "imagens", "musicas", os.path.join("template", "banners"), os.path.join("template", "parceiros")):
        os.makedirs(os.path.join(MIDIA, sub), exist_ok=True)
    porta = int(CFG.get("porta_painel", 8710))
    srv = ThreadingHTTPServer(("0.0.0.0", porta), Handler)
    srv.daemon_threads = True
    threading.Thread(target=laco_agenda, daemon=True).start()
    threading.Thread(target=laco_insercoes, daemon=True).start()
    threading.Thread(target=laco_vigia, daemon=True).start()
    threading.Thread(target=laco_ceder_21h, daemon=True).start()
    threading.Thread(target=laco_vymber_auto, daemon=True).start()
    threading.Thread(target=laco_saida_som, daemon=True).start()
    threading.Thread(target=laco_youtube, daemon=True).start()
    threading.Thread(target=laco_nuvem, daemon=True).start()
    if CFG["telao"].get("abrir_automatico"):
        threading.Thread(target=abrir_telao, daemon=True).start()
    log.info("OX Show no ar na porta %s (mídia em %s)", porta, MIDIA)
    srv.serve_forever()


if __name__ == "__main__":
    main()
