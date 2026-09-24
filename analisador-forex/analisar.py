"""Roda o backtest e imprime a tabela ranqueada.

Uso:
    python analisar.py                # todos os arquivos baixados
    python analisar.py EURUSD M5      # um par/timeframe
    python analisar.py --payout 0.80  # ajusta o breakeven da binaria
"""
import argparse
import sys
import time
from pathlib import Path

import pandas as pd

import config
from src.backtest import relatorio


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("par", nargs="?")
    ap.add_argument("timeframe", nargs="?")
    ap.add_argument("--payout", type=float, default=relatorio.PAYOUT_PADRAO)
    ap.add_argument("--velas", type=int, default=relatorio.VELAS_BINARIA)
    ap.add_argument("--fdr", type=float, default=0.10)
    ap.add_argument("--saida", default="relatorio.csv")
    a = ap.parse_args()

    if a.par and a.timeframe:
        alvos = [(a.par.upper(), a.timeframe.upper())]
    else:
        alvos = sorted((f.stem.split("_")[0], f.stem.split("_")[1])
                       for f in config.DIR_DADOS.glob("*.parquet"))
    if not alvos:
        print("Nenhum dado em dados/. Rode baixar.py primeiro.")
        return 1

    print(f"payout {a.payout:.0%} -> breakeven "
          f"{relatorio.est.breakeven_binaria(a.payout):.2%} | "
          f"expiracao {a.velas} velas | FDR {a.fdr:.0%}\n")

    tabelas, t0 = [], time.time()
    for par, tf in alvos:
        try:
            t = relatorio.analisar(par, tf, payout=a.payout, velas=a.velas)
            tabelas.append(t)
            print(f"  {par} {tf}: {len(t)} combinacoes com amostra suficiente")
        except Exception as e:
            print(f"  {par} {tf}: FALHOU {e}")

    df = relatorio.consolidar(tabelas, fdr=a.fdr)
    if df.empty:
        print("\nNada com amostra suficiente.")
        return 0

    df.to_csv(a.saida, index=False)
    print(f"\n{len(df):,} combinacoes testadas | salvo em {a.saida}")
    print(f"tempo: {time.time()-t0:.1f}s\n")

    bb, bt = df["borda_binaria"].sum(), df["borda_tradicional"].sum()
    print("Funil de filtragem (binaria | tradicional):")
    etapas = [
        ("p < 0.05 sem correcao", int((df["p_binaria"] < 0.05).sum()),
         int((df["p_tradicional"] < 0.05).sum())),
        (f"+ correcao FDR {a.fdr:.0%}", int(df["aprovado_binaria"].sum()),
         int(df["aprovado_tradicional"].sum())),
        ("+ IC inferior favoravel",
         int((df["aprovado_binaria"] & (df["ic_inf"] > df["breakeven"])).sum()),
         int((df["aprovado_tradicional"] & (df["r_ic_inf"] > 0)).sum())),
        ("+ cada metade se sustenta sozinha", int(bb), int(bt)),
    ]
    for rotulo, x, y in etapas:
        print(f"  {rotulo:36s} {x:>5} | {y:>5}")
    print(f"  {'de um total de':36s} {len(df):>5} combinacoes" + chr(10))

    pd.set_option("display.width", 200, "display.max_columns", 30)
    for rotulo, mask, cols, ordem in (
        ("BINARIA", df["borda_binaria"],
         ["par", "timeframe", "padrao", "direcao", "sessao", "contexto",
          "ocorrencias", "taxa_acerto", "ic_inf", "taxa_treino", "taxa_teste",
          "p_binaria"], "taxa_acerto"),
        ("TRADICIONAL", df["borda_tradicional"],
         ["par", "timeframe", "padrao", "direcao", "sessao", "contexto",
          "ocorrencias", "expectativa_r", "r_ic_inf", "r_treino", "r_teste",
          "p_tradicional"], "expectativa_r"),
    ):
        sub = df[mask].sort_values(ordem, ascending=False)
        print(f"--- {rotulo}: top 15 ---")
        print(sub[cols].head(15).to_string(index=False) if len(sub)
              else "  nenhuma combinacao com borda estatistica.")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
