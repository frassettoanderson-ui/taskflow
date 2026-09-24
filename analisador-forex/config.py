"""Configuracao central do analisador."""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
DIR_DADOS = RAIZ / "dados"

# Caminho do terminal MT5 (deixe None para autodeteccao)
MT5_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"

# Pares majors: spread baixo e liquidez alta. Exoticos nao sobrevivem ao custo.
PARES = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD"]

TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"]

# Padrao do download em lote.
# M5 = operacional; M15 = confirmacao; H1 = contexto de tendencia.
TF_PADRAO = ["M5", "M15", "H1"]
ANOS_PADRAO = 12

# ATENCAO: o terminal limita barras por "MaxBars" em config/common.ini.
# Com o padrao (100000) o M5 devolve so ~1,3 ano. Foi elevado para
# 2147483647 em 24/09/2026, liberando os 12 anos completos.

# Janelas de sessao em UTC, **disjuntas** (inicio inclusivo, fim exclusivo).
# Faixas sobrepostas se mascaram e a contagem por sessao fica errada; por isso
# a sobreposicao Londres+NY — onde mora o maior volume do dia — e uma faixa
# propria em vez de ficar escondida dentro de "londres" ou de "ny".
SESSOES = {
    "asia":       (0, 7),    # Toquio/Sydney: baixa liquidez, tende a range
    "londres":    (7, 12),   # abertura europeia
    "londres_ny": (12, 16),  # sobreposicao: maior volume e maior amplitude
    "ny":         (16, 21),  # tarde americana
    "pos_ny":     (21, 24),  # virada do dia, liquidez minima
}

# Barras com spread anomalo sao descartadas antes da analise.
# Na virada do dia do servidor (21h UTC no MetaQuotes-Demo) o spread do
# EURUSD pula de ~3 para ~15 pontos e o volume cai a um sexto. Padroes
# detectados nessa janela produzem "borda" que nao existe na pratica:
# o movimento medido e alargamento de spread, nao preco.
LIMITE_SPREAD_MEDIANAS = 3.0
