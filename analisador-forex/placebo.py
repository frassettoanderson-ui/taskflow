"""Teste placebo: o pipeline encontra borda onde sabidamente nao existe?

Constroi uma serie sintetica embaralhando a ORDEM dos retornos reais. Cada
vela mantem a propria forma (corpo, sombras, proporcoes), entao os detectores
disparam com frequencia parecida com a real — mas a sequencia e destruida,
logo nao existe nada a prever.

O placebo nao e um teste de aprovado/reprovado: ele mede a **linha de base
de falsas descobertas**. Com FDR de 10% espera-se aprovacao ocasional mesmo
no aleatorio — e isso e o metodo funcionando como anunciado, nao defeito.

O uso correto e comparativo: rodar N repeticoes, medir quantas aprovacoes
o acaso produz por rodada, e so entao olhar o resultado real. Um resultado
real dentro da linha de base nao e descoberta nenhuma. Muito acima dela,
sim. Aprovacao macica no aleatorio (ordens de grandeza acima do FDR
nominal) e que indicaria vazamento de futuro no codigo.

Uso:
    python placebo.py EURUSD H1 [repeticoes]
"""
import sys

import numpy as np
import pandas as pd

from src.backtest import descoberta
from src.dados import mt5_fonte as fonte


def embaralhar(df: pd.DataFrame, semente: int) -> pd.DataFrame:
    """Permuta a ordem das barras preservando a forma de cada vela."""
    rng = np.random.default_rng(semente)
    n = len(df)
    c = df["close"].to_numpy(np.float64)

    retorno = np.diff(np.log(c), prepend=np.log(c[0]))
    # razoes de cada vela em relacao ao proprio fechamento: a "forma" da vela
    razao_o = df["open"].to_numpy() / c
    razao_h = df["high"].to_numpy() / c
    razao_l = df["low"].to_numpy() / c

    ordem = rng.permutation(n)
    novo_close = c[0] * np.exp(np.cumsum(retorno[ordem]))

    saida = df.copy()
    saida["close"] = novo_close
    saida["open"] = novo_close * razao_o[ordem]
    saida["high"] = novo_close * np.maximum.reduce([razao_h[ordem], razao_o[ordem],
                                                    np.ones(n)])
    saida["low"] = novo_close * np.minimum.reduce([razao_l[ordem], razao_o[ordem],
                                                   np.ones(n)])
    return saida  # hora_utc e spread ficam na ordem original: o eixo de tempo e real


def main() -> int:
    par = (sys.argv[1] if len(sys.argv) > 1 else "EURUSD").upper()
    tf = (sys.argv[2] if len(sys.argv) > 2 else "H1").upper()
    repeticoes = int(sys.argv[3]) if len(sys.argv) > 3 else 5

    real = fonte.carregar(par, tf)
    print(f"placebo em {par} {tf} | {len(real):,} barras | {repeticoes} repeticoes\n")

    original = fonte.carregar
    totais = []
    for r in range(repeticoes):
        sintetico = embaralhar(real, semente=1000 + r)
        sintetico.attrs.update(real.attrs)
        fonte.carregar = lambda *_a, **_k: sintetico  # injeta a serie falsa
        try:
            t = descoberta.avaliar(par, tf)
            t = descoberta.validar(descoberta.selecionar(t))
            cb, ct = int(t["candidata_binaria"].sum()), int(t["candidata_tradicional"].sum())
            ab, at = int(t["aprovada_binaria"].sum()), int(t["aprovada_tradicional"].sum())
            totais.append((len(t), cb, ct, ab, at))
            print(f"  rodada {r+1}: {len(t):>4} hipoteses | candidatas {cb:>3}/{ct:>3} | "
                  f"APROVADAS {ab:>3}/{at:>3}")
        finally:
            fonte.carregar = original

    nl = chr(10)
    a = np.array(totais)
    print(f"\n  media por rodada: {a[:,0].mean():.0f} hipoteses | "
          f"candidatas {a[:,1].mean():.1f}/{a[:,2].mean():.1f} | "
          f"aprovadas {a[:,3].mean():.1f}/{a[:,4].mean():.1f}")
    base_b, base_t = a[:, 3].mean(), a[:, 4].mean()
    hip = a[:, 0].mean()
    cand = a[:, 1].mean() + a[:, 2].mean()
    # Sob FDR 10% espera-se aprovacao ocasional mesmo no aleatorio: isso e o
    # metodo funcionando, nao defeito. So aprovacao muito acima do nominal
    # (usamos 3x de folga) indicaria vazamento de futuro no codigo.
    teto = 0.10 * max(cand, 1) * 3
    print(nl + "  LINHA DE BASE DO ACASO (referencia, nao gabarito):")
    print(f"    aprovacoes por rodada: binaria {base_b:.2f} | tradicional {base_t:.2f}")
    print(f"    candidatas por rodada: {cand:.2f} | hipoteses: {hip:.0f}" + nl)
    if base_b + base_t > teto:
        print(f"  ALERTA: {base_b+base_t:.2f} aprovacoes/rodada e alto demais "
              f"para FDR 10%. Suspeitar de vazamento de futuro no codigo.")
    else:
        print(f"  OK: {base_b+base_t:.2f} aprovacoes/rodada e compativel com FDR 10%.")
        print(f"  Leitura pratica: resultado real com ate ~{base_b+base_t:.1f} "
              f"aprovacoes nao se distingue do acaso.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
