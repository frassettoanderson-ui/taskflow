"""OX Controle - agente local que junta telão (OBS), luz (Lumikit) e luz ambiente (COM25).

Roda no PC da academia e serve o painel em http://<ip-do-pc>:8710.
Só usa a biblioteca padrão do Python; pyserial é opcional (só para a COM).
"""
import base64
import datetime
import hashlib
import json
import logging
import os
import socket
import struct
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from logging.handlers import RotatingFileHandler
from urllib.parse import quote

PASTA = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.environ.get("OX_CONFIG") or os.path.join(PASTA, "config.json")

log = logging.getLogger("ox")
log.setLevel(logging.INFO)
_h = RotatingFileHandler(os.path.join(PASTA, "agente.log"), maxBytes=1_000_000, backupCount=3, encoding="utf-8")
_h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
log.addHandler(_h)
if __import__("sys").stderr:  # pythonw não tem console
    log.addHandler(logging.StreamHandler())


def carregar_config():
    with open(CONFIG_PATH, encoding="utf-8-sig") as f:
        return json.load(f)


CFG = carregar_config()


class Bloqueado(Exception):
    pass


# ---------------------------------------------------------------- trava do evento das 21h

def janela_evento(agora=None):
    """Retorna True se estamos dentro da janela protegida do evento automático."""
    ev = CFG.get("evento") or {}
    if not ev.get("ativo", True):
        return False
    agora = agora or datetime.datetime.now()
    if agora.weekday() not in ev.get("dias", [0, 1, 2, 3, 4]):
        return False
    hm = agora.strftime("%H:%M:%S")
    return ev.get("inicio", "20:58:00") <= hm <= ev.get("fim", "21:03:00")


def checar_trava():
    if janela_evento():
        raise Bloqueado("Evento das 21h em andamento: comandos travados até o fim do evento.")


# ---------------------------------------------------------------- OBS (obs-websocket v5)

class ObsWS:
    """Cliente websocket mínimo para o obs-websocket 5 (sem dependências)."""

    def __init__(self, host, porta, senha):
        self.host, self.porta, self.senha = host, porta, senha
        self.sock = None
        self.lock = threading.Lock()
        self.seq = 0

    def _ler_exato(self, n):
        buf = b""
        while len(buf) < n:
            parte = self.sock.recv(n - len(buf))
            if not parte:
                raise ConnectionError("OBS fechou a conexão")
            buf += parte
        return buf

    def _enviar_frame(self, dados, opcode=1):
        cab = bytes([0x80 | opcode])
        n = len(dados)
        if n < 126:
            cab += bytes([0x80 | n])
        elif n < 65536:
            cab += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            cab += bytes([0x80 | 127]) + struct.pack(">Q", n)
        mascara = os.urandom(4)
        self.sock.sendall(cab + mascara + bytes(b ^ mascara[i % 4] for i, b in enumerate(dados)))

    def _ler_frame(self):
        while True:
            b1, b2 = self._ler_exato(2)
            opcode, n = b1 & 0x0F, b2 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._ler_exato(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._ler_exato(8))[0]
            mascara = self._ler_exato(4) if b2 & 0x80 else None
            dados = self._ler_exato(n)
            if mascara:
                dados = bytes(b ^ mascara[i % 4] for i, b in enumerate(dados))
            if opcode == 8:
                raise ConnectionError("OBS encerrou a conexão")
            if opcode == 9:
                self._enviar_frame(dados, 10)
                continue
            if opcode in (1, 2):
                return json.loads(dados.decode("utf-8"))

    def _conectar(self):
        self.sock = socket.create_connection((self.host, self.porta), timeout=3)
        chave = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((
            f"GET / HTTP/1.1\r\nHost: {self.host}:{self.porta}\r\nUpgrade: websocket\r\n"
            f"Connection: Upgrade\r\nSec-WebSocket-Key: {chave}\r\nSec-WebSocket-Version: 13\r\n"
            "Sec-WebSocket-Protocol: obswebsocket.json\r\n\r\n").encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            parte = self.sock.recv(1024)
            if not parte:
                raise ConnectionError("OBS não respondeu ao handshake")
            resp += parte
        if b" 101 " not in resp.split(b"\r\n", 1)[0]:
            raise ConnectionError("OBS recusou a conexão websocket")
        hello = self._ler_frame()["d"]
        ident = {"rpcVersion": 1, "eventSubscriptions": 0}
        auth = hello.get("authentication")
        if auth:
            if not self.senha:
                raise ConnectionError("OBS pede senha e ela não foi encontrada")
            segredo = base64.b64encode(hashlib.sha256((self.senha + auth["salt"]).encode()).digest()).decode()
            ident["authentication"] = base64.b64encode(
                hashlib.sha256((segredo + auth["challenge"]).encode()).digest()).decode()
        self._enviar_frame(json.dumps({"op": 1, "d": ident}).encode())
        if self._ler_frame().get("op") != 2:
            raise ConnectionError("OBS não aceitou a identificação (senha errada?)")

    def _fechar(self):
        try:
            if self.sock:
                self.sock.close()
        finally:
            self.sock = None

    def pedir(self, tipo, dados=None):
        with self.lock:
            for tentativa in (1, 2):
                try:
                    if not self.sock:
                        self._conectar()
                    self.seq += 1
                    rid = str(self.seq)
                    self._enviar_frame(json.dumps({"op": 6, "d": {
                        "requestType": tipo, "requestId": rid, "requestData": dados or {}}}).encode())
                    while True:
                        msg = self._ler_frame()
                        if msg.get("op") == 7 and msg["d"].get("requestId") == rid:
                            st = msg["d"]["requestStatus"]
                            if not st.get("result"):
                                raise RuntimeError(st.get("comment") or f"OBS recusou {tipo}")
                            return msg["d"].get("responseData") or {}
                except (OSError, ConnectionError) as e:
                    self._fechar()
                    if tentativa == 2:
                        raise ConnectionError(f"OBS indisponível: {e}")


def senha_obs():
    if CFG["obs"].get("senha"):
        return CFG["obs"]["senha"]
    caminho = os.path.join(os.environ.get("APPDATA", ""), "obs-studio", "plugin_config", "obs-websocket", "config.json")
    try:
        with open(caminho, encoding="utf-8-sig") as f:
            return json.load(f).get("server_password", "")
    except OSError:
        return ""


OBS = ObsWS(CFG["obs"].get("host", "127.0.0.1"), CFG["obs"].get("porta", 4455), senha_obs())


def obs_status():
    r = OBS.pedir("GetSceneList")
    cenas = [c["sceneName"] for c in sorted(r.get("scenes", []), key=lambda c: -c["sceneIndex"])]
    return {"ok": True, "cenas": cenas, "atual": r.get("currentProgramSceneName")}


def obs_trocar_cena(nome):
    OBS.pedir("SetCurrentProgramScene", {"sceneName": nome})


# ---------------------------------------------------------------- Lumikit (WebRemote)

def lumikit(caminho):
    url = CFG["lumikit"].get("url", "http://127.0.0.1:5000").rstrip("/") + "/services/" + caminho
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            return json.loads(r.read().decode("utf-8-sig")).get("data")
    except OSError as e:
        raise ConnectionError(f"Lumikit indisponível: {e}")


def luz_status(pagina):
    cenas = lumikit(f"edmx_get_scenes_status/{int(pagina)}") or []
    ativa = (lumikit("edmx_get_active_scene") or [{}])[0]
    blackout = (lumikit("main_is_blackout_on") or [{}])[0].get("blackout")
    return {
        "ok": True,
        "pagina": int(pagina),
        "cenas": [{"nome": c.get("name", ""), "cor": c.get("color")} for c in cenas],
        "ativa": {"pagina": int(ativa.get("activePage", -1)), "cena": int(ativa.get("activeScene", -1))},
        "blackout": str(blackout).lower() == "true",
    }


def luz_cena(pagina, indice):
    lumikit(f"edmx_change_scene/{int(pagina)}/{int(indice)}")


def luz_blackout(ligar):
    lumikit("main_set_blackout_" + ("on" if ligar else "off"))


# ---------------------------------------------------------------- Luz ambiente (COM25)

COM_LOCK = threading.Lock()


def ambiente_enviar(cena_id):
    amb = CFG["ambiente"]
    cena = next((c for c in amb["cenas"] if str(c["id"]) == str(cena_id)), None)
    if not cena:
        raise ValueError(f"Cena de ambiente {cena_id} não cadastrada")
    try:
        import serial
    except ImportError:
        raise ConnectionError("pyserial não instalado neste Python")
    dados = bytes.fromhex(cena["bytes"])
    erros = []
    with COM_LOCK:
        for vel in amb.get("velocidades", [9600, 115200]):
            try:
                with serial.Serial(amb["porta"], vel, timeout=1) as ser:
                    time.sleep(0.5)
                    ser.write(dados)
                return
            except Exception as e:  # porta ocupada / velocidade não aceita
                erros.append(f"{vel}: {e}")
    raise ConnectionError(f"Não consegui usar a {amb['porta']} ({'; '.join(erros)})")


# ---------------------------------------------------------------- Momentos (vários comandos de uma vez)

def executar_passo(p):
    tipo = p.get("tipo")
    if tipo == "obs":
        obs_trocar_cena(p["cena"])
    elif tipo == "luz":
        luz_cena(p.get("pagina", 0), p["cena"])
    elif tipo == "blackout":
        luz_blackout(bool(p.get("ligar", True)))
    elif tipo == "ambiente":
        ambiente_enviar(p["cena"])
    elif tipo == "espera":
        time.sleep(min(float(p.get("segundos", 1)), 30))
    else:
        raise ValueError(f"Passo desconhecido: {tipo}")


def executar_momento(mid):
    m = next((m for m in CFG.get("momentos", []) if m["id"] == mid), None)
    if not m:
        raise ValueError("Momento não encontrado")
    falhas = []
    for p in m.get("passos", []):
        try:
            executar_passo(p)
        except Exception as e:
            falhas.append(str(e))
    return falhas


# ---------------------------------------------------------------- HTTP

def tentar(fn, *a):
    try:
        return fn(*a)
    except Exception as e:
        return {"ok": False, "erro": str(e)}


class Handler(BaseHTTPRequestHandler):
    server_version = "OXControle/1.0"

    def log_message(self, fmt, *args):
        pass

    def _json(self, codigo, obj):
        corpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def _pin_ok(self):
        pin = str(CFG.get("pin") or "")
        return not pin or self.headers.get("X-Pin", "") == pin

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            with open(os.path.join(PASTA, "painel.html"), "rb") as f:
                corpo = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(corpo)))
            self.end_headers()
            self.wfile.write(corpo)
            return
        if not self.path.startswith("/api/"):
            return self._json(404, {"erro": "não encontrado"})
        if not self._pin_ok():
            return self._json(401, {"erro": "PIN inválido"})
        if self.path.startswith("/api/status"):
            pagina = 0
            if "pagina=" in self.path:
                try:
                    pagina = int(self.path.split("pagina=")[1].split("&")[0])
                except ValueError:
                    pass
            return self._json(200, {
                "obs": tentar(obs_status),
                "luz": tentar(luz_status, pagina),
                "ambiente": {"ok": True, "porta": CFG["ambiente"]["porta"],
                             "cenas": [{"id": c["id"], "nome": c["nome"]} for c in CFG["ambiente"]["cenas"]]},
                "momentos": [{"id": m["id"], "nome": m["nome"]} for m in CFG.get("momentos", [])],
                "evento": {"travado": janela_evento(), "inicio": CFG["evento"]["inicio"][:5],
                           "fim": CFG["evento"]["fim"][:5]},
            })
        return self._json(404, {"erro": "não encontrado"})

    def do_POST(self):
        if not self._pin_ok():
            return self._json(401, {"erro": "PIN inválido"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            corpo = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self._json(400, {"erro": "JSON inválido"})
        try:
            checar_trava()
            if self.path == "/api/obs/cena":
                obs_trocar_cena(corpo["nome"])
            elif self.path == "/api/luz/cena":
                luz_cena(corpo.get("pagina", 0), corpo["cena"])
            elif self.path == "/api/luz/blackout":
                luz_blackout(bool(corpo.get("ligar")))
            elif self.path == "/api/ambiente/cena":
                ambiente_enviar(corpo["id"])
            elif self.path == "/api/momento":
                falhas = executar_momento(corpo["id"])
                log.info("momento %s %s", corpo["id"], falhas or "ok")
                if falhas:
                    return self._json(207, {"ok": False, "erro": " | ".join(falhas)})
            else:
                return self._json(404, {"erro": "não encontrado"})
            log.info("%s %s", self.path, json.dumps(corpo, ensure_ascii=False))
            return self._json(200, {"ok": True})
        except Bloqueado as e:
            return self._json(423, {"ok": False, "erro": str(e)})
        except (KeyError, ValueError) as e:
            return self._json(400, {"ok": False, "erro": f"Pedido inválido: {e}"})
        except Exception as e:
            log.warning("%s falhou: %s", self.path, e)
            return self._json(502, {"ok": False, "erro": str(e)})


def main():
    porta = int(CFG.get("porta_painel", 8710))
    srv = ThreadingHTTPServer(("0.0.0.0", porta), Handler)
    log.info("OX Controle no ar na porta %s", porta)
    srv.serve_forever()


if __name__ == "__main__":
    main()
