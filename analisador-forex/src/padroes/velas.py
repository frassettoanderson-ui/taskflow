"""Detectores de padroes de candlestick.

Cada detector devolve uma Serie int8 com:
    +1 sinal de alta   |   -1 sinal de baixa   |   0 nada

Decisao de projeto: **os detectores nao filtram por tendencia**. Eles apenas
identificam a forma. O contexto (tendencia, sessao, horario) entra como
dimensao no relatorio — o mesmo padrao a favor e contra a tendencia costuma
ter estatisticas opostas, e isso so aparece medindo as duas situacoes
separadamente. Filtrar dentro do detector esconderia esse efeito.

Os limiares sao relativos ao ATR, entao os mesmos criterios valem para
EURUSD e USDJPY sem ajuste manual.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# Vela relevante: precisa ter tamanho ante a volatilidade corrente.
# Abaixo disso e ruido de microestrutura, nao padrao.
MIN_AMPLITUDE_ATR = 0.5


def _serie(cond_alta, cond_baixa, indice) -> pd.Series:
    return pd.Series(np.where(cond_alta, 1, np.where(cond_baixa, -1, 0)),
                     index=indice, dtype="int8")


def _relevante(d: pd.DataFrame) -> pd.Series:
    return d["_amplitude"] >= MIN_AMPLITUDE_ATR * d["_atr"]


def engolfo(d: pd.DataFrame) -> pd.Series:
    """Corpo da vela atual cobre o corpo da anterior, com cor oposta."""
    ab, af = d["open"].shift(1), d["close"].shift(1)
    # Por definicao o corpo que engole e maior que o engolido; sem exigir isso
    # qualquer par de velas opostas vira "engolfo" e o padrao perde sentido.
    forca = (d["_corpo"] > d["_corpo"].shift(1)) & (d["_corpo"] >= 0.6 * d["_atr"])
    alta = (d["_baixa"].shift(1, fill_value=False) & d["_alta"]
            & (d["close"] >= ab) & (d["open"] <= af) & forca & _relevante(d))
    baixa = (d["_alta"].shift(1, fill_value=False) & d["_baixa"]
             & (d["close"] <= ab) & (d["open"] >= af) & forca & _relevante(d))
    return _serie(alta, baixa, d.index)


def pin_bar(d: pd.DataFrame) -> pd.Series:
    """Sombra longa de um lado e sombra curta do outro: rejeicao de preco."""
    corpo_ok = d["_corpo"] > 0
    alta = (corpo_ok & (d["_somb_inf"] >= 2 * d["_corpo"])
            & (d["_somb_sup"] <= 0.5 * d["_corpo"]) & _relevante(d))
    baixa = (corpo_ok & (d["_somb_sup"] >= 2 * d["_corpo"])
             & (d["_somb_inf"] <= 0.5 * d["_corpo"]) & _relevante(d))
    return _serie(alta, baixa, d.index)


def marubozu(d: pd.DataFrame) -> pd.Series:
    """Corpo ocupa quase toda a barra: pressao continua do inicio ao fim."""
    cheio = (d["_corpo"] >= 0.9 * d["_amplitude"]) & _relevante(d)
    return _serie(cheio & d["_alta"], cheio & d["_baixa"], d.index)


def harami(d: pd.DataFrame) -> pd.Series:
    """Corpo pequeno contido no corpo grande anterior: perda de forca."""
    topo_ant = d[["open", "close"]].shift(1).max(axis=1)
    base_ant = d[["open", "close"]].shift(1).min(axis=1)
    dentro = ((d[["open", "close"]].max(axis=1) <= topo_ant)
              & (d[["open", "close"]].min(axis=1) >= base_ant)
              & (d["_corpo"].shift(1) >= 0.7 * d["_atr"])
              & (d["_corpo"] <= 0.5 * d["_corpo"].shift(1)))
    return _serie(dentro & d["_baixa"].shift(1, fill_value=False) & d["_alta"],
                  dentro & d["_alta"].shift(1, fill_value=False) & d["_baixa"], d.index)


def piercing_nuvem(d: pd.DataFrame) -> pd.Series:
    """Piercing line (+1) e dark cloud cover (-1): invasao do corpo anterior."""
    ab, af = d["open"].shift(1), d["close"].shift(1)
    meio = (ab + af) / 2
    grande_ant = d["_corpo"].shift(1) >= 0.7 * d["_atr"]
    alta = (d["_baixa"].shift(1, fill_value=False) & d["_alta"] & grande_ant
            & (d["open"] < af) & (d["close"] > meio) & (d["close"] < ab))
    baixa = (d["_alta"].shift(1, fill_value=False) & d["_baixa"] & grande_ant
             & (d["open"] > af) & (d["close"] < meio) & (d["close"] > ab))
    return _serie(alta, baixa, d.index)


def estrela(d: pd.DataFrame) -> pd.Series:
    """Morning star (+1) / evening star (-1): reversao em tres velas."""
    c1_corpo, c2_corpo = d["_corpo"].shift(2), d["_corpo"].shift(1)
    c1_open, c1_close = d["open"].shift(2), d["close"].shift(2)
    meio1 = (c1_open + c1_close) / 2
    indeciso = c2_corpo <= 0.35 * c1_corpo
    grande1 = c1_corpo >= 0.7 * d["_atr"]
    alta = (d["_baixa"].shift(2, fill_value=False) & indeciso & grande1
            & d["_alta"] & (d["close"] > meio1))
    baixa = (d["_alta"].shift(2, fill_value=False) & indeciso & grande1
             & d["_baixa"] & (d["close"] < meio1))
    return _serie(alta, baixa, d.index)


def tres_velas(d: pd.DataFrame) -> pd.Series:
    """Tres soldados brancos (+1) / tres corvos negros (-1): continuidade."""
    corpo_ok = ((d["_corpo"] >= 0.5 * d["_atr"])
                & (d["_corpo"].shift(1) >= 0.5 * d["_atr"])
                & (d["_corpo"].shift(2) >= 0.5 * d["_atr"]))
    alta = (d["_alta"] & d["_alta"].shift(1, fill_value=False) & d["_alta"].shift(2, fill_value=False)
            & (d["close"] > d["close"].shift(1)) & (d["close"].shift(1) > d["close"].shift(2))
            & corpo_ok)
    baixa = (d["_baixa"] & d["_baixa"].shift(1, fill_value=False) & d["_baixa"].shift(2, fill_value=False)
             & (d["close"] < d["close"].shift(1)) & (d["close"].shift(1) < d["close"].shift(2))
             & corpo_ok)
    return _serie(alta, baixa, d.index)


def pinca(d: pd.DataFrame) -> pd.Series:
    """Tweezers: duas velas rejeitando o mesmo nivel, com cores opostas."""
    # Tweezers exige rejeicao do MESMO nivel: tolerancia frouxa transforma
    # qualquer par de velas vizinhas em pinca.
    tol = 0.03 * d["_atr"]
    fundo = ((d["low"] - d["low"].shift(1)).abs() <= tol) & d["_baixa"].shift(1, fill_value=False) & d["_alta"]
    topo = ((d["high"] - d["high"].shift(1)).abs() <= tol) & d["_alta"].shift(1, fill_value=False) & d["_baixa"]
    ambas_relevantes = _relevante(d) & _relevante(d).shift(1, fill_value=False)
    return _serie(fundo & ambas_relevantes, topo & ambas_relevantes, d.index)


# --- neutros: a direcao nao esta no padrao, o backtest testa os dois lados ---

def doji(d: pd.DataFrame) -> pd.Series:
    """Indecisao. Marcado com 1 onde ocorre; direcao fica a cargo do backtest."""
    presente = ((d["_corpo"] <= 0.05 * d["_amplitude"])
                & (d["_amplitude"] >= 0.3 * d["_atr"]))
    return presente.astype("int8")


def inside_bar(d: pd.DataFrame) -> pd.Series:
    """Barra contida na anterior: compressao antes de expansao."""
    presente = ((d["high"] < d["high"].shift(1)) & (d["low"] > d["low"].shift(1))
                & (d["_amplitude"].shift(1) >= 0.7 * d["_atr"]))
    return presente.fillna(False).astype("int8")
