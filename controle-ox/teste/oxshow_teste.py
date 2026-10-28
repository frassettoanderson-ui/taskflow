"""Sobe o Lumikit falso (:15000) e o OX Show com a config/mídia de teste (pasta passada em OXSHOW_TESTE)."""
import os
import sys
import threading
from http.server import ThreadingHTTPServer

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, "..", "oxshow"))
import rodar_teste  # noqa: E402  (Lumikit falso)

threading.Thread(target=ThreadingHTTPServer(("127.0.0.1", 15000), rodar_teste.Lumi).serve_forever, daemon=True).start()
os.environ["OX_CONFIG"] = os.path.join(os.environ["OXSHOW_TESTE"], "config.json")
import oxshow  # noqa: E402
oxshow.main()
