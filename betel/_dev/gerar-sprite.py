# -*- coding: utf-8 -*-
"""
Injeta os logos (SVG) como <symbol> dentro do index.html, para que possam ser
usados com <use href="#lg-betel"> e recoloridos por CSS (fill:currentColor).

Rode de dentro da pasta betel/:   python _dev/gerar-sprite.py
E idempotente: substitui o bloco entre os marcadores SPRITE:INICIO / SPRITE:FIM.
"""
import io
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGOS = os.path.join(RAIZ, "assets", "img", "logo")
HTML = os.path.join(RAIZ, "index.html")

SIMBOLOS = [
    ("lg-betel", "betel-movimento.svg"),   # lockup completo: Betel + MOVIMENTO
    ("lg-betel-puro", "betel.svg"),        # so "Betel" + ramo (usado no hero)
    ("lg-ramo", "simbolo.svg"),            # so o ramo de oliveira
    ("lg-flor", "flor.svg"),               # margarida, ornamento das secoes
]


def corpo_e_viewbox(caminho):
    svg = io.open(caminho, encoding="utf-8").read()
    viewbox = re.search(r'viewBox="([^"]+)"', svg).group(1)
    corpo = re.sub(r"^.*?<svg[^>]*>", "", svg, flags=re.S)
    corpo = re.sub(r"</svg>\s*$", "", corpo)
    corpo = re.sub(r"<!--.*?-->", "", corpo, flags=re.S)
    corpo = re.sub(r"<\?xml.*?\?>", "", corpo, flags=re.S)
    return viewbox, corpo.strip()


partes = ['<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">']
for ident, arquivo in SIMBOLOS:
    vb, corpo = corpo_e_viewbox(os.path.join(LOGOS, arquivo))
    partes.append('<symbol id="%s" viewBox="%s" fill="currentColor">%s</symbol>' % (ident, vb, corpo))
partes.append("</svg>")
sprite = "<!--SPRITE:INICIO-->\n" + "\n".join(partes) + "\n<!--SPRITE:FIM-->"

html = io.open(HTML, encoding="utf-8").read()
if "<!--SPRITE:INICIO-->" in html:
    html = re.sub(r"<!--SPRITE:INICIO-->.*?<!--SPRITE:FIM-->", lambda m: sprite, html, flags=re.S)
elif "<!--SPRITE-->" in html:
    html = html.replace("<!--SPRITE-->", sprite)
else:
    raise SystemExit("Marcador <!--SPRITE--> nao encontrado no index.html")

io.open(HTML, "w", encoding="utf-8").write(html)
print("sprite injetado: %d simbolos, %d bytes" % (len(SIMBOLOS), len(sprite)))
