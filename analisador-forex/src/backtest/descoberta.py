"""Descoberta em duas etapas: procurar no passado, provar no futuro.

A primeira rodada testou 3.353 combinacoes de uma vez. Corrigir multiplos
testes nessa escala e obrigatorio, mas cobra caro em poder: a barra sobe
tanto que so passaria uma borda enorme. Com confluencia o numero de
hipoteses cresce muito mais, e testar tudo junto seria autodestrutivo.

O desenho aqui e outro, e e o padrao em pesquisa quantitativa seria:

    Etapa 1 - DESCOBERTA, nos primeiros 60% do historico.
        Varre todas as hipoteses sem correcao. Nao e o resultado: e uma
        peneira. Espera-se falso positivo aqui, e tudo bem.

    Etapa 2 - VALIDACAO, nos 40% finais, nunca tocados na etapa 1.
        Testa SO os candidatos que passaram, aplicando a correcao apenas
        sobre esse conjunto pequeno.

O ganho e real: corrigir sobre ~100 candidatos em vez de ~9.000 hipoteses
preserva poder sem abrir mao do rigor. E o periodo de validacao e, de fato,
fora da amostra — o que nenhuma quantidade de correcao estatistica
aplicada ao periodo inteiro consegue imitar.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

import config
from ..padroes import REGISTRO, detectar_todos, preparar
from ..padroes import confluencia as cf
from ..padroes import niveis as nv
from . import estatistica as est
from .motor import avaliar_binaria, avaliar_tradicional
from .relatorio import MULT_ALVO, MULT_STOP, PAYOUT_PADRAO, VELAS_BINARIA, _contexto

CORTE = 0.60
MIN_TREINO = 150
MIN_TESTE = 100


def _stats(sub: pd.DataFrame, breakeven: float) -> dict:
    """Resumo de um periodo: taxa de acerto binaria e expectativa em R."""
    validos = sub[~sub["empate"]]
    n = len(validos)
    vit = int(validos["vitoria"].sum())
    r = sub["resultado_r"].to_numpy()
    return {
        "n": n,
        "taxa": vit / n if n else np.nan,
        "p_bin": est.p_valor_acerto(vit, n, breakeven) if n else 1.0,
        "exp_r": float(np.nanmean(r)) if len(r) else np.nan,
        "p_r": est.p_valor_expectativa(r),
    }


def avaliar(par: str, timeframe: str, payout: float = PAYOUT_PADRAO,
            velas: int = VELAS_BINARIA, corte: float = CORTE,
            min_treino: int = MIN_TREINO, min_teste: int = MIN_TESTE) -> pd.DataFrame:
    """Uma linha por (variante x contexto), com estatisticas dos dois periodos."""
    from ..dados import mt5_fonte as fonte

    d = preparar(fonte.carregar(par, timeframe), config.SESSOES)
    sinais = detectar_todos(d)

    # Mesmo filtro da primeira rodada: a entrada acontece na barra seguinte,
    # entao o spread que importa e o dela. Sem isso o rollover contamina tudo.
    limite = config.LIMITE_SPREAD_MEDIANAS * d["spread"].median()
    valida = (d["spread"] <= limite).shift(-1, fill_value=False)
    sinais = sinais.mul(valida.astype("int8"), axis=0).astype("int8")

    loc = nv.localizacao(nv.mapear(d))
    variantes = cf.gerar_variantes(sinais, REGISTRO, loc)

    tendencia = d["_tendencia"].to_numpy()
    breakeven = est.breakeven_binaria(payout)
    corte_i = int(len(d) * corte)

    linhas = []
    for nome, sinal in variantes.items():
        if int((sinal != 0).sum()) < min_treino + min_teste:
            continue
        b = avaliar_binaria(d, sinal, velas)
        t = avaliar_tradicional(d, sinal, MULT_STOP, MULT_ALVO)
        if b.empty or t.empty:
            continue
        j = b.merge(t[["i", "resultado_r"]], on="i", how="inner")
        j["contexto"] = _contexto(j["direcao"].to_numpy(), tendencia[j["i"].to_numpy()])

        grupos = [("todos", j)] + list(j.groupby("contexto"))
        for ctx, g in grupos:
            treino, teste = g[g["i"] < corte_i], g[g["i"] >= corte_i]
            if len(treino) < min_treino or len(teste) < min_teste:
                continue
            st, sv = _stats(treino, breakeven), _stats(teste, breakeven)
            linhas.append({
                "par": par, "timeframe": timeframe, "variante": nome, "contexto": ctx,
                "n_treino": st["n"], "taxa_treino": st["taxa"],
                "p_bin_treino": st["p_bin"], "exp_r_treino": st["exp_r"],
                "p_r_treino": st["p_r"],
                "n_teste": sv["n"], "taxa_teste": sv["taxa"],
                "p_bin_teste": sv["p_bin"], "exp_r_teste": sv["exp_r"],
                "p_r_teste": sv["p_r"],
                "breakeven": breakeven,
            })

    return pd.DataFrame(linhas)


def selecionar(df: pd.DataFrame, alfa_treino: float = 0.01) -> pd.DataFrame:
    """Etapa 1: candidatos, olhando SO o periodo de treino.

    Sem correcao de multiplos testes aqui — de proposito. Esta peneira existe
    para reduzir o espaco de hipoteses, nao para concluir nada.
    """
    d = df.copy()
    d["candidata_binaria"] = (d["p_bin_treino"] < alfa_treino) & (d["taxa_treino"] > d["breakeven"])
    d["candidata_tradicional"] = (d["p_r_treino"] < alfa_treino) & (d["exp_r_treino"] > 0)
    return d


def validar(df: pd.DataFrame, fdr: float = 0.10) -> pd.DataFrame:
    """Etapa 2: correcao aplicada apenas sobre os candidatos, no periodo de teste."""
    d = df.copy()
    d["aprovada_binaria"] = False
    d["aprovada_tradicional"] = False

    for coluna_cand, coluna_p, coluna_ok, condicao in (
        ("candidata_binaria", "p_bin_teste", "aprovada_binaria", d["taxa_teste"] > d["breakeven"]),
        ("candidata_tradicional", "p_r_teste", "aprovada_tradicional", d["exp_r_teste"] > 0),
    ):
        mask = d[coluna_cand].to_numpy()
        if not mask.any():
            continue
        aprovados = est.benjamini_hochberg(d.loc[mask, coluna_p].to_numpy(), fdr)
        idx = d.index[mask][aprovados]
        d.loc[idx, coluna_ok] = True
        d[coluna_ok] &= condicao

    return d
