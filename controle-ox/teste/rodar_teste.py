"""Sobe simuladores do Lumikit (:15000) e do OBS websocket (:14455, senha "teste")
e roda o agente na porta 18710 apontando para eles. Só para testar fora da academia."""
import base64
import hashlib
import json
import os
import socket
import struct
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "agente"))

# ---------------- Lumikit falso
NOMES = ["STROBO", "", "", "STROBO", "RED", "", "STROBO", "MOVIMENTO", "Vazia",
         "Fita 3K_Parede", "PAREDE", "FIM", "Fita RED ON", "FITE RED OFF", "Fita 3K ON", "Fita 3K OFF"]
CORES = [(255, 0, 0), (255, 255, 255), (255, 0, 0), (255, 255, 255), (255, 0, 0), (0, 0, 0), (255, 255, 255),
         (255, 255, 255), (0, 0, 0), (0, 0, 0), (255, 255, 255), (255, 255, 255), (255, 0, 0), (0, 0, 0),
         (255, 255, 120), (0, 0, 0)]
LUZ = {"pagina": 0, "cena": 8, "blackout": False}


class Lumi(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        p = self.path.split("/services/")[-1].split("/")
        cmd, args = p[0], p[1:]
        if cmd == "edmx_get_scenes_status":
            data = [{"name": n, "color": {"r": str(c[0]), "g": str(c[1]), "b": str(c[2])}}
                    for n, c in zip(NOMES, CORES)] if args[0] == "0" else []
        elif cmd == "edmx_get_active_scene":
            data = [{"activePage": str(LUZ["pagina"]), "activeScene": str(LUZ["cena"])}]
        elif cmd == "edmx_change_scene":
            LUZ["pagina"], LUZ["cena"] = int(args[0]), int(args[1])
            data = []
        elif cmd == "main_is_blackout_on":
            data = [{"blackout": "true" if LUZ["blackout"] else "false"}]
        elif cmd.startswith("main_set_blackout_"):
            LUZ["blackout"] = cmd.endswith("on")
            data = []
        else:
            self.send_response(404)
            self.end_headers()
            return
        corpo = json.dumps({"data": data}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(corpo)


# ---------------- OBS websocket falso (v5, com senha)
SENHA, SALT, CHALLENGE = "teste", "c2FsdA==", "ZGVzYWZpbw=="
OBS = {"cenas": ["Painel de Led", "Sorteio", "Institucional", "Centro", "Faixa Esquerda", "Faixa Direita", "Faixa Baixo"],
       "atual": "Painel de Led"}


def ler(c, n):
    b = b""
    while len(b) < n:
        x = c.recv(n - len(b))
        if not x:
            raise ConnectionError
        b += x
    return b


def ler_frame(c):
    b1, b2 = ler(c, 2)
    n = b2 & 0x7F
    if n == 126:
        n = struct.unpack(">H", ler(c, 2))[0]
    elif n == 127:
        n = struct.unpack(">Q", ler(c, 8))[0]
    m = ler(c, 4)
    return json.loads(bytes(x ^ m[i % 4] for i, x in enumerate(ler(c, n))))


def enviar(c, obj):
    d = json.dumps(obj).encode()
    cab = bytes([0x81]) + (bytes([len(d)]) if len(d) < 126 else bytes([126]) + struct.pack(">H", len(d)))
    c.sendall(cab + d)


def atender_obs(c):
    try:
        req = b""
        while b"\r\n\r\n" not in req:
            req += c.recv(1024)
        chave = [l.split(b": ")[1] for l in req.split(b"\r\n") if l.lower().startswith(b"sec-websocket-key")][0]
        aceite = base64.b64encode(hashlib.sha1(chave + b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest())
        c.sendall(b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                  b"Sec-WebSocket-Accept: " + aceite + b"\r\n\r\n")
        enviar(c, {"op": 0, "d": {"rpcVersion": 1, "authentication": {"challenge": CHALLENGE, "salt": SALT}}})
        ident = ler_frame(c)["d"]
        seg = base64.b64encode(hashlib.sha256((SENHA + SALT).encode()).digest()).decode()
        esperado = base64.b64encode(hashlib.sha256((seg + CHALLENGE).encode()).digest()).decode()
        if ident.get("authentication") != esperado:
            c.sendall(b"\x88\x02\x0f\xa0")
            return
        enviar(c, {"op": 2, "d": {"negotiatedRpcVersion": 1}})
        while True:
            r = ler_frame(c)["d"]
            ok, resp = True, {}
            if r["requestType"] == "GetSceneList":
                n = len(OBS["cenas"])
                resp = {"currentProgramSceneName": OBS["atual"],
                        "scenes": [{"sceneName": s, "sceneIndex": n - 1 - i} for i, s in enumerate(OBS["cenas"])]}
            elif r["requestType"] == "SetCurrentProgramScene":
                ok = r["requestData"]["sceneName"] in OBS["cenas"]
                if ok:
                    OBS["atual"] = r["requestData"]["sceneName"]
            enviar(c, {"op": 7, "d": {"requestType": r["requestType"], "requestId": r["requestId"],
                                      "requestStatus": {"result": ok, "code": 100 if ok else 600,
                                                        "comment": None if ok else "cena não existe"},
                                      "responseData": resp}})
    except (ConnectionError, OSError):
        pass
    finally:
        c.close()


def servidor_obs():
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("127.0.0.1", 14455))
    s.listen()
    while True:
        c, _ = s.accept()
        threading.Thread(target=atender_obs, args=(c,), daemon=True).start()


if __name__ == "__main__":
    threading.Thread(target=ThreadingHTTPServer(("127.0.0.1", 15000), Lumi).serve_forever, daemon=True).start()
    threading.Thread(target=servidor_obs, daemon=True).start()
    os.environ["OX_CONFIG"] = os.path.join(AQUI, "config-teste.json")
    import agente
    agente.main()
