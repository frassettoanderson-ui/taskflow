"""Monta arte 1920x500 a partir da geração 21:9: recorta faixa, escala p/ caber na área segura,
estende laterais (borda esticada + blur) e funde a base no cinza #EDEDED da loja."""
import sys
from PIL import Image, ImageFilter
import numpy as np
src, dst, y0, s = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
W, H = 1920, 500
im = Image.open(src).convert("RGB")
ch = int(round(H / s))
faixa = im.crop((0, y0, im.width, min(im.height, y0 + ch)))
if faixa.height < ch:  # completa embaixo com cinza
    tmp = Image.new("RGB", (im.width, ch), (237, 237, 237)); tmp.paste(faixa, (0, 0)); faixa = tmp
fw = int(round(im.width * s))
faixa = faixa.resize((fw, H), Image.LANCZOS)
out = Image.new("RGB", (W, H))
pad = (W - fw) // 2
# laterais: estica a coluna da borda e desfoca, para o fundo continuar sem emenda
# laterais: cada linha recebe a média das 30 colunas da borda (fundo liso, sem emenda)
fa = np.asarray(faixa).astype(float)
esq_cor = fa[:, :30].mean(axis=1)
dir_cor = fa[:, -30:].mean(axis=1)
base = np.zeros((H, W, 3))
base[:, :pad + 1] = esq_cor[:, None, :]
base[:, pad + fw - 1:] = dir_cor[:, None, :]
out = Image.fromarray(base.astype("uint8")); out.paste(faixa, (pad, 0))
# costura suave entre lateral e faixa
a = np.asarray(out).astype(float)
for x0 in (pad, pad + fw):
    for dx in range(-24, 25):
        x = x0 + dx
        if 0 < x < W - 1:
            a[:, x] = a[:, max(0, x - 1)] * 0.5 + a[:, x] * 0.5
# base: funde para #EDEDED nos últimos px
alvo = np.array([237, 237, 237], float)
ini = int(sys.argv[5]) if len(sys.argv) > 5 else 380
for y in range(ini, H):
    t = min(1.0, ((y - ini) / (H - ini - 40)) ** 0.9)
    a[y] = a[y] * (1 - t) + alvo * t
Image.fromarray(a.clip(0, 255).astype("uint8")).save(dst, quality=87, optimize=True, progressive=True)
print("ok", dst)
