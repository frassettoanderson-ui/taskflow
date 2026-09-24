"""Suportes e resistencias por clusterizacao de toques.

O nivel nao e uma linha que alguem desenha: e um preco onde o mercado ja
voltou varias vezes. Aqui ele nasce de pivos (maximas e minimas locais)
agrupados por proximidade — quanto mais pivos caem no mesmo preco, mais
"forte" o nivel.

**Vies de antecipacao e o risco central deste arquivo.** Tracar niveis com
o grafico inteiro a vista produz backtests espetaculares e inuteis. Duas
protecoes:

1. Um pivo usa janela centrada, entao so e conhecido k barras depois do topo
   ou fundo. Registramos a confirmacao em `i + k`, nunca em `i`.
2. O mapeamento roda em blocos: as barras de um bloco so enxergam pivos
   confirmados ANTES do bloco comecar. Custa alguma atualidade nos niveis
   (ate `BLOCO` barras) e em troca torna o vazamento de futuro impossivel
   por construcao, nao por disciplina.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

JANELA_PIVO = 10        # barras de cada lado; maior = menos pivos, mais relevantes
TOLERANCIA_ATR = 0.25   # dois pivos a menos que isso viram o mesmo nivel
JANELA_MEMORIA = 3000   # por quantas barras um nivel continua valendo
MIN_TOQUES = 2          # um pivo isolado nao e nivel
BLOCO = 200             # barras que compartilham o mesmo mapa de niveis
PERTO_ATR = 0.30        # distancia para considerar o preco "no nivel"


def _pivos(d: pd.DataFrame, k: int) -> tuple[np.ndarray, np.ndarray]:
    """Devolve (indice de confirmacao, preco) de todos os pivos, ja deslocados."""
    janela = 2 * k + 1
    idxs, precos = [], []
    for coluna, minimo in (("low", True), ("high", False)):
        s = d[coluna]
        extremo = s.rolling(janela, center=True).min() if minimo \
            else s.rolling(janela, center=True).max()
        pos = np.flatnonzero((s == extremo).to_numpy())
        idxs.append(pos + k)          # so se sabe k barras depois
        precos.append(s.to_numpy()[pos])
    i = np.concatenate(idxs)
    p = np.concatenate(precos)
    ordem = np.argsort(i)
    return i[ordem], p[ordem]


def _agrupar(precos: np.ndarray, tolerancia: float) -> tuple[np.ndarray, np.ndarray]:
    """Agrupa precos proximos num nivel. Devolve (preco medio, nº de toques)."""
    if len(precos) == 0:
        return np.empty(0), np.empty(0, dtype=int)
    p = np.sort(precos)
    corte = np.flatnonzero(np.diff(p) > tolerancia) + 1
    inicios = np.concatenate(([0], corte))
    somas = np.add.reduceat(p, inicios)
    contagens = np.diff(np.concatenate((inicios, [len(p)])))
    return somas / contagens, contagens


def mapear(d: pd.DataFrame, k: int = JANELA_PIVO, tol_atr: float = TOLERANCIA_ATR,
           memoria: int = JANELA_MEMORIA, min_toques: int = MIN_TOQUES,
           bloco: int = BLOCO) -> pd.DataFrame:
    """Para cada barra, distancia ate o nivel mais proximo acima e abaixo.

    Distancias em ATR, para comparar entre pares e regimes de volatilidade.
    """
    n = len(d)
    fechamento = d["close"].to_numpy(np.float64)
    atr = d["_atr"].to_numpy(np.float64)
    pivo_i, pivo_p = _pivos(d, k)

    dist_res = np.full(n, np.nan)
    dist_sup = np.full(n, np.nan)
    toques_res = np.zeros(n, dtype=np.int32)
    toques_sup = np.zeros(n, dtype=np.int32)

    atr_ref = np.nanmedian(atr)
    if not np.isfinite(atr_ref) or atr_ref <= 0:
        atr_ref = np.nanmedian(d["high"] - d["low"])
    tolerancia = tol_atr * atr_ref

    for inicio in range(0, n, bloco):
        fim = min(inicio + bloco, n)
        # Apenas pivos confirmados ANTES do bloco comecar.
        elegiveis = (pivo_i < inicio) & (pivo_i >= inicio - memoria)
        if not elegiveis.any():
            continue
        niveis, toques = _agrupar(pivo_p[elegiveis], tolerancia)
        forte = toques >= min_toques
        niveis, toques = niveis[forte], toques[forte]
        if len(niveis) == 0:
            continue

        alvo = fechamento[inicio:fim]
        pos = np.searchsorted(niveis, alvo)
        tem_acima = pos < len(niveis)
        tem_abaixo = pos > 0

        faixa = slice(inicio, fim)
        acima = np.where(tem_acima, niveis[np.minimum(pos, len(niveis) - 1)], np.nan)
        abaixo = np.where(tem_abaixo, niveis[np.maximum(pos - 1, 0)], np.nan)
        dist_res[faixa] = np.where(tem_acima, acima - alvo, np.nan)
        dist_sup[faixa] = np.where(tem_abaixo, alvo - abaixo, np.nan)
        toques_res[faixa] = np.where(tem_acima, toques[np.minimum(pos, len(niveis) - 1)], 0)
        toques_sup[faixa] = np.where(tem_abaixo, toques[np.maximum(pos - 1, 0)], 0)

    with np.errstate(invalid="ignore", divide="ignore"):
        d_res, d_sup = dist_res / atr, dist_sup / atr

    return pd.DataFrame({
        "_dist_res_atr": d_res,
        "_dist_sup_atr": d_sup,
        "_toques_res": toques_res,
        "_toques_sup": toques_sup,
    }, index=d.index)


def localizacao(niveis: pd.DataFrame, perto: float = PERTO_ATR) -> pd.Series:
    """Rotula onde o preco esta: em suporte, em resistencia ou livre.

    Quando os dois estao perto (preco espremido entre niveis), vence o mais
    proximo — e a barreira que o preco encontra primeiro.
    """
    res, sup = niveis["_dist_res_atr"], niveis["_dist_sup_atr"]
    em_res = res.notna() & (res <= perto)
    em_sup = sup.notna() & (sup <= perto)
    ambos = em_res & em_sup
    rotulo = pd.Series("livre", index=niveis.index, dtype=object)
    rotulo = rotulo.mask(em_res, "resistencia")
    rotulo = rotulo.mask(em_sup, "suporte")
    rotulo = rotulo.mask(ambos & (res <= sup), "resistencia")
    rotulo = rotulo.mask(ambos & (sup < res), "suporte")
    return rotulo
