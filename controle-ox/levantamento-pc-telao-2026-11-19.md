# Automações do PC do telão da OXFITNESS (levantamento de 19/11/2026)

**PC:** DESKTOP-NLQHNPL, rede local 192.168.0.210. Windows 11 Pro, placa de vídeo RX 580 e 16 GB de RAM.

**Como foi feito:** acesso por SSH, só leitura. Nada foi alterado. Foram lidos as tarefas agendadas, a inicialização do Windows, os processos, o histórico de liga/desliga dos últimos 30 dias, a rede e as configurações de OBS, Advanced Scene Switcher, REAPER e Lumikit.

---

## 1. O dia do PC

| Hora | O que acontece | Quem faz |
|---|---|---|
| **04:30** (todos os dias) | O PC liga sozinho | Placa-mãe (BIOS). Não há despertador do Windows. Nos 30 dias do histórico, o PC ligou todo dia às 04:30. |
| 04:30 | O Windows entra e abre OBS, REAPER, Lumikit SHOW, NovaLCT, Chrome, Edge, loopMIDI, AnyDesk, RustDesk, Tailscale, o painel da placa de som e o OX Show | Pasta Inicializar e registro do Windows |
| **04:39** (seg a sex) | Liga a cena 9 da página 1 do Lumikit | Agenda do Lumikit |
| **04:40** (seg a sex) / **07:30** (sáb e dom) | Executa o cue "4:30" (luz do dia) | Agenda do Lumikit |
| O dia todo | O telão roda um vídeo único em loop e a música toca pelo site **Sonvra** | OBS (cena "Painel de Led") |
| **19:00** (todos os dias) | Executa o cue "19:00" (luz da noite) | Agenda do Lumikit |
| **20:59:57 a ~21:01:35** (seg a sex) | **Evento das 21h** (detalhe na seção 2) | REAPER + Lumikit + OBS + COM25 |
| **23:54** (todos os dias) | Regra do Lumikit do tipo 10. Pela ordem das ações dentro do programa, deve ser **"Release all (Desligar tudo)"**, que apaga todas as luzes antes de fechar. Alta probabilidade, falta só olhar a tela. | Agenda do Lumikit |
| **23:55** | Fecha OBS, REAPER, Lumikit, Edge, Chrome e NovaLCT "com educação", espera 20 s e limpa a sessão dos navegadores | Tarefa "Desligar Soft" (`Documents\Desligar Soft.bat`) |
| **00:00** | Desliga o PC na marra (`shutdown -s -f`) | Tarefa "Desligar PC" |

## 2. O evento das 21h, peça por peça

O que dispara tudo é um script no REAPER (`Scripts\play_automatico.lua`). O `__startup.lua` o deixa rodando desde a abertura do REAPER. Às **20:59:57 de segunda a sexta**, ele dá Play no projeto `C:\Automacao\RP OX.rpp`. O projeto tem dois marcadores e duas trilhas:

| Tempo no projeto | Peça | Efeito |
|---|---|---|
| 0 s | Marcador 1 executa `C:\Automacao\chamar_python.lua`, que roda `enviar_cena.py 2` | Manda o comando "cena 2" pela **COM25** (luz ambiente em modo show) |
| 21:00:00 | A agenda do Lumikit executa o cue **"Timeline"** | O Lumikit prepara a timeline "Video": 2425 quadros (~97 s), montada em cima de `Redzone.mp3` |
| 3,5 s | Trilha **"Timecode"**: gerador de timecode por 94,5 s, saindo pelo loopMIDI | O Lumikit roda a timeline de luz sincronizada |
| 3,5 s | Trilha **"OBS"**: nota MIDI (dó central) pelo loopMIDI | A macro "Timecode" do Advanced Scene Switcher troca o OBS para a cena **"Institucional"**, que toca o vídeo *Red Zone Final - Agência Recalcule* com som pela placa MBS16CH |
| 97 s | Marcador 2 executa `chamar_python_cena1.lua`, que roda `enviar_cena.py 1` | Manda o comando "cena 1" pela **COM25** (luz ambiente normal) |
| 97 s depois de trocar de cena | A macro "Retorno" do Advanced Scene Switcher | O OBS volta para a cena "Painel de Led" |
| ~98 s | O REAPER para e volta ao início | Quando o timecode acaba, o Lumikit liga a cena de fim (cena 12, página 1) e para a lista de cenas |

**Corrente de dependências:** REAPER, loopMIDI, Lumikit e OBS com o Advanced Scene Switcher, mais Python e a COM25. Se um deles não estiver aberto ou travar, o evento falha em parte.

**Correção do que se sabia antes:** as tarefas `Mudar_Para_Cena_1` (19:00) e `Mudar_Para_Cena_2` (22:00) **não existem mais**. O `agendar_cenas.bat` que as criava continua em `C:\Automacao`, mas não está ativo. Hoje a COM25 só muda durante o evento das 21h.

## 3. Telão (OBS + LED NovaStar)

**Cenas do OBS:**
- **Painel de Led** é a que fica no ar o dia todo. Tem:
  - o vídeo `Documents\videos telao\26.10.2026 telao int03333.mp4` em loop (1,7 GB, trocado em 17/11). Institucional e patrocinadores estão **editados juntos num arquivo só**;
  - o som do Edge com o site **Sonvra**, que é a música da academia.
- **Institucional:** vídeo Red Zone, usado só no evento das 21h.
- **Sorteio:** página `oxcloudbr.com.br/sorteio` (o sorteador do OX Cloud).
- **Centro, Faixa Esquerda, Faixa Direita e Faixa Baixo:** cenas vazias.

**Painel de LED:**
- É da NovaStar. O NovaLCT V5.9.2 e o MarsServerProvider ficam abertos e conversam com **3 aparelhos na rede**: 192.168.0.230, .240 e .244, porta 5200.
- O vídeo sai da RX 580 por duas saídas: um monitor "HDMI" e um aparelho NovaStar ("HDMI2.0").
- **Confirmado pelo usuário em 19/11:** o LED está ligado no PC pelo HDMI e funciona como **segunda tela** do Windows. O OBS mostra a imagem nessa tela.

## 4. Som

- A placa de som é a USB **Meibaisi MBS16CH**, de 16 canais. O OBS manda o áudio para "Alto-falantes (MBS16CH)".
- **A música do dia** é o site **Sonvra** aberto no Edge. O OBS captura esse som e o manda para a placa. Por isso o Edge usava cerca de 1 GB de RAM, e **se o OBS cair, a música para junto**.
- **192.168.0.231 é a mesa de som Duonn AXIOS16E.** A página dela se chama "AXIOS16E" e foi aberta 50 vezes no Chrome, que a abre sozinho quando o PC liga.
- Há um aparelho Google Cast (Chromecast ou TV) em 192.168.20.233, em outra faixa de rede.

## 5. Luz

- **Lumikit SHOW**, com o projeto `Documents\Oxfitness Sala Força.show` (salvo em 21/10). A API local na porta 5000 está ligada; o OX Show já usa essa API.
- A agenda do Lumikit é a da seção 1. Ela funciona sozinha, dentro do próprio Lumikit.
- **COM25:**
  - é um adaptador USB-serial CH340;
  - o protocolo `B6 B6 01 01 03 00 00 0N A9` vem do `enviar_cena.py`, que tenta 9600 e depois 115200;
  - continua sem confirmação **qual equipamento físico** está ligado nela. A hipótese é a luz ambiente.
- Também há no PC um atalho do **Lumikit ACAP** e o instalador do **MA2 Dual NSP Emulator** (grandMA2). Nenhum dos dois faz parte da automação atual.

## 6. Outras coisas que rodam

| Item | Para quê |
|---|---|
| **OX Show** (tarefa ao entrar no Windows, porta 8710) | Nosso programa. Está instalado com a agenda desligada e não interfere no que roda hoje. |
| **OX Rede** (tarefa de sistema, a cada 5 min) | Túnel das cobranças da Rede do OX Cloud. **Não pode ser desligado.** |
| AnyDesk, RustDesk, Tailscale + SSH | Acesso remoto |
| OXCYCLE (demo), pasta `sorteio` | Telão da sala de bike e sorteio |
| Copilot, OneDrive, Widgets, Office | Coisas do Windows que abrem sozinhas e gastam memória sem ter função no telão |

## 7. Pontos de atenção

1. **O evento das 21h depende de 6 peças em fila.** O disparo é num segundo exato (20:59:57); se o REAPER estiver travado nesse segundo, o evento não acontece.
2. **A música passa pelo OBS.** Se o OBS cair, saem do ar o telão e a música ao mesmo tempo.
3. **O Windows Update reiniciou o PC às 04:31 de 15/11.** Uma reinicialização fora de hora derruba tudo. Vale configurar o horário ativo do Windows para cobrir o expediente.
4. **O vídeo do dia é um arquivo editado à mão.** Trocar ou incluir um patrocinador hoje exige reeditar o vídeo inteiro (1,7 GB).
5. **A agenda de luz fica dentro do Lumikit.** Ela funciona, mas só se edita abrindo o Lumikit pelo AnyDesk.

## 8. O que isso muda no plano do OX Show

| Hoje | No OX Show |
|---|---|
| Vídeo único editado em loop | Vídeos separados com envio pelo painel e "X vezes por dia" (pedido de 19/11) |
| Sonvra pelo Edge e OBS | Pasta de músicas, link do YouTube e anúncios "X vezes por dia". O Sonvra pode continuar como uma das opções. |
| Agenda do Lumikit (04:40, 07:30, 19:00 e 23:54) | **Pode continuar no Lumikit**: funciona e não depende do OBS nem do REAPER. Ou passa para a agenda do OX Show, que manda os cues pela API. |
| Evento das 21h (REAPER + MIDI + ASS + Python) | O OX Show faz tudo: vídeo no telão, timeline do Lumikit (timecode pelo loopMIDI ou play pela API), COM25 1 e 2 e volta para o loop. Testar fora do horário antes de trocar. |
| Liga 04:30 (BIOS) / fecha 23:55 / desliga 00:00 | Fica igual. Só a lista de programas que o "Desligar Soft" fecha muda, quando OBS e REAPER saírem. |

**Falta confirmar na academia:**
- o que a COM25 aciona;
- olhar na tela do Lumikit se a regra das 23:54 é mesmo "Release all".

## 9. Fotos do rack (19/11)

| Equipamento | Papel |
|---|---|
| **NovaStar VC6 Pro** (controladora de vídeo do LED) | Recebe o HDMI do PC (é a "segunda tela"). É o aparelho "NOVE45E" que o Windows vê. |
| **Taramps THS 4004** (amplificador de 4 zonas: WC MAS, WC FEM, LOUNGE…) | Som dos banheiros e do lounge |
| **Taigar System GSP2x** (processador digital de caixas) | O visor mostra **"Pro=1"** (programa 1) |
| **Duonn AXIOS 16** (mesa digital) | Ligada ao PC por **USB**. A placa de som "MBS16CH" que o Windows vê é a própria mesa, com driver Meibaisi. Também está na rede: 192.168.0.231. |
| Adaptador azul **USB → RS485** (CH340) na traseira do PC | É a COM25, com 2 fios no borne verde |

**COM25, hipótese forte:** o par RS485 vai para o **processador Taigar**, e "cena 1" e "cena 2" trocam o **programa (preset) de som** dele. Por exemplo: Pro=1 é o som normal, e Pro=2 é o som do show das 21h.
- **Indícios:** o visor mostra "Pro=1", que bate com o "cena 1" do dia; processadores desse tipo costumam ter RS485 para trocar de preset; e na academia não há outro aparelho de RS485.
- **Para confirmar:** ver se os 2 fios do adaptador chegam no borne RS485 atrás do Taigar, ou olhar o visor dele durante o evento das 21h (deve mostrar "Pro=2").
