"""Combinacao de sinais: padrao + localizacao, e padrao + padrao.

A hipotese e simples: padrao isolado nao tem borda (a primeira rodada mostrou
isso em 3.353 combinacoes), mas padrao no lugar certo, ou dois padroes
concordando, pode ter.

Tudo aqui olha so para tras. `combinar` usa janela rolante passada; o rotulo
de localizacao vem de niveis.py, que ja e a prova de futuro por construcao.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

JANELA_COMBINACAO = 3  # barras de tolerancia entre os dois padroes


def com_localizacao(sinal: pd.Series, loc: pd.Series, modo: str) -> pd.Series:
    """Filtra o sinal pela posicao do preco em relacao aos niveis.

    modo="reversao"   -> alta so em suporte, baixa so em resistencia
                         (o nivel segura o preco)
    modo="rompimento" -> alta so em resistencia, baixa so em suporte
                         (o nivel cede)
    modo="livre"      -> longe de qualquer nivel relevante
    """
    if modo == "reversao":
        ok_alta, ok_baixa = loc == "suporte", loc == "resistencia"
    elif modo == "rompimento":
        ok_alta, ok_baixa = loc == "resistencia", loc == "suporte"
    elif modo == "livre":
        ok_alta = ok_baixa = loc == "livre"
    else:
        raise ValueError(f"modo invalido: {modo}")

    return pd.Series(np.where((sinal == 1) & ok_alta, 1,
                              np.where((sinal == -1) & ok_baixa, -1, 0)),
                     index=sinal.index, dtype="int8")


def combinar(a: pd.Series, b: pd.Series, janela: int = JANELA_COMBINACAO) -> pd.Series:
    """Sinal de `a` confirmado por `b` na mesma direcao, nas ultimas `janela` barras.

    A janela inclui a barra atual (os dois padroes podem fechar juntos) e so
    olha para tras.
    """
    saida = np.zeros(len(a), dtype="int8")
    for direcao in (1, -1):
        recente = (b == direcao).rolling(janela, min_periods=1).max().fillna(0).astype(bool)
        saida[((a == direcao) & recente).to_numpy()] = direcao
    return pd.Series(saida, index=a.index, dtype="int8")


def sinais_base(sinais: pd.DataFrame, registro: dict) -> dict[str, pd.Series]:
    """Normaliza tudo em sinais ja direcionados.

    Padroes neutros (doji, inside bar) viram duas entradas, uma por direcao —
    a direcao nao esta no padrao, entao cada lado e uma hipotese propria.
    """
    base: dict[str, pd.Series] = {}
    for nome, meta in registro.items():
        s = sinais[nome]
        if meta["tipo"] == "direcional":
            base[nome] = s
        else:
            base[f"{nome}_alta"] = (s != 0).astype("int8")
            base[f"{nome}_baixa"] = -((s != 0).astype("int8"))
    return base


def gerar_variantes(sinais: pd.DataFrame, registro: dict, loc: pd.Series,
                    janela: int = JANELA_COMBINACAO) -> dict[str, pd.Series]:
    """Monta todas as hipoteses a testar: padrao x localizacao e padrao x padrao."""
    base = sinais_base(sinais, registro)
    variantes: dict[str, pd.Series] = {}

    for nome, s in base.items():
        for modo in ("reversao", "rompimento", "livre"):
            variantes[f"{nome}@{modo}"] = com_localizacao(s, loc, modo)

    # Pares de padroes direcionais. Ordem importa pouco, entao so metade.
    direcionais = [n for n, m in registro.items() if m["tipo"] == "direcional"]
    for i, a in enumerate(direcionais):
        for b in direcionais[i + 1:]:
            variantes[f"{a}+{b}"] = combinar(sinais[a], sinais[b], janela)

    return variantes
