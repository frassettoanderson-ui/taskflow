"""Padroes de estrutura de preco e de indicador.

Mesma convencao dos candles: +1 alta, -1 baixa, 0 nada.

Cuidado central aqui e **vies de antecipacao**: qualquer padrao que so se
confirma olhando barras futuras precisa ser marcado no momento em que
seria de fato conhecido, nunca no momento em que "fica bonito no grafico".
E o erro que faz backtest de divergencia parecer genial e quebrar ao vivo.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .velas import _serie

JANELA_PIVO = 3  # barras de cada lado para confirmar um pivo


def rompimento(d: pd.DataFrame, n: int = 20) -> pd.Series:
    """Fechamento alem da maxima/minima das n barras anteriores."""
    max_ant = d["high"].rolling(n).max().shift(1)
    min_ant = d["low"].rolling(n).min().shift(1)
    return _serie((d["close"] > max_ant).fillna(False),
                  (d["close"] < min_ant).fillna(False), d.index)


def cruzamento_emas(d: pd.DataFrame, rapida: int = 9, lenta: int = 21) -> pd.Series:
    """Cruzamento de medias exponenciais, marcado so na barra do cruzamento."""
    er = d["close"].ewm(span=rapida, adjust=False, min_periods=rapida).mean()
    el = d["close"].ewm(span=lenta, adjust=False, min_periods=lenta).mean()
    # Atencao: shift() numa Serie booleana devolve dtype object, e nele o
    # operador ~ vira inversao bitwise de Python (~True == -2, que e truthy).
    # Isso transformava o filtro de alta em passa-tudo. fill_value preserva bool.
    valido = er.notna() & el.notna()
    acima = (er > el) & valido
    acima_ant = acima.shift(1, fill_value=False)
    return _serie(acima & ~acima_ant & valido,
                  ~acima & acima_ant & valido, d.index)


def rsi_extremo(d: pd.DataFrame, baixo: int = 30, alto: int = 70) -> pd.Series:
    """Saida da zona extrema — nao a entrada.

    Comprar so porque o RSI furou 30 e comprar contra um movimento que ainda
    esta acontecendo. O sinal aqui e o retorno para a faixa normal.
    """
    r, r_ant = d["_rsi"], d["_rsi"].shift(1)
    return _serie(((r > baixo) & (r_ant <= baixo)).fillna(False),
                  ((r < alto) & (r_ant >= alto)).fillna(False), d.index)


def _pivos(serie: pd.Series, k: int, minimo: bool) -> np.ndarray:
    """Indices dos pivos. Usa janela centrada, logo so e conhecido k barras depois."""
    janela = 2 * k + 1
    extremo = serie.rolling(janela, center=True).min() if minimo \
        else serie.rolling(janela, center=True).max()
    return np.flatnonzero((serie == extremo).to_numpy())


def divergencia_rsi(d: pd.DataFrame, k: int = JANELA_PIVO,
                    min_dist: int = 5, max_dist: int = 60) -> pd.Series:
    """Preco faz extremo novo e o RSI nao acompanha.

    O sinal e marcado k barras APOS o pivo, que e quando ele passa a ser
    conhecido. Marcar no pivo inflaria o resultado com informacao do futuro.
    """
    sinal = np.zeros(len(d), dtype="int8")
    rsi_v = d["_rsi"].to_numpy()

    for minimo in (True, False):
        preco = d["low"] if minimo else d["high"]
        pv = _pivos(preco, k, minimo)
        vals = preco.to_numpy()
        for anterior, atual in zip(pv, pv[1:]):
            dist = atual - anterior
            if dist < min_dist or dist > max_dist:
                continue
            alvo = atual + k
            if alvo >= len(d) or sinal[alvo] != 0:
                continue
            if minimo and vals[atual] < vals[anterior] and rsi_v[atual] > rsi_v[anterior]:
                sinal[alvo] = 1
            elif not minimo and vals[atual] > vals[anterior] and rsi_v[atual] < rsi_v[anterior]:
                sinal[alvo] = -1

    return pd.Series(sinal, index=d.index, dtype="int8")
