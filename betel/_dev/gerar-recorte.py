# -*- coding: utf-8 -*-
"""
Gera o recorte (PNG com alfa -> webp) das mulheres da foto do hero, para que o
logo possa ficar ATRAS delas no site.

O recorte precisa ter EXATAMENTE as mesmas dimensoes da foto de fundo
(assets/img/fotos/equipe/img-9954.webp), porque as duas camadas usam o mesmo
object-fit/object-position no CSS e tem que bater pixel a pixel.

Requer: pip install "rembg[cpu]"
Rode de dentro da pasta betel/:  python _dev/gerar-recorte.py
Demora alguns minutos (a primeira vez baixa ~179MB de modelo).
"""
import os

from PIL import Image
from rembg import new_session, remove

# foto original em alta, direto da pasta entregue pelo designer
ORIGEM = (
    r"C:/Users/ander/Downloads/Betel/ENSAIO DAS 4 JUNTAS -20260921T225807Z-1-001"
    r"/ENSAIO DAS 4 JUNTAS/IMG_9954.JPG"
)
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUNDO = os.path.join(RAIZ, "assets", "img", "fotos", "equipe", "img-9954.webp")
DESTINO = os.path.join(RAIZ, "assets", "img", "fotos", "equipe", "img-9954-recorte.webp")

alvo = Image.open(FUNDO).size
print("fundo:", alvo)

src = Image.open(ORIGEM).convert("RGB")
sessao = new_session("isnet-general-use")
recorte = remove(
    src,
    session=sessao,
    alpha_matting=True,                      # cabelo fica muito melhor
    alpha_matting_foreground_threshold=250,
    alpha_matting_background_threshold=15,
    alpha_matting_erode_size=8,
)

recorte = recorte.resize(alvo, Image.LANCZOS)
recorte.save(DESTINO, "WEBP", quality=88, method=5, exact=True)
print("gerado:", DESTINO, recorte.size, "%.0f KB" % (os.path.getsize(DESTINO) / 1024))
