"""Conexao com o MetaTrader 5 e download de historico OHLCV.

Duas limitacoes do terminal ditam o desenho deste modulo:

1. Pedidos acima de ~50.000 barras falham com "Invalid params" e, se
   repetidos, **derrubam o terminal**. Por isso todo download e feito em
   blocos de ~30.000 barras.
2. O terminal pode cair no meio de uma sessao longa. `garantir_conexao()`
   reabre e reloga (a conta fica salva no perfil).

O MT5 entrega spread real por barra, o que permite backtest com custo
verdadeiro em vez de estimativa.
"""
from __future__ import annotations

import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pandas as pd
import MetaTrader5 as mt5

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import config  # noqa: E402

_TF = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}

# Barras por dia corrido, ja considerando que o Forex para no fim de semana.
_BARRAS_DIA = {"M1": 1030, "M5": 206, "M15": 69, "M30": 34,
               "H1": 17.1, "H4": 4.3, "D1": 0.71}

# Teto observado e ~50k. Ficamos bem abaixo para nao arriscar o terminal.
BARRAS_POR_BLOCO = 30_000


class ErroMT5(RuntimeError):
    pass


def conectar() -> None:
    """Abre a conexao IPC. O terminal sobe sozinho se estiver fechado."""
    if not mt5.initialize(path=config.MT5_PATH, timeout=120_000):
        codigo, msg = mt5.last_error()
        if codigo == -10005:
            raise ErroMT5(
                "IPC timeout: terminal aberto mas sem conta logada "
                "(ou preso no assistente). Faca login no MT5 e rode de novo."
            )
        raise ErroMT5(f"Falha ao conectar ao MT5: {codigo} {msg}")
    if mt5.account_info() is None:
        mt5.shutdown()
        raise ErroMT5("Terminal conectado, mas sem conta. Faca login no MT5.")


def desconectar() -> None:
    mt5.shutdown()


def garantir_conexao() -> None:
    """Reconecta se o terminal tiver caido no meio do trabalho."""
    if mt5.terminal_info() is not None:
        return
    mt5.shutdown()
    time.sleep(3)
    conectar()


def info_conta() -> dict:
    c, t = mt5.account_info(), mt5.terminal_info()
    return {
        "login": c.login,
        "servidor": c.server,
        "corretora": c.company,
        "moeda": c.currency,
        "tipo": "DEMO" if c.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO else "REAL",
        "build": t.build,
        "conectado": t.connected,
    }


def offset_servidor_horas() -> int:
    """Fuso do servidor da corretora (costuma ser UTC+2/+3).

    Sem corrigir isso, qualquer analise por sessao fica deslocada em horas.
    """
    tick = mt5.symbol_info_tick("EURUSD")
    if tick is None:
        return 0
    servidor = datetime.fromtimestamp(tick.time, tz=timezone.utc)
    return round((servidor - datetime.now(timezone.utc)).total_seconds() / 3600)


def garantir_simbolo(par: str) -> str:
    """Ativa o simbolo. Alguns brokers usam sufixo (EURUSD.a, EURUSDm)."""
    if mt5.symbol_info(par) is not None:
        mt5.symbol_select(par, True)
        return par
    for s in mt5.symbols_get() or []:
        if s.name.upper().startswith(par.upper()):
            mt5.symbol_select(s.name, True)
            return s.name
    raise ErroMT5(f"Simbolo {par} indisponivel nesta corretora.")


def _bloco(nome: str, tf_mt5: int, inicio: datetime, fim: datetime):
    """Um pedido ao terminal, com retry. Devolve array de barras ou None.

    O MT5 devolve 1 barra sintetica quando nao ha historico no periodo;
    tratamos isso como vazio.
    """
    for tentativa in range(3):
        try:
            r = mt5.copy_rates_range(nome, tf_mt5, inicio, fim)
        except Exception:
            r = None
        if r is not None and len(r) > 1:
            return r
        codigo = mt5.last_error()[0]
        if codigo in (-10001, -10004, -10005):  # terminal caiu ou travou
            garantir_conexao()
            garantir_simbolo(nome)
            time.sleep(2)
            continue
        if tentativa == 0:
            time.sleep(1)  # pode ser sincronizacao em andamento
            continue
        break
    return None


def baixar(par: str, timeframe: str, anos: int = 5, verboso: bool = False) -> pd.DataFrame:
    """Baixa OHLCV + spread caminhando para tras em blocos.

    Para quando o historico da corretora acaba, mesmo que `anos` peca mais.
    """
    if timeframe not in _TF:
        raise ValueError(f"Timeframe invalido: {timeframe}")

    garantir_conexao()
    nome = garantir_simbolo(par)
    tf_mt5 = _TF[timeframe]
    dias_bloco = max(1, int(BARRAS_POR_BLOCO / _BARRAS_DIA[timeframe]))

    limite = datetime.utcnow() - timedelta(days=int(365.25 * anos))
    fim = datetime.utcnow() + timedelta(minutes=1)
    partes, vazios = [], 0

    while fim > limite:
        inicio = max(fim - timedelta(days=dias_bloco), limite)
        r = _bloco(nome, tf_mt5, inicio, fim)
        if r is None:
            vazios += 1
            if vazios >= 2:  # dois blocos seguidos sem nada: historico acabou
                break
        else:
            vazios = 0
            partes.append(pd.DataFrame(r))
            if verboso:
                print(f"      {inicio:%Y-%m-%d} .. {fim:%Y-%m-%d}: {len(r):,}")
        fim = inicio

    if not partes:
        raise ErroMT5(f"Sem dados para {nome} {timeframe}: {mt5.last_error()}")

    df = pd.concat(partes, ignore_index=True)
    df = df.drop_duplicates(subset="time").sort_values("time").reset_index(drop=True)

    df["hora_servidor"] = pd.to_datetime(df["time"], unit="s")
    off = offset_servidor_horas()
    df["hora_utc"] = df["hora_servidor"] - pd.Timedelta(hours=off)
    df = df.drop(columns=["time", "real_volume"], errors="ignore")
    df = df.rename(columns={"tick_volume": "volume"})

    info = mt5.symbol_info(nome)
    df.attrs.update(par=nome, timeframe=timeframe, digitos=info.digits,
                    ponto=info.point, offset_servidor=off)
    return df


def salvar(df: pd.DataFrame) -> Path:
    config.DIR_DADOS.mkdir(parents=True, exist_ok=True)
    destino = config.DIR_DADOS / f"{df.attrs['par']}_{df.attrs['timeframe']}.parquet"
    df.to_parquet(destino, index=False)
    return destino


def carregar(par: str, timeframe: str) -> pd.DataFrame:
    caminho = config.DIR_DADOS / f"{par}_{timeframe}.parquet"
    if not caminho.exists():
        raise FileNotFoundError(f"{caminho} nao existe. Rode baixar.py primeiro.")
    return pd.read_parquet(caminho)
