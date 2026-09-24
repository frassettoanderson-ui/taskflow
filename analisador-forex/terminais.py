"""Lista os MetaTrader 5 instalados nesta maquina e o que cada um enxerga.

Cada corretora instala o SEU proprio terminal, em pasta propria. O da
MetaQuotes nao tem simbolos da B3; o da corretora brasileira normalmente nao
tem Forex completo. Este script descobre quais existem e o que cada um
oferece, para escolher o certo antes de baixar qualquer coisa.

Uso:
    python terminais.py              # lista os terminais e seus simbolos
    python terminais.py --usar 2     # imprime o comando para usar o nº 2
"""
import argparse
import os
from pathlib import Path

import MetaTrader5 as mt5

RAIZES = [
    Path(os.environ.get("ProgramFiles", r"C:\Program Files")),
    Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")),
    Path(os.environ.get("LOCALAPPDATA", "")) / "Programs",
]

# Prefixos de ativos da B3. Cuidado: prefixo sozinho da falso positivo —
# na MetaQuotes-Demo, WING e a Wingstop, VALE e o ADR em Nova York, INDA e um
# ETF de India e DOL e a Dole, todas em USD na Nasdaq. Por isso a checagem
# real e a moeda do ativo, nao o nome.
PREFIXOS_B3 = ("WIN", "WDO", "IND", "DOL", "PETR", "VALE", "BOVA")
MOEDA_B3 = "BRL"


def _e_b3(s) -> bool:
    return (s.currency_profit == MOEDA_B3
            and s.name.upper().startswith(PREFIXOS_B3))


def encontrar() -> list[Path]:
    achados: list[Path] = []
    for raiz in RAIZES:
        if not raiz.exists():
            continue
        for pasta in raiz.iterdir():
            if not pasta.is_dir():
                continue
            exe = pasta / "terminal64.exe"
            if exe.exists():
                achados.append(exe)
    return sorted(set(achados))


def inspecionar(exe: Path) -> dict:
    """Abre o terminal e pergunta o que ele tem. Fecha em seguida."""
    info = {"caminho": exe, "ok": False}
    try:
        if not mt5.initialize(path=str(exe), timeout=120_000):
            info["erro"] = f"{mt5.last_error()}"
            return info
        conta, term = mt5.account_info(), mt5.terminal_info()
        if conta is None:
            info["erro"] = "sem conta logada"
            mt5.shutdown()
            return info

        todos = mt5.symbols_get() or []
        simbolos = [s.name for s in todos]
        b3 = [s.name for s in todos if _e_b3(s)]
        info.update(
            ok=True,
            corretora=conta.company,
            servidor=conta.server,
            login=conta.login,
            moeda=conta.currency,
            demo=conta.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO,
            total=len(simbolos),
            b3=sorted(b3)[:20],
            qtd_b3=len(b3),
            tem_forex=any(s.upper().startswith("EURUSD") for s in simbolos),
        )
        mt5.shutdown()
    except Exception as e:  # terminal corrompido ou versao incompativel
        info["erro"] = str(e)
    return info


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--usar", type=int, help="numero do terminal a usar")
    a = ap.parse_args()

    terminais = encontrar()
    if not terminais:
        print("Nenhum MetaTrader 5 encontrado nesta maquina.")
        return 1

    print(f"{len(terminais)} terminal(is) encontrado(s):\n")
    dados = []
    for i, exe in enumerate(terminais, 1):
        d = inspecionar(exe)
        dados.append(d)
        print(f"[{i}] {exe.parent.name}")
        print(f"    {exe}")
        if not d["ok"]:
            print(f"    indisponivel: {d.get('erro')}")
            print("    (abra este terminal e faca login para ele aparecer completo)\n")
            continue
        tipo = "DEMO" if d["demo"] else "REAL"
        print(f"    {d['corretora']} | conta {d['login']} ({tipo}) | {d['servidor']}")
        print(f"    {d['total']:,} simbolos | Forex: {'sim' if d['tem_forex'] else 'nao'} "
              f"| B3: {d['qtd_b3']}")
        if d["b3"]:
            print(f"    exemplos B3: {', '.join(d['b3'][:10])}")
        print()

    if a.usar:
        escolhido = terminais[a.usar - 1]
        print("Para usar este terminal nos proximos comandos:\n")
        print(f'  set MT5_PATH={escolhido}          (Prompt de Comando)')
        print(f'  $env:MT5_PATH="{escolhido}"       (PowerShell)')
    else:
        print("Rode com --usar <numero> para ver como apontar o programa "
              "para um terminal especifico.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
