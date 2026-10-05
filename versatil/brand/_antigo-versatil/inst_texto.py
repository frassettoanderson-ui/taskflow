from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
base = Image.open("inst-base.jpg").convert("RGBA")
W, H = base.size
def fonte(peso, tam):
    f = ImageFont.truetype("Montserrat.ttf", tam)
    f.set_variation_by_axes([peso])
    return f
def texto_ouro(txt, f):
    """texto com degradê dourado vertical"""
    l, t, r, b = f.getbbox(txt)
    w, h = r - l + 4, b - t + 4
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).text((-l + 2, -t + 2), txt, font=f, fill=255)
    g = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        u = y / max(1, h - 1)
        c = np.array([243, 217, 139]) * (1 - u) + np.array([196, 150, 60]) * u
        g[y, :, :3] = c
    g[..., 3] = np.asarray(m)
    return Image.fromarray(g, "RGBA")
x0 = 372
# logo verdadeira (dourada, fundo transparente)
logo = Image.open(r"C:\Users\ander\Downloads\taskflow_backup_completo\versatil\brand\logo-dourado-transparente.png").convert("RGBA")
bb = logo.getbbox(); logo = logo.crop(bb)
lw = 300; logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
base.alpha_composite(logo, (x0, 34))
d = ImageDraw.Draw(base)
y = 34 + logo.height + 22
f1 = fonte(800, 50)
d.text((x0, y), "O MELHOR PREÇO", font=f1, fill=(255, 255, 255, 255)); y += 58
t2 = texto_ouro("DA REGIÃO", fonte(800, 62)); base.alpha_composite(t2, (x0 - 2, y - 4)); y += t2.height + 8
d.text((x0, y), "Produtos conferidos, preço de verdade e retirada na loja", font=fonte(500, 19), fill=(255, 255, 255, 205)); y += 40
# selos
def pilula(xy, txt, preenchido):
    f = fonte(700, 17); l, t, r, b = f.getbbox(txt); w, h = r - l + 44, 40
    x, yy = xy
    if preenchido:
        g = texto_ouro("x", fonte(800, 10))  # só p/ reutilizar paleta
        d.rounded_rectangle((x, yy, x + w, yy + h), radius=20, fill=(226, 186, 88, 255))
        d.text((x + 22 - l, yy + (h - (b - t)) / 2 - t), txt, font=f, fill=(20, 16, 8, 255))
    else:
        d.rounded_rectangle((x, yy, x + w, yy + h), radius=20, outline=(226, 186, 88, 255), width=2)
        d.text((x + 22 - l, yy + (h - (b - t)) / 2 - t), txt, font=f, fill=(243, 217, 139, 255))
    return x + w + 12
nx = pilula((x0, y), "PIX OU CARTÃO", True)
pilula((nx, y), "RETIRE NA LOJA", False)
base.convert("RGB").save("banner-05-institucional.jpg", quality=87, optimize=True, progressive=True)
print("ok", y + 40)
