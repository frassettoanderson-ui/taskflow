"""Cruza padroes x contexto e produz a tabela ranqueada.

Cada linha responde a pergunta que importa: *neste par, neste timeframe,
nesta sessao, com a tendencia a favor ou contra, esse padrao teve borda?*

Um padrao nunca e avaliado "em geral". Engolfo de alta na Asia contra a
tendencia e outro evento, estatisticamente, do que engolfo de alta na
sobreposicao Londres/NY a favor. Misturar os dois e o jeito mais rapido de
transformar duas bordas opostas em um nada medio.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

import config
from ..padroes import REGISTRO, detectar_todos, preparar
from . import estatistica as est
from .motor import avaliar_binaria, avaliar_tradicional

PAYOUT_PADRAO = 0.87      # payout tipico de binaria; breakeven ~53,5%
# Fracao inicial do historico usada como "treino". Uma borda de verdade
# aparece nas duas metades; a que so existe na metade recente e mudanca de
# regime ou sorte concentrada, e nao sobrevive ao proximo ano.
CORTE_TEMPORAL = 0.60
MIN_POR_PERIODO = 50
VELAS_BINARIA = 3
MULT_STOP, MULT_ALVO = 1.0, 2.0


def _contexto(direcao: np.ndarray, tendencia: np.ndarray) -> np.ndarray:
    """Relacao entre o sinal e a tendencia vigente."""
    rel = direcao * tendencia
    return np.where(rel > 0, "a_favor", np.where(rel < 0, "contra", "neutro"))


def analisar(par: str, timeframe: str, payout: float = PAYOUT_PADRAO,
             velas: int = VELAS_BINARIA, amostra_minima: int = est.AMOSTRA_MINIMA
             ) -> pd.DataFrame:
    """Roda todos os padroes de um par/timeframe e devolve uma linha por grupo."""
    from ..dados import mt5_fonte as fonte

    d = preparar(fonte.carregar(par, timeframe), config.SESSOES)
    sinais = detectar_todos(d)

    # A entrada acontece na barra seguinte ao sinal, entao o spread que
    # importa e o DELA. Descartar aqui evita que a janela de rollover
    # contamine o relatorio com borda ilusoria.
    limite = config.LIMITE_SPREAD_MEDIANAS * d["spread"].median()
    entrada_valida = (d["spread"] <= limite).shift(-1, fill_value=False)
    sinais = sinais.mul(entrada_valida.astype("int8"), axis=0).astype("int8")
    descartados = int((~entrada_valida).sum())
    sessao = d["_sessao"].to_numpy()
    tendencia = d["_tendencia"].to_numpy()
    breakeven = est.breakeven_binaria(payout)

    linhas = []
    _ = descartados  # exposto no log do CLI
    for nome, meta in REGISTRO.items():
        direcoes = [None] if meta["tipo"] == "direcional" else [1, -1]
        for dir_fixa in direcoes:
            bin_df = avaliar_binaria(d, sinais[nome], velas, dir_fixa)
            trad_df = avaliar_tradicional(d, sinais[nome], MULT_STOP, MULT_ALVO,
                                          direcao_fixa=dir_fixa)
            if bin_df.empty:
                continue

            juncao = bin_df.merge(trad_df[["i", "resultado_r"]], on="i", how="inner")
            juncao["sessao"] = sessao[juncao["i"].to_numpy()]
            juncao["contexto"] = _contexto(juncao["direcao"].to_numpy(),
                                           tendencia[juncao["i"].to_numpy()])

            for (sess, ctx, dire), g in juncao.groupby(["sessao", "contexto", "direcao"]):
                validos = g[~g["empate"]]          # empate: corretora devolve a aposta
                n = len(validos)
                if n < amostra_minima:
                    continue
                # Estabilidade temporal: o mesmo calculo nas duas metades.
                corte_i = int(len(d) * CORTE_TEMPORAL)
                treino, teste = validos[validos["i"] < corte_i], validos[validos["i"] >= corte_i]
                g_tre, g_tes = g[g["i"] < corte_i], g[g["i"] >= corte_i]
                periodos_ok = (len(treino) >= MIN_POR_PERIODO
                               and len(teste) >= MIN_POR_PERIODO)

                vit = int(validos["vitoria"].sum())
                taxa = vit / n
                ic_inf, ic_sup = est.wilson(vit, n)
                r = g["resultado_r"].to_numpy()
                media_r, r_inf, r_sup = est.bootstrap_media(r)

                linhas.append({
                    "par": par, "timeframe": timeframe, "padrao": nome,
                    "direcao": "alta" if dire > 0 else "baixa",
                    "sessao": sess, "contexto": ctx, "ocorrencias": n,
                    "taxa_acerto": taxa, "ic_inf": ic_inf, "ic_sup": ic_sup,
                    "breakeven": breakeven,
                    "p_binaria": est.p_valor_acerto(vit, n, breakeven),
                    "taxa_treino": treino["vitoria"].mean() if len(treino) else np.nan,
                    "taxa_teste": teste["vitoria"].mean() if len(teste) else np.nan,
                    "r_treino": g_tre["resultado_r"].mean() if len(g_tre) else np.nan,
                    "r_teste": g_tes["resultado_r"].mean() if len(g_tes) else np.nan,
                    "p_treino": est.p_valor_expectativa(g_tre["resultado_r"].to_numpy()),
                    "p_teste": est.p_valor_expectativa(g_tes["resultado_r"].to_numpy()),
                    "p_bin_treino": est.p_valor_acerto(int(treino["vitoria"].sum()),
                                                       len(treino), breakeven),
                    "p_bin_teste": est.p_valor_acerto(int(teste["vitoria"].sum()),
                                                      len(teste), breakeven),
                    "periodos_ok": periodos_ok,
                    "expectativa_r": media_r, "r_ic_inf": r_inf, "r_ic_sup": r_sup,
                    "p_tradicional": est.p_valor_expectativa(r),
                })

    return pd.DataFrame(linhas)


def consolidar(tabelas: list[pd.DataFrame], fdr: float = 0.10) -> pd.DataFrame:
    """Junta tudo e aplica a correcao de multiplos testes.

    A correcao roda sobre o conjunto INTEIRO de combinacoes testadas. Aplicar
    por par ou por padrao separadamente derrotaria o proposito: o que se
    controla e o numero de falsas descobertas no relatorio como um todo.
    """
    tabelas = [t for t in tabelas if not t.empty]
    if not tabelas:
        return pd.DataFrame()

    df = pd.concat(tabelas, ignore_index=True)
    df["aprovado_binaria"] = est.benjamini_hochberg(df["p_binaria"].to_numpy(), fdr)
    df["aprovado_tradicional"] = est.benjamini_hochberg(df["p_tradicional"].to_numpy(), fdr)
    df["margem_breakeven"] = df["taxa_acerto"] - df["breakeven"]
    # Criterio honesto: nao basta a media estar acima do breakeven; o limite
    # inferior do intervalo de confianca tambem precisa estar.
    # Tres filtros em serie, do mais fraco ao mais exigente:
    #   1. significancia com correcao de multiplos testes
    #   2. limite inferior do IC tambem acima do breakeven (nao so a media)
    #   3. a borda existe nas duas metades do historico
    # "Positivo nas duas metades" e frouxo demais: uma metade pode estar
    # positiva por margem irrelevante. Cada metade precisa se sustentar
    # sozinha, senao o que passou no conjunto foi carregado por uma so.
    df["estavel_binaria"] = (df["periodos_ok"]
                             & (df["p_bin_treino"] < 0.05) & (df["p_bin_teste"] < 0.05))
    df["estavel_tradicional"] = (df["periodos_ok"]
                                 & (df["p_treino"] < 0.05) & (df["p_teste"] < 0.05))
    df["borda_binaria"] = (df["aprovado_binaria"] & (df["ic_inf"] > df["breakeven"])
                           & df["estavel_binaria"])
    df["borda_tradicional"] = (df["aprovado_tradicional"] & (df["r_ic_inf"] > 0)
                               & df["estavel_tradicional"])
    return df.sort_values("expectativa_r", ascending=False).reset_index(drop=True)
