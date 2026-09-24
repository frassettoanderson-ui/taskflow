"""Registro dos detectores de padrao.

`tipo` diz como o backtest deve tratar o sinal:
    direcional -> o proprio padrao aponta o lado (+1 / -1)
    neutro     -> o padrao so marca ocorrencia; o backtest mede os dois lados
"""
from __future__ import annotations

import pandas as pd

from . import estrutura, velas
from .indicadores import preparar  # noqa: F401  (reexport)

REGISTRO: dict[str, dict] = {
    "engolfo":         {"fn": velas.engolfo,         "tipo": "direcional", "desc": "corpo engolindo o corpo anterior"},
    "pin_bar":         {"fn": velas.pin_bar,         "tipo": "direcional", "desc": "sombra longa de rejeicao"},
    "marubozu":        {"fn": velas.marubozu,        "tipo": "direcional", "desc": "corpo cheio, sem sombras"},
    "harami":          {"fn": velas.harami,          "tipo": "direcional", "desc": "corpo pequeno dentro do anterior"},
    "piercing_nuvem":  {"fn": velas.piercing_nuvem,  "tipo": "direcional", "desc": "invasao do corpo anterior"},
    "estrela":         {"fn": velas.estrela,         "tipo": "direcional", "desc": "morning/evening star"},
    "tres_velas":      {"fn": velas.tres_velas,      "tipo": "direcional", "desc": "tres soldados / tres corvos"},
    "pinca":           {"fn": velas.pinca,           "tipo": "direcional", "desc": "tweezers no mesmo nivel"},
    "doji":            {"fn": velas.doji,            "tipo": "neutro",     "desc": "indecisao"},
    "inside_bar":      {"fn": velas.inside_bar,      "tipo": "neutro",     "desc": "barra contida na anterior"},
    "rompimento":      {"fn": estrutura.rompimento,      "tipo": "direcional", "desc": "rompe maxima/minima de 20 barras"},
    "cruzamento_emas": {"fn": estrutura.cruzamento_emas, "tipo": "direcional", "desc": "EMA 9 cruza EMA 21"},
    "rsi_extremo":     {"fn": estrutura.rsi_extremo,     "tipo": "direcional", "desc": "RSI saindo de 30/70"},
    "divergencia_rsi": {"fn": estrutura.divergencia_rsi, "tipo": "direcional", "desc": "preco x RSI discordam"},
}


def detectar_todos(d: pd.DataFrame) -> pd.DataFrame:
    """Roda todos os detectores sobre um DataFrame ja preparado."""
    return pd.DataFrame({nome: meta["fn"](d) for nome, meta in REGISTRO.items()},
                        index=d.index)
