"""Motor de backtest: mede o que aconteceu DEPOIS de cada sinal.

Duas regras valem para os dois modos e sao o que separa um backtest util
de um backtest bonito:

1. **Entrada na abertura da barra seguinte.** O sinal so existe quando a
   barra fecha; entrar no fechamento dela e operar com informacao que ainda
   nao se tinha.
2. **Custo real descontado.** O spread vem do proprio MT5, barra a barra.
   Em M5 ele consome boa parte do movimento — ignorar isso inverte o sinal
   de qualquer resultado marginal.

Quando alvo e stop sao tocados na mesma barra, contamos **stop**. Sem dados
intrabarra nao da para saber a ordem, e a suposicao pessimista e a unica
que nao infla o resultado.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def _arrays(d: pd.DataFrame):
    return (d["open"].to_numpy(np.float64), d["high"].to_numpy(np.float64),
            d["low"].to_numpy(np.float64), d["close"].to_numpy(np.float64))


def avaliar_binaria(d: pd.DataFrame, sinal: pd.Series, velas: int = 3,
                    direcao_fixa: int | None = None) -> pd.DataFrame:
    """Modo binario: o preco terminou acima ou abaixo do de entrada?

    `direcao_fixa` serve para padroes neutros (doji, inside bar), em que a
    direcao nao esta no padrao e precisa ser testada nos dois sentidos.

    Nao ha spread aqui: em opcao binaria o custo nao e o spread, e o payout
    menor que 100%. O breakeven entra na camada estatistica.
    """
    o, _h, _l, c = _arrays(d)
    n = len(d)
    s = sinal.to_numpy()

    idx = np.flatnonzero(s != 0)
    direcao = np.full(len(idx), direcao_fixa, dtype=np.int8) if direcao_fixa \
        else s[idx].astype(np.int8)

    entrada_i = idx + 1          # abre na barra seguinte ao sinal
    saida_i = idx + velas        # expira `velas` barras depois
    valido = saida_i < n
    idx, direcao = idx[valido], direcao[valido]
    entrada_i, saida_i = entrada_i[valido], saida_i[valido]

    variacao = (c[saida_i] - o[entrada_i]) * direcao
    return pd.DataFrame({
        "i": idx,
        "direcao": direcao,
        "vitoria": variacao > 0,
        "empate": variacao == 0,
        "variacao": variacao,
    })


def avaliar_tradicional(d: pd.DataFrame, sinal: pd.Series, mult_stop: float = 1.0,
                        mult_alvo: float = 2.0, max_barras: int = 100,
                        direcao_fixa: int | None = None) -> pd.DataFrame:
    """Modo tradicional: stop e alvo em multiplos de ATR, resultado em R.

    R = risco de uma operacao. Expectativa positiva em R importa mais que
    taxa de acerto: 40% de acerto a 2R lucra mais que 60% a 0,5R.
    """
    o, h, l, c = _arrays(d)
    n = len(d)
    s = sinal.to_numpy()
    atr = d["_atr"].to_numpy(np.float64)
    ponto = d.attrs.get("ponto", 1e-5)
    custo = d["spread"].to_numpy(np.float64) * ponto  # spread real da barra

    idx = np.flatnonzero(s != 0)
    idx = idx[(idx + 1 < n) & np.isfinite(atr[idx]) & (atr[idx] > 0)]
    direcao = (np.full(len(idx), direcao_fixa, dtype=np.int8) if direcao_fixa
               else s[idx].astype(np.int8)).astype(np.float64)

    entrada_i = idx + 1
    risco = mult_stop * atr[idx]
    # Paga-se o spread inteiro na entrada; a saida e avaliada no preco puro.
    entrada = o[entrada_i] + direcao * custo[entrada_i]
    stop = entrada - direcao * risco
    alvo = entrada + direcao * mult_alvo * atr[idx]

    resultado = np.full(len(idx), np.nan)
    barras = np.zeros(len(idx), dtype=np.int32)
    aberto = np.ones(len(idx), dtype=bool)

    for k in range(max_barras):
        if not aberto.any():
            break
        barra = entrada_i + k
        dentro = aberto & (barra < n)
        if not dentro.any():
            break
        b = barra[dentro]
        dir_d = direcao[dentro]
        contra = np.where(dir_d > 0, l[b], h[b])   # extremo que ameaca o stop
        favor = np.where(dir_d > 0, h[b], l[b])    # extremo que alcanca o alvo

        bateu_stop = dir_d * (contra - stop[dentro]) <= 0
        bateu_alvo = dir_d * (favor - alvo[dentro]) >= 0

        pos = np.flatnonzero(dentro)
        # stop tem prioridade quando os dois caem na mesma barra
        fecha_stop = pos[bateu_stop]
        fecha_alvo = pos[bateu_alvo & ~bateu_stop]
        resultado[fecha_stop] = -1.0
        resultado[fecha_alvo] = mult_alvo / mult_stop
        barras[fecha_stop] = barras[fecha_alvo] = k + 1
        aberto[fecha_stop] = aberto[fecha_alvo] = False

    # Sobrou aberto: encerra a mercado na ultima barra disponivel.
    if aberto.any():
        resta = np.flatnonzero(aberto)
        ultima = np.minimum(entrada_i[resta] + max_barras - 1, n - 1)
        resultado[resta] = (direcao[resta] * (c[ultima] - entrada[resta])) / risco[resta]
        barras[resta] = max_barras

    return pd.DataFrame({
        "i": idx,
        "direcao": direcao.astype(np.int8),
        "resultado_r": resultado,
        "barras": barras,
        "expirou": aberto,
    })
