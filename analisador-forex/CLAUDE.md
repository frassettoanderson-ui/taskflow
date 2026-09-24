# Analisador Forex — detector de padroes com validacao estatistica

Ferramenta local (Windows) que detecta padroes graficos em Forex e **mede se
o padrao tem borda real** antes de mostrar qualquer sinal.

## Premissa do projeto
Detectar padrao e facil; provar que o padrao presta e o trabalho de verdade.
Nada aparece na interface sem passar pelo filtro estatistico.

## Ambiente (ja instalado em 24/09/2026)
- MetaTrader 5: `C:\Program Files\MetaTrader 5\terminal64.exe`
- Python 3.11.9 (64 bits) + MetaTrader5, pandas, numpy, scipy, pyarrow
- A API IPC do MT5 **so responde com o terminal aberto e conta logada**

## Estrutura
```
config.py            pares, timeframes, janelas de sessao (UTC)
diagnostico.py       checa terminal, conta e simbolos
baixar.py            CLI de download do historico -> dados/*.parquet
src/dados/           conexao MT5, download, offset de fuso do servidor
```

## Regras que nao se negociam
1. **Spread real sempre descontado.** O MT5 entrega spread por barra; usar
   esse valor, nunca estimativa. Em M1/M5 o spread come a maior parte do edge.
2. **Segmentar por sessao.** Corretora opera em UTC+2/+3 — `offset_servidor_horas()`
   corrige isso. Sem correcao, a analise por sessao fica deslocada.
3. **Amostra minima e teste de significancia.** Padrao com menos de ~200
   ocorrencias ou p-valor fraco nao entra no relatorio.
4. **Duas metricas em paralelo:** binaria (% acerto em N velas) e tradicional
   (expectativa em R com stop/alvo). Os dados decidem qual caminho vale.
5. **Walk-forward, nao so backtest.** Otimizar no historico inteiro e enganacao.
6. Apenas majors. Exoticos tem spread de 15-30 pips e nenhum padrao sobrevive.

## Resultado da primeira rodada completa (24/09/2026)

7 majors x 3 timeframes x 12 anos (21 arquivos, ~9,2 milhoes de barras),
14 padroes x 5 sessoes x 3 contextos de tendencia = **3.353 combinacoes**.

Funil de filtragem            | binaria | tradicional
------------------------------|---------|------------
p < 0.05 sem correcao         |      11 |          46
+ correcao FDR 10%            |       1 |           5
+ IC inferior favoravel       |       1 |           5
+ cada metade se sustenta     |   **0** |       **0**

Mediana entre as 3.353: **-0,10R** e **48,97%** de acerto (breakeven 53,48%).

Leitura: com estes parametros (expiracao de 3 velas; stop 1 ATR / alvo 2 ATR),
**nenhum padrao classico isolado tem borda estavel**. Os que pareciam ter
sumiram em um dos tres filtros. Nao e prova de que nada funciona — e prova de
que padrao isolado, sem confluencia e sem contexto adicional, nao basta.

Dois artefatos encontrados e neutralizados no caminho:
- **Rollover das 21h UTC**: spread do EURUSD salta de ~3 para ~15 pontos e o
  volume cai a um sexto. Os dois unicos "achados" da primeira rodada estavam
  todos nessa janela. Filtro de spread anomalo eliminou os dois.
- **Positivo nas duas metades era criterio frouxo**: uma metade passava com
  +0,035R (p=0,24, ou seja nada) e carregava o conjunto. Agora cada metade
  precisa ser significativa sozinha.

## Segunda rodada: confluencia + niveis (24/09/2026)

4.440 hipoteses (padrao x localizacao no nivel, e pares de padroes
concordando em ate 3 barras), com descoberta em duas etapas:
treino nos primeiros 60%, validacao nos 40% finais nunca tocados.

Resultado: **0 aprovadas** (binaria nem teve candidatas).

### O que foi aprendido, que vale mais que o resultado

**1. A confluencia com niveis funciona — e e pequena demais.**
Teste pareado, 797 trios (mesmo padrao, mesmo par, mesmo contexto):

    livre        -0,1524R
    reversao     -0,1311R   (+0,0213R sobre livre, p < 0,0001)
    rompimento   -0,1396R   (+0,0127R sobre livre, p < 0,0001)

O nivel carrega informacao real e estatisticamente solida. So que o efeito
e uma ordem de grandeza menor que o buraco a cobrir.

**2. Combinar dois padroes PIORA** (-0,172R contra -0,136R do padrao solto).
Exigir confirmacao atrasa a entrada e corta amostra sem agregar informacao.

**3. O custo e o vilao, nao a falta de padrao.** Mesmos sinais com spread zero:

    EURUSD M5   -0,148R -> -0,033R
    EURUSD H1   -0,042R -> -0,022R
    GBPUSD H1   -0,057R -> -0,027R

Sem custo a expectativa fica em torno de -0,02/-0,03R, que e aproximadamente
o vies da regra conservadora de desempate (stop vence quando stop e alvo
caem na mesma barra). Ou seja: **os padroes sao indistinguiveis de aleatorio,
e o custo transforma neutro em perdedor.**

**4. O custo em R desaba conforme o timeframe cresce** (stop = 1 ATR):

    M5   0,154R     M15  0,076R     H1   0,029R

E a unica direcao estruturalmente favoravel que os dados apontam. Dai a
terceira rodada em H4/D1.

**5. A distribuicao nula nao e centrada em zero.** Apenas 6,2% das hipoteses
tem expectativa positiva no treino (mediana -0,142R). Esperar "1% de
candidatas com alfa 0,01" estava errado: o custo desloca a distribuicao
inteira para baixo.

### Teste placebo (placebo.py)
Pipeline rodado sobre series embaralhadas (vela mantem a forma, sequencia
destruida): **1 aprovacao em 25 rodadas** (0,04/rodada), compativel com FDR
de 10%. O pipeline nao inventa borda e nao vaza futuro.
O placebo e linha de base, nao gabarito: FDR de 10% admite falsa descoberta
por definicao, entao resultado real dentro da linha de base nao e descoberta.

## Terceira rodada: H4/D1 e a conclusao do projeto (24/09/2026)

Baixados 20 anos de H4 e D1 dos 7 majors. A pergunta era: com o custo
praticamente eliminado, os padroes passam a ter borda?

Expectativa media dos 14 padroes, 7 majors, com custo real e com spread zero:

    tf    custo em R   com spread   spread zero      sinais
    M5        0,1539      -0,2358       -0,0236   4.707.620
    M15       0,0759      -0,1337       -0,0274   1.483.547
    H1        0,0288      -0,0718       -0,0290     354.403
    H4        0,0196      -0,0294       -0,0022     150.869
    D1        0,0033      -0,0037       +0,0024      24.960

**A expectativa converge para zero conforme o custo vai a zero, em todos os
timeframes.** Nao fica positiva: fica neutra. Em D1, onde o spread custa
0,0033R (47x menos que em M5), a expectativa e -0,0037R — indistinguivel
de zero.

### Conclusao

Os padroes graficos classicos implementados aqui, isolados ou em
confluencia com niveis, **nao tem poder preditivo** nos 7 majors, em 5
timeframes, ao longo de 20 anos e ~6,7 milhoes de sinais avaliados. O que
decide o resultado de operar por eles e exclusivamente o custo.

Isso nao e opiniao nem ceticismo a priori: e o que sobrou depois de
detectar, medir com entrada realista, descontar custo real, corrigir
multiplos testes, validar fora da amostra e calibrar contra placebo.

### Para onde a ferramenta vale a pena ir

O pipeline em si continua valioso — mudou o uso, nao a qualidade:

**Como laboratorio de validacao.** Qualquer estrategia (propria, herdada ou
comprada de terceiro) pode ser submetida a este mesmo crivo. Responder
"essa estrategia tem borda?" com entrada realista, custo real, correcao de
multiplos testes, validacao fora da amostra e linha de base do acaso e um
produto de verdade — e e exatamente o que falta no mercado de sinais.

**Como marcador visual.** Detectar e desenhar padroes e niveis no grafico
segue util para leitura e estudo, desde que sem promessa de borda.

**Hipoteses com base teorica diferente** (fora do escopo de "padrao
grafico", e por isso nao testadas aqui): microestrutura e fluxo, carry,
sazonalidade de calendario, cointegracao entre pares, regime de
volatilidade.

## Estado
- [x] Ambiente MT5 + Python
- [x] Camada de dados (download, parquet, fuso do servidor, filtro de spread)
- [x] 14 detectores de padroes
- [x] Motor de backtest spread-aware (binario + tradicional em paralelo)
- [x] Camada estatistica (Wilson, binomial, bootstrap, Benjamini-Hochberg)
- [x] Validacao de estabilidade temporal
- [x] Relatorio ranqueado (analisar.py -> CSV)
- [x] Niveis de suporte/resistencia por clusterizacao de toques
- [x] Confluencia (padrao x nivel, padrao x padrao)
- [x] Descoberta em duas etapas (treino/validacao fora da amostra)
- [x] Teste placebo para calibrar a linha de base do acaso
- [x] Terceira rodada em H4/D1 (20 anos) — conclusiva
- [ ] Reposicionar como laboratorio de validacao de estrategias
- [ ] Interface com grafico (lightweight-charts) para marcacao visual
- [ ] Filtro de calendario economico (NFP, CPI, FOMC)
