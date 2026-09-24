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

## Estado
- [x] Ambiente MT5 + Python
- [x] Camada de dados (download, parquet, fuso do servidor)
- [ ] Detectores de padroes
- [ ] Motor de backtest spread-aware
- [ ] Camada estatistica (binomial, IC, walk-forward)
- [ ] Relatorio ranqueado
- [ ] Interface com grafico (lightweight-charts)
