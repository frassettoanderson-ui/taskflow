"""Conexao com o MetaTrader 5 e download de historico OHLCV.

O MT5 entrega spread real por barra, o que permite backtest com custo
verdadeiro em vez de uma estimativa chutada.
"""
from __future__ import annotations

import sys
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


class ErroMT5(RuntimeError):
    pass


def conectar() -> None:
    """Abre a conexao IPC com o terminal. Exige conta logada no MT5."""
    if not mt5.initialize(path=config.MT5_PATH, timeout=60_000):
        codigo, msg = mt5.last_error()
        if codigo == -10005:
            raise ErroMT5(
                "IPC timeout. O terminal esta aberto mas sem conta logada "
                "(ou preso no assistente). Faca login no MT5 e rode de novo."
            )
        raise ErroMT5(f"Falha ao conectar ao MT5: {codigo} {msg}")

    conta = mt5.account_info()
    if conta is None:
        mt5.shutdown()
        raise ErroMT5("Terminal conectado, mas sem conta. Faca login no MT5.")


def desconectar() -> None:
    mt5.shutdown()


def info_conta() -> dict:
    c = mt5.account_info()
    t = mt5.terminal_info()
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
    """Descobre o fuso do servidor da corretora comparando com o UTC real.

    Corretoras costumam operar em UTC+2/+3. Sem corrigir isso, qualquer
    analise por sessao fica deslocada em horas.
    """
    tick = mt5.symbol_info_tick("EURUSD")
    if tick is None:
        return 0
    hora_servidor = datetime.fromtimestamp(tick.time, tz=timezone.utc)
    agora_utc = datetime.now(timezone.utc)
    return round((hora_servidor - agora_utc).total_seconds() / 3600)


def garantir_simbolo(par: str) -> str:
    """Ativa o simbolo no Market Watch. Alguns brokers usam sufixo (EURUSD.a)."""
    if mt5.symbol_info(par) is not None:
        mt5.symbol_select(par, True)
        return par
    for s in mt5.symbols_get() or []:
        if s.name.upper().startswith(par.upper()):
            mt5.symbol_select(s.name, True)
            return s.name
    raise ErroMT5(f"Simbolo {par} indisponivel nesta corretora.")


def baixar(par: str, timeframe: str, anos: int = 5) -> pd.DataFrame:
    """Baixa OHLCV + spread e devolve DataFrame com hora do servidor e UTC."""
    if timeframe not in _TF:
        raise ValueError(f"Timeframe invalido: {timeframe}")

    nome = garantir_simbolo(par)
    fim = datetime.now(timezone.utc)
    inicio = fim - timedelta(days=365 * anos)

    rates = mt5.copy_rates_range(nome, _TF[timeframe], inicio, fim)
    if rates is None or len(rates) == 0:
        raise ErroMT5(f"Sem dados para {nome} {timeframe}: {mt5.last_error()}")

    df = pd.DataFrame(rates)
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
