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

## Estado
- [x] Ambiente MT5 + Python
- [x] Camada de dados (download, parquet, fuso do servidor, filtro de spread)
- [x] 14 detectores de padroes
- [x] Motor de backtest spread-aware (binario + tradicional em paralelo)
- [x] Camada estatistica (Wilson, binomial, bootstrap, Benjamini-Hochberg)
- [x] Validacao de estabilidade temporal
- [x] Relatorio ranqueado (analisar.py -> CSV)
- [ ] Confluencia: combinar padroes em vez de avaliar isolados
- [ ] Varredura de parametros (expiracao, R:R) — exige ampliar a correcao
      de multiplos testes junto, senao vira data mining
- [ ] Filtro de calendario economico (NFP, CPI, FOMC)
- [ ] Niveis de suporte/resistencia por clusterizacao de toques
- [ ] Interface com grafico (lightweight-charts)
