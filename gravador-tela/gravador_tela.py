"""
Gravador de Tela para Windows
=============================

Grava a tela em MP4 (H.264) usando o FFmpeg (gdigrab). Recursos:

  - Tela inteira (todos os monitores ou um específico) ou região (estilo Lightshot).
  - Flags de captura: Áudio (microfone) e Webcam.
  - Webcam ao vivo (OpenCV) numa janelinha com moldura, arrastável para qualquer
    canto — ela aparece na tela e é capturada junto com o vídeo (estilo OBS).
  - Qualidade (Alta/Máxima/Leve) e FPS (30/60) selecionáveis.
  - Ícone na bandeja do sistema (perto do relógio).
  - Atalho global Ctrl+Alt+S para parar; a interface do app some durante a gravação.
  - Botão para abrir a pasta das gravações.

Vídeos salvos em "Vídeos\\Gravador de Tela", nome por data/hora.

Dependências externas: FFmpeg (ou embutido junto do programa).
Dependências Python: screeninfo, keyboard, pystray, pillow, opencv-python-headless.
"""

import os
import re
import sys
import time
import shutil
import queue
import subprocess
import threading
import datetime
import tkinter as tk
from tkinter import messagebox, filedialog, ttk

# ---------------------------------------------------------------------------
# Dependências opcionais (degradação suave se faltarem)
# ---------------------------------------------------------------------------

try:
    from screeninfo import get_monitors
    TEM_SCREENINFO = True
except Exception:
    TEM_SCREENINFO = False

try:
    import keyboard
    TEM_KEYBOARD = True
except Exception:
    TEM_KEYBOARD = False

# Pillow é base para o ícone da bandeja e para exibir a webcam.
try:
    from PIL import Image, ImageDraw, ImageTk
    TEM_PIL = True
except Exception:
    TEM_PIL = False

# pystray: ícone na bandeja (precisa do Pillow).
try:
    import pystray
    TEM_TRAY = TEM_PIL
except Exception:
    TEM_TRAY = False

# OpenCV: leitura da webcam ao vivo (precisa do Pillow para exibir).
try:
    import cv2
    TEM_CV2 = TEM_PIL
except Exception:
    TEM_CV2 = False


# ---------------------------------------------------------------------------
# Configurações
# ---------------------------------------------------------------------------

HOTKEY_PARAR = "ctrl+alt+s"
NOME_PASTA_SAIDA = "Gravador de Tela"

QUALIDADES = {
    "Alta (recomendada)":      {"crf": "18", "preset": "veryfast"},
    "Máxima (nitidez total)":  {"crf": "15", "preset": "faster"},
    "Leve (arquivo menor)":    {"crf": "24", "preset": "veryfast"},
}
QUALIDADE_PADRAO = "Alta (recomendada)"

FPS_OPCOES = ["30", "60"]
FPS_PADRAO = "30"

# Tamanhos da janelinha da webcam (largura x altura, em pixels — proporção 4:3).
TAMANHOS_CAM = {
    "Pequena": (200, 150),
    "Média":   (280, 210),
    "Grande":  (360, 270),
}
TAM_CAM_PADRAO = "Média"

FFMPEG_CAMINHO_MANUAL = ""


# ---------------------------------------------------------------------------
# Tema visual
# ---------------------------------------------------------------------------

COR_BG       = "#13131c"
COR_CARD     = "#1e1e2b"
COR_TEXTO    = "#f4f4f8"
COR_MUTED    = "#9a9ab0"
COR_BORDA    = "#2c2c3c"

COR_REC      = "#e23b3b"
COR_REC_H    = "#c52f2f"
COR_AZUL     = "#3b82f6"
COR_AZUL_H   = "#2f6fd6"
COR_NEUTRO   = "#2a2a3a"
COR_NEUTRO_H = "#34344a"
COR_CAM_BORDA = "#3b82f6"   # moldura da webcam

FONTE = "Segoe UI"


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def diretorio_base():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def pasta_saida():
    videos = os.path.join(os.path.expanduser("~"), "Videos")
    base = videos if os.path.isdir(videos) else os.path.expanduser("~")
    return os.path.join(base, NOME_PASTA_SAIDA)


def caminho_recurso(nome):
    if getattr(sys, "frozen", False):
        base = getattr(sys, "_MEIPASS", diretorio_base())
    else:
        base = diretorio_base()
    return os.path.join(base, nome)


def encontrar_ffmpeg():
    if FFMPEG_CAMINHO_MANUAL and os.path.isfile(FFMPEG_CAMINHO_MANUAL):
        return FFMPEG_CAMINHO_MANUAL
    env = os.environ.get("FFMPEG_BINARY")
    if env and os.path.isfile(env):
        return env
    base = diretorio_base()
    for c in (os.path.join(base, "ffmpeg.exe"),
              os.path.join(base, "ffmpeg", "bin", "ffmpeg.exe"),
              os.path.join(base, "bin", "ffmpeg.exe")):
        if os.path.isfile(c):
            return c
    return shutil.which("ffmpeg")


def ajustar_par(n):
    n = int(n)
    return n if n % 2 == 0 else n - 1


def listar_monitores():
    monitores = []
    if TEM_SCREENINFO:
        try:
            for i, m in enumerate(get_monitors(), start=1):
                monitores.append({
                    "nome": f"Monitor {i} ({m.width}x{m.height})",
                    "x": int(m.x), "y": int(m.y),
                    "largura": int(m.width), "altura": int(m.height),
                    "principal": bool(getattr(m, "is_primary", False)),
                })
        except Exception:
            monitores = []
    if not monitores:
        tmp = tk.Tk(); tmp.withdraw()
        lw, lh = tmp.winfo_screenwidth(), tmp.winfo_screenheight()
        tmp.destroy()
        monitores.append({"nome": f"Monitor 1 ({lw}x{lh})", "x": 0, "y": 0,
                          "largura": lw, "altura": lh, "principal": True})
    return monitores


def limites_virtuais(monitores):
    vx = min(m["x"] for m in monitores)
    vy = min(m["y"] for m in monitores)
    vr = max(m["x"] + m["largura"] for m in monitores)
    vb = max(m["y"] + m["altura"] for m in monitores)
    return vx, vy, vr - vx, vb - vy


def listar_dispositivos_dshow(ffmpeg):
    """
    Retorna (videos, audios): listas de nomes de dispositivos DirectShow,
    lidas da saída de 'ffmpeg -list_devices true -f dshow -i dummy'.
    """
    videos, audios = [], []
    if not ffmpeg:
        return videos, audios
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        p = subprocess.run(
            [ffmpeg, "-hide_banner", "-list_devices", "true",
             "-f", "dshow", "-i", "dummy"],
            capture_output=True, text=True, encoding="utf-8",
            errors="replace", creationflags=flags, timeout=15)
        saida = (p.stderr or "") + (p.stdout or "")
    except Exception:
        return videos, audios

    # Dois formatos de saída do FFmpeg:
    #   Novo (7.x/8.x):  [...] "Nome" (video|audio|none)   -> tipo no fim da linha
    #   Antigo:          cabeçalhos "DirectShow video/audio devices" + nomes
    secao = None
    for linha in saida.splitlines():
        low = linha.lower()
        if "alternative name" in low:
            continue
        if "video devices" in low:
            secao = "v"; continue
        if "audio devices" in low:
            secao = "a"; continue
        m = re.search(r'"([^"]+)"', linha)
        if not m:
            continue
        nome = m.group(1)
        fim = low.rstrip()
        if fim.endswith("(video)"):
            videos.append(nome)
        elif fim.endswith("(audio)"):
            audios.append(nome)
        elif fim.endswith("(none)"):
            continue                      # ex.: filtros como "LSVCam"
        elif secao == "v":
            videos.append(nome)
        elif secao == "a":
            audios.append(nome)
    return videos, audios


def criar_botao(parent, texto, cor, cor_hover, comando, fg="white"):
    btn = tk.Button(parent, text=texto, command=comando,
                    font=(FONTE, 11, "bold"), bg=cor, fg=fg,
                    activebackground=cor_hover, activeforeground=fg,
                    relief="flat", bd=0, cursor="hand2", pady=10)
    btn.bind("<Enter>", lambda e: btn.config(bg=cor_hover))
    btn.bind("<Leave>", lambda e: btn.config(bg=cor))
    return btn


# ---------------------------------------------------------------------------
# Janelinha da webcam ao vivo (arrastável, com moldura)
# ---------------------------------------------------------------------------

class WebcamOverlay:
    """
    Mostra a webcam ao vivo numa janela sem bordas, sempre no topo, que o
    usuário arrasta para onde quiser. Como fica visível na tela, é capturada
    pelo gdigrab junto com o resto — o vídeo final mostra a câmera ali.
    """

    def __init__(self, root, indice=0, largura=280, altura=210, ao_fechar=None):
        self.root = root
        self.indice = indice
        self.larg = largura
        self.alt = altura
        self.ao_fechar = ao_fechar     # callback quando o usuário clica no ✕
        self.cap = None
        self.rodando = False
        self._imgtk = None
        self._after_id = None

        self.top = tk.Toplevel(root)
        self.top.overrideredirect(True)
        self.top.attributes("-topmost", True)
        self.top.configure(bg=COR_CAM_BORDA)         # borda externa (accent)

        # moldura: accent (3px) -> linha escura (2px) -> vídeo
        inner = tk.Frame(self.top, bg="#0d0d12")
        inner.pack(padx=3, pady=3)
        self.video = tk.Label(inner, bg="black", cursor="fleur")
        self.video.pack(padx=2, pady=2)

        win_w = self.larg + 10
        win_h = self.alt + 10
        sw = self.top.winfo_screenwidth()
        sh = self.top.winfo_screenheight()
        x = sw - win_w - 40
        y = sh - win_h - 90
        self.top.geometry(f"{win_w}x{win_h}+{x}+{y}")

        # arrastar clicando em qualquer parte da câmera
        for w in (self.top, self.video, inner):
            w.bind("<ButtonPress-1>", self._drag_start)
            w.bind("<B1-Motion>", self._drag_move)

        # botão de fechar (✕) no canto superior direito (some ao gravar)
        self.btn_fechar = tk.Label(self.top, text="✕", bg=COR_REC, fg="white",
                                   font=(FONTE, 9, "bold"), cursor="hand2",
                                   padx=5, pady=0)
        self.btn_fechar.bind("<Button-1>", lambda e: self._fechar_pelo_botao())
        self.btn_fechar.place(relx=1.0, rely=0.0, x=-2, y=2, anchor="ne")

        self.iniciar()

    def _fechar_pelo_botao(self):
        if self.ao_fechar:
            self.ao_fechar()     # o app desmarca a flag e fecha a câmera
        else:
            self.fechar()

    def definir_modo_gravacao(self, gravando):
        """Esconde o ✕ durante a gravação (para não sair no vídeo)."""
        try:
            if gravando:
                self.btn_fechar.place_forget()
            else:
                self.btn_fechar.place(relx=1.0, rely=0.0, x=-2, y=2, anchor="ne")
        except Exception:
            pass
        self.reforcar_topo()

    def iniciar(self):
        if not (TEM_CV2 and TEM_PIL):
            return
        try:
            # CAP_DSHOW abre a câmera mais rápido no Windows.
            self.cap = cv2.VideoCapture(self.indice, cv2.CAP_DSHOW)
        except Exception:
            try:
                self.cap = cv2.VideoCapture(self.indice)
            except Exception:
                self.cap = None
        if self.cap is not None:
            # Captura modesta = leve e fluida (redimensionamos para exibir).
            for prop, val in ((cv2.CAP_PROP_FRAME_WIDTH, 640),
                              (cv2.CAP_PROP_FRAME_HEIGHT, 480),
                              (cv2.CAP_PROP_FPS, 30),
                              (cv2.CAP_PROP_BUFFERSIZE, 1)):
                try:
                    self.cap.set(prop, val)
                except Exception:
                    pass

        self.rodando = True
        self._ultimo = None            # último quadro pronto (PIL Image)
        self._lock = threading.Lock()
        self._thread = threading.Thread(target=self._captura_loop, daemon=True)
        self._thread.start()
        self._exibir_loop()

    def _captura_loop(self):
        """
        Thread: lê e prepara o quadro usando o OpenCV (resize/cvtColor liberam
        o GIL), limitada a ~30fps para não competir com a interface.
        """
        intervalo = 1.0 / 30.0
        while self.rodando and self.cap is not None:
            t0 = time.time()
            ok, frame = self.cap.read()
            if not ok or frame is None:
                time.sleep(0.01)
                continue
            frame = cv2.resize(frame, (self.larg, self.alt),
                               interpolation=cv2.INTER_LINEAR)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(frame)
            with self._lock:
                self._ultimo = img
            resto = intervalo - (time.time() - t0)
            if resto > 0:
                time.sleep(resto)

    def _exibir_loop(self):
        """
        Thread do Tk: só copia o último quadro para a imagem já existente
        (paste reaproveita o PhotoImage — bem mais leve que recriar).
        """
        if not self.rodando:
            return
        img = None
        with self._lock:
            if self._ultimo is not None:
                img, self._ultimo = self._ultimo, None
        if img is not None:
            if self._imgtk is None:
                self._imgtk = ImageTk.PhotoImage(img)
                self.video.configure(image=self._imgtk)
            else:
                self._imgtk.paste(img)
        self._after_id = self.root.after(33, self._exibir_loop)

    def _drag_start(self, e):
        self._dx = e.x_root - self.top.winfo_x()
        self._dy = e.y_root - self.top.winfo_y()

    def _drag_move(self, e):
        self.top.geometry(f"+{e.x_root - self._dx}+{e.y_root - self._dy}")

    def reforcar_topo(self):
        try:
            self.top.attributes("-topmost", True)
            self.top.lift()
        except Exception:
            pass

    def fechar(self):
        self.rodando = False
        if self._after_id:
            try:
                self.root.after_cancel(self._after_id)
            except Exception:
                pass
            self._after_id = None
        t = getattr(self, "_thread", None)
        if t is not None:
            try:
                t.join(timeout=1.0)
            except Exception:
                pass
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        try:
            self.top.destroy()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Controle flutuante discreto (gravar / parar) — fica sempre no topo
# ---------------------------------------------------------------------------

class ControleFlutuante:
    """
    Pílula pequena, semitransparente e arrastável, sempre no topo:
      ●  (cinza)  = pronto para gravar  -> clique inicia (tela inteira)
      ■  (vermelho) + cronômetro        = gravando      -> clique para parar
    Serve para interromper a gravação mesmo com a janela principal escondida.
    """

    def __init__(self, root, ao_toggle):
        self.root = root
        self.ao_toggle = ao_toggle

        self.top = tk.Toplevel(root)
        self.top.overrideredirect(True)
        self.top.attributes("-topmost", True)
        try:
            self.top.attributes("-alpha", 0.92)
        except Exception:
            pass
        self.top.configure(bg="#0d0d12")

        frame = tk.Frame(self.top, bg="#0d0d12")
        frame.pack(padx=2, pady=2)
        self.grip = tk.Label(frame, text="⋮⋮", bg="#0d0d12", fg="#666",
                             font=(FONTE, 11, "bold"), cursor="fleur", padx=3)
        self.grip.pack(side="left")
        self.btn = tk.Label(frame, text="●", bg="#0d0d12", fg="#888",
                            font=(FONTE, 14, "bold"), cursor="hand2", padx=6)
        self.btn.pack(side="left")
        self.lbl = tk.Label(frame, text="", bg="#0d0d12", fg=COR_TEXTO,
                            font=(FONTE, 10, "bold"))

        self.btn.bind("<Button-1>", lambda e: self.ao_toggle())
        for w in (self.top, frame, self.grip):
            w.bind("<ButtonPress-1>", self._drag_start)
            w.bind("<B1-Motion>", self._drag_move)

        self.top.update_idletasks()
        sw = self.top.winfo_screenwidth()
        self.top.geometry(f"+{sw - self.top.winfo_width() - 30}+12")

    def definir_estado(self, gravando, segundos=0):
        try:
            if gravando:
                m, s = divmod(int(segundos), 60)
                self.btn.config(text="■", fg=COR_REC)
                self.lbl.config(text=f"{m:02d}:{s:02d}")
                self.lbl.pack(side="left", padx=(2, 8))
            else:
                self.btn.config(text="●", fg="#888")
                self.lbl.pack_forget()
            self.top.attributes("-topmost", True)
            self.top.lift()
        except Exception:
            pass

    def _drag_start(self, e):
        self._dx = e.x_root - self.top.winfo_x()
        self._dy = e.y_root - self.top.winfo_y()

    def _drag_move(self, e):
        self.top.geometry(f"+{e.x_root - self._dx}+{e.y_root - self._dy}")

    def fechar(self):
        try:
            self.top.destroy()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Overlay de seleção de região (estilo Lightshot)
# ---------------------------------------------------------------------------

class SeletorRegiao:
    def __init__(self, root, monitores):
        self.resultado = None
        self.vx, self.vy, self.vw, self.vh = limites_virtuais(monitores)

        self.top = tk.Toplevel(root)
        self.top.overrideredirect(True)
        self.top.attributes("-topmost", True)
        try:
            self.top.attributes("-alpha", 0.30)
        except Exception:
            pass
        self.top.geometry(f"{self.vw}x{self.vh}+{self.vx}+{self.vy}")

        self.canvas = tk.Canvas(self.top, bg="black",
                                highlightthickness=0, cursor="crosshair")
        self.canvas.pack(fill="both", expand=True)
        self.canvas.create_text(
            self.vw // 2, 42,
            text="Arraste para selecionar a região   •   Esc para cancelar",
            fill="white", font=(FONTE, 16, "bold"))

        self.x0 = self.y0 = 0
        self.ret = None
        self.cx_txt = None
        self.canvas.bind("<ButtonPress-1>", self._inicio)
        self.canvas.bind("<B1-Motion>", self._arrasto)
        self.canvas.bind("<ButtonRelease-1>", self._fim)
        self.top.bind("<Escape>", self._cancelar)
        self.top.focus_force()

    def _inicio(self, e):
        self.x0, self.y0 = e.x, e.y
        if self.ret:
            self.canvas.delete(self.ret)
        self.ret = self.canvas.create_rectangle(
            self.x0, self.y0, self.x0, self.y0, outline="#ff3b30", width=2)

    def _arrasto(self, e):
        if not self.ret:
            return
        self.canvas.coords(self.ret, self.x0, self.y0, e.x, e.y)
        larg, alt = abs(e.x - self.x0), abs(e.y - self.y0)
        if self.cx_txt:
            self.canvas.delete(self.cx_txt)
        self.cx_txt = self.canvas.create_text(
            e.x + 55, e.y + 14, text=f"{larg} x {alt}",
            fill="white", font=(FONTE, 11, "bold"))

    def _fim(self, e):
        x, y = min(self.x0, e.x), min(self.y0, e.y)
        larg, alt = abs(e.x - self.x0), abs(e.y - self.y0)
        if larg < 8 or alt < 8:
            messagebox.showwarning(
                "Seleção muito pequena",
                "A área é muito pequena. Arraste uma região maior, ou Esc para "
                "cancelar.", parent=self.top)
            if self.ret:
                self.canvas.delete(self.ret); self.ret = None
            return
        self.resultado = (self.vx + x, self.vy + y, larg, alt)
        self.top.destroy()

    def _cancelar(self, _e=None):
        self.resultado = None
        self.top.destroy()


# ---------------------------------------------------------------------------
# Janelinha de indicação (fallback de parada, quando não há bandeja/atalho)
# ---------------------------------------------------------------------------

class IndicadorGravacao:
    def __init__(self, root, ao_parar):
        self.top = tk.Toplevel(root)
        self.top.title("Gravando")
        self.top.attributes("-topmost", True)
        self.top.resizable(False, False)
        self.top.configure(bg=COR_CARD)
        self.top.protocol("WM_DELETE_WINDOW", ao_parar)

        frame = tk.Frame(self.top, bg=COR_CARD, padx=16, pady=12)
        frame.pack()
        self.lbl = tk.Label(frame, text="●  Gravando   00:00",
                            fg=COR_REC, bg=COR_CARD, font=(FONTE, 12, "bold"))
        self.lbl.pack(pady=(0, 10))
        criar_botao(frame, f"Parar  ({HOTKEY_PARAR.upper()})",
                    COR_REC, COR_REC_H, ao_parar).pack(fill="x")

        self.top.update_idletasks()
        sw = self.top.winfo_screenwidth()
        self.top.geometry(f"+{sw - self.top.winfo_width() - 30}+30")

    def atualizar_tempo(self, segundos):
        m, s = divmod(int(segundos), 60)
        self.lbl.config(text=f"●  Gravando   {m:02d}:{s:02d}")

    def fechar(self):
        try:
            self.top.destroy()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Aplicação principal
# ---------------------------------------------------------------------------

class GravadorApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Gravador de Tela")
        self.root.configure(bg=COR_BG)
        self.root.resizable(False, False)
        self._definir_icone()

        self.ffmpeg = encontrar_ffmpeg()
        self.monitores = listar_monitores()
        # Dispositivos de áudio/vídeo (DirectShow).
        self._cam_nomes, self._mic_nomes = [], []
        self._enumerar_dispositivos()

        # Estado de gravação.
        self.proc = None
        self.gravando = False
        self.log_arquivo = None
        self.log_caminho = ""
        self.saida_caminho = ""
        self.indicador = None
        self.inicio_ts = None
        self._pedido_parar = threading.Event()
        self._hotkey_handle = None
        self._mostrar_indicador = False

        # Webcam.
        self.webcam = None

        # Controle flutuante.
        self.controle = None

        # Bandeja.
        self.fila = queue.Queue()
        self.tray = None
        self.tray_ativo = False
        self._avisou_bandeja = False

        self._montar_interface()
        self._centralizar(470, 720)
        self.root.protocol("WM_DELETE_WINDOW", self._ao_fechar_janela)

    def _enumerar_dispositivos(self):
        try:
            v, a = listar_dispositivos_dshow(self.ffmpeg)
            self._cam_nomes, self._mic_nomes = v, a
        except Exception:
            self._cam_nomes, self._mic_nomes = [], []

    # ---- Aparência ---------------------------------------------------------

    def _definir_icone(self):
        ico = caminho_recurso("icon.ico")
        if os.path.isfile(ico):
            try:
                self.root.iconbitmap(ico)
            except Exception:
                pass

    def _centralizar(self, w, h):
        self.root.update_idletasks()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        self.root.geometry(f"{w}x{h}+{(sw - w)//2}+{max(0,(sh - h)//3)}")

    def _estilo_combos(self):
        estilo = ttk.Style()
        try:
            estilo.theme_use("clam")
        except Exception:
            pass
        estilo.configure("Dark.TCombobox",
                         fieldbackground=COR_CARD, background=COR_CARD,
                         foreground=COR_TEXTO, arrowcolor=COR_TEXTO,
                         bordercolor=COR_BORDA, lightcolor=COR_BORDA,
                         darkcolor=COR_BORDA, padding=5)
        estilo.map("Dark.TCombobox",
                   fieldbackground=[("readonly", COR_CARD), ("disabled", COR_BG)],
                   foreground=[("readonly", COR_TEXTO), ("disabled", COR_MUTED)])

    # ---- Helpers de UI -----------------------------------------------------

    def _card(self, titulo):
        cab = tk.Label(self.root, text=titulo, bg=COR_BG, fg=COR_MUTED,
                       font=(FONTE, 9, "bold"), anchor="w")
        cab.pack(fill="x", padx=24, pady=(10, 2))
        card = tk.Frame(self.root, bg=COR_CARD, highlightbackground=COR_BORDA,
                        highlightthickness=1)
        card.pack(fill="x", padx=24)
        inner = tk.Frame(card, bg=COR_CARD, padx=14, pady=12)
        inner.pack(fill="x")
        return inner

    def _check(self, parent, texto, var, comando):
        cb = tk.Checkbutton(parent, text=texto, variable=var, command=comando,
                            bg=COR_CARD, fg=COR_TEXTO, selectcolor=COR_BG,
                            activebackground=COR_CARD, activeforeground=COR_TEXTO,
                            font=(FONTE, 10, "bold"), anchor="w",
                            highlightthickness=0, bd=0, cursor="hand2")
        cb.pack(fill="x")
        return cb

    def _combo(self, parent, valores, padrao, estado="readonly"):
        var = tk.StringVar(value=padrao)
        cb = ttk.Combobox(parent, textvariable=var, values=valores,
                          state=estado, style="Dark.TCombobox", font=(FONTE, 10))
        cb.pack(fill="x", pady=(2, 0))
        return var, cb

    def _rotulo(self, parent, texto):
        tk.Label(parent, text=texto, bg=COR_CARD, fg=COR_MUTED,
                 font=(FONTE, 8), anchor="w").pack(fill="x", pady=(8, 0))

    # ---- Interface ---------------------------------------------------------

    def _montar_interface(self):
        self._estilo_combos()

        cab = tk.Frame(self.root, bg=COR_BG)
        cab.pack(fill="x", padx=24, pady=(20, 0))
        tk.Label(cab, text="🎥  Gravador de Tela", bg=COR_BG, fg=COR_TEXTO,
                 font=(FONTE, 18, "bold")).pack(anchor="w")
        tk.Label(cab, text="Tela • áudio • webcam — você escolhe.",
                 bg=COR_BG, fg=COR_MUTED, font=(FONTE, 9)).pack(anchor="w")

        # --- Card: O que capturar ---
        cap = self._card("O QUE CAPTURAR")
        self.var_audio = tk.BooleanVar(value=False)
        self.var_webcam = tk.BooleanVar(value=False)

        self._check(cap, "🎙  Áudio (microfone)", self.var_audio, self._toggle_audio)
        self._rotulo(cap, "Microfone")
        mics = self._mic_nomes if self._mic_nomes else ["(nenhum microfone detectado)"]
        self.var_mic, self.cb_mic = self._combo(cap, mics, mics[0], estado="disabled")

        tk.Frame(cap, bg=COR_BORDA, height=1).pack(fill="x", pady=10)

        self._check(cap, "📷  Webcam (aparece na tela)", self.var_webcam, self._toggle_webcam)
        linha = tk.Frame(cap, bg=COR_CARD)
        linha.pack(fill="x")
        col1 = tk.Frame(linha, bg=COR_CARD); col1.pack(side="left", fill="x", expand=True, padx=(0, 6))
        col2 = tk.Frame(linha, bg=COR_CARD); col2.pack(side="left")
        self._rotulo(col1, "Câmera")
        cams = self._cam_nomes if self._cam_nomes else ["Câmera 1"]
        self.var_cam, self.cb_cam = self._combo(col1, cams, cams[0], estado="disabled")
        self.cb_cam.bind("<<ComboboxSelected>>", lambda e: self._reabrir_webcam())
        self._rotulo(col2, "Tamanho")
        self.var_cam_tam, self.cb_tam = self._combo(col2, list(TAMANHOS_CAM.keys()),
                                                    TAM_CAM_PADRAO, estado="disabled")
        self.cb_tam.configure(width=10)
        self.cb_tam.bind("<<ComboboxSelected>>", lambda e: self._reabrir_webcam())
        self.lbl_dica_cam = tk.Label(cap, text="", bg=COR_CARD, fg=COR_AZUL,
                                     font=(FONTE, 8), anchor="w")
        self.lbl_dica_cam.pack(fill="x", pady=(6, 0))

        # --- Card: Vídeo ---
        vid = self._card("VÍDEO")
        self._rotulo(vid, "Monitor (modo tela inteira)")
        opcoes_mon = ["Todos os monitores"] + [
            m["nome"] + (" — principal" if m["principal"] else "")
            for m in self.monitores]
        self.var_monitor, _ = self._combo(vid, opcoes_mon, opcoes_mon[0])
        linha2 = tk.Frame(vid, bg=COR_CARD); linha2.pack(fill="x")
        cqa = tk.Frame(linha2, bg=COR_CARD); cqa.pack(side="left", fill="x", expand=True, padx=(0, 6))
        cqb = tk.Frame(linha2, bg=COR_CARD); cqb.pack(side="left")
        self._rotulo(cqa, "Qualidade")
        self.var_qualidade, _ = self._combo(cqa, list(QUALIDADES.keys()), QUALIDADE_PADRAO)
        self._rotulo(cqb, "FPS")
        self.var_fps, cbfps = self._combo(cqb, FPS_OPCOES, FPS_PADRAO)
        cbfps.configure(width=6)

        # --- Botões de ação ---
        acoes = tk.Frame(self.root, bg=COR_BG)
        acoes.pack(fill="x", padx=24, pady=(14, 4))
        criar_botao(acoes, "🔴  Gravar tela inteira", COR_REC, COR_REC_H,
                    self.gravar_tela_inteira).pack(fill="x", pady=4)
        criar_botao(acoes, "⬚  Selecionar região", COR_AZUL, COR_AZUL_H,
                    self.gravar_regiao).pack(fill="x", pady=4)

        self.var_controle = tk.BooleanVar(value=True)
        tk.Checkbutton(
            self.root, text="Mostrar controle flutuante (gravar/parar) na tela",
            variable=self.var_controle, command=self._toggle_controle,
            bg=COR_BG, fg=COR_MUTED, selectcolor=COR_BG, activebackground=COR_BG,
            activeforeground=COR_TEXTO, font=(FONTE, 8), cursor="hand2",
            bd=0, highlightthickness=0, anchor="w"
        ).pack(fill="x", padx=24, pady=(2, 0))

        rodape = tk.Frame(self.root, bg=COR_BG)
        rodape.pack(fill="x", padx=24, pady=(4, 4))
        criar_botao(rodape, "📁  Abrir pasta das gravações", COR_NEUTRO,
                    COR_NEUTRO_H, self.abrir_pasta, fg=COR_TEXTO).pack(side="left",
                    fill="x", expand=True, padx=(0, 6))
        criar_botao(rodape, "Sair", COR_NEUTRO, COR_NEUTRO_H, self._encerrar,
                    fg=COR_MUTED).pack(side="left")

        self.lbl_status = tk.Label(self.root, text="", bg=COR_BG, fg=COR_MUTED,
                                   font=(FONTE, 8), justify="left", wraplength=420)
        self.lbl_status.pack(fill="x", padx=24, pady=(6, 12))
        self._atualizar_status()

    def _atualizar_status(self):
        partes = ["FFmpeg: OK" if self.ffmpeg else "FFmpeg: NÃO encontrado"]
        if not TEM_CV2:
            partes.append("webcam off (OpenCV ausente)")
        elif not self._cam_nomes:
            partes.append("nenhuma câmera detectada")
        if not self._mic_nomes:
            partes.append("nenhum microfone detectado")
        if not TEM_KEYBOARD and not TEM_TRAY:
            partes.append("use a janelinha p/ parar")
        self.lbl_status.config(text="   •   ".join(partes))

    # ---- Toggles de captura ------------------------------------------------

    def _toggle_audio(self):
        if self.var_audio.get() and not self._mic_nomes:
            messagebox.showwarning(
                "Sem microfone",
                "Nenhum microfone foi detectado pelo FFmpeg. Verifique se há um "
                "microfone conectado/ativado no Windows.")
            self.var_audio.set(False)
            return
        self.cb_mic.configure(state="readonly" if self.var_audio.get() else "disabled")

    def _toggle_webcam(self):
        if self.var_webcam.get():
            if not (TEM_CV2 and TEM_PIL):
                messagebox.showwarning(
                    "Webcam indisponível",
                    "A webcam precisa do OpenCV. Instale com:\n\n"
                    "    pip install opencv-python-headless\n\n"
                    "(ou use a versão instalada do programa, que já inclui).")
                self.var_webcam.set(False)
                return
            self.cb_cam.configure(state="readonly")
            self.cb_tam.configure(state="readonly")
            self._reabrir_webcam()
            self.lbl_dica_cam.config(
                text="Arraste a janelinha. Se a imagem não bater com o nome, "
                     "escolha outra câmera (o preview é ao vivo).")
        else:
            self.cb_cam.configure(state="disabled")
            self.cb_tam.configure(state="disabled")
            self.lbl_dica_cam.config(text="")
            self._fechar_webcam()

    def _reabrir_webcam(self):
        if not self.var_webcam.get():
            return
        self._fechar_webcam()
        idx = 0
        if self._cam_nomes and self.var_cam.get() in self._cam_nomes:
            idx = self._cam_nomes.index(self.var_cam.get())
        larg, alt = TAMANHOS_CAM.get(self.var_cam_tam.get(), (280, 210))
        try:
            self.webcam = WebcamOverlay(self.root, idx, larg, alt,
                                        ao_fechar=self._webcam_fechada_pelo_usuario)
        except Exception as e:
            messagebox.showerror("Erro na webcam", str(e))
            self.var_webcam.set(False)
            self._toggle_webcam()

    def _webcam_fechada_pelo_usuario(self):
        """Chamado pelo ✕ da janelinha: desmarca a flag e fecha a câmera."""
        self.var_webcam.set(False)
        self.cb_cam.configure(state="disabled")
        self.cb_tam.configure(state="disabled")
        self.lbl_dica_cam.config(text="")
        self._fechar_webcam()

    def _fechar_webcam(self):
        if self.webcam:
            self.webcam.fechar()
            self.webcam = None

    def abrir_pasta(self):
        pasta = pasta_saida()
        try:
            os.makedirs(pasta, exist_ok=True)
            os.startfile(pasta)
        except Exception as e:
            messagebox.showerror("Erro", f"Não consegui abrir a pasta:\n{e}")

    # ---- Controle flutuante ------------------------------------------------

    def _toggle_controle(self):
        if self.var_controle.get():
            self._mostrar_controle()
        else:
            self._fechar_controle()

    def _mostrar_controle(self):
        if self.controle is None:
            self.controle = ControleFlutuante(self.root, self._toggle_gravacao_rapido)
        self.controle.definir_estado(self.gravando)

    def _fechar_controle(self):
        if self.controle:
            self.controle.fechar()
            self.controle = None

    def _toggle_gravacao_rapido(self):
        """Clique no controle flutuante: para se gravando, senão grava a tela."""
        if self.gravando:
            self.parar_gravacao()
        else:
            self.gravar_tela_inteira()

    # ---- Verificações ------------------------------------------------------

    def _garantir_ffmpeg(self):
        if self.ffmpeg:
            return True
        if not messagebox.askyesno(
            "FFmpeg não encontrado",
            "Não encontrei o FFmpeg.\n\nDeseja localizar o ffmpeg.exe manualmente?"):
            return False
        caminho = filedialog.askopenfilename(
            title="Selecione o ffmpeg.exe",
            filetypes=[("Executável", "*.exe"), ("Todos os arquivos", "*.*")])
        if caminho and os.path.isfile(caminho):
            self.ffmpeg = caminho
            self._enumerar_dispositivos()
            self._atualizar_status()
            return True
        return False

    # ---- Fluxos de gravação -----------------------------------------------

    def gravar_tela_inteira(self):
        if not self._garantir_ffmpeg():
            return
        escolha = self.var_monitor.get()
        if escolha.startswith("Todos"):
            regiao = limites_virtuais(self.monitores)
        else:
            regiao = limites_virtuais(self.monitores)
            for m in self.monitores:
                if escolha.startswith(m["nome"]):
                    regiao = (m["x"], m["y"], m["largura"], m["altura"])
                    break
        self._iniciar_gravacao(regiao)

    def gravar_regiao(self):
        if not self._garantir_ffmpeg():
            return
        self.root.withdraw()
        self.root.update()
        seletor = SeletorRegiao(self.root, self.monitores)
        self.root.wait_window(seletor.top)
        self.root.deiconify()
        if seletor.resultado is None:
            return
        self._iniciar_gravacao(seletor.resultado)

    # ---- Motor de gravação -------------------------------------------------

    def _iniciar_gravacao(self, regiao):
        x, y, w, h = regiao
        w, h = ajustar_par(w), ajustar_par(h)
        if w < 16 or h < 16:
            messagebox.showerror("Região inválida", "A região é pequena demais.")
            return

        pasta = pasta_saida()
        try:
            os.makedirs(pasta, exist_ok=True)
        except Exception as e:
            messagebox.showerror("Erro", f"Não consegui criar a pasta:\n{e}")
            return

        carimbo = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        self.saida_caminho = os.path.join(pasta, f"gravacao_{carimbo}.mp4")
        self.log_caminho = os.path.join(pasta, "ffmpeg_ultimo.log")

        q = QUALIDADES.get(self.var_qualidade.get(), QUALIDADES[QUALIDADE_PADRAO])
        fps = self.var_fps.get() if self.var_fps.get() in FPS_OPCOES else FPS_PADRAO
        usar_audio = self.var_audio.get() and bool(self._mic_nomes)
        mic = self.var_mic.get() if usar_audio else None

        # Monta o comando do FFmpeg.
        cmd = [self.ffmpeg, "-y",
               "-thread_queue_size", "1024",
               "-f", "gdigrab", "-framerate", fps,
               "-offset_x", str(int(x)), "-offset_y", str(int(y)),
               "-video_size", f"{w}x{h}", "-draw_mouse", "1",
               "-i", "desktop"]
        if usar_audio:
            # use_wallclock alinha o relógio do microfone ao da captura de tela.
            cmd += ["-thread_queue_size", "1024", "-rtbufsize", "256M",
                    "-use_wallclock_as_timestamps", "1",
                    "-f", "dshow", "-i", f"audio={mic}"]
        cmd += ["-c:v", "libx264", "-preset", q["preset"], "-crf", q["crf"],
                "-pix_fmt", "yuv420p"]
        if usar_audio:
            # aresample corrige a deriva do áudio ao longo da gravação.
            cmd += ["-c:a", "aac", "-b:a", "160k", "-af", "aresample=async=1000"]
        # Vídeo em taxa de quadros constante (CFR) mantém a sincronia estável.
        cmd += ["-fps_mode", "cfr", "-r", fps,
                "-movflags", "+faststart", self.saida_caminho]

        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        try:
            self.log_arquivo = open(self.log_caminho, "w",
                                    encoding="utf-8", errors="replace")
            self.proc = subprocess.Popen(
                cmd, stdin=subprocess.PIPE, stdout=self.log_arquivo,
                stderr=subprocess.STDOUT, creationflags=flags)
        except Exception as e:
            messagebox.showerror("Erro ao iniciar o FFmpeg", str(e))
            self._fechar_log()
            return

        self.gravando = True
        self.inicio_ts = datetime.datetime.now()
        self._pedido_parar.clear()

        # Esconde a interface do app; mantém só a webcam (é conteúdo).
        self.root.withdraw()
        if self.webcam:
            self.webcam.definir_modo_gravacao(True)   # some o ✕ e reforça o topo
        if self.controle:
            self.controle.definir_estado(True, 0)

        # Indicador na tela só como fallback (sem controle, bandeja nem atalho).
        self._mostrar_indicador = not (self.controle or self.tray_ativo or TEM_KEYBOARD)
        if self._mostrar_indicador:
            self.indicador = IndicadorGravacao(self.root, self.parar_gravacao)
        elif self.tray_ativo and self.tray:
            try:
                self.tray.notify(
                    f"Gravando… aperte {HOTKEY_PARAR.upper()} para parar.",
                    "Gravador de Tela")
            except Exception:
                pass

        self._registrar_hotkey()
        self.root.after(1500, self._verificar_inicio)
        self.root.after(150, self._poll_parada)
        self.root.after(250, self._atualizar_timer)

    def _verificar_inicio(self):
        if not self.gravando or self.proc is None:
            return
        if self.proc.poll() is not None and self.proc.returncode not in (0, None):
            self.gravando = False
            self._fechar_log()
            if self.indicador:
                self.indicador.fechar(); self.indicador = None
            self._remover_hotkey()
            self._voltar_apos_gravar()
            messagebox.showerror(
                "Falha ao iniciar a gravação",
                "O FFmpeg encerrou logo após iniciar.\n\n" + self._ultimas_linhas_log())

    def _poll_parada(self):
        if not self.gravando:
            return
        if self._pedido_parar.is_set():
            self.parar_gravacao()
            return
        self.root.after(150, self._poll_parada)

    def _atualizar_timer(self):
        if not self.gravando:
            return
        segs = 0
        if self.inicio_ts:
            segs = (datetime.datetime.now() - self.inicio_ts).total_seconds()
        if self.indicador:
            self.indicador.atualizar_tempo(segs)
        if self.controle:
            self.controle.definir_estado(True, segs)
        self.root.after(250, self._atualizar_timer)

    def parar_gravacao(self):
        if not self.gravando:
            return
        self.gravando = False
        self._remover_hotkey()

        if self.proc is not None:
            try:
                self.proc.stdin.write(b"q")
                self.proc.stdin.flush()
            except Exception:
                pass
            try:
                self.proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                self.proc.terminate()
                try:
                    self.proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self.proc.kill()

        self._fechar_log()
        if self.indicador:
            self.indicador.fechar()
            self.indicador = None
        self._voltar_apos_gravar()

        if os.path.isfile(self.saida_caminho) and os.path.getsize(self.saida_caminho) > 0:
            if messagebox.askyesno(
                "Gravação salva",
                f"Vídeo salvo em:\n{self.saida_caminho}\n\nAbrir a pasta?"):
                try:
                    os.startfile(os.path.dirname(self.saida_caminho))
                except Exception:
                    pass
        else:
            messagebox.showerror(
                "Falha ao salvar",
                "O vídeo não foi gerado.\n\n" + self._ultimas_linhas_log())

    # ---- Atalho global -----------------------------------------------------

    def _registrar_hotkey(self):
        if not TEM_KEYBOARD:
            return
        try:
            self._hotkey_handle = keyboard.add_hotkey(
                HOTKEY_PARAR, lambda: self._pedido_parar.set())
        except Exception:
            self._hotkey_handle = None

    def _remover_hotkey(self):
        if not TEM_KEYBOARD:
            return
        try:
            if self._hotkey_handle is not None:
                keyboard.remove_hotkey(self._hotkey_handle)
        except Exception:
            try:
                keyboard.clear_all_hotkeys()
            except Exception:
                pass
        self._hotkey_handle = None

    # ---- Log ---------------------------------------------------------------

    def _fechar_log(self):
        if self.log_arquivo:
            try:
                self.log_arquivo.close()
            except Exception:
                pass
            self.log_arquivo = None

    def _ultimas_linhas_log(self, n=18):
        try:
            with open(self.log_caminho, "r", encoding="utf-8", errors="replace") as f:
                linhas = f.readlines()
            trecho = "".join(linhas[-n:]).strip()
            return f"Detalhes (ffmpeg_ultimo.log):\n\n{trecho}" if trecho \
                else f"Veja o log em:\n{self.log_caminho}"
        except Exception:
            return f"Veja o log em:\n{self.log_caminho}"

    # ---- Bandeja do sistema ------------------------------------------------

    def _imagem_tray(self):
        tam = 64
        img = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.ellipse([6, 6, tam - 6, tam - 6], fill=(226, 59, 59, 255))
        return img

    def _iniciar_tray(self):
        if not TEM_TRAY:
            self.tray_ativo = False
            return
        menu = pystray.Menu(
            pystray.MenuItem("Abrir janela", self._tray_abrir, default=True),
            pystray.MenuItem("Gravar tela inteira", self._tray_tela_inteira),
            pystray.MenuItem("Selecionar região", self._tray_regiao),
            pystray.MenuItem("Parar gravação", self._tray_parar),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sair", self._tray_sair),
        )
        try:
            self.tray = pystray.Icon("gravador_tela", self._imagem_tray(),
                                     "Gravador de Tela", menu)
            threading.Thread(target=self.tray.run, daemon=True).start()
            self.tray_ativo = True
        except Exception:
            self.tray = None
            self.tray_ativo = False

    def _tray_abrir(self, icon=None, item=None):
        self.fila.put(self._mostrar_janela)

    def _tray_tela_inteira(self, icon=None, item=None):
        self.fila.put(self.gravar_tela_inteira)

    def _tray_regiao(self, icon=None, item=None):
        self.fila.put(self.gravar_regiao)

    def _tray_parar(self, icon=None, item=None):
        self._pedido_parar.set()

    def _tray_sair(self, icon=None, item=None):
        self.fila.put(self._encerrar)

    def _processar_fila(self):
        try:
            while True:
                self.fila.get_nowait()()
        except queue.Empty:
            pass
        self.root.after(120, self._processar_fila)

    def _mostrar_janela(self):
        self.root.deiconify()
        self.root.lift()
        self.root.attributes("-topmost", True)
        self.root.after(300, lambda: self.root.attributes("-topmost", False))
        self.root.focus_force()

    def _ao_fechar_janela(self):
        if self.gravando:
            self.root.withdraw()
            return
        if self.tray_ativo:
            self.root.withdraw()
            if not self._avisou_bandeja:
                self._avisou_bandeja = True
                try:
                    self.tray.notify(
                        "O Gravador continua aqui na bandeja. "
                        "Clique no ícone para abrir.", "Gravador de Tela")
                except Exception:
                    pass
        else:
            self._encerrar()

    def _voltar_apos_gravar(self):
        if self.webcam:
            self.webcam.definir_modo_gravacao(False)   # volta o ✕
        if self.controle:
            self.controle.definir_estado(False)
        if self.tray_ativo:
            self.root.withdraw()
        else:
            self.root.deiconify()

    def _encerrar(self):
        self._fechar_webcam()
        self._fechar_controle()
        try:
            if self.tray:
                self.tray.stop()
        except Exception:
            pass
        try:
            self.root.destroy()
        except Exception:
            pass

    # ---- Loop principal ----------------------------------------------------

    def executar(self):
        self._iniciar_tray()
        if self.var_controle.get():
            self._mostrar_controle()
        self.root.after(120, self._processar_fila)
        self.root.mainloop()


def main():
    if os.name != "nt":
        print("Aviso: este programa usa gdigrab e foi feito para o Windows.")
    GravadorApp().executar()


if __name__ == "__main__":
    main()
