"""OX Show - telão, música, luz e luz ambiente da OXFITNESS num lugar só.

Roda no PC da academia. Serve:
  /        painel de controle (PIN)
  /telao   página que vai em tela cheia no painel de LED (vídeo, site, imagem e a música do dia)
Só usa a biblioteca padrão do Python; pyserial é opcional (luz ambiente na COM).
"""
import ctypes
import datetime
import json
import logging
import mimetypes
import os
import random
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from logging.handlers import RotatingFileHandler
from urllib.parse import quote, unquote, urlparse, parse_qs

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
               ("telao_padrao", {"modo": "preto"})):
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
        self.clientes = 0
        self.ultimo_contato = 0.0

    def publicar(self):
        with self.cond:
            self.versao += 1
            self.cond.notify_all()

    def foto(self):
        return {"telao": self.telao_efetivo(), "musica": dict(self.musica)}

    def telao_efetivo(self):
        t = dict(self.telao)
        if t.get("modo") == "padrao":
            p = dict(DADOS.get("telao_padrao") or {"modo": "preto"})
            p["id"] = t["id"]
            p["padrao"] = True
            return p
        return t


ESTADO = Estado()
_seq = [0]


def proximo_id():
    _seq[0] += 1
    return int(time.time() * 1000) * 10 + _seq[0] % 10


def telao_mostrar(passo):
    modo = passo.get("modo", "padrao")
    novo = {"modo": modo, "id": proximo_id()}
    if modo == "video":
        novo.update(arquivo=passo["arquivo"], repetir=bool(passo.get("repetir")), mudo=bool(passo.get("mudo")))
        if not os.path.isfile(caminho_midia("videos", passo["arquivo"])):
            raise FileNotFoundError(f"Vídeo não encontrado: {passo['arquivo']}")
    elif modo == "imagem":
        novo.update(arquivo=passo["arquivo"])
    elif modo == "site":
        novo.update(url=passo["url"])
    elif modo not in ("padrao", "preto"):
        raise ValueError(f"Modo de telão desconhecido: {modo}")
    ESTADO.telao = novo
    ESTADO.publicar()


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


def listar_midia():
    musicas = os.path.join(MIDIA, "musicas")
    playlists = {}
    if os.path.isdir(musicas):
        for nome in sorted(os.listdir(musicas)):
            if os.path.isdir(os.path.join(musicas, nome)):
                playlists[nome] = len(listar(os.path.join("musicas", nome), EXT_AUDIO))
    return {"videos": listar("videos", EXT_VIDEO), "imagens": listar("imagens", EXT_IMAGEM), "playlists": playlists}


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
        self.playlist, self.fila = nome, []
        self.proxima()

    def faixas(self, nome):
        return listar(os.path.join("musicas", nome), EXT_AUDIO) if nome else []

    def proxima(self):
        with self.lock:
            nome = self.manual or self.playlist
            if nome and not self.fila:
                self.fila = self.faixas(nome)
                random.shuffle(self.fila)
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
                self.proxima()
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


# ================================================================ passos, cenas e eventos

def executar_passo(p, profundidade=0):
    tipo = p.get("tipo")
    if tipo == "telao":
        telao_mostrar(p)
    elif tipo == "musica":
        MUSICA.acao(p)
    elif tipo == "luz":
        lumikit(f"edmx_change_scene/{int(p.get('pagina', 0))}/{int(p['cena'])}")
    elif tipo == "luz_timeline":
        if p.get("acao") == "parar":
            lumikit("timeline_stop")
        else:
            lumikit(f"timeline_play/{int(p.get('indice', 0))}")
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


def rodar_cena(iid, profundidade=0, origem=""):
    cena = achar("cenas", iid)
    falhas = []
    for p in cena.get("passos", []):
        try:
            executar_passo(p, profundidade)
        except Exception as e:
            falhas.append(str(e))
    registrar("cena", cena["nome"], falhas, origem)
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
    return [{"quando": f"{dias[q.weekday()]} {q:%d/%m %H:%M:%S}", "nome": i["nome"]} for q, i in lista[:limite]]


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
    mons = monitores()
    escolha = CFG["telao"].get("monitor", "secundario")
    if isinstance(escolha, int) and 1 <= escolha <= len(mons):
        m = mons[escolha - 1]
    else:
        m = next((x for x in mons if not x["principal"]), mons[0] if mons else {"x": 0, "y": 0})
    url = f"http://127.0.0.1:{CFG.get('porta_painel', 8710)}/telao"
    args = [nav, f"--kiosk", url, "--edge-kiosk-type=fullscreen", "--no-first-run", "--no-default-browser-check",
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


def laco_vigia():
    """Se o telão sumir (navegador fechado/travado), abre de novo."""
    while True:
        time.sleep(5)
        try:
            if not CFG["telao"].get("abrir_automatico"):
                continue
            sem_contato = time.time() - ESTADO.ultimo_contato > 20
            if ESTADO.clientes == 0 and sem_contato:
                log.warning("telão sem contato, abrindo de novo")
                abrir_telao()
                time.sleep(25)
        except Exception:
            log.exception("vigia do telão")


# ================================================================ trava enquanto o REAPER ainda faz o evento

def janela_protegida():
    ev = CFG.get("janela_protegida") or {}
    if not ev.get("ativo"):
        return False
    a = agora()
    return a.weekday() in ev.get("dias", []) and ev["inicio"] <= a.strftime("%H:%M:%S") <= ev["fim"]


# ================================================================ HTTP

COLECOES = {"cenas", "eventos", "agenda", "musica", "telao_padrao"}


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
        if not isinstance(valor, dict) or valor.get("modo") not in ("video", "imagem", "site", "preto"):
            raise ValueError("Telão padrão inválido")


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
            elif rota == "/telao/musica-fim" and corpo.get("id") == ESTADO.musica.get("id"):
                MUSICA.proxima()
            elif rota == "/telao/erro":
                log.warning("telão: %s", corpo.get("msg"))
                if corpo.get("musica") and corpo.get("id") == ESTADO.musica.get("id"):
                    MUSICA.proxima()
            return self._json(200, {"ok": True})
        if not self._pin_ok():
            return self._json(401, {"erro": "PIN inválido"})
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
        if colecao == "telao_padrao":
            ESTADO.publicar()
        log.info("dados '%s' salvos pelo painel (%s)", colecao, self._origem())
        return self._json(200, {"ok": True})


# ---------------------------------------------------------- OX Cloud (painel de qualquer rede)
# Conexão de SAÍDA para o OX Cloud (long-poll): busca os comandos do painel de lá, executa aqui
# como se fosse o painel local e devolve a resposta. Não precisa abrir porta no roteador.
VERSAO = "1.1"


def laco_nuvem():
    nuvem = CFG.get("nuvem") or {}
    url, token = (nuvem.get("url") or "").rstrip("/"), nuvem.get("token") or ""
    if not url or not token:
        return
    cab = {"X-Agente-Token": token, "X-Agente-Versao": VERSAO, "X-Agente-Maquina": os.environ.get("COMPUTERNAME", "")}
    log.info("OX Cloud: conectando em %s", url)
    falhas = 0
    while True:
        try:
            req = urllib.request.Request(url + "/api/show/agente/fila", headers=cab)
            with urllib.request.urlopen(req, timeout=40) as r:
                pedidos = json.loads(r.read() or b"{}").get("pedidos") or []
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
        req = urllib.request.Request(url + "/api/show/agente/resposta", data=resp, method="POST",
                                     headers={**cab, "Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=15).close()
    except Exception as e:
        log.warning("OX Cloud: falha ao devolver resposta: %s", e)


def main():
    for sub in ("videos", "imagens", "musicas"):
        os.makedirs(os.path.join(MIDIA, sub), exist_ok=True)
    porta = int(CFG.get("porta_painel", 8710))
    srv = ThreadingHTTPServer(("0.0.0.0", porta), Handler)
    srv.daemon_threads = True
    threading.Thread(target=laco_agenda, daemon=True).start()
    threading.Thread(target=laco_vigia, daemon=True).start()
    threading.Thread(target=laco_nuvem, daemon=True).start()
    if CFG["telao"].get("abrir_automatico"):
        threading.Thread(target=abrir_telao, daemon=True).start()
    log.info("OX Show no ar na porta %s (mídia em %s)", porta, MIDIA)
    srv.serve_forever()


if __name__ == "__main__":
    main()
