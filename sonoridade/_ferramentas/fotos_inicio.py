# Converte as fotos geradas no Codex para webp leves da tela inicial (app/img/inicio/).
# Uso: python _ferramentas/fotos_inicio.py <pasta com os .png>
import sys, os
from PIL import Image
orig, destino = sys.argv[1], 'app/img/inicio'
for nome in os.listdir(orig):
    if not nome.endswith('.png'): continue
    im = Image.open(os.path.join(orig, nome)).convert('RGB')
    largura = 1600 if nome.startswith('estudio') else 960
    im.thumbnail((largura, largura))
    alvo = os.path.join(destino, nome.replace('.png', '.webp'))
    im.save(alvo, quality=72 if largura > 1000 else 76, method=6)
    print(alvo, os.path.getsize(alvo) // 1024, 'KB')
