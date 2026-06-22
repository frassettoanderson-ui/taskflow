"""
Gera o ícone do aplicativo (icon.ico) usando Pillow.

Desenha um botão de "gravar" (círculo vermelho) sobre um fundo escuro
arredondado. Salva em múltiplos tamanhos dentro de um único .ico.

Uso:
    pip install pillow
    python gerar_icone.py
"""

from PIL import Image, ImageDraw

ARQUIVO = "icon.ico"
TAMANHO = 256  # desenhamos em alta resolução e reduzimos para os outros tamanhos

FUNDO   = (21, 21, 31, 255)     # quase preto (combina com o tema do app)
ANEL    = (60, 60, 80, 255)     # anel sutil ao redor
VERMELHO = (226, 59, 59, 255)   # bolinha de "gravar"


def desenhar(tam):
    img = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    margem = int(tam * 0.06)
    raio = int(tam * 0.22)

    # Fundo arredondado.
    d.rounded_rectangle(
        [margem, margem, tam - margem, tam - margem],
        radius=raio, fill=FUNDO)

    # Anel.
    cx = cy = tam // 2
    r_anel = int(tam * 0.30)
    d.ellipse([cx - r_anel, cy - r_anel, cx + r_anel, cy + r_anel],
              outline=ANEL, width=max(2, int(tam * 0.03)))

    # Bolinha vermelha de "gravar".
    r_rec = int(tam * 0.20)
    d.ellipse([cx - r_rec, cy - r_rec, cx + r_rec, cy + r_rec], fill=VERMELHO)

    return img


def main():
    base = desenhar(TAMANHO)
    tamanhos = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64),
                (128, 128), (256, 256)]
    base.save(ARQUIVO, format="ICO", sizes=tamanhos)
    print(f"Ícone gerado: {ARQUIVO}")


if __name__ == "__main__":
    main()
