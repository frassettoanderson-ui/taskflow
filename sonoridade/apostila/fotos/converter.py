"""Converte as fotos geradas no Codex (a/, b/, PNG grandes) em JPG leves para a apostila (fotos/<nome>.jpg).
A foto da mão é espelhada: o Codex fez uma mão direita e a apostila precisa da esquerda."""
from pathlib import Path
from PIL import Image, ImageOps

AQUI = Path(__file__).resolve().parent
ESPELHAR = {"mao"}
for png in sorted(AQUI.glob("[a-z]/*.png")):
    im = Image.open(png).convert("RGB")
    if png.stem in ESPELHAR:
        im = ImageOps.mirror(im)
    if max(im.size) > 1400:
        im.thumbnail((1400, 1400), Image.LANCZOS)
    destino = AQUI / f"{png.stem}.jpg"
    im.save(destino, quality=84, optimize=True, progressive=True)
    print(destino.name, im.size)
