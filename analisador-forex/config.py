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

# Janelas de sessao em horario UTC (inicio inclusivo, fim exclusivo).
# Forex roda 24h, mas Toquio, Londres e NY tem comportamentos distintos.
# Segmentar por sessao costuma separar padrao com borda de padrao inutil.
SESSOES = {
    "sydney":  (21, 6),
    "toquio":  (0, 9),
    "londres": (7, 16),
    "ny":      (12, 21),
}

# Sobreposicoes: onde mora a maior parte do volume
SOBREPOSICOES = {
    "londres_ny": (12, 16),
    "toquio_londres": (7, 9),
}
