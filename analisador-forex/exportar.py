"""Exporta os dados que o terminal web consome.

Gera um JSON por par/timeframe com as ultimas `BARRAS` velas, as ocorrencias
de cada padrao dentro dessa janela e os niveis ativos ao final dela, mais um
arquivo de estatisticas com o veredito de cada padrao.

As ocorrencias sao gravadas como indice da vela, nao como timestamp: o
navegador resolve a data. Em 4.000 velas isso corta o arquivo pela metade.

Uso:
    python exportar.py              # tudo que estiver baixado
    python exportar.py EURUSD H1
"""
import json
import sys
from pathlib import Path

import numpy as np

import config
from src.backtest import estatistica as est
from src.backtest.motor import avaliar_binaria, avaliar_tradicional
from src.backtest.relatorio import MULT_ALVO, MULT_STOP, PAYOUT_PADRAO, VELAS_BINARIA
from src.dados import mt5_fonte as fonte
from src.padroes import REGISTRO, detectar_todos, preparar
from src.padroes import niveis as nv

BARRAS = 4000        # janela exportada; segura o JSON em ~250 KB
MAX_NIVEIS = 24      # niveis desenhados, os mais proximos do preco atual
DESTINO = Path(__file__).resolve().parent / "web" / "dados"


def niveis_ativos(d, fim: int) -> list[tuple[float, int]]:
    """Niveis validos na barra `fim`, ordenados pela distancia ao preco."""
    pivo_i, pivo_p = nv._pivos(d, nv.JANELA_PIVO)
    elegiveis = (pivo_i < fim) & (pivo_i >= fim - nv.JANELA_MEMORIA)
    if not elegiveis.any():
        return []

    atr_ref = float(np.nanmedian(d["_atr"]))
    precos, toques = nv._agrupar(pivo_p[elegiveis], nv.TOLERANCIA_ATR * atr_ref)
    forte = toques >= nv.MIN_TOQUES
    precos, toques = precos[forte], toques[forte]

    atual = float(d["close"].iloc[fim - 1])
    ordem = np.argsort(np.abs(precos - atual))[:MAX_NIVEIS]
    return [(round(float(precos[i]), 6), int(toques[i])) for i in ordem]


def veredito(taxa: float, breakeven: float, exp_r: float) -> str:
    """Traduz os numeros em uma frase curta, sem enfeitar o resultado."""
    if np.isnan(taxa):
        return "amostra insuficiente"
    if taxa > breakeven and exp_r > 0:
        return "acima do custo nos dois modos"
    if exp_r > 0:
        return "positivo no modo tradicional"
    if taxa > breakeven:
        return "acima do breakeven da binaria"
    return "abaixo do custo"


def exportar(par: str, tf: str) -> dict:
    d = preparar(fonte.carregar(par, tf), config.SESSOES)
    sinais = detectar_todos(d)
    breakeven = est.breakeven_binaria(PAYOUT_PADRAO)

    # Estatisticas sobre o historico INTEIRO, nao so sobre a janela desenhada:
    # o painel precisa dizer quanto o padrao vale de verdade.
    estatisticas = {}
    for nome in REGISTRO:
        b = avaliar_binaria(d, sinais[nome], VELAS_BINARIA)
        t = avaliar_tradicional(d, sinais[nome], MULT_STOP, MULT_ALVO)
        validos = b[~b["empate"]] if not b.empty else b
        n = len(validos)
        taxa = float(validos["vitoria"].mean()) if n else float("nan")
        exp_r = float(t["resultado_r"].mean()) if not t.empty else float("nan")
        ic = est.wilson(int(validos["vitoria"].sum()), n) if n else (float("nan"),) * 2
        estatisticas[nome] = {
            "ocorrencias": int(n),
            "taxa": None if np.isnan(taxa) else round(taxa, 4),
            "ic_inf": None if np.isnan(ic[0]) else round(ic[0], 4),
            "expectativa_r": None if np.isnan(exp_r) else round(exp_r, 4),
            "veredito": veredito(taxa, breakeven, exp_r),
            "tipo": REGISTRO[nome]["tipo"],
            "descricao": REGISTRO[nome]["desc"],
        }

    inicio = max(0, len(d) - BARRAS)
    janela = d.iloc[inicio:]
    digitos = int(d.attrs.get("digitos", 5))

    velas = [
        [int(ts.timestamp()), round(o, digitos), round(h, digitos),
         round(l, digitos), round(c, digitos)]
        for ts, o, h, l, c in zip(janela["hora_utc"], janela["open"], janela["high"],
                                  janela["low"], janela["close"])
    ]

    ocorrencias = {}
    for nome in REGISTRO:
        s = sinais[nome].to_numpy()[inicio:]
        pos = np.flatnonzero(s != 0)
        ocorrencias[nome] = [[int(i), int(s[i])] for i in pos]

    ponto = float(d.attrs.get("ponto", 1e-5))
    return {
        "par": par,
        "timeframe": tf,
        "digitos": digitos,
        "velas": velas,
        "padroes": ocorrencias,
        "niveis": niveis_ativos(d, len(d)),
        "estatisticas": estatisticas,
        "breakeven": round(breakeven, 4),
        "meta": {
            "barras_total": int(len(d)),
            "barras_janela": len(velas),
            "inicio_historico": d["hora_utc"].min().strftime("%d/%m/%Y"),
            "fim_historico": d["hora_utc"].max().strftime("%d/%m/%Y %H:%M"),
            "spread_mediano": float(d["spread"].median()),
            "atr_pontos": round(float(np.nanmedian(d["_atr"])) / ponto, 1),
            "custo_em_r": round(float(d["spread"].median())
                                / (float(np.nanmedian(d["_atr"])) / ponto), 4),
        },
    }


def main() -> int:
    if len(sys.argv) >= 3:
        alvos = [(sys.argv[1].upper(), sys.argv[2].upper())]
    else:
        alvos = sorted((f.stem.split("_")[0], f.stem.split("_")[1])
                       for f in config.DIR_DADOS.glob("*.parquet"))
    if not alvos:
        print("Nenhum dado em dados/. Rode baixar.py primeiro.")
        return 1

    DESTINO.mkdir(parents=True, exist_ok=True)
    indice: dict[str, list[str]] = {}
    for par, tf in alvos:
        try:
            dados = exportar(par, tf)
        except Exception as e:
            print(f"  {par} {tf}: FALHOU {e}")
            continue
        caminho = DESTINO / f"{par}_{tf}.json"
        caminho.write_text(json.dumps(dados, separators=(",", ":")), encoding="utf-8")
        indice.setdefault(par, []).append(tf)
        print(f"  {par:8s} {tf:4s} {len(dados['velas']):>5,} velas | "
              f"{len(dados['niveis']):>2} niveis | {caminho.stat().st_size/1024:>6.0f} KB")

    ordem = {t: i for i, t in enumerate(config.TIMEFRAMES)}
    for par in indice:
        indice[par].sort(key=lambda t: ordem.get(t, 99))
    (DESTINO / "indice.json").write_text(json.dumps(indice), encoding="utf-8")
    print(f"\n{sum(len(v) for v in indice.values())} arquivos em {DESTINO}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
