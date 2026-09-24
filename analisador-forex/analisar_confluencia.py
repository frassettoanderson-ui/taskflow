"""Descoberta em duas etapas sobre padroes combinados com niveis.

Uso:
    python analisar_confluencia.py                 # tudo que estiver baixado
    python analisar_confluencia.py EURUSD H1
    python analisar_confluencia.py --tf M15 H1     # so esses timeframes
"""
import argparse
import time

import pandas as pd

import config
from src.backtest import descoberta, estatistica as est


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("par", nargs="?")
    ap.add_argument("timeframe", nargs="?")
    ap.add_argument("--tf", nargs="*", help="filtra timeframes quando roda tudo")
    ap.add_argument("--payout", type=float, default=descoberta.PAYOUT_PADRAO)
    ap.add_argument("--velas", type=int, default=descoberta.VELAS_BINARIA)
    ap.add_argument("--alfa-treino", type=float, default=0.01)
    ap.add_argument("--fdr", type=float, default=0.10)
    ap.add_argument("--saida", default="confluencia.csv")
    a = ap.parse_args()

    if a.par and a.timeframe:
        alvos = [(a.par.upper(), a.timeframe.upper())]
    else:
        alvos = sorted((f.stem.split("_")[0], f.stem.split("_")[1])
                       for f in config.DIR_DADOS.glob("*.parquet"))
        if a.tf:
            permitidos = {t.upper() for t in a.tf}
            alvos = [x for x in alvos if x[1] in permitidos]
    if not alvos:
        print("Nenhum dado. Rode baixar.py primeiro.")
        return 1

    print(f"payout {a.payout:.0%} -> breakeven {est.breakeven_binaria(a.payout):.2%} | "
          f"expiracao {a.velas} velas")
    print(f"treino: primeiros {descoberta.CORTE:.0%} | teste: {1-descoberta.CORTE:.0%} finais")
    print(f"etapa 1 alfa {a.alfa_treino} (sem correcao) | etapa 2 FDR {a.fdr:.0%}\n")

    tabelas, t0 = [], time.time()
    for par, tf in alvos:
        try:
            t = descoberta.avaliar(par, tf, payout=a.payout, velas=a.velas)
            tabelas.append(t)
            print(f"  {par} {tf}: {len(t)} hipoteses com amostra nos dois periodos")
        except Exception as e:
            print(f"  {par} {tf}: FALHOU {e}")

    tabelas = [t for t in tabelas if not t.empty]
    if not tabelas:
        print("\nNada com amostra suficiente.")
        return 0

    df = descoberta.validar(descoberta.selecionar(pd.concat(tabelas, ignore_index=True),
                                                  a.alfa_treino), a.fdr)
    df.to_csv(a.saida, index=False)

    cb, ct = int(df["candidata_binaria"].sum()), int(df["candidata_tradicional"].sum())
    ab, at = int(df["aprovada_binaria"].sum()), int(df["aprovada_tradicional"].sum())
    print(f"\n{len(df):,} hipoteses | salvo em {a.saida} | {time.time()-t0:.0f}s\n")
    print("                                          binaria | tradicional")
    print(f"  {'hipoteses testadas':38s} {len(df):>7} | {len(df):>11}")
    print(f"  {'etapa 1: candidatas no treino':38s} {cb:>7} | {ct:>11}")
    print(f"  {'etapa 2: aprovadas no teste (fora da amostra)':38s}"[:40] +
          f" {ab:>7} | {at:>11}\n")

    pd.set_option("display.width", 220, "display.max_columns", 40)
    for rotulo, mask, cols in (
        ("BINARIA", df["aprovada_binaria"],
         ["par", "timeframe", "variante", "contexto", "n_treino", "taxa_treino",
          "n_teste", "taxa_teste", "p_bin_teste"]),
        ("TRADICIONAL", df["aprovada_tradicional"],
         ["par", "timeframe", "variante", "contexto", "n_treino", "exp_r_treino",
          "n_teste", "exp_r_teste", "p_r_teste"]),
    ):
        sub = df[mask]
        print(f"--- {rotulo}: aprovadas fora da amostra ---")
        if len(sub):
            ordem = "taxa_teste" if rotulo == "BINARIA" else "exp_r_teste"
            print(sub.sort_values(ordem, ascending=False)[cols].head(20).to_string(index=False))
        else:
            print("  nenhuma.")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
