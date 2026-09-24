"""Checa se o ambiente esta pronto: terminal, conta e simbolos."""
import MetaTrader5 as mt5
import config

print("Terminal:", config.MT5_PATH)
if not mt5.initialize(path=config.MT5_PATH, timeout=60_000):
    print("[x] nao conectou:", mt5.last_error())
    print("    -> abra o MT5 e faca login numa conta (demo serve).")
    raise SystemExit(1)

c, t = mt5.account_info(), mt5.terminal_info()
if c is None:
    print("[x] terminal aberto, sem conta logada.")
    mt5.shutdown()
    raise SystemExit(1)

print(f"[ok] {c.company} | conta {c.login} | servidor {c.server}")
print(f"[ok] build {t.build} | conectado {t.connected} | simbolos {mt5.symbols_total()}")
print("\nDisponibilidade dos majors:")
for par in config.PARES:
    s = mt5.symbol_info(par)
    if s is None:
        alt = [x.name for x in (mt5.symbols_get() or []) if x.name.upper().startswith(par)]
        print(f"  {par:8s} ausente" + (f" (talvez: {', '.join(alt[:3])})" if alt else ""))
    else:
        mt5.symbol_select(par, True)
        tick = mt5.symbol_info_tick(par)
        spread = (tick.ask - tick.bid) / s.point if tick else 0
        print(f"  {par:8s} ok | digitos {s.digits} | spread agora {spread:.1f} pts")
mt5.shutdown()
