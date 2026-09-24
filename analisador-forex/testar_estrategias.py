"""Submete estrategias de livro ao mesmo crivo usado nos padroes.

Cada estrategia e testada com tres relacoes de risco/retorno (1:1, 1:2, 1:3),
porque a mesma entrada pode prestar com um alvo e nao prestar com outro — e
porque taxa de acerto sozinha nao diz nada: 40% de acerto a 1:3 ganha mais
que 60% a 1:1.

Metodo (igual ao resto do projeto):
  - entra na ABERTURA da barra seguinte ao sinal, nunca no fechamento dele
  - desconta o spread real do MT5, barra a barra
  - descobre nos primeiros 60% do historico, valida nos 40% finais
  - corrige multiplos testes no periodo de validacao

Uso:
    python testar_estrategias.py XAUUSD M5
    python testar_estrategias.py XAUUSD          # todos os timeframes do ativo
"""
import argparse
import sys
import time

import numpy as np
import pandas as pd

import config
from src import estrategias as ez
from src.backtest import estatistica as est
from src.backtest.motor import avaliar_binaria, avaliar_tradicional
from src.dados import mt5_fonte as fonte
from src.padroes import preparar

RR = [(1.0, 1.0), (1.0, 2.0), (1.0, 3.0)]
VELAS_BINARIA = 3
CORTE = 0.60
MIN_TREINO, MIN_TESTE = 100, 60


def avaliar(par: str, tf: str, payout: float) -> pd.DataFrame:
    d = preparar(fonte.carregar(par, tf), config.SESSOES)
    sinais = ez.detectar_todas(d)

    limite = config.LIMITE_SPREAD_MEDIANAS * d["spread"].median()
    valida = (d["spread"] <= limite).shift(-1, fill_value=False)
    sinais = sinais.mul(valida.astype("int8"), axis=0).astype("int8")

    breakeven = est.breakeven_binaria(payout)
    corte_i = int(len(d) * CORTE)
    linhas = []

    for nome in ez.REGISTRO:
        s = sinais[nome]
        total = int((s != 0).sum())
        if total < MIN_TREINO + MIN_TESTE:
            continue
        b = avaliar_binaria(d, s, VELAS_BINARIA)

        for stop, alvo in RR:
            t = avaliar_tradicional(d, s, stop, alvo)
            if t.empty or b.empty:
                continue
            j = b.merge(t[["i", "resultado_r"]], on="i", how="inner")
            treino, teste = j[j["i"] < corte_i], j[j["i"] >= corte_i]
            if len(treino) < MIN_TREINO or len(teste) < MIN_TESTE:
                continue

            def bloco(g):
                v = g[~g["empate"]]
                n = len(v)
                vit = int(v["vitoria"].sum())
                r = g["resultado_r"].to_numpy()
                return {
                    "n": n,
                    "taxa": vit / n if n else np.nan,
                    "exp_r": float(np.nanmean(r)) if len(r) else np.nan,
                    "p_r": est.p_valor_expectativa(r),
                    "p_bin": est.p_valor_acerto(vit, n, breakeven) if n else 1.0,
                }

            tudo, tre, tes = bloco(j), bloco(treino), bloco(teste)
            linhas.append({
                "par": par, "tf": tf, "estrategia": nome, "rr": f"1:{alvo:.0f}",
                "sinais": tudo["n"],
                "taxa": tudo["taxa"], "exp_r": tudo["exp_r"],
                "taxa_treino": tre["taxa"], "exp_treino": tre["exp_r"],
                "taxa_teste": tes["taxa"], "exp_teste": tes["exp_r"],
                "p_treino": tre["p_r"], "p_teste": tes["p_r"],
                "p_bin_treino": tre["p_bin"], "p_bin_teste": tes["p_bin"],
                "breakeven": breakeven,
                "fonte": ez.REGISTRO[nome]["fonte"],
            })

    return pd.DataFrame(linhas)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("par")
    ap.add_argument("timeframe", nargs="?")
    ap.add_argument("--payout", type=float, default=0.87)
    ap.add_argument("--fdr", type=float, default=0.10)
    ap.add_argument("--saida", default="estrategias.csv")
    a = ap.parse_args()

    par = a.par.upper()
    if a.timeframe:
        tfs = [a.timeframe.upper()]
    else:
        tfs = [f.stem.split("_")[1] for f in config.DIR_DADOS.glob(f"{par}_*.parquet")]
        ordem = {t: i for i, t in enumerate(config.TIMEFRAMES)}
        tfs.sort(key=lambda t: ordem.get(t, 99))
    if not tfs:
        print(f"Nenhum dado de {par}. Rode baixar.py primeiro.")
        return 1

    print(f"{par} | {len(ez.REGISTRO)} estrategias x {len(RR)} relacoes risco/retorno")
    print(f"treino: primeiros {CORTE:.0%} | validacao: {1-CORTE:.0%} finais (nunca tocados)")
    print(f"payout binaria {a.payout:.0%} -> breakeven "
          f"{est.breakeven_binaria(a.payout):.2%}\n")

    t0 = time.time()
    tabelas = []
    for tf in tfs:
        try:
            t = avaliar(par, tf, a.payout)
            tabelas.append(t)
            print(f"  {tf:4s} {len(t):>3} combinacoes com amostra suficiente")
        except Exception as e:
            print(f"  {tf:4s} FALHOU: {e}")

    tabelas = [t for t in tabelas if not t.empty]
    if not tabelas:
        print("\nNada com amostra suficiente.")
        return 0

    df = pd.concat(tabelas, ignore_index=True)

    # Etapa 1: candidatas pelo treino. Etapa 2: correcao so entre elas.
    df["candidata"] = (df["p_treino"] < 0.05) & (df["exp_treino"] > 0)
    df["aprovada"] = False
    if df["candidata"].any():
        m = df["candidata"].to_numpy()
        ok = est.benjamini_hochberg(df.loc[m, "p_teste"].to_numpy(), a.fdr)
        df.loc[df.index[m][ok], "aprovada"] = True
        df["aprovada"] &= df["exp_teste"] > 0

    df.sort_values("exp_teste", ascending=False).to_csv(a.saida, index=False)
    print(f"\n{len(df)} combinacoes | salvo em {a.saida} | {time.time()-t0:.0f}s\n")

    pd.set_option("display.width", 240, "display.max_columns", 40)
    cols = ["tf", "estrategia", "rr", "sinais", "taxa", "exp_r",
            "exp_treino", "exp_teste", "p_teste"]
    print("--- TODAS AS COMBINACOES (ordenadas pelo periodo de validacao) ---")
    tab = df.sort_values("exp_teste", ascending=False)[cols].copy()
    tab["taxa"] = (tab["taxa"] * 100).round(1).astype(str) + "%"
    for c in ("exp_r", "exp_treino", "exp_teste"):
        tab[c] = tab[c].round(3)
    tab["p_teste"] = tab["p_teste"].round(4)
    print(tab.to_string(index=False))

    print(f"\n--- FUNIL ---")
    print(f"  combinacoes testadas                 {len(df):>4}")
    print(f"  positivas no treino (p<0.05)         {int(df['candidata'].sum()):>4}")
    print(f"  aprovadas fora da amostra            {int(df['aprovada'].sum()):>4}")

    if df["aprovada"].any():
        print("\n--- APROVADAS ---")
        print(df[df["aprovada"]][cols + ["fonte"]].to_string(index=False))
    else:
        print("\n  Nenhuma estrategia manteve vantagem no periodo de validacao.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
