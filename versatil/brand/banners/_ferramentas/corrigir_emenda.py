"""Remove a emenda horizontal entre fundo colorido e 'piso' cinza gerada pela IA.
Abaixo da linha, TUDO vira fundo novo (prolongamento da cor de cima sumindo no #EDEDED),
exceto as formas protegidas (botões, celular, cards), passadas em coordenadas de exibição 2000px.
Uso: corrigir_emenda.py entrada saida linha_disp fade_disp "x0,y0,x1,y1,raio;..." """
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGB")
W, H = img.size
k = W / 2000
linha, fade = int(float(sys.argv[3]) * k), int(float(sys.argv[4]) * k)
atraso = int(float(sys.argv[6]) * k) if len(sys.argv) > 6 else 0  # quanto a cor de cima segue antes de começar a sumir
im = np.asarray(img).astype(float)
formas = []
for s_ in (sys.argv[5].split(";") if len(sys.argv) > 5 and sys.argv[5] else []):
    so_escuro = s_.startswith("t:")
    x0, y0, x1, y1, r = [float(v) * k for v in s_.replace("t:", "").split(",")]
    formas.append((so_escuro, x0, y0, x1, y1, r))
# cor do fundo logo acima da emenda, SEM os objetos que cruzam a linha (interpola por cima deles)
ref = im[linha - 16:linha - 6].mean(axis=0)
livre = np.ones(W, bool)
for _, x0, y0, x1, y1, _r in formas:
    if y0 < linha < y1 or y1 > linha - 16 > y0:
        livre[max(0, int(x0) - 12):min(W, int(x1) + 12)] = False
xs = np.arange(W)
for c in range(3):
    ref[:, c] = np.interp(xs, xs[livre], ref[livre, c])
ref = np.asarray(Image.fromarray(ref[None].astype("uint8")).resize((max(1, W // 10), 1)).resize((W, 1), Image.BILINEAR)).astype(float)[0]
cinza = np.array([237, 237, 237], float)
fundo = im.copy()
for y in range(linha - 8, H):
    t = min(1.0, max(0.0, (y - linha - atraso) / fade)) ** 0.85
    fundo[y] = ref * (1 - t) + cinza * t
m = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(m)
d.rectangle((0, linha - 8, W, H), fill=255)
for so_escuro, x0, y0, x1, y1, r in formas:
    if not so_escuro:
        d.rounded_rectangle((x0, y0, x1, y1), radius=r, fill=0)
m = m.filter(ImageFilter.GaussianBlur(3))
mask = np.asarray(m).astype(float)
# formas "t:" (texto/objetos escuros sobre o piso): mantém só os pixels escuros
lum = im.mean(axis=2)
for so_escuro, x0, y0, x1, y1, r in formas:
    if so_escuro:
        a, b, c_, e = int(y0), int(y1), int(x0), int(x1)
        bloco = im[a:b, c_:e]
        sat = bloco.max(axis=2) - bloco.min(axis=2)
        escuro = (lum[a:b, c_:e] < 175) | (sat > 45)  # mantém escuro OU colorido (dourado); descarta piso cinza/branco
        esc = np.asarray(Image.fromarray((escuro * 255).astype("uint8")).filter(ImageFilter.MaxFilter(5))).astype(float)
        mask[a:b, c_:e] = np.minimum(mask[a:b, c_:e], 255 - esc)
mask = mask[..., None] / 255
out = im * (1 - mask) + fundo * mask
Image.fromarray(out.clip(0, 255).astype("uint8")).save(dst)
print("ok", dst)
