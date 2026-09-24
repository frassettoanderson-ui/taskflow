"""CLI de download do historico.

Uso:
    python baixar.py                 # todos os pares, M5/M15/H1, 12 anos
    python baixar.py EURUSD M5 10    # par, timeframe, anos
"""
import sys

import config
from src.dados import mt5_fonte as fonte


def main() -> int:
    try:
        fonte.conectar()
    except fonte.ErroMT5 as e:
        print(f"[x] {e}")
        return 1

    info = fonte.info_conta()
    print(f"[ok] {info['corretora']} | conta {info['login']} ({info['tipo']}) "
          f"| servidor {info['servidor']} | build {info['build']}")
    print(f"[ok] fuso do servidor: UTC{fonte.offset_servidor_horas():+d}\n")

    if len(sys.argv) >= 3:
        tarefas = [(sys.argv[1].upper(), sys.argv[2].upper())]
        anos = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    else:
        tarefas = [(p, tf) for p in config.PARES for tf in config.TF_PADRAO]
        anos = config.ANOS_PADRAO

    for par, tf in tarefas:
        try:
            df = fonte.baixar(par, tf, anos=anos)
            destino = fonte.salvar(df)
            spread_medio = df["spread"].mean()
            print(f"  {par:8s} {tf:4s} {len(df):>8,} barras | "
                  f"{df['hora_utc'].min():%Y-%m-%d} -> {df['hora_utc'].max():%Y-%m-%d} | "
                  f"spread medio {spread_medio:.1f} pts | {destino.name}")
        except Exception as e:
            print(f"  {par:8s} {tf:4s} FALHOU: {e}")

    fonte.desconectar()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
