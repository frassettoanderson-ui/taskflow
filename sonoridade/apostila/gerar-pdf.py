"""Gera o PDF da apostila: monta o HTML (node gerar.mjs), imprime no Chrome e acerta os números do sumário.
Rodar de dentro de sonoridade/:  python apostila/gerar-pdf.py
"""
import json, subprocess, sys
from pathlib import Path
import fitz  # PyMuPDF

AQUI = Path(__file__).resolve().parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PDF = AQUI / "Apostila-Metodo-Sonoridade-Vol1.pdf"


def montar():
    subprocess.run(["node", str(AQUI / "gerar.mjs")], check=True)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    "--allow-file-access-from-files", "--virtual-time-budget=20000",
                    f"--print-to-pdf={PDF}", (AQUI / "apostila.html").as_uri()],
                   check=True, capture_output=True)


def paginas():
    doc = fitz.open(PDF)
    achou, tema = {}, 0
    for i, pag in enumerate(doc):
        txt = pag.get_text()
        if "nestetemavocêvaiaprender" in "".join(txt.split()).lower():
            tema += 1
            achou[str(tema)] = i + 1
        elif "Como usar esta apostila" in txt and "Sumário" not in txt and "como" not in achou:
            achou["como"] = i + 1
        elif "Cheguei lá" in txt and "progresso" not in achou:
            achou["progresso"] = i + 1
    return achou, len(doc)


montar()
p, total = paginas()
(AQUI / "paginas.json").write_text(json.dumps(p), encoding="utf-8")
montar()
p2, total = paginas()
if p2 != p:
    (AQUI / "paginas.json").write_text(json.dumps(p2), encoding="utf-8")
    montar()
print("páginas:", p2, "total:", total, "->", PDF)
