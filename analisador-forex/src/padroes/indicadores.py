"""Indicadores e medidas auxiliares das velas.

Tudo vetorizado em pandas: um backtest de 900 mil barras roda em segundos.
Onde existe a versao de Wilder (ATR, RSI), usamos ela — e a que os
terminais desenham, entao os numeros batem com o que o usuario ve no grafico.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


# --- anatomia da vela ---------------------------------------------------

def corpo(df: pd.DataFrame) -> pd.Series:
    return (df["close"] - df["open"]).abs()


def amplitude(df: pd.DataFrame) -> pd.Series:
    return df["high"] - df["low"]


def sombra_superior(df: pd.DataFrame) -> pd.Series:
    return df["high"] - df[["open", "close"]].max(axis=1)


def sombra_inferior(df: pd.DataFrame) -> pd.Series:
    return df[["open", "close"]].min(axis=1) - df["low"]


def e_alta(df: pd.DataFrame) -> pd.Series:
    return df["close"] > df["open"]


def e_baixa(df: pd.DataFrame) -> pd.Series:
    return df["close"] < df["open"]


# --- indicadores --------------------------------------------------------

def true_range(df: pd.DataFrame) -> pd.Series:
    fechamento_ant = df["close"].shift(1)
    return pd.concat([
        df["high"] - df["low"],
        (df["high"] - fechamento_ant).abs(),
        (df["low"] - fechamento_ant).abs(),
    ], axis=1).max(axis=1)


def atr(df: pd.DataFrame, periodo: int = 14) -> pd.Series:
    """ATR de Wilder. Serve de regua: normaliza padroes entre pares e regimes."""
    return true_range(df).ewm(alpha=1 / periodo, adjust=False, min_periods=periodo).mean()


def rsi(df: pd.DataFrame, periodo: int = 14) -> pd.Series:
    delta = df["close"].diff()
    ganho = delta.clip(lower=0)
    perda = -delta.clip(upper=0)
    mg = ganho.ewm(alpha=1 / periodo, adjust=False, min_periods=periodo).mean()
    mp = perda.ewm(alpha=1 / periodo, adjust=False, min_periods=periodo).mean()
    fr = mg / mp.replace(0, np.nan)
    return (100 - 100 / (1 + fr)).fillna(50)


def ema(df: pd.DataFrame, periodo: int, coluna: str = "close") -> pd.Series:
    return df[coluna].ewm(span=periodo, adjust=False, min_periods=periodo).mean()


# --- contexto -----------------------------------------------------------

def tendencia(df: pd.DataFrame, rapida: int = 21, lenta: int = 50) -> pd.Series:
    """Contexto de tendencia: +1 alta, -1 baixa, 0 indefinido.

    Nao filtra os detectores — entra como dimensao do relatorio. O mesmo
    padrao a favor e contra a tendencia costuma ter estatisticas opostas,
    e isso so aparece se as duas situacoes forem medidas separadas.
    """
    er, el = ema(df, rapida), ema(df, lenta)
    return pd.Series(np.where(er > el, 1, np.where(er < el, -1, 0)),
                     index=df.index, dtype="int8")


def sessao(df: pd.DataFrame, sessoes: dict) -> pd.Series:
    """Rotula cada barra pela sessao (usa hora_utc, ja corrigida do fuso).

    Assume faixas disjuntas — ver config.SESSOES. Faixas sobrepostas se
    mascarariam e a contagem por sessao sairia errada.
    """
    hora = df["hora_utc"].dt.hour
    rotulo = pd.Series("fora", index=df.index, dtype=object)
    for nome, (ini, fim) in sessoes.items():
        dentro = (hora >= ini) & (hora < fim) if ini < fim else (hora >= ini) | (hora < fim)
        rotulo = rotulo.mask(dentro, nome)
    return rotulo


# --- preparacao ---------------------------------------------------------

COLUNAS_AUXILIARES = ["_corpo", "_amplitude", "_somb_sup", "_somb_inf",
                      "_alta", "_baixa", "_atr", "_rsi", "_tendencia", "_sessao"]


def preparar(df: pd.DataFrame, sessoes: dict | None = None) -> pd.DataFrame:
    """Calcula uma vez o que todos os detectores usam.

    Sem isso cada detector recalcularia ATR e RSI sobre 900 mil barras.
    """
    d = df.copy()
    d["_corpo"] = corpo(d)
    d["_amplitude"] = amplitude(d)
    d["_somb_sup"] = sombra_superior(d)
    d["_somb_inf"] = sombra_inferior(d)
    d["_alta"] = e_alta(d)
    d["_baixa"] = e_baixa(d)
    d["_atr"] = atr(d)
    d["_rsi"] = rsi(d)
    d["_tendencia"] = tendencia(d)
    if sessoes and "hora_utc" in d.columns:
        d["_sessao"] = sessao(d, sessoes)
    d.attrs.update(df.attrs)
    return d
