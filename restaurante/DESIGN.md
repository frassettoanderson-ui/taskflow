# "Papel & Brasa" — o sistema visual

> Como o sistema se parece e **por quê**. Consultar antes de criar tela nova,
> para tudo continuar parecendo a mesma coisa.

## A ideia em uma frase

A tela parece um **bom cardápio impresso em papel quente**, com o **calor da
brasa** da cozinha nos detalhes.

O contrário do painel cinza-azulado frio que todo software de gestão usa. E
claro, porque este sistema vive no balcão, de dia, muitas vezes perto da janela.

## Referências olhadas

Anota AI, Consumer e o Gestor de Pedidos do iFood. O que trouxemos de lá:

- **tempo correndo no pedido** com alerta de cor (âmbar na metade do tempo,
  vermelho no atraso) — o cartão avisa sozinho na hora do pico;
- **contadores por etapa** no topo;
- **aceite automático** e **impressora térmica** ficaram mapeados nos backlogs.

O que NÃO copiamos: as colunas kanban (arrastar pedido de coluna em coluna).
O fundador preferiu lista única com tags. Um "modo quadros" alternativo, como o
iFood tem, está anotado como possibilidade.

---

## Cores

| Papel | Uso |
|---|---|
| `--bg` `#FBF7F1` | fundo de tudo (papel quente) |
| `--surface` `#FFFFFF` | cartões |
| `--surface-2` `#F4EEE5` | faixas, cabeçalho de tabela, fundos sutis |
| `--text` `#1C1512` | tinta espresso |
| `--muted` `#736358` | texto secundário — **escolhido por medição**, ver abaixo |

| Brasa | Uso |
|---|---|
| `--brand` `#C2410C` | a marca. Passa em contraste como texto **e** como fundo |
| `--brand-vivo` `#E4571B` | só no gradiente do botão (área grande) |

| Canal | Cor |
|---|---|
| Delivery | brasa `#C2410C` |
| Salão | jade `#0F766E` |
| Retirada / Balcão | ametista `#6D28D9` |

Semáforo sempre em **par**: cor forte + fundo suave (`--ok`/`--ok-bg`,
`--aviso`/`--aviso-bg`, `--danger`/`--danger-bg`, `--info`/`--info-bg`).

### O menu lateral é escuro de propósito

Espresso `#21190F` contra o papel do conteúdo. Faz três coisas: dá profundidade,
separa "onde eu navego" de "onde eu trabalho", e dá cara de produto pensado.

### A cozinha (KDS) continua escura

É o único lugar. Tela grande, ligada o serviço inteiro, sob luz forte e perto do
fogão: fundo escuro cansa menos a vista, não reflete e a comanda salta. Os
tokens são redefinidos dentro de `.kds`.

---

## Tipografia

- **Poppins** (títulos, números de pedido, valores). Geométrica, redonda,
  moderna. Escolhida pelo fundador: a serifada que havia antes (Fraunces) tinha
  ar "sofisticado" demais para um sistema de trabalho.
- **Archivo** (todo o resto). Simples, ótima em corpo pequeno e com **números
  tabulares** — dinheiro alinha em coluna. A Poppins, sendo geométrica, é larga
  demais para dado denso, por isso não serve para o texto do dia a dia.

Baixadas no build e servidas pelo próprio sistema (`next/font`). **Nada é pedido
ao Google em tempo de uso** — requisito do PDV, que funciona sem internet.

---

## Ícones: SVG, nunca emoji

Emoji muda de desenho em cada sistema operacional, não aceita a cor da
interface, não alinha com o texto e o leitor de tela lê o nome dele em inglês.
São desenhos, não ícones.

Todos em `src/components/icones.tsx`: traço de 1.75px, um só estilo, herdando
`currentColor`.

Única exceção: emoji dentro de **mensagem para o cliente** (ex.: o texto de
campanha que vai para o WhatsApp). Ali é conteúdo, não interface.

---

## Duas decisões que exigiram medição

### 1. O `--muted` foi escolhido no medidor, não no olho

Um bege mais claro ficava bonito e **ilegível**: dava 4,08:1, abaixo do mínimo
de 4,5. O `#736358` passa sobre os três fundos que existem (branco, papel e
papel-2).

### 2. A cor da marca não pode virar texto sem tratamento

O restaurante escolhe a cor dele — pode ser um amarelo-limão. Como fundo de área
grande tudo bem; como **texto** sobre papel, some.

A saída foi **travar a luminosidade** (`oklch(from var(--marca) min(l, 0.5) c h)`)
mantendo matiz e saturação: continua sendo a cor dele, só que sempre legível.
Cor que já é escura não é tocada.

Medido, contraste sobre o papel:

| Cor da marca | Antes | Depois |
|---|---|---|
| amarelo `#FFE600` | 1,27:1 ❌ | **5,52:1** ✅ |
| ciano `#7DF9FF` | 1,25:1 ❌ | **5,13:1** ✅ |
| branco `#FFFFFF` | 1,00:1 ❌ | **5,63:1** ✅ |
| azul `#0B2E6B` | 12,17:1 ✅ | 12,17:1 (não mexe) |

---

## O menu lateral

- **Retrátil**: o puxador na borda encolhe de 268px para 76px (só ícones). A
  escolha fica guardada no aparelho.
- **Submenus abrem PARA A DIREITA**, num painel — nunca empurrando o resto do
  menu para baixo. Retraído, o mesmo painel serve para dizer o nome do item.
- ⚠️ O painel é posicionado em **coordenadas de tela** (`position: fixed`,
  calculadas em JS). Se fosse `absolute` dentro do menu, a lista — que rola —
  o **recortaria pela metade**. Já aconteceu.
- Nomes em **15,5px**: o menu é lido de relance, muitas vezes de longe, com o
  tablet na bancada.
- No celular vira gaveta e abre sempre **inteira**; retrair ali não ajuda
  ninguém, e o puxador some.

## Regras para telas novas

- Use os **tokens**, nunca cor fixa. Cor fixa é o que faz o tema desmontar.
- Ícone é **SVG** de `components/icones.tsx`.
- Alvo de toque: **40px** no desktop, **44px** no celular. O sistema roda em
  tablet no balcão, onde se usa o dedo.
- Contraste mínimo **4,5:1** (3:1 para texto grande). Há um medidor pronto: o
  jeito de conferir está no histórico desta sessão.
- Sombra é **quente** (marrom), nunca cinza — é o que dá o ar de papel.
- Movimento entre **150 e 300ms**, e respeitando `prefers-reduced-motion`.
