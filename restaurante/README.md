# Sistema para Restaurantes

SaaS de canal próprio (gestor de pedidos + cardápio digital sem comissão) e portal/marketplace.
O contexto completo do produto está em [CLAUDE.md](./CLAUDE.md).

**Etapa atual: 4 — CRM, fidelidade e marketing (concluída).**

---

## Como rodar

Você precisa de **Docker Desktop aberto** (ícone da baleia 🐳 ativo). Só isso — nada de instalar
Node, Postgres ou Redis na máquina.

Abra o terminal na pasta `restaurante` e rode:

```bash
docker compose up
```

Na primeira vez demora alguns minutos (baixa e instala tudo). Nas próximas, sobe em segundos.

Para desligar: `Ctrl + C` no terminal, ou `docker compose down`.

### Endereços

| O quê | Endereço |
|---|---|
| Site (login e Painel) | http://localhost:3010 |
| **Painel único de pedidos** (todas as marcas) | http://localhost:3010/pedidos |
| **Clientes (CRM)** — base, segmentos e ficha | http://localhost:3010/clientes |
| **Marketing** — cupons, campanhas e NPS | http://localhost:3010/marketing |
| **Salão** — mapa de mesas, fila e reservas | http://localhost:3010/salao |
| **QR Code da mesa 5** (o que o cliente abre) | http://localhost:3010/mesa/mesa-5 |
| **Totem de autoatendimento** | http://localhost:3010/mesa/mesa-5?modo=totem |
| **Cozinha (KDS)** — precisa login | http://localhost:3010/kds |
| **Acompanhar pedido** | http://localhost:3010/pedido/`CÓDIGO` |
| Cardápio — Cantina, delivery | http://localhost:3010/m/cantina-da-nona |
| Cardápio — Cantina, **salão** | http://localhost:3010/m/cantina-da-nona?canal=salao |
| Cardápio — Burger, delivery | http://localhost:3010/m/burger-do-ze |
| Cardápio — Burger, **balcão** | http://localhost:3010/m/burger-do-ze?canal=balcao |
| API (backend) | http://localhost:3011/api |
| "Está tudo de pé?" | http://localhost:3011/api/health |
| Banco PostgreSQL | `localhost:5442` |
| Redis | `localhost:6389` |

> As portas são fora do padrão de propósito, para não brigar com os outros projetos da máquina.

### Usuários de exemplo

Senha de todos: **`123456`**

| E-mail | Papel |
|---|---|
| `dono@exemplo.com` | Dono (OWNER) |
| `gerente@exemplo.com` | Gerente (MANAGER) |
| `caixa@exemplo.com` | Caixa (CASHIER) — fecha conta e recebe |
| `garcom@exemplo.com` | Garçom (WAITER) — lança pedido, **não** mexe em dinheiro |
| `operador@exemplo.com` | Operador de cozinha (OPERATOR) |

---

## Como testar a Etapa 0

### Teste 1 — Subiu tudo?

Abra http://localhost:3011/api/health. Deve aparecer:

```json
{ "api": "ok", "db": "ok", "cache": "ok", "etapa": 0 }
```

Os três precisam dizer `ok`.

### Teste 2 — Login funciona?

1. Abra http://localhost:3010
2. Você é mandado para a tela de **Entrar** (os campos já vêm preenchidos)
3. Clique em **Entrar**
4. Deve aparecer o **Painel** com: *Olá, Anderson (Dono)*, empresa **Grupo Sabor**, perfil
   **Dono** e a marca **Cantina da Nona**

### Teste 3 — Sem login, não entra

1. No Painel, clique em **Sair**
2. Tente abrir http://localhost:3010/painel direto
3. Você deve ser jogado de volta para o login

### Teste 4 — Um restaurante não vê o do outro

Esta é a prova do multi-tenant, e ela aparece **sozinha no Painel**, no cartão verde
"Teste de isolamento entre empresas".

O que acontece por trás: o sistema pede ao backend a marca `brd_rival_forno`, que pertence
a **outro** restaurante (a "Pizzaria Rival", criada pelo seed só para este teste). A resposta
tem que ser **404 — não encontrada**. Do seu ponto de vista, o dado do vizinho nem existe.

Se aparecer o cartão **vermelho**, o isolamento quebrou.

### Teste 5 — Papéis de acesso

Saia e entre com `operador@exemplo.com`. O Painel mostra o perfil **Operador**.
Operador não pode criar marca — só dono e gerente. (Ainda não há botão na tela para isso;
a regra está no backend e é testada automaticamente.)

### Teste 6 — Testes automáticos

```bash
docker compose exec api npx jest
```

Devem passar 8 testes (papéis de acesso e contexto de tenant).

---

---

## Como testar a Etapa 1 (o pedido de ponta a ponta)

O melhor teste usa **duas abas** do navegador lado a lado.

### Preparação

- **Aba 1:** http://localhost:3010/kds — entre com `dono@exemplo.com` / `123456`.
  Deve aparecer *"Ao vivo"* com uma bolinha verde.
- **Aba 2:** http://localhost:3010/m/cantina-da-nona (é o link que o restaurante
  mandaria para o cliente no WhatsApp — repare que **não pede login**).

### Passo a passo

1. **Monte o pedido.** Na aba 2, clique em **Spaghetti à Bolonhesa**.
2. **Veja a regra funcionar.** Clique em *Adicionar* sem escolher nada → ele barra:
   *"Escolha 1 opção em Ponto da massa"*.
3. **Escolha os complementos.** Marque **Al dente**, **Bacon** e **Queijo parmesão extra**.
   O botão vira **R$ 59,90** (46,90 + 7,00 + 6,00). Clique em *Adicionar*.
4. **Cross-sell.** Clique na barra laranja *Ver carrinho*. Embaixo aparece
   **"Quem pediu isto também levou…"** com 3 sugestões. Clique numa para adicionar.
5. **Feche o pedido.** Clique em *Continuar* → preencha nome, telefone e endereço.
   Em *"Quando você quer receber?"*, experimente **Agendar** e escolha uma data.
6. **Pague.** Clique em *Ir para o pagamento*. Você cai na tela de acompanhamento com o
   **QR Code de teste** e o Pix "copia e cola".
7. **Confira que a cozinha ainda NÃO viu o pedido.** Olhe a aba 1: continua vazia.
   Isso é de propósito — pedido só cai na cozinha depois de pago.
8. **Simule o pagamento.** Clique em **Simular pagamento aprovado**.
9. **Olhe a aba 1 sem tocar nela.** O pedido **aparece sozinho** na coluna *Novos*,
   com destaque laranja por alguns segundos.
10. **Avance na cozinha.** Clique em *Aceito*, *Em preparo*, *Pronto*…
11. **Olhe a aba 2 sem tocar nela.** A trilha do cliente anda sozinha, com o horário
    de cada etapa.
12. **Tente furar a fila.** Leve o pedido até *Entregue*. Depois disso, ele some da
    cozinha e não aceita mais mudança.

---

## Como testar a Etapa 2 (multimarca e multicanal)

### O que o exemplo monta

**Uma cozinha** ("Cozinha Centro", com CNPJ e endereço) com **4 estações** —
Forno, Chapa, Montagem e Bebidas — e **duas marcas dentro dela**:

| Marca | Canais | Entrega |
|---|---|---|
| **Cantina da Nona** | Delivery e **Salão** | por **bairro** |
| **Burger do Zé** | Delivery e **Balcão** | por **raio (km)** |

### Passo a passo

**1. As duas marcas num painel só**
Entre em http://localhost:3010/painel. O cartão *Marcas* mostra as duas, com
cada canal e se está aberto ou fechado agora.

**2. Mesmo prato, canal diferente, preço diferente**
Abra os dois e compare:
- Delivery: http://localhost:3010/m/cantina-da-nona → Spaghetti **R$ 46,90**
- Salão: http://localhost:3010/m/cantina-da-nona?canal=salao → Spaghetti **R$ 54,90**

No salão existem itens que **não existem** no delivery (Couvert da Casa, Taça de
Vinho). Use as abas no topo para trocar de canal.

O mesmo vale para a Burger: **R$ 32,90** no delivery e **R$ 29,90** no balcão.

**3. Frete por bairro (Cantina)**
Faça um pedido e experimente bairros diferentes:

| Bairro | O que acontece |
|---|---|
| Centro | frete **R$ 7,00** |
| Praia da Vila | frete **R$ 9,00** |
| Vila Nova | frete R$ 12,00, mas **exige R$ 40 de pedido mínimo** |
| Mirim | frete **R$ 15,00** |
| Ibiraquera | **recusado** — fora da área |

**4. Frete por raio (Burger)**
A mesma coisa, mas por distância da cozinha:

| Bairro | Distância | O que acontece |
|---|---|---|
| Praia da Vila | ~1,6 km | frete **R$ 6,00** |
| Mirim | ~3,9 km | frete **R$ 10,00** |
| Ibiraquera | ~10,7 km | **recusado** — entrega até 10 km |
| Bairro inventado | — | **recusado** — não localizou o endereço |

**5. Pausar uma marca em segundos**
No Painel, clique em **Pausar** na Burger do Zé. Abra
http://localhost:3010/m/burger-do-ze noutra aba: aparece a tarja vermelha
*"Não estamos aceitando pedidos agora"* e o botão de finalizar fica desligado.
Clique em **Reabrir** e recarregue: voltou ao normal.

**6. Pausar um item**
Mesmo efeito, mas só num prato: ele continua no cardápio, marcado como
**Indisponível hoje**, e não dá para clicar.

**7. Painel único de pedidos**
Abra http://localhost:3010/pedidos. Ali estão os pedidos **das duas marcas
misturados**, com o resumo por marca no topo e filtros de **marca**, **canal** e
**situação**. Ele atualiza ao vivo.

**8. KDS com roteamento por estação**
Abra http://localhost:3010/kds. No topo, escolha **Forno**, **Chapa**,
**Montagem** ou **Bebidas** — cada tela mostra só as linhas daquela estação
(a pizza vai para o Forno, a massa para a Chapa, o refrigerante para Bebidas).
O seletor de marca ao lado separa as filas por marca.

**9. Base de clientes é de cada marca**
Peça na Cantina e na Burger **com o mesmo telefone**. São criados **dois
cadastros separados** — a base é de cada marca, nunca compartilhada.
É o princípio "seus clientes, seus dados".

**10. Horário de funcionamento**
No rodapé de qualquer cardápio há a tabela de horários da semana, com o dia de
hoje em destaque. A Burger **fecha aos domingos no delivery** e o balcão dela
fecha às 22:00 — se você testar depois disso, vai ver a marca como *fechada*.

---

## Como testar a Etapa 3 (salão)

O exemplo tem **12 mesas da Cantina da Nona**: 8 no Interno (1 a 8) e 4 na Varanda
(V1 a V4). O endereço do QR de cada uma é `/mesa/mesa-<número>` — por exemplo
`/mesa/mesa-5` ou `/mesa/mesa-v2`.

Use **duas abas** lado a lado: uma como cliente, outra como equipe.

**1. O cliente aponta a câmera para o QR**
Abra http://localhost:3010/mesa/mesa-5 — **sem login**. Aparece *Mesa 5*, o
cardápio do **salão** (preços de salão) e dois botões: *Chamar garçom* e
*Pedir a conta*.

**2. Pedir pela mesa**
Escolha o **Spaghetti à Bolonhesa** (R$ 54,90 — repare que é o preço do salão,
não o do delivery) e envie. Aparece *"Pedido enviado para a cozinha"*, e a aba
**Minha conta** já mostra R$ 60,39 (o prato + 10% de serviço).

**3. O pedido cai no KDS marcado com a mesa**
Em http://localhost:3010/kds o pedido aparece com canal **Salão** e cliente
**Mesa 5**, com cada item na sua estação.

**4. Chamar garçom e pedir a conta**
Clique nos dois botões. Clique de novo: o sistema avisa que *já avisamos* — não
enche a tela do garçom com o mesmo chamado.

**5. O salão vê tudo ao vivo**
Abra http://localhost:3010/salao (como `caixa@exemplo.com`). Sem recarregar nada:
- os **chamados** aparecem no topo
- a **Mesa 5** fica laranja/amarela com o valor em aberto e um **sino vermelho**
- o rodapé mostra **fila de espera** e **reservas**

**6. O garçom lança uma rodada**
Clique na mesa ocupada → aba **Lançar pedido** → escolha algo → *Lançar na
cozinha*. A comanda passa a ter 2 rodadas, uma marcada como *cliente pelo QR* e
outra como *garçom*.

**7. O caixa fecha a conta**
Na aba **Conta**: *Fechar a conta*. Dá para **tirar a taxa de 10%** com um clique
(e recolocar).

**8. Dividir a conta**
Escolha em quantas partes e clique em *Dividir em N* — cada parte vira um Pix.
A soma **sempre fecha exato**: a última parte leva o centavo da sobra.
Também dá para *Gerar Pix* de um **valor livre** ("eu pago só R$ 50").

**9. Pagar e liberar a mesa**
Clique em *Simular Pix* em cada parte. A cada pagamento o "Falta" diminui.
Quando zera: a comanda vira **PAGA**, a **mesa volta a livre sozinha** no mapa e
a tela do cliente zera — tudo sem ninguém recarregar página.

**10. O garçom não mexe em dinheiro**
Entre como `garcom@exemplo.com` e abra a mesma mesa. Ele **vê** a conta, mas não
existem os botões *Fechar*, *Dividir* nem *Gerar Pix* — só o recado explicando
que quem recebe é o caixa.

**11. Totem de autoatendimento**
http://localhost:3010/mesa/mesa-5?modo=totem — mesma base, tela cheia, letras
maiores, sem os botões de mesa. Ao finalizar, mostra o código para retirar.

**12. A cozinha não entra no salão**
Entre como `operador@exemplo.com` e tente abrir /salao: acesso negado.

---

## Como testar a Etapa 4 (CRM, fidelidade e marketing)

### O que o exemplo já traz

- **Cashback:** Cantina devolve **5%** (validade 90 dias, pedido mínimo R$ 30, dá para pagar
  até 50% do pedido com ele). Burger devolve **3%** (60 dias).
- **Cupons:** `PRIMEIRA10` (10% no primeiro pedido), `VOLTASEMPRE` (R$ 15 para quem sumiu
  há 30 dias), `TERCADEMASSA` (frete grátis às terças, 18h–23h) e `BURGER5`.

### Passo a passo

**1. Um pedido cria o cliente no CRM**
Faça um pedido em http://localhost:3010/m/cantina-da-nona e abra
http://localhost:3010/clientes. O cliente está lá, com telefone, bairro, nº de
pedidos e ticket médio.

**2. Entregar o pedido credita o cashback**
Leve o pedido até **Entregue** no KDS. Volte em Clientes, clique no cliente:
o **extrato** mostra `ganhou +R$ X · 5% de volta`, com data de vencimento.

**3. Usar o cashback no próximo pedido**
Faça outro pedido e, no checkout, digite **o mesmo telefone**. Aparece:
*"💰 Joana, você tem R$ 14,35 de cashback aqui — usar neste pedido"*.
Marque a caixinha e veja o total cair.

**4. Cupom**
No mesmo checkout, digite `PRIMEIRA10` e clique em **Aplicar**. Se o cliente já
pediu antes, ele **recusa** com a explicação. Experimente também `TERCADEMASSA`
num dia que não seja terça — ele diz o motivo.

**5. Criar um cupom pela tela**
Em http://localhost:3010/marketing → aba **Cupons** → **+ Novo cupom**.
Crie, por exemplo, `SEMPRE15` com 15%, e use no checkout.

**6. Disparar uma campanha**
Aba **Campanhas** → **+ Nova campanha**. Escolha o segmento (ex.: *Todos*),
escreva a mensagem usando `{nome}` e crie. Depois clique em **Disparar agora**.

A campanha vai para a **fila** e a tela atualiza sozinha mostrando
*enviando… → concluída*, com o total de enviadas e falhas.

**7. Ver as mensagens "enviadas"**
Aba **Enviadas**: está tudo ali — campanha, recuperação de carrinho e pesquisa.
Como o WhatsApp é fake, nada sai da sua máquina. Também dá para acompanhar no log:

```bash
docker compose logs -f api
```

**8. Carrinho abandonado**
Monte um carrinho no cardápio, vá até o checkout, **digite nome e telefone** e
feche a aba sem finalizar. Em **Marketing → Satisfação**, o carrinho aparece
como *parado*. Passados **2 minutos** (em desenvolvimento), o lembrete é enviado
e o status vira *lembrete enviado*.

**9. Pesquisa de satisfação (NPS)**
**1 minuto** depois de um pedido ser entregue, o convite é enviado. Vá em
**Marketing → Enviadas**, copie o link `/avaliar/<código>` da mensagem e abra no
navegador. Dê uma nota de 0 a 10 e envie. O resultado aparece na aba
**Satisfação**, com o cálculo do NPS.

> Os prazos de 2 e 1 minuto são curtos **de propósito em desenvolvimento**, para
> você não esperar. Em produção seriam 30 e 60 minutos (`CART_RECOVERY_MINUTES`
> e `NPS_DELAY_MINUTES` no `docker-compose.yml`).

**10. Segmentos**
Na tela de Clientes, os botões do topo filtram: *Todos*, *Ainda não pediram*,
*Novos*, *Recorrentes (3+)* e *Inativos* — com a contagem de cada um.

### Teste rápido pela API (opcional)

```bash
docker compose exec api npx jest
```

Devem passar **58 testes** — máquina de estados, divisão do dinheiro, papéis de
acesso, isolamento por empresa, canais de venda, cálculo de distância, divisão da
conta, taxa de serviço, cashback, segmentos e NPS.

---

## O que ficou como "fake / ponta solta" na Etapa 4

| Item | Situação | Quando resolve |
|---|---|---|
| **WhatsApp** | `FakeMessagingProvider`: registra a mensagem, escreve no log e nada sai da máquina. Toda a mecânica (fila, tentativas, relatório) é real | Etapa 7 |
| **⚠️ Resgate do cashback** | Identificamos o cliente **só pelo telefone, sem confirmação** — como você escolheu. Quem souber o telefone de outra pessoa consegue gastar o cashback dela. **Não subir assim para produção** | Código por WhatsApp na Etapa 7 |
| **Carteira da rede** (`NetworkCustomer`) | Tabela criada e ligada ao cliente da marca, mas **ainda não é alimentada** — é a base do cashback do portal | Etapa 6 |
| **Trabalhadores da fila** | Rodam dentro da própria API. Com muito volume, viram um processo separado | Quando o volume pedir |
| **Campanhas** | Dispara na hora. **Não há agendamento** ("mandar sábado às 10h"), nem limite de velocidade por operadora | Etapa 7 |
| **Opt-out** | O campo existe e as campanhas respeitam, mas **o cliente não tem como se descadastrar sozinho** (falta o link na mensagem) | Etapa 7 |
| **Cupons** | Percentual, valor fixo e frete grátis, com regras de dia/horário/segmento. **Não há** cupom por item específico nem "compre 2 leve 3" | Se você quiser depois |
| **Cashback no salão** | Só funciona no delivery — no salão o cliente não se identifica por telefone | Quando fizer sentido |
| **LGPD** | Não há exportação nem exclusão de dados do cliente a pedido dele | Etapa de qualidade e confiança |

---

## O que ficou como "fake / ponta solta" na Etapa 3

| Item | Situação | Quando resolve |
|---|---|---|
| **QR Code** | O endereço da mesa funciona, mas **não geramos a imagem do QR** para imprimir e colar | Etapa de administração |
| **Pagamento na mesa** | Continua no `FakePixProvider` — o botão *Simular Pix* imita o aviso do banco. Nenhum dinheiro real | Etapa 7 |
| **Dividir por item** | Só por **N partes iguais** e por **valor livre**, como combinado. Marcar "o que cada um consumiu" não existe | Se você quiser depois |
| **Cadastro de mesas** | As 12 mesas vêm do seed. Não há tela para criar/renomear mesa nem arrastar no mapa | Etapa de administração |
| **Mesa e marca** | Cada mesa pertence a **uma** marca, como combinado. Praça de alimentação (pedir de várias marcas na mesma conta) não está previsto | Se você quiser depois |
| **Horário no salão** | O QR da mesa **não** confere horário de funcionamento de propósito — quem está sentado já foi recebido. Marca **pausada** bloqueia | — |
| **Reservas** | Cria, marca mesa como reservada e registra a chegada. Sem lembrete por WhatsApp nem controle de no-show automático | Etapa de atendimento |
| **Fila de espera** | Entra, chama e senta. **Não avisa o cliente** por mensagem | Etapa 7 (WhatsApp) |
| **Comanda por garçom** | O pedido guarda quem lançou, mas não há **relatório de vendas por garçom** nem acerto de comissão | Etapa de bastidores |
| **Impressão** | Não imprime comanda nem conta | Etapa de administração |

---

## O que ficou como "fake / ponta solta" na Etapa 2

| Item | Situação | Quando resolve |
|---|---|---|
| **Mapa / distância** | `FakeMapProvider` com uma tabelinha de bairros de Imbituba embutida e distância em **linha reta**. Um mapa de verdade dá 20-30% a mais e conhece qualquer endereço | Etapa 7 |
| **Cadastro de marcas, cardápios, bairros e horários** | Tudo vem do seed. Pela tela dá para **pausar** marca e item, e **ler** as regras — não para cadastrar | Etapa própria de administração |
| **Múltiplas unidades** | Modelado e funcionando por baixo (pedido guarda a unidade, estações pertencem à unidade, existe a tabela de exceção local por unidade), mas o exemplo roda com **uma** cozinha e não há tela de gestão de unidades | Quando você tiver a 2ª loja |
| **Exceção local do cardápio** (`UnitItemOverride`) | Tabela criada, mas ainda **não é lida** no cálculo de preço — hoje o preço é sempre o da marca | Junto com a 2ª unidade |
| **Escolha da unidade** | O pedido vai sempre para a primeira cozinha da marca. Com várias, precisará escolher a mais perto | Quando houver a 2ª loja |
| **Salão e balcão** | Já têm cardápio e preço próprios e aceitam pedido, mas **sem mesa, comanda nem QR na mesa** | Etapa do presencial |
| **Cliente da marca** | Guarda nome, telefone, último endereço e o resumo (nº de pedidos e total gasto). Ainda **não há tela** de CRM | Etapa de CRM/fidelidade |
| **Agendamento** | Continua sem organizar a fila por horário | Etapa de gestão de produção |

---

## Comandos úteis

```bash
docker compose up            # liga tudo
docker compose down          # desliga
docker compose down -v       # desliga E APAGA o banco (recomeça do zero)
docker compose logs -f api   # acompanha o backend
docker compose exec api npx prisma db seed   # recria os dados de exemplo
docker compose exec api npx prisma studio    # abre uma tela para ver o banco
```

### Quando eu acrescentar uma biblioteca nova

As bibliotecas ficam num "volume" separado do Docker, que **não se atualiza
sozinho** quando o `package.json` muda. Se o backend reclamar de um pacote que
deveria existir:

```bash
docker compose rm -sf api
docker volume rm restaurante_api_node_modules
docker compose up -d api
```

---

## O que ficou como "fake / ponta solta" na Etapa 1

| Item | Situação | Quando resolve |
|---|---|---|
| **Pagamento** | `FakePixProvider`: gera cobrança e QR de mentira, e o botão "Simular pagamento aprovado" imita o aviso do banco. Nenhum dinheiro real, nenhuma conta em gateway. A **lógica de divisão do dinheiro (split) está pronta e testada** | Gateway real na Etapa 7 |
| **Taxa de entrega** | Valor fixo configurável (`DELIVERY_FEE_CENTS`, hoje R$ 9,00). O cálculo por distância depende do `MapProvider`, que ainda é fake | Etapa 7 |
| **Tempo real** | Feito com **SSE** (o servidor empurra avisos para a tela), apoiado no Redis. O plano falava em WebSocket/Socket.IO; troquei porque aqui a conversa é de mão única (servidor → tela) e o SSE resolve com muito menos peça. Quando houver algo que exija mão dupla (chat, por exemplo), aí sim entra WebSocket | — |
| **Botão "Simular pagamento"** | Aparece sempre. Precisa ser escondido fora de desenvolvimento | Antes do primeiro cliente real |
| **QR Code** | É um desenho decorativo, não um QR que a câmera lê (está escrito "QR de teste" na tela) | Etapa 7 |
| **Cardápio** | Só o canal **delivery**, e vem do seed. Não há tela para o restaurante montar/editar o cardápio | Etapa própria de administração do cardápio |
| **Cross-sell** | Usa o histórico real de pedidos; sem histórico, cai nos mais baratos do cardápio | Melhora sozinho com o uso |
| **Agendamento** | Aceita data/hora e mostra na cozinha, mas ainda **não organiza a fila** por horário | Etapa de gestão de produção |
| **Marketplace / iFood / motoboy / NF-e / WhatsApp** | Interfaces definidas, implementações vazias | Etapa 7 |

## O que ficou como "fake / ponta solta" na Etapa 0

Coisas propositalmente incompletas, para resolver nas próximas etapas:

| Item | Situação | Quando resolve |
|---|---|---|
| **6 adaptadores externos** (pagamento, WhatsApp, mapa, NF-e, iFood, motoboy) | Interfaces definidas, implementações **vazias** (dão erro se chamadas) | Pagamento na Etapa 1; os demais na Etapa 7 |
| **Redis** | De pé e monitorado, mas ainda não usado | Etapa 1 (tempo real do KDS e filas) |
| **E-mail do usuário** | Único no sistema inteiro. O certo é ser único **por tenant** (dois restaurantes poderiam ter o mesmo e-mail) | Quando houver cadastro de novos clientes |
| **Migrations do banco** | Usamos `prisma db push` (rápido para desenvolver, mas sem histórico de mudanças) | Antes de ir para produção |
| **Isolamento por tenant** | Garantido **em código** (o Prisma injeta o `tenantId` e recusa consulta sem tenant) | Row-Level Security no banco pode ser somado depois, como 2ª camada |
| **Cadastro de usuários/marcas pela tela** | Não existe; tudo vem do seed | Etapa própria de configurações |
| **Segurança do cookie** | `secure: false` porque desenvolvimento é `http` | Vira `true` no deploy |
| **Recuperação de senha, 2FA, LGPD** | Não existem | Etapa de qualidade e confiança |
