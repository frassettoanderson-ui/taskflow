# SONORIDADE — Plano do app

> **App de estudo para instrumentos de corda: violão, guitarra e baixo.**
> Tem exercícios para praticar, **aulas gravadas pelo Evaldo**, uma **grande biblioteca de louvores** com cifra e, em parte deles, **VS com click**. No VS dá para treinar com a banda inteira e depois **tirar o seu instrumento** para tocar como se fosse no culto.
> Público: uso pessoal + grupo de amigos (não é produto à venda).
> Referência: QMe Prompter (vídeo do André Sarmanho; a transcrição está em `transcritor-video/transcricoes/QMe Prompter - Andre Sarmanho.txt`). Dele só aproveitamos o que ajuda a estudar.
> Status: **planejamento** (10/11/2026).

---

## 1. Os 4 blocos do app

| Bloco | O que é |
|---|---|
| **Louvores** | Biblioteca de cifras e tablaturas; parte dos louvores com **VS** |
| **Treino com VS** | Tocar junto com a banda e ir tirando o seu instrumento até tocar sozinho |
| **Exercícios** | Prática guiada, com o microfone ouvindo e corrigindo |
| **Aulas do Evaldo** | Vídeos por instrumento e nível, ligados aos exercícios e aos louvores |

Na entrada o aluno escolhe **o instrumento (violão, guitarra ou baixo)** e o **nível**. O app inteiro se adapta: cifra ou tab, faixa que sai do VS, exercícios e aulas.

---

## 2. Louvores (biblioteca)

**Como a música aparece**
- **Cifra** com acordes acima da letra, separada por partes (intro, verso, pré, refrão, ponte, solo, final).
- **Tablatura** para riffs, intros, solos e linhas de baixo.
- **Desenho do acorde no braço** ao tocar no acorde; mostra mais de uma posição.
- **Graus** em vez de acordes, em número (1, 4, 5, 6m) ou romano (I, IV, V, vi), para estudar harmonia.
- **Mudar o tom** com um toque e **capo** (mostra o desenho relativo ao capo).
- Fonte grande, modo escuro e **rolagem automática** (por BPM ou junto com o VS).

**Como a biblioteca é montada**
- Colar **link ou texto** de cifra (Cifra Club etc.) → o app converte para o formato dele.
- Importar **PDF ou foto** → a IA limpa (tira nº de página e nome de site) e marca as partes.
- Editor para corrigir e marcar partes na mão.
- Cada louvor tem artista, tom original, BPM, **nível de dificuldade por instrumento** e marcação se tem VS.
- Busca e filtros: por instrumento, nível, "tem VS", tom e artista.

---

## 3. Treino com VS (o diferencial)

O VS vem com as faixas separadas do estúdio (Click, Guia, Bateria, Baixo, Violão, Guitarra, Teclado, Voz…).

### Importar o VS (só para quem administra a biblioteca)
- Subir a **pasta ou o .zip**. O app reconhece cada faixa pelo nome do arquivo (`BAIXO.wav`, `VIOLAO.mp3`, `CLICK.wav`, `GUIA.wav`…); quando o nome vier estranho, dá para corrigir na mão.
- Lê o **BPM** pelo Click.
- Usa a **Guia** (a voz que fala "verso", "refrão") para **marcar as partes no tempo** e ligar ao VS a cifra da mesma música.
- Converte para áudio comprimido (de ~500 MB em WAV para ~30–60 MB) sem perda perceptível no treino.

### Tela de treino
- **A cifra/tab anda junto com o VS**, destacando a parte e o acorde da hora.
- **Mixer**: cada faixa com mudo, solo e volume; **click** liga e desliga.
- **Loop de uma parte** (só a intro, só o solo, só a virada do refrão).
- **Velocidade** de 50% a 120% sem mudar o tom.
- **Mudar o tom do VS** com a cifra transpondo junto. Soa bem em 1 ou 2 tons; mais que isso fica artificial.
- **Contagem antes de começar** (o click conta 1-2-3-4).

### Modo progressivo: "até estar preparado"
O aluno sobe de etapa quando se sentir pronto (ou quando o app perceber que ele acertou bem):

| Etapa | Seu instrumento no VS | Velocidade |
|---|---|---|
| 1. Ouvir | alto (100%) — só escuta e acompanha a cifra | 70% |
| 2. Tocar junto | alto | 70% → 85% |
| 3. Apoio | baixo (30%) | 85% → 100% |
| 4. **Sozinho** | **desligado** — ambiente de culto | 100% |
| 5. Culto | desligado, sem cifra rolando sozinha (só o mapa da música) | 100% |

O progresso fica salvo por louvor ("Lugar Secreto — etapa 3 no baixo").

### Gravar e ouvir
- Gravar o próprio take por cima do VS e ouvir de volta, com e sem a banda.

---

## 4. Exercícios

Separados por instrumento e nível. Sempre que possível, **o microfone ouve e diz se acertou** (detecção de nota e afinação). Todos com **metrônomo** e BPM que sobe aos poucos.

### Comuns aos 3 instrumentos
- **Notas no braço**: "toque o Dó na 5ª corda" e o app confere.
- **Escala cromática** (1-2-3-4 em todas as casas, subindo e descendo), como aquecimento e para independência dos dedos.
- **Escalas**: maior, menor natural, pentatônica maior e menor, em todas as posições e tons.
- **Campo harmônico e graus**: tocar I-IV-V-vi em vários tons (liga com o modo "graus" da cifra).
- **Ritmo**: semínima, colcheia, semicolcheia e tercina com click; contratempo.
- **Ouvido**: identificar se o acorde é maior ou menor, o intervalo, o grau; "tirar" uma progressão de 4 acordes.
- **Ciclo de quintas** e tons com acidentes ("tocar em F# para sair da zona de conforto").

### Violão
- Formação e troca de acordes cronometrada ("troque Sol→Ré 30 vezes em 1 minuto").
- Pestana (fortalecimento progressivo).
- **Levadas de louvor**: balada, 6/8, pop worship, levada de ministração.
- Dedilhados.
- Inversões e acordes com baixo (D/F#, C/E, 5/7).

### Guitarra
- Palhetada alternada e econômica.
- Arpejos; *power chords*; tríades no braço.
- Riffs e intros de louvor.
- Técnicas: bend, vibrato, slide, *hammer-on/pull-off*.
- Timbres de louvor (ambiente, delay em semínima pontuada) — teórico, com exemplos em áudio.

### Baixo
- Tônica e quinta; caminhar entre acordes (notas de passagem).
- Grooves de louvor (balada, 6/8, *pop worship*).
- Dedo alternado (indicador/médio) com click.
- Pegar a **dinâmica** da banda (entrar no refrão, sair no verso).
- Leitura de cifra com baixo invertido (D/F# → toca F#).

### Motivação
- Sequência de dias, meta de minutos por semana, níveis e medalhas por trilha.
- **Cada exercício termina num louvor real** ("agora use essa levada em tal louvor, etapa 2").

---

## 5. Aulas do Evaldo

- Vídeos organizados em **trilhas por instrumento e nível** (iniciante, intermediário, avançado).
- Cada aula pode ter **material junto**: cifra/tab, exercício para praticar e o louvor da biblioteca onde o assunto aparece.
- **Marcar como assistida** e retomar de onde parou.
- Velocidade do vídeo (0,75×–1,5×) e **loop de um trecho** da aula (ex.: o pedaço em que ele mostra o dedilhado).
- Vídeo hospedado de forma que **ninguém de fora assista**: YouTube não listado é o mais simples; um player próprio (Bunny Stream ou na VPS) esconde melhor e funciona offline.
- Painel simples para o Evaldo subir a aula, escrever a descrição e ligar a exercícios e louvores.

---

## 6. Ferramentas

- **Afinador** (violão, guitarra e baixo de 4/5 cordas; afinação padrão e meio tom abaixo).
- **Metrônomo** com subdivisões e acento.
- **Dicionário de acordes e escalas** com o desenho no braço.

---

## 7. Arquitetura

**Recomendação: começar como app web instalável (PWA).**
- Os amigos abrem um link e tocam em "Adicionar à tela inicial": funciona no **iPhone, no Android e no PC**.
- Não precisa de loja nem da conta Apple (US$ 99 por ano).
- Toca várias faixas sincronizadas (Web Audio API), muda velocidade e tom (SoundTouch/Rubber Band em WASM), detecta nota pelo microfone e funciona offline.
- Se a Fase 0 mostrar que o celular não aguenta, partimos para app nativo (React Native).

**Stack (o padrão dos seus projetos)**
- **Front**: Next.js/React (PWA).
- **API**: Node + Prisma + Postgres.
- **Arquivos** (VS, PDFs, vídeos): na VPS ou em storage barato.
- **IA** (organizar cifra importada, ler PDF/foto): Gemini.

---

## 8. Fases

| Fase | Entrega |
|---|---|
| **0 — Provas técnicas** | tocar um VS real de 8 faixas no celular (iPhone e Android) com mudo, volume, loop e velocidade; detectar a nota tocada pelo microfone; testar a marcação das partes pela Guia |
| **1 — Louvores + Treino com VS** | login por convite, escolha de instrumento, biblioteca (cifra, tab, tom, capo, graus), importar cifra e VS, tela de treino com cifra andando junto, mixer, loop, velocidade e **modo progressivo** |
| **2 — Exercícios** | notas no braço, cromático, escalas, ritmo e campo harmônico com o microfone avaliando; afinador e metrônomo |
| **3 — Aulas do Evaldo** | trilhas de vídeo, painel para ele subir as aulas, ligação aula ↔ exercício ↔ louvor |
| **4 — Extras** | gravar o take, ouvido (percepção), motivação (sequência e medalhas), offline completo |

---

## 8.0 Mudança de rumo (10/11/2026): começar pelo básico

Depois de ver o protótipo do VS, o usuário decidiu **começar pelo básico** e deixar o treino com VS para quem já está mais avançado (sem descartar).
- **Ideia guardada para o VS:** em vez de cifra rolando, uma **barra que avança na música estilo jogo de ritmo** ("Guitar Hero"), mostrando o acorde atual, o próximo e o momento exato da troca. A esteira do treino de batidas (abaixo) já é a semente disso.
- **Feito — app em `app/`** (HTML/JS puro, PWA; rodar o servidor `sonoridade` do `.claude/launch.json` → http://localhost:8180/app/):
  - **Tela inicial** com as opções: Acordes, Batidas e Sequências (prontos); Afinador, Exercícios e Aulas do Evaldo (em breve); Louvores com VS (avançado → protótipo).
  - **Acordes:** 39 acordes de violão em 5 grupos (primeiros, sétima, pestana, nona/quarta, baixo trocado) e **por tom** (campo harmônico de Sol, Ré, Dó, Lá, Mi e Fá com graus I–vi). Cada acorde: **braço do violão desenhado** (em pé no celular, deitado no PC) com os dedos numerados, pestana, X/O, nome das cordas, casas; **Ouvir** (batida) e **Corda por corda**; dicas automáticas; anterior/próximo.
  - **Batidas:** 6 batidas (só para baixo, adoração, vai e volta, balada, 6/8, balada com abafada). Treino com **esteira de setas chegando na linha** no tempo, contagem 1-2-3-4 antes, **acorde atual + próximo + barra até a troca**, metrônomo, violão tocando junto (aço ou náilon), BPM 40–140, 5 sequências de acordes, a sua sequência (vinda da tela Sequências) ou um acorde só, trocar a cada 1 ou 2 compassos.
  - **Sequências (campo harmônico):** tom maior (G, D, C, A, E, F) ou menor (Em, Am, Bm, Dm); toca nos graus (I ii iii IV V vi / i III iv v VI VII, com a função de cada um) para montar até 8 acordes; trocar o tom mantém os graus (transpõe); 8 sequências prontas de louvor no maior e 4 no menor; ouvir, guardar (no aparelho) e mandar para o treino de batida (`#/batidas/<batida>?seq=G,D,Em,C`). Diminuto ficou de fora.
  - **Som do violão gravado:** amostras reais MusyngKite (aço e náilon, licença CC BY-SA 3.0, baixadas na hora do gleitz.github.io/midi-js-soundfonts e guardadas em memória), cada corda tocada separada com atraso natural entre elas, batida para cima só nas cordas agudas, abafamento da batida anterior e reverb leve de sala. Se a internet falhar, cai no som sintetizado (Karplus-Strong). Para usar offline no futuro: copiar as ~30 notas usadas para dentro do app.
  - **Visual (11/2026):** refeito sem "cara de IA": cores chapadas (preto, grafite, ouro da logo), fonte única Archivo (condensada nos títulos e acordes), cantos 5/7 px, sem brilho, degradê, grão, etiquetas em maiúsculas, pílulas ou setas de texto (ícones e setas de batida em SVG). Texto centralizado nos cartões e logo grande.
  - **Aulas (11/11/2026):** "Aulas do Evaldo" virou só **Aulas**. Tela estilo Netflix: destaque no topo, filtro por instrumento, "Continuar assistindo" (guardado no aparelho), uma fileira por trilha (Primeiros passos, Louvores, Ritmo e dedilhado, Entendendo a música, Guitarra, Baixo) e a página da aula (vídeo, resumo, marcar como vista, mais desta trilha). Por enquanto com ~44 vídeos públicos do Cifra Club; depois entram as aulas gravadas pelo Evaldo (onde hospedar os vídeos dele entra nas perguntas do §9).
  - **Tocar cifra, Fase 1 (11/11/2026):** `#/cifras` (biblioteca: busca, filtro Louvor/Hinos, "abertas por último", ordem das mais tocadas) e `#/cifras/<id>` (a música). Na música: versão **principal/simplificada**, **tom ±** (meio em meio tom, com volta ao original), **capotraste ±** (os desenhos mudam e o tom que soa fica), **afinação** padrão / ½ tom abaixo / 1 tom abaixo, **desenho de todos os acordes** da música (toque no acorde = folha com braço, ouvir, dedilhar, "tocar junto a partir daqui"), tamanho da letra, tablaturas recolhidas, **rolagem automática** (5 velocidades) e **tocar junto**: o violão do app faz a batida escolhida e troca os acordes na ordem da cifra, com metrônomo, contagem antes, o acorde da vez marcado no texto (a tela acompanha) e uma barra embaixo com acorde atual/próximo/mini braço. As preferências ficam guardadas por música, no aparelho.
    - **Posição de qualquer acorde:** `js/dados/teoria.js` lê o símbolo do jeito brasileiro (9 = com nona, 7M, 4 = sus, (…) = acrescentadas, °, 5 = power chord, baixo trocado), transpõe e procura a posição mais confortável no braço quando o acorde não está no dicionário de `acordes.js`. Testado: todos os acordes das 9 músicas, nos 12 tons, têm desenho.
    - **Cifras de teste:** 9 das mais tocadas do gênero gospel no Cifra Club (Tudo É Perda, Sublime, Me Ama, Porque Ele Vive, É Tudo Sobre Você, Grande É o Senhor, Bondade de Deus, Só Tu És Santo, A Ele a Glória), copiadas para `app/dados-teste/cifras-teste.json`, **fora do git**, só para uso pessoal.
    - **Ritmo por música (11/11/2026):** `js/dados/ritmos.js`. **Velocidade medida na gravação oficial** (áudio baixado do YouTube e analisado com librosa: tempo, subdivisão binária/ternária e quanto cada acorde dura): Tudo É Perda 63, Sublime 63, Me Ama 51, Porque Ele Vive 80, É Tudo Sobre Você 69, Grande É o Senhor 58 (ou 117), Bondade de Deus 64 em embalo de três (12/8), Só Tu És Santo 62, A Ele a Glória 53 (ou 105). Em todas o acorde troca a cada ~1 compasso. **Batida de cada parte** (intro, estrofe, pré, refrão, ponte, solo, final) é SUGESTÃO, falta quem toca conferir. Batidas novas: Dedilhado simples, Dedilhado de louvor, Embalo de três (12/8) e Dedilhado de três (12/8) — notação P = polegar no baixo, 1–4 = corda. No "tocar junto": "Batida de cada parte" (padrão) ou "Uma batida para tudo"; a parte mostra a batida no título; a barra de baixo mostra a batida da vez.
    - **Limite atual:** a duração de cada acorde ainda é igual para todos (1 compasso; pode mudar para ½ ou 2). Acordes que duram 2 compassos ou meio compasso na gravação ainda não são respeitados: para isso falta alinhar a cifra com o áudio, acorde por acorde.
    - **Próximo (Fase 2):** mapa de tempo por música + **avaliação pelo microfone** (trocou o acorde na hora? a batida estava no tempo?) + **importar música nova** por link/texto.
  - **Acordes refeito (11/11/2026):** mural com o desenho em cada cartão (tocar = ouvir + cordas vibrando), grupos numa página só com índice fixo, "Procurar qualquer acorde" (qualquer símbolo, posição calculada pela teoria) e "Por tom" com graus e botão que toca I V vi IV.
  - **Gravação original (11/11/2026):** na biblioteca, a capa de cada música toca **30 s do refrão** do vídeo oficial (YouTube embutido, preso embaixo). Na música, **"Ouvir a gravação original"** abre o vídeo na barra de baixo e marca na cifra o acorde que está soando (Agora/Próximo), com "ouvir a gravação daqui" ao tocar num acorde. O mapa de cada acorde (`app/dados-teste/sincronia.json`, fora do git) foi **medido no áudio**: a letra cantada transcrita com tempo de cada palavra (faster-whisper) é casada com as linhas da cifra (Viterbi que aceita refrão repetido e fala no meio), cada acorde ganha o tempo da sílaba onde está escrito (encaixado na batida) e as partes sem letra (intro, solo) entram um acorde por compasso. Conferência pelo próprio áudio: 8 das 9 músicas mapeadas; o acorde marcado bate com o que soa em 72–91% das trocas (Tudo É Perda 91, Bondade 90, É Tudo Sobre Você 87, Me Ama 85, Sublime 81, Grande É o Senhor 75, Só Tu És Santo 75, Porque Ele Vive 72). **A Ele a Glória ficou sem mapa** (só 43%: gravação ao vivo, pouca letra; o `juntar.py` descarta mapa abaixo de 60%), mas tem o refrão na biblioteca (quando a gravação está em outro tom, o app avisa e oferece "Pôr em <tom da gravação>"; ex.: Porque Ele Vive soa em Ab, a cifra está em A). Limites: só os primeiros 4 min de cada gravação foram baixados (o download inteiro foi barrado), então a cifra acompanha até ali e depois avisa; Sublime está quase inteira (até 7:36). Scripts em `_ferramentas/sincronia/`.
  - **Afinador (11/11/2026):** `#/afinador`, violão/guitarra/baixo, afinação padrão, ½ tom abaixo e Drop D; mostrador com agulha em cents, corda achada sozinha ou travada (tocar na corda toca a nota de referência), visto em cada corda afinada. Detecção YIN (`js/audio/microfone.js`), testada com sinais de corda: erro < 0,1 cent de 41 Hz a 330 Hz. **Precisa de HTTPS no celular**: ligado em 11/11 (`_deploy/https.sh`) → https://sonoridade.89-117-79-163.sslip.io/app/.
  - **Exercícios (11/11/2026):** `#/exercicios`: troca de acordes em 1 minuto (12 pares, recorde por par, metrônomo opcional), aranha cromática 1-2-3-4 (bpm, casa inicial, 1 ou 2 notas por clique, dedo da vez no braço, notas tocando), notas no braço (4 níveis, sustenidos opcionais, responder no botão ou **tocando, pelo microfone**) e ouvido (maior/menor/com sétima). Recordes guardados no aparelho.
  - **Revisão geral (11/11/2026, madrugada):** corrigido: dois "tocar junto" ao mesmo tempo quando se tocava rápido (cifra e aranha); microfone que ficava ligado se saísse da tela enquanto o navegador pedia permissão (afinador e notas no braço); pergunta nova chegando depois de sair do exercício; busca de acorde forçando maiúscula no celular (am virava AM); afinador agora pega até 30 Hz (Drop D no baixo); vídeo do YouTube com aviso quando não abre, quando falta internet ou quando o celular exige tocar no vídeo; volume do refrão volta ao normal se arrastar o vídeo; fim da cifra sempre visível acima da barra de baixo (mede a altura real); áreas de toque maiores (acordes da cifra, botões redondos, links pequenos); índice dos acordes abaixo do entalhe do iPhone e sem pular a página; braço dos exercícios com números maiores; ícones PNG para instalar no celular (180/192/512 + versão "maskable") e cor do tema igual ao fundo; foco visível no teclado e avisos lidos pelo leitor de tela. **Falta:** service worker (abrir sem internet).
- **Falta conferir:** se o som gravado agrada no celular e se os desenhos dos acordes batem com o jeito que o Evaldo ensina.

## 8.1 Fase 0 — resultados (10/11/2026)

Protótipo em `prototipo/` (rodar: servidor `sonoridade-prototipo` do `.claude/launch.json` → http://localhost:8180). VS de teste: **Sublime – Meia Noite** (Ré, 125 BPM), 8 faixas do zip convertidas para AAC 192k em `prototipo/vs/sublime-meia-noite/` (fora do git).

**Formato real do VS** (projeto Ableton): pasta `MultiTracks/` com `AG` (violão), `EG 1` (guitarra), `Bass`, `Drums`, `Perc`, `Piano`, `Click Track`, `Guide` — WAV 44,1 kHz/16 bits, todas do mesmo tamanho e alinhadas no zero. Sem faixa de voz cantada. Tem também um 2º click (`click HELDER.wav`, mono, mais longo) que é o usado no projeto do Ableton, um `Guia … (L.R).mp3` (versão de palco) e `Album.jpg` (capa). Nome da pasta = `Título-Tom-BPM`. Não há marcadores de partes no `.als` → as partes terão de vir da faixa Guide.

| Teste | Resultado |
|---|---|
| 8 faixas sincronizadas (mesmo relógio, AudioWorklet próprio) | ✅ funciona |
| Mixer mudo / solo / volume, sem estalo | ✅ (troca de ganho passa pela sobreposição das janelas) |
| Velocidade sem mudar o tom (WSOLA próprio) | ✅ medido: 70% → avança 0,71 s por segundo. **Qualidade do som ainda precisa ser ouvida** |
| Tom ±4 semitons, com velocidade mantida | ✅ medido: tom +1 a 70% continua 0,70 s/s |
| Loop A–B | ✅ fica preso no trecho |
| Modo progressivo (etapas 1–4) | ✅ |
| Afinador (YIN) | ✅ com tons sintéticos de 41 Hz (Mi do baixo) a 659 Hz, erro < 0,1 Hz. **Microfone real ainda não testado** |
| Memória | ⚠️ **534 MB** (faixas inteiras em 16 bits; 2 de 8 detectadas como mono). Pesado demais para celular |
| Tempo para abrir | ⚠️ 18 s no PC (só toca depois de decodificar tudo) |
| Celular | ⏳ não testado: AudioWorklet e microfone **exigem HTTPS** → precisa subir numa VPS com domínio |

**Próximo passo técnico:** trocar "decodificar tudo na memória" por **decodificar em pedaços durante a reprodução** (WebCodecs `AudioDecoder`, com fallback para pedaços pré-cortados de ~10 s no servidor). Meta: < 150 MB de memória e começar a tocar em < 3 s. Depois, testar no iPhone e no Android via HTTPS.

---

## 9. O que preciso de você

1. **Uns 2 ou 3 VS reais** (a pasta como vocês recebem), para ver os nomes das faixas e se a Guia fala as partes.
2. **Quantos amigos** vão usar e se usam mais iPhone ou Android.
3. **Onde hospedar**: na sua VPS (qual?) ou em outro lugar.
4. **Aulas do Evaldo**: quantas existem ou estão previstas, se já estão gravadas e onde estão hoje. O Evaldo vai subir as aulas sozinho?
5. **Quem monta a biblioteca** de louvores e VS: só você, ou qualquer amigo pode adicionar?
