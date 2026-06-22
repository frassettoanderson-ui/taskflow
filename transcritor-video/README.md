# Transcritor de vídeos do YouTube (local e gratuito)

Script de linha de comando que baixa o **áudio** de um vídeo do YouTube e gera
um arquivo `.txt` com a transcrição em **português**. Tudo roda **localmente em
CPU**, sem usar nenhuma API paga.

- Download do áudio: [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) + `ffmpeg`
- Transcrição: [`faster-whisper`](https://github.com/SYSTRAN/faster-whisper)
  (mais rápido e leve que o Whisper original; roda bem em CPU)
- A transcrição vem **sempre do áudio** (nunca das legendas do YouTube), então
  funciona inclusive em vídeos sem legenda.

---

## ⭐ Início rápido no Windows (rodar no seu PC)

A forma mais fácil, **sem mexer em terminal**:

1. Abra a pasta `transcritor-video`.
2. Dê **duplo-clique em `transcrever.bat`**.
3. **Cole o link** do YouTube e tecle **Enter**.

Ele baixa, transcreve e **abre sozinho** a pasta `transcricoes/` com o `.txt`.

> Neste PC já está tudo instalado e testado (Python, `yt-dlp`, `faster-whisper`
> e `ffmpeg`). No seu IP residencial o YouTube **não** pede login — então aqui
> **não precisa de cookies**.

Pelo terminal (opcional), com mais opções:

```
transcrever.bat "https://youtu.be/XXXX"
transcrever.bat "https://youtu.be/XXXX" --modelo small   # mais rápido
transcrever.bat "URL" --manter-audio
```

O padrão é o modelo `medium` (mais preciso); use `--modelo small` se quiser mais
velocidade. As seções abaixo (instalação via `apt`, VPS, etc.) são para
**Linux/servidor** ou para instalar do zero em outra máquina.

---

## 1. Instalação

### Dependências do sistema (ffmpeg)

No Linux (Debian/Ubuntu/VPS):

```bash
sudo apt update
sudo apt install -y ffmpeg python3-venv
```

Confira: `ffmpeg -version` deve responder.

### Dependências do Python (em um ambiente virtual)

Recomendado usar um `venv` para não bagunçar o Python do sistema:

```bash
cd transcritor-video
python3 -m venv venv
source venv/bin/activate          # no Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

> Na **primeira** transcrição, o `faster-whisper` baixa automaticamente o
> modelo escolhido (o `medium`, padrão, tem ~1,5 GB; o `small` tem ~0,5 GB).
> Os usos seguintes reaproveitam o modelo do cache.

---

## 2. Uso

```bash
python transcrever.py "https://www.youtube.com/watch?v=XXXX"
python transcrever.py "https://youtu.be/XXXX" --modelo medium
python transcrever.py "URL" --manter-audio
```

Argumentos:

| Argumento         | Tipo            | Padrão  | Descrição                                  |
|-------------------|-----------------|---------|--------------------------------------------|
| `url`             | posicional      | —       | URL do vídeo do YouTube (obrigatório).     |
| `--modelo`        | opcional        | `medium`| Modelo do Whisper a usar.                  |
| `--manter-audio`  | flag opcional   | (off)   | Não apaga o áudio temporário ao final.     |
| `--cookies`       | opcional        | —       | Caminho de um `cookies.txt` do YouTube (ver seção 5). |

O resultado é salvo em **`transcricoes/`** (criada automaticamente), com o nome
baseado no título do vídeo. Por exemplo:

```
transcricoes/Como fazer pao caseiro.txt
```

O texto é **corrido**, sem marcações de tempo.

---

## 3. Escolha do modelo e desempenho em CPU

| Modelo     | Qualidade | Velocidade em CPU | Memória  | Quando usar                          |
|------------|-----------|-------------------|----------|--------------------------------------|
| `tiny`     | baixa     | muito rápida      | ~1 GB    | testes rápidos / áudio muito limpo   |
| `base`     | ok        | rápida            | ~1 GB    | rascunhos                            |
| `small`    | boa       | moderada          | ~2 GB    | quando quer mais velocidade          |
| **`medium`**| **ótima**| **lenta**         | ~5 GB    | **padrão — mais precisão**           |
| `large-v3` | a melhor  | muito lenta       | ~10 GB   | só com bastante CPU/RAM              |

Recomendações:

- O padrão é **`medium`**: entrega a melhor precisão em português, ao custo de
  ser mais lento e exigir mais RAM (~5 GB). Use quando a qualidade importa mais
  que o tempo.
- Se precisar de **mais velocidade** (ou a máquina tiver pouca RAM), use
  `--modelo small`: em CPU ele costuma ser **várias vezes** mais rápido que o
  `medium`, ainda com boa qualidade.
- O script usa `compute_type=int8`, que é o mais leve/rápido para CPU.

### Vídeos longos (1h+)

Funciona sem problema: o `faster-whisper` processa o áudio em segmentos e o
script consome esses segmentos em streaming, sem carregar tudo na memória de uma
vez. Para vídeos longos em CPU, se o `medium` ficar lento demais, troque para
`--modelo small` (ou rode em uma máquina com mais núcleos para ganhar
velocidade).

---

## 4. Solução de problemas

- **`ffmpeg não encontrado`** → instale com `sudo apt install -y ffmpeg`.
- **`URL inválida` / `vídeo indisponível`** → confira o link; vídeos privados,
  removidos ou com restrição regional não podem ser baixados.
- **Transcrição vazia** → o áudio pode não ter fala detectável (ex.: vídeo só
  com música/texto na tela).
- **Primeira execução demorada** → é o download do modelo; as próximas usam o
  cache.
- **`Sign in to confirm you're not a bot` / `o YouTube pediu login para este
  IP`** → típico de VPS/servidor. Veja a **seção 5** (rodar com `--cookies`).
- **`vídeo com restrição regional`** → o vídeo está bloqueado no país do
  servidor; tente outro vídeo ou um proxy/VPN.
- **JavaScript runtime** → o `yt-dlp` precisa de um runtime JS (deno/node) para
  alguns vídeos. O script **ativa o `node` automaticamente** se ele estiver
  instalado (`sudo apt install -y nodejs`). Mantenha também o `yt-dlp`
  atualizado: `pip install -U yt-dlp`.

---

## 5. Rodando em VPS/servidor — quando o YouTube pede login

Em servidores (VPS, cloud), o YouTube costuma **bloquear o IP do datacenter** e
responder com `Sign in to confirm you're not a bot`. Isso **não é um erro do
script** — é uma proteção do YouTube contra IPs de servidor. A solução oficial é
fornecer **cookies** de uma conta logada.

Passo a passo:

1. **No seu computador** (navegador onde você está logado no YouTube), instale a
   extensão **"Get cookies.txt LOCALLY"** (Chrome/Edge/Firefox).
2. Abra o `youtube.com` logado e **exporte** o `cookies.txt` (formato Netscape).
3. **Envie o arquivo para a VPS**, por exemplo:

   ```bash
   scp cookies.txt root@SEU_IP:/root/transcritor-video/
   ```

4. **Rode passando os cookies:**

   ```bash
   python transcrever.py "https://youtu.be/XXXX" --cookies cookies.txt
   ```

Dicas:

- Os cookies expiram com o tempo; se voltar a falhar, **exporte de novo**.
- Use de preferência uma **conta secundária** do YouTube (não a principal).
- Alternativa aos cookies: rodar atrás de um **proxy residencial**
  (`yt-dlp` aceita `--proxy`), mas cookies costuma ser o caminho mais simples.
