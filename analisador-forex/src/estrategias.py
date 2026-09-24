"""Estrategias classicas de day trade, implementadas como estao nos livros.

Nenhuma foi inventada aqui. Cada uma vem de fonte publicada e conhecida, e
os parametros sao os que o autor original usa — nao os que fariam o teste
parecer bom. Ajustar parametro ate o resultado agradar e o jeito mais comum
de se enganar num backtest.

Convencao igual a dos padroes: +1 compra, -1 venda, 0 nada.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .padroes.indicadores import rsi


# --------------------------------------------------------------------------
# 1. Rompimento da abertura (Opening Range Breakout)
#    Toby Crabel, "Day Trading with Short Term Price Patterns"; Mark Fisher,
#    "The Logical Trader". Define o range dos primeiros minutos apos a
#    abertura e opera o rompimento dele.
# --------------------------------------------------------------------------

def rompimento_abertura(d: pd.DataFrame, hora_abertura: int = 7,
                        barras_range: int = 4, janela_barras: int = 60) -> pd.Series:
    """Range formado nas primeiras barras da sessao; opera quem furar.

    hora_abertura em UTC: 7 = Londres, 12 = Nova York.
    Um sinal por dia, no maximo — o primeiro rompimento vale, o resto e
    reentrada em movimento ja andado.
    """
    sinal = np.zeros(len(d), dtype="int8")
    hora = d["hora_utc"].dt.hour.to_numpy()
    high, low, close = (d[c].to_numpy() for c in ("high", "low", "close"))

    for _, idx in d.groupby(d["hora_utc"].dt.date).indices.items():
        pos = idx[hora[idx] >= hora_abertura]
        if len(pos) < barras_range + 2:
            continue
        formacao = pos[:barras_range]
        teto, piso = high[formacao].max(), low[formacao].min()

        for i in pos[barras_range:barras_range + janela_barras]:
            if close[i] > teto:
                sinal[i] = 1
                break
            if close[i] < piso:
                sinal[i] = -1
                break
    return pd.Series(sinal, index=d.index, dtype="int8")


# --------------------------------------------------------------------------
# 2. RSI(2) de Larry Connors
#    "Short Term Trading Strategies That Work". Compra fraqueza dentro de
#    tendencia de alta; vende forca dentro de tendencia de baixa.
# --------------------------------------------------------------------------

def rsi2_connors(d: pd.DataFrame, limite_baixo: int = 5, limite_alto: int = 95,
                 periodo_tendencia: int = 200) -> pd.Series:
    r = rsi(d, 2)
    media = d["close"].ewm(span=periodo_tendencia, adjust=False,
                           min_periods=periodo_tendencia).mean()
    compra = (d["close"] > media) & (r < limite_baixo)
    venda = (d["close"] < media) & (r > limite_alto)
    return pd.Series(np.where(compra, 1, np.where(venda, -1, 0)),
                     index=d.index, dtype="int8")


# --------------------------------------------------------------------------
# 3. Reversao nas Bandas de Bollinger
#    John Bollinger, "Bollinger on Bollinger Bands". Preco fura a banda e
#    volta para dentro: exaustao, nao continuidade.
# --------------------------------------------------------------------------

def bollinger_reversao(d: pd.DataFrame, periodo: int = 20, desvios: float = 2.0) -> pd.Series:
    media = d["close"].rolling(periodo).mean()
    desvio = d["close"].rolling(periodo).std()
    inferior, superior = media - desvios * desvio, media + desvios * desvio
    compra = (d["low"] < inferior) & (d["close"] > inferior)
    venda = (d["high"] > superior) & (d["close"] < superior)
    return pd.Series(np.where(compra.fillna(False), 1,
                              np.where(venda.fillna(False), -1, 0)),
                     index=d.index, dtype="int8")


# --------------------------------------------------------------------------
# 4. Canal de Donchian (sistema Tartaruga)
#    Curtis Faith, "Way of the Turtle". Rompimento da maxima/minima de N
#    barras. O sistema original usa 20 para entrada.
# --------------------------------------------------------------------------

def donchian(d: pd.DataFrame, periodo: int = 20) -> pd.Series:
    teto = d["high"].rolling(periodo).max().shift(1)
    piso = d["low"].rolling(periodo).min().shift(1)
    return pd.Series(np.where((d["close"] > teto).fillna(False), 1,
                              np.where((d["close"] < piso).fillna(False), -1, 0)),
                     index=d.index, dtype="int8")


# --------------------------------------------------------------------------
# 5. Reversao ao VWAP
#    Preco medio ponderado por volume, reiniciado a cada dia. Usado como
#    referencia de "preco justo" por mesas institucionais; a tese e que
#    afastamento grande tende a voltar.
# --------------------------------------------------------------------------

def vwap_reversao(d: pd.DataFrame, afastamento_atr: float = 1.5) -> pd.Series:
    tipico = (d["high"] + d["low"] + d["close"]) / 3
    dia = d["hora_utc"].dt.date
    pv = (tipico * d["volume"]).groupby(dia).cumsum()
    v = d["volume"].groupby(dia).cumsum().replace(0, np.nan)
    vwap = pv / v

    distancia = (d["close"] - vwap) / d["_atr"]
    virou_cima = d["close"] > d["close"].shift(1)
    virou_baixo = d["close"] < d["close"].shift(1)
    compra = (distancia < -afastamento_atr) & virou_cima
    venda = (distancia > afastamento_atr) & virou_baixo
    return pd.Series(np.where(compra.fillna(False), 1,
                              np.where(venda.fillna(False), -1, 0)),
                     index=d.index, dtype="int8")


# --------------------------------------------------------------------------
# 6. Cruzamento de medias com filtro de tendencia
#    A versao que quase todo curso ensina: cruzamento rapido, mas so a favor
#    da media longa. O filtro existe justamente para evitar o cruzamento
#    contra a tendencia, que e o modo classico de perder com esse sistema.
# --------------------------------------------------------------------------

def cruzamento_filtrado(d: pd.DataFrame, rapida: int = 9, lenta: int = 21,
                        filtro: int = 200) -> pd.Series:
    er = d["close"].ewm(span=rapida, adjust=False, min_periods=rapida).mean()
    el = d["close"].ewm(span=lenta, adjust=False, min_periods=lenta).mean()
    ef = d["close"].ewm(span=filtro, adjust=False, min_periods=filtro).mean()

    valido = er.notna() & el.notna() & ef.notna()
    acima = (er > el) & valido
    anterior = acima.shift(1, fill_value=False)
    cruzou_cima = acima & ~anterior & valido
    cruzou_baixo = ~acima & anterior & valido

    compra = cruzou_cima & (d["close"] > ef)
    venda = cruzou_baixo & (d["close"] < ef)
    return pd.Series(np.where(compra, 1, np.where(venda, -1, 0)),
                     index=d.index, dtype="int8")


REGISTRO = {
    "rompimento_abertura_londres": {
        "fn": lambda d: rompimento_abertura(d, hora_abertura=7),
        "fonte": "Crabel / Fisher — Opening Range Breakout (abertura de Londres)",
    },
    "rompimento_abertura_ny": {
        "fn": lambda d: rompimento_abertura(d, hora_abertura=12),
        "fonte": "Crabel / Fisher — Opening Range Breakout (abertura de NY)",
    },
    "rsi2_connors": {
        "fn": rsi2_connors,
        "fonte": "Larry Connors — Short Term Trading Strategies That Work",
    },
    "bollinger_reversao": {
        "fn": bollinger_reversao,
        "fonte": "John Bollinger — Bollinger on Bollinger Bands",
    },
    "donchian_20": {
        "fn": donchian,
        "fonte": "Curtis Faith — Way of the Turtle (canal de 20)",
    },
    "vwap_reversao": {
        "fn": vwap_reversao,
        "fonte": "Reversao ao VWAP diario (uso institucional corrente)",
    },
    "cruzamento_filtrado": {
        "fn": cruzamento_filtrado,
        "fonte": "Cruzamento 9/21 com filtro de media de 200",
    },
}


def detectar_todas(d: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame({nome: meta["fn"](d) for nome, meta in REGISTRO.items()},
                        index=d.index)
