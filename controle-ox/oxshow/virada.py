"""Virada para o OX Show (27/11/2026): OBS e REAPER saem; o OX Show assume telão, música e show das 21h.
Uso: py virada.py fazer | py virada.py desfazer"""
import json, os, shutil, subprocess, sys
OX = r"C:\OXShow"
INI = os.path.expandvars(r"%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup")
DESAT = os.path.join(OX, "desativados")
LNKS = ["OBS Studio.lnk", "REAPER (x64).lnk"]
BK = "-antes-virada"

def ler(p): return json.load(open(p, encoding="utf-8"))
def gravar(p, d): json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

def fazer():
    for n in ("config.json", "dados.json"):
        b = os.path.join(OX, n + BK)
        if not os.path.exists(b): shutil.copy2(os.path.join(OX, n), b)
    os.makedirs(DESAT, exist_ok=True)
    for l in LNKS:
        if os.path.exists(os.path.join(INI, l)): shutil.move(os.path.join(INI, l), os.path.join(DESAT, l))
    subprocess.run(["taskkill", "/im", "obs64.exe", "/f"], capture_output=True)
    subprocess.run(["taskkill", "/im", "reaper.exe", "/f"], capture_output=True)
    c = ler(os.path.join(OX, "config.json"))
    c["telao"].update(ceder_21h=False, saida_som="MBS16CH", abrir_automatico=True)
    c.setdefault("vymber", {}).update(abrir_automatico=True, saida="MBS16CH")
    gravar(os.path.join(OX, "config.json"), c)
    d = ler(os.path.join(OX, "dados.json"))
    for a in d["agenda"]:
        if a["id"] == "ag-21h": a["ativo"] = True
    gravar(os.path.join(OX, "dados.json"), d)
    print("virada feita")

def desfazer():
    for l in LNKS:
        if os.path.exists(os.path.join(DESAT, l)): shutil.move(os.path.join(DESAT, l), os.path.join(INI, l))
    for n in ("config.json", "dados.json"):
        b = os.path.join(OX, n + BK)
        if os.path.exists(b): shutil.copy2(b, os.path.join(OX, n))
    print("desfeito: OBS e REAPER voltam na inicialização; reinicie o PC (ou abra os dois) para voltarem a rodar")

{"fazer": fazer, "desfazer": desfazer}[sys.argv[1]]()
