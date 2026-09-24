"""Configuracao central do analisador."""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
DIR_DADOS = RAIZ / "dados"

# Caminho do terminal MT5 (deixe None para autodeteccao)
MT5_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"

# Pares majors: spread baixo e liquidez alta. Exoticos nao sobrevivem ao custo.
PARES = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD"]

TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"]

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
