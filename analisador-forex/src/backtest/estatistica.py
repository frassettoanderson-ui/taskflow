"""Camada estatistica: decide se um resultado e borda ou sorte.

O ponto mais importante do projeto esta aqui. Cruzando 14 padroes x 5 sessoes
x 3 contextos de tendencia x 7 pares x 3 timeframes chegamos a milhares de
combinacoes testadas. A 5% de significancia, **centenas passariam por puro
acaso**. Por isso todo relatorio aplica correcao de multiplos testes
(Benjamini-Hochberg); sem ela a ferramenta vira uma maquina de gerar
falsos positivos convincentes.
"""
from __future__ import annotations

import numpy as np
from scipy import stats

# Amostra abaixo disso nao vale conclusao, por melhor que pareca a taxa.
AMOSTRA_MINIMA = 200


def breakeven_binaria(payout: float) -> float:
    """Taxa de acerto necessaria so para empatar.

    Com payout de 87%, sao 53,5%. Com 80%, 55,6%. E por isso que padrao
    "bom" de 52% de acerto perde dinheiro em binaria.
    """
    return 1.0 / (1.0 + payout)


def wilson(vitorias: int, total: int, confianca: float = 0.95) -> tuple[float, float]:
    """Intervalo de confianca de Wilson para proporcao.

    Preferido ao intervalo normal: nao estoura os limites [0,1] e se comporta
    bem com amostra pequena ou taxa proxima dos extremos.
    """
    if total == 0:
        return (float("nan"), float("nan"))
    z = stats.norm.ppf(1 - (1 - confianca) / 2)
    p = vitorias / total
    denom = 1 + z**2 / total
    centro = (p + z**2 / (2 * total)) / denom
    margem = z * np.sqrt(p * (1 - p) / total + z**2 / (4 * total**2)) / denom
    return (max(0.0, centro - margem), min(1.0, centro + margem))


def p_valor_acerto(vitorias: int, total: int, p0: float) -> float:
    """Probabilidade de observar essa taxa (ou melhor) se o padrao nao tivesse
    borda nenhuma. Unilateral: so interessa ser MELHOR que o breakeven."""
    if total == 0:
        return 1.0
    return float(stats.binomtest(vitorias, total, p0, alternative="greater").pvalue)


def p_valor_expectativa(resultados_r: np.ndarray) -> float:
    """Teste t unilateral: a expectativa em R e maior que zero?"""
    r = np.asarray(resultados_r, dtype=float)
    r = r[np.isfinite(r)]
    if len(r) < 3 or np.allclose(r.std(), 0):
        return 1.0
    return float(stats.ttest_1samp(r, 0.0, alternative="greater").pvalue)


def bootstrap_media(resultados_r: np.ndarray, reamostragens: int = 2000,
                    confianca: float = 0.95, semente: int = 42) -> tuple[float, float, float]:
    """Media e IC por bootstrap — nao assume normalidade.

    Resultado em R e assimetrico por construcao (perda travada em -1, ganho
    ate +mult_alvo), entao o IC normal engana.
    """
    r = np.asarray(resultados_r, dtype=float)
    r = r[np.isfinite(r)]
    if len(r) == 0:
        return (float("nan"),) * 3
    rng = np.random.default_rng(semente)
    amostras = rng.choice(r, size=(reamostragens, len(r)), replace=True).mean(axis=1)
    a = (1 - confianca) / 2
    return (float(r.mean()), float(np.quantile(amostras, a)),
            float(np.quantile(amostras, 1 - a)))


def benjamini_hochberg(p_valores: np.ndarray, fdr: float = 0.10) -> np.ndarray:
    """Controla a taxa de falsas descobertas entre muitos testes.

    Devolve mascara booleana das combinacoes que sobrevivem. Com fdr=0.10,
    espera-se que ate 10% das aprovadas sejam falso positivo — muito melhor
    que o alagamento de aprovar tudo com p<0.05 em milhares de testes.
    """
    p = np.asarray(p_valores, dtype=float)
    n = len(p)
    if n == 0:
        return np.zeros(0, dtype=bool)
    ordem = np.argsort(p)
    limites = fdr * (np.arange(1, n + 1) / n)
    passou = p[ordem] <= limites
    aprovado = np.zeros(n, dtype=bool)
    if passou.any():
        corte = np.flatnonzero(passou).max()
        aprovado[ordem[: corte + 1]] = True
    return aprovado
