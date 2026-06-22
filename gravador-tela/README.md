# 🎥 Gravador de Tela (Windows)

Programa em Python que grava a tela em vídeo **MP4 (H.264)**, com duas opções:

- **Tela inteira** (todos os monitores, ou um monitor específico), ou
- **Selecionar uma região** arrastando o mouse, no estilo do Lightshot — a tela
  escurece levemente e você desenha um retângulo sobre a área a gravar.

Flags de captura: **áudio (microfone)** e **webcam ao vivo** (uma janelinha
com moldura que você arrasta para onde quiser e que aparece no vídeo, estilo
OBS). Interface escura com seletores de **Qualidade** e **FPS**, **ícone na
bandeja**, atalho global **Ctrl+Alt+S** para parar (a interface do app some
durante a gravação), botão para **abrir a pasta**, e — se quiser — um
**instalador** com FFmpeg + tudo embutido para compartilhar com amigos.

> ⚠️ **Funciona apenas no Windows** (depende do `gdigrab`).

---

## 📁 Conteúdo da pasta

| Arquivo | Para que serve |
|---|---|
| `gravador_tela.py` | Programa principal (comentado). |
| `requirements.txt` | Dependências para **rodar** (`screeninfo`, `keyboard`). |
| `requirements-build.txt` | Dependências para **empacotar** (`pyinstaller`, `pillow`). |
| `gerar_icone.py` | Gera o `icon.ico` do app. |
| `build.ps1` | Gera o `.exe` (PyInstaller) + copia o FFmpeg → pasta `dist`. |
| `installer.iss` | Script do Inno Setup para gerar o instalador. |
| `README.md` | Este guia. |

---

# PARTE 1 — Rodar no seu PC (desenvolvimento)

## 1) Instalar o Python

1. Baixe em <https://www.python.org/downloads/windows/> (3.9+).
2. **Marque “Add Python to PATH”** no instalador.
3. Confirme: `python --version`.

## 2) Instalar as dependências

```powershell
cd <pasta-do-projeto>\gravador-tela
pip install -r requirements.txt
```

- `Tkinter` já vem com o Python.
- `keyboard` é para o atalho global Ctrl+Alt+S. Sem ela, use o botão **Parar**.

## 3) Instalar o FFmpeg

O FFmpeg é um programa **externo**. Mais fácil (Windows 10/11):

```powershell
winget install Gyan.FFmpeg
```

Feche e reabra o PowerShell e teste: `ffmpeg -version`.

> Alternativas (download manual, PATH, ou caminho fixo) na seção **Solução de
> problemas** mais abaixo.

## 4) Executar

```powershell
python gravador_tela.py
```

---

## 5) Como usar

- **Configurações** (na janela): escolha o **Monitor** (modo tela inteira), a
  **Qualidade** e os **FPS** antes de gravar.
- **Gravar tela inteira:** clique no botão vermelho.
- **Selecionar região:** clique no botão azul → a tela escurece → **clique e
  arraste** → **solte** para confirmar. **Esc** cancela.
- **Parar:** **Ctrl+Alt+S** (de qualquer janela) **ou** o botão **Parar** na
  janelinha “● Gravando”.

### Áudio e webcam (flags de captura)

No card **“O que capturar”** você liga o que quiser antes de gravar:

- **🎙 Áudio (microfone):** marque e escolha o microfone na lista. A narração
  entra no vídeo (faixa AAC). *Som do sistema* não é capturado nesta versão.
- **📷 Webcam:** marque e uma **janelinha com a câmera ao vivo** abre na tela.
  **Arraste-a** para o canto que quiser — ela fica sempre por cima e é gravada
  junto com a tela (o que você vê é o que sai no vídeo). Dá para escolher a
  **câmera** e o **tamanho** (Pequena/Média/Grande).

> Combinações livres: só tela, tela + áudio, tela + webcam, ou tela + áudio +
> webcam. É só marcar/desmarcar as flags.

### Enquanto grava

A janela do programa **some** durante a gravação (para não aparecer no vídeo).
Para **parar**, use qualquer um destes:

- O **controle flutuante** (pílula discreta no canto): mostra **■ + cronômetro**
  durante a gravação — clique para parar. Quando parado mostra **●** — clique para
  gravar a tela inteira. Arraste pelo **⋮⋮** para reposicionar. Dá para
  escondê-lo no checkbox *“Mostrar controle flutuante”* do painel.
- O atalho **Ctrl+Alt+S**.
- O menu da **bandeja → Parar gravação**.

A janelinha da webcam continua visível de propósito (faz parte do vídeo).

### Bandeja do sistema (ícone perto do relógio)

O programa fica com um **ícone vermelho na bandeja** do Windows:

- **Clique no ícone** → abre a janela.
- **Clique com o botão direito** → menu rápido: *Gravar tela inteira*,
  *Selecionar região*, *Parar gravação* e *Sair*.
- **Fechar a janela (X)** apenas **recolhe para a bandeja** (não encerra). Para
  encerrar de verdade, use *Sair* (no botão da janela ou no menu da bandeja).

> 💡 **Deixar o ícone sempre visível:** por padrão o Windows esconde ícones
> novos no menu de estouro (a setinha **˄**). Para fixá-lo ao lado do relógio,
> arraste o ícone da setinha **˄** para a barra — ou vá em
> *Configurações → Personalização → Barra de tarefas → Outros ícones da bandeja*
> e ligue o **Gravador de Tela**.

### Qualidade do vídeo

| Opção | Quando usar | Detalhe técnico |
|---|---|---|
| **Alta (recomendada)** | Uso geral, ótimo nível de nitidez | `crf 18`, preset `veryfast` |
| **Máxima (nitidez total)** | Textos pequenos, telas detalhadas | `crf 15`, preset `faster` (arquivos maiores) |
| **Leve (arquivo menor)** | Vídeos longos / espaço limitado | `crf 24`, preset `veryfast` |

> Dica: para vídeo com **movimento** (jogos, animações), selecione **60 FPS**.
> `crf` menor = melhor qualidade e arquivo maior.

### Onde os vídeos ficam

Na pasta **`Vídeos\Gravador de Tela`** do seu usuário, com nome por data/hora:

```
C:\Users\<você>\Videos\Gravador de Tela\gravacao_2026-06-19_14-32-10.mp4
```

(O programa pergunta se quer **abrir a pasta** ao terminar.)

---

# PARTE 2 — Empacotar e distribuir para amigos

Aqui geramos um **instalador** (`GravadorDeTela-Setup.exe`) que já inclui o
FFmpeg. Seus amigos só dão duplo-clique e usam — **sem Python e sem FFmpeg**.

## Passo A — Gerar o executável (PyInstaller)

Na pasta do projeto, no PowerShell:

```powershell
.\build.ps1
```

O script faz tudo: instala as dependências de build, gera o ícone, empacota com
o PyInstaller e copia o `ffmpeg.exe` (do seu sistema) para a pasta `dist`.

Ao final você terá uma **versão portátil**:

```
dist\GravadorDeTela.exe
dist\ffmpeg.exe
```

> Já dá para **zipar a pasta `dist`** e enviar a alguém — é portátil. Mas o
> instalador (abaixo) é mais “bonito” e cria atalhos.

> Se aparecer erro de execução de script no PowerShell, rode uma vez:
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` e tente de novo.

## Passo B — Gerar o instalador (Inno Setup)

1. Instale o **Inno Setup** (grátis): <https://jrsoftware.org/isdl.php>
2. Gere o instalador de uma destas formas:
   - Abra o `installer.iss` no Inno Setup e clique em **Compile** (ou **F9**), ou
   - Pela linha de comando:
     ```powershell
     & "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
     ```
3. O instalador sai em:
   ```
   Output\GravadorDeTela-Setup.exe
   ```

Mande esse arquivo para seus amigos. Ao instalar, ele cria atalhos no Menu
Iniciar (e, opcionalmente, na Área de Trabalho).

> **Aviso do Windows SmartScreen:** como o `.exe` não é assinado digitalmente,
> na primeira execução pode aparecer “O Windows protegeu o seu computador”.
> Basta clicar em **Mais informações → Executar assim mesmo**. (Para remover
> esse aviso seria necessário um certificado de assinatura de código pago.)

---

## 6) Configurações rápidas (no `gravador_tela.py`)

| Constante | Padrão | O que faz |
|---|---|---|
| `QUALIDADES` | 3 perfis | Mapas de `crf`/`preset` do x264. |
| `FPS_OPCOES` | `["30","60"]` | Opções de taxa de quadros. |
| `HOTKEY_PARAR` | `"ctrl+alt+s"` | Atalho global de parada. |
| `NOME_PASTA_SAIDA` | `"Gravador de Tela"` | Subpasta dentro de “Vídeos”. |
| `FFMPEG_CAMINHO_MANUAL` | `""` | Caminho fixo do `ffmpeg.exe`, se quiser. |

Detalhes técnicos:
- Áudio/microfone **não** são capturados nesta versão (apenas vídeo).
- A região é ajustada para ter **largura e altura pares** (exigência do H.264).
- A parada envia `q` ao FFmpeg, **finalizando o MP4 corretamente**.

---

## 7) Solução de problemas

| Problema | Solução |
|---|---|
| **“FFmpeg: NÃO encontrado”** | Instale o FFmpeg (seção 3) ou aponte o caminho. Na versão instalada, o `ffmpeg.exe` já vem junto. |
| **Janela some e nada grava** | Veja `Vídeos\Gravador de Tela\ffmpeg_ultimo.log` (o programa mostra as últimas linhas do erro). |
| **Ctrl+Alt+S não para** | Instale `keyboard` (`pip install keyboard`) ou use o botão **Parar**. Se preciso, rode o terminal **como Administrador**. |
| **2º monitor sai preto** | Em arranjos com monitor à **esquerda/acima** do principal (coordenadas negativas), o `gdigrab` pode falhar. Grave **por monitor** ou **selecione região**. |
| **Vídeo “fechado” demais / pesado** | Ajuste a **Qualidade** na janela (Leve ↔ Máxima). |
| **Webcam preta / não abre** | Outro app pode estar usando a câmera (feche-o). Tente outra opção em **Câmera**. Sem webcam no PC, a opção fica indisponível. |
| **Sem som no vídeo** | Confira o **microfone** certo na lista e o volume de entrada no Windows. |
| **Áudio dessincronizado** | Em PCs mais lentos pode haver pequeno atraso; tente **Qualidade “Leve”** e **30 FPS**. |
| **Webcam falha no `.exe` instalado** | Recompile garantindo `--collect-all cv2` no `build.ps1` (já incluso). |
| **PowerShell bloqueia o `build.ps1`** | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`. |

### Instalar o FFmpeg manualmente (sem winget)

1. Baixe o **“ffmpeg-release-essentials.zip”** em
   <https://www.gyan.dev/ffmpeg/builds/> e extraia, ex.: `C:\ffmpeg`.
2. Adicione `C:\ffmpeg\bin` ao **PATH** (Iniciar → “variáveis de ambiente” →
   Variáveis do sistema → `Path` → Editar → Novo).
3. Feche/reabra o terminal e teste `ffmpeg -version`.
   - Alternativa sem PATH: copie o `ffmpeg.exe` para a pasta do programa, ou
     defina `FFMPEG_CAMINHO_MANUAL` no `gravador_tela.py`.

---

## ✅ Validação na sua máquina

1. `python gravador_tela.py` → rodapé deve mostrar **“FFmpeg: OK”**.
2. **Selecionar região**, gravar ~5–10s, parar com **Ctrl+Alt+S**.
3. Abrir o MP4 em `Vídeos\Gravador de Tela` e conferir nitidez/área.
4. Testar **tela inteira** e as diferentes **qualidades/FPS**.
5. (Distribuição) `.\build.ps1` → testar `dist\GravadorDeTela.exe` →
   compilar `installer.iss` → instalar o `Setup.exe` numa conta/máquina limpa.
