# Sistema para Restaurantes

SaaS de canal próprio (gestor de pedidos + cardápio digital sem comissão) e portal/marketplace.
O contexto completo do produto está em [CLAUDE.md](./CLAUDE.md).

**Etapa atual: 6 — Portal / marketplace da rede (concluída).**

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
| **PORTAL** — a vitrine da rede (sem login) | http://localhost:3010/portal |
| **Relatórios** — vendas, itens e horários de pico | http://localhost:3010/relatorios |
| **Financeiro** — DRE, contas e acertos | http://localhost:3010/financeiro |
| **Estoque** — insumos, ficha técnica e CMV | http://localhost:3010/estoque |
| **Entregas** — motoboys, corridas e acerto | http://localhost:3010/entregadores |
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

---

## Como testar a Etapa 5 (gestão e bastidores)

### O que o exemplo já traz

- **10 insumos** cadastrados, com custo, estoque e mínimo
- **Ficha técnica** completa do **Spaghetti à Bolonhesa** e da **Pizza Margherita**
- **2 entregadores**: Rafael (fatia do frete) e Lucas (R$ 8,00 fixo por entrega)
- A **Embalagem delivery** entra abaixo do mínimo de propósito, para você ver o alerta

### Passo a passo

**1. Relatório de vendas por marca**
Abra http://localhost:3010/relatorios. Faturamento, nº de pedidos, ticket médio e
**horário de pico** no topo; embaixo, a quebra **por marca**, por canal, os itens
mais vendidos e o gráfico de horários. Dá para filtrar por período, marca e canal.

**2. Ficha técnica e CMV**
Em http://localhost:3010/estoque → aba **Fichas técnicas e margem**.
A lista vem ordenada pela **pior margem primeiro** — é onde o dinheiro escapa.
Clique no **Spaghetti à Bolonhesa**:

| | |
|---|---|
| Preço de venda | R$ 46,90 |
| **CMV** (custo real) | **R$ 13,43** — 28,6% do preço |
| **Margem** | **R$ 33,47** — 71,4% |

Cada linha mostra a quantidade, a **perda** e quanto ela custa. Repare na cebola:
40 g no prato, mas com 20% de perda saem 48 g do estoque — porque a casca você
paga do mesmo jeito.

**3. Montar uma ficha do zero**
Clique em qualquer prato sem ficha (ex.: *Fettuccine Alfredo*), escolha um insumo,
informe a quantidade e a perda, e clique em **Adicionar à ficha**. O CMV e a
margem aparecem na hora.

**4. Baixa automática no estoque**
Anote o estoque da *Massa de espaguete*. Faça um pedido de Spaghetti, pague, e no
KDS clique em **Aceito**. Volte no estoque: baixou sozinho.
Cancele o pedido: **volta sozinho** também.

**5. Alerta de estoque mínimo**
No topo da tela de Estoque, a tarja vermelha mostra o que está abaixo do mínimo.
Use a coluna **Movimentar** para dar entrada de compra e ver o alerta sumir.

**6. Atribuir um pedido a um motoboy**
Abra http://localhost:3010/entregadores. Os pedidos prontos aparecem em
**Esperando entregador**. Escolha o motoboy e clique em **Atribuir**.

Compare as duas formas de pagamento com o mesmo frete de R$ 9,00:
- **Rafael** (fatia do frete) recebe **R$ 8,10** — a plataforma retém 10%
- **Lucas** (valor fixo) recebe **R$ 8,00**

Depois avance: **Saiu para entrega** → **Entregou**.

**7. Acerto do motoboy**
Ainda em Entregas, clique em **Fechar acerto** no cartão do entregador, escolha o
período e confirme. O acerto **vira automaticamente uma conta a pagar** —
confira em http://localhost:3010/financeiro → aba **Contas**.

**8. DRE do mês**
Em Financeiro → aba **DRE**:

```
  Receita bruta
− Deduções (comissões e frete)
= Receita líquida
− CMV (custo da comida, pela ficha técnica)
= Lucro bruto
− Despesas
= Resultado
```

Lance uma despesa em **Contas → + Novo lançamento** (ex.: aluguel) e veja a DRE mudar.

**9. LGPD: exportar e apagar**
Em http://localhost:3010/clientes, abra um cliente e desça até
**Dados pessoais (LGPD)**:
- **Exportar dados** baixa um arquivo com tudo que o restaurante guarda
- **Apagar dados pessoais** anonimiza: nome, telefone e endereço somem, mas os
  valores dos pedidos ficam — a venda é obrigação fiscal

---

## Como testar a trava do cashback (código de confirmação)

### O problema que isto resolve

Até aqui, o **telefone era a única identificação** do cliente no resgate do
cashback. Telefone não é segredo: quem soubesse o número de outra pessoa
gastava o saldo dela. Era a única pendência da lista que eu chamaria de
perigosa.

### Como funciona agora

Ver o saldo continua fácil (senão ninguém se daria ao trabalho de confirmar).
**Gastar** exige um código de 6 dígitos.

O código sai pela **mesma porta de mensagens** das campanhas. Hoje o adaptador
é fake e o código aparece na própria tela, marcado como *modo de teste*; quando
o WhatsApp for ligado na Etapa 7, o mesmo código passa a chegar no celular —
sem mudar uma linha.

### Passo a passo

1. Faça um pedido em http://localhost:3010/m/cantina-da-nona e leve até
   **Entregue**, para o cliente ganhar cashback. (Ou credite à mão em
   **Clientes → abrir o cliente → cashback**.)
2. Comece um pedido novo com o **mesmo telefone**. Ao digitar o número, aparece
   *"Você tem R$ X de cashback aqui"*.
3. Marque **Usar**. Agora surge **Enviar código**.
4. Clique. A tela mostra para onde foi (`•••••••2222`) e, em modo de teste, o
   próprio código.
5. Digite o código e **Confirme**. Só então o desconto entra na conta.

### As travas (pode tentar quebrar)

| O que você tenta | O que acontece |
|---|---|
| Fechar o pedido com cashback **sem** confirmar | Recusa: "confirme o código que enviamos" |
| Inventar um código de autorização | Recusa: "a confirmação venceu ou já foi usada" |
| Errar o código | Recusa. Ao 5º erro o código morre e é preciso pedir outro |
| Usar o **mesmo** código em dois pedidos | Recusa: um código, um pedido |
| Pedir código sem parar (para incomodar alguém) | Recusa a partir do 4º na mesma hora |
| Descobrir se um telefone é cliente da casa | Impossível: a resposta é **idêntica** para número com e sem cadastro |
| Descobrir o **nome** de quem tem aquele telefone | Não sai mais — a consulta pública devolve só o saldo |

> Teste real feito aqui: o "estranho" foi barrado duas vezes (sem código e com
> código inventado); a dona do telefone pediu o código `709198`, confirmou e
> fechou o pedido de R$ 24,90 pagando **R$ 19,45** (R$ 12,45 de cashback, que é
> o teto de 50%); e o mesmo código, reutilizado, foi recusado. ✅

**O que ainda não protege:** o código chega pelo canal do telefone. Quem tiver
acesso ao **celular** da pessoa continua conseguindo — é o mesmo limite de
qualquer confirmação por SMS/WhatsApp, e é aceitável para o tamanho do valor.

---

## Como testar o resgate da carteira da rede

### O que mudou

A carteira do portal acumulava, aparecia... e não dava para gastar. Agora dá — e
com a **mesma confirmação por código** do cashback da marca, porque ela tinha o
mesmo furo: o telefone identificava, mas não provava nada.

### Passo a passo

1. Faça um pedido pelo **portal** (`/portal`) e conclua. Você ganha cashback da
   rede (2% do pedido).
2. Faça um pedido novo, no portal, **com o mesmo telefone**. Ao digitá-lo,
   aparece *"Você tem R$ X na sua carteira da rede"*.
3. Marque **Usar** → **Enviar código** → digite os 6 dígitos → **Confirmar**.
4. Feche o pedido: o valor sai do total e o extrato da carteira registra a saída.

### A parte que protege o restaurante

Este é o ponto mais delicado do produto, então vale ler devagar:

**O desconto sai do bolso do PORTAL, nunca do restaurante.**

No teste real: pedido de R$ 45,09 no portal (R$ 39,09 de comida, já com R$ 4,19
de comissão embutida, + R$ 6,00 de frete), com R$ 20,00 pagos da carteira.

| Quem | Recebe |
|---|---|
| **Restaurante** | **R$ 34,90** — o preço cheio do cardápio dele, intacto |
| Motoboy | R$ 5,40 |
| **Plataforma** | **− R$ 15,21** (ficou negativa: bancou o desconto) |
| Soma | R$ 25,09 = exatamente o que o cliente pagou ✅ |

Se o desconto do portal encolhesse a parte do restaurante, o portal estaria
fazendo promoção com o dinheiro dos outros — e a promessa do produto ("o
restaurante recebe cheio") viraria mentira. Há **5 testes automáticos** só
protegendo essa conta.

> Teste real: o "estranho" que só sabia o telefone foi barrado; a dona confirmou
> o código `216113` e o pedido `NV3S3C` saiu por **R$ 25,09** com **−R$ 20,00**
> da carteira; o saldo caiu de R$ 24,26 para R$ 5,43 e o extrato mostrou as duas
> linhas. ✅

### O que ficou como "fake / ponta solta"

| Item | Situação | Quando resolve |
|---|---|---|
| **Teto de uso** | A carteira pode cobrir o pedido **inteiro**, diferente do cashback da marca (limitado a 50%). Se virar porta para abuso, é uma linha para mudar | Observar no uso real |
| **Validade do saldo** | O campo existe, mas nada expira a carteira da rede ainda (o cashback da marca já expira) | Quando o saldo acumular |
| **Estorno** | Cancelando o pedido, o saldo usado **não volta** sozinho | Precisa de tratamento no cancelamento |
| **Só no portal** | A carteira da rede não vale no canal direto do restaurante — de propósito: é o incentivo do portal | Por escolha |

---

## Como testar os limites de plano e a cobrança

### As duas decisões que você tomou

| Situação | O que o sistema faz |
|---|---|
| **Estourou os pedidos do plano** | **Nunca bloqueia.** Avisa em 80%, avisa ao passar, e cobra o excedente na fatura |
| **Estourou as marcas do plano** | Bloqueia a criação da próxima marca (é ato de administração: nada para de vender) |
| **Mensalidade atrasada** | Avisa com contagem regressiva e, **a partir do 15º dia, bloqueia tudo** — painel e cardápio |

O porquê da primeira: travar a venda do restaurante no meio do almoço é o jeito
mais rápido de perdê-lo — e a culpa, para ele, seria sua.

### Passo a passo

**1. Ver o consumo**
Entre no Painel. Se estiver perto do limite, aparece a faixa de aviso. Para
forçar o cenário, diminua o limite do plano no banco:

```bash
docker compose exec db psql -U restaurante -d restaurante -c "UPDATE plans SET \"maxOrdersPerMonth\"=5 WHERE code='PRO';"
```

Recarregue o Painel: aparece **"seus pedidos continuam entrando normalmente"**
com o valor do excedente acumulado.

**2. Provar que o pedido não é bloqueado**
Com o limite estourado, faça um pedido em `/m/cantina-da-nona`. Ele entra.

**3. Limite de marcas**
Rebaixe para o plano Start (1 marca) e tente criar uma marca em `/admin`:
recusa dizendo quantas você tem e onde subir de plano.

**4. Atraso de pagamento**
Crie uma fatura vencida há 10 dias — aparece a faixa vermelha com *"bloqueado
em 5 dias"*, mas tudo funciona. Mude para 16 dias: painel e PDV passam a
responder **403**, e o cardápio público mostra *"temporariamente
indisponível"* — sem citar fatura, porque o cliente do restaurante não tem
nada a ver com isso.

### O detalhe que faz o bloqueio cobrar em vez de só irritar

Três coisas **continuam abertas** mesmo bloqueado: o **login**, a tela de
**assinatura** e o **aviso que explica o bloqueio**. Sem elas, o devedor veria
telas quebradas, não entenderia o motivo e não teria como pagar.

> Teste real feito aqui: com plano Start e 4 marcas, a criação foi recusada; com
> limite forçado em 5 pedidos e 15 feitos, o sistema apontou **10 de excedente
> (R$ 3,00)** e o pedido seguinte **entrou normalmente**; com 10 dias de atraso
> nada travou; com 16 dias, KDS e PDV deram **403**, o cardápio fechou, mas
> login, assinatura e o aviso continuaram abrindo. ✅

### O que ficou como "fake / ponta solta"

| Item | Situação | Quando resolve |
|---|---|---|
| **A cobrança em si** | `FakeBillingProvider`: a fatura é emitida e o excedente é calculado, mas nada é cobrado de verdade | Etapa 7 |
| **Aviso por e-mail/WhatsApp** | O aviso de vencimento só aparece **dentro do painel**. Quem não entrar, não vê | Etapa 7 |
| **Excedente do mês corrente** | Só vira dinheiro na virada do período. No meio do mês é uma estimativa | — |
| **Reativação** | Pagando, o bloqueio some na hora. Mas quem marca a fatura como paga hoje é o botão de teste | Etapa 7 |
| **Limites por recurso** | Só marcas e pedidos são contados. "Salão", "portal" e afins aparecem no plano mas não são checados | Se você quiser depois |

---

## Como testar o aplicativo instalável e a venda sem internet

### As duas coisas que isto resolve

1. **Instalar como aplicativo** (PWA): o sistema vira um ícone no celular ou no
   computador, abre sem barra de navegador e sem digitar endereço.
2. **O caixa não parar quando a internet cai**: a venda é guardada no aparelho
   e sobe sozinha quando a conexão volta.

### Instalar

Abra http://localhost:3010 no Chrome ou Edge. Aparece um ícone de **instalar**
na barra de endereço (ou em *⋮ → Instalar*). No celular: *Adicionar à tela de
início*. Instalado, ele ainda ganha atalhos diretos para **PDV**, **Cozinha** e
**Pedidos**.

> Fora do `localhost`, os navegadores só aceitam isso em **HTTPS** — no dia do
> deploy, o certificado deixa de ser opcional.

### Vender sem internet (o teste que vale)

1. Abra http://localhost:3010/pdv e deixe carregar (é quando o cardápio fica
   guardado no aparelho).
2. **Desligue o Wi-Fi** — ou, no navegador, `F12 → Network → Offline`.
3. Aparece a faixa **📴 Sem internet**, explicando o que fazer.
4. **Venda normalmente.** Monte, escolha dinheiro, digite o valor recebido: o
   **troco é calculado no próprio aparelho**.
5. O comprovante sai com um código **`OFF-1212`** e o aviso de **avisar a
   cozinha** — ela só recebe o pedido quando a internet voltar.
6. Faça mais uma venda. A faixa amarela mostra **2 vendas esperando para subir**.
7. **Religue a internet.** Em segundos a faixa some sozinha: as vendas subiram,
   na ordem, e já estão no `/kds`.

### Por que não vira venda dobrada

Cada venda leva um **apelido único** gerado no aparelho. Se a resposta do
servidor se perder no caminho, o aparelho reenvia — e o servidor, ao ver o mesmo
apelido, **devolve o pedido que já existe** em vez de criar outro.

> Teste real feito aqui: a mesma venda foi enviada **3 vezes** e virou **um só**
> pedido (`EBBQDJ`), com a resposta avisando *"já tinha subido"* na 2ª e na 3ª.
> Duas vendas feitas offline (`OFF-1212` e `OFF-3190`) subiram sozinhas quando a
> conexão voltou, **com a hora do balcão** (19:13 e 19:14), não a da
> sincronização — senão a venda das 23h50 cairia no caixa do dia seguinte. ✅

### O que ficou como "fake / ponta solta"

| Item | Situação | Quando resolve |
|---|---|---|
| **A cozinha offline** | O KDS **não** funciona sem internet — ele vive no servidor. Sem conexão, o caixa vende e a cozinha produz **pelo papel**. É assim que funciona qualquer PDV com contingência, mas é bom você saber | Só um servidor dentro da loja resolveria |
| **Cardápio velho** | Offline, o aparelho usa o cardápio da última vez que abriu online. Preço mudado nesse meio-tempo **não** aparece | Aceitável: o servidor reconfere o preço quando a venda sobe |
| **Estoque offline** | A baixa de estoque só acontece quando a venda sobe. Dá para vender o que já acabou | Inerente ao modo offline |
| **Cashback e cupom offline** | Não funcionam sem internet — dependem de consultar o servidor | Se você quiser depois |
| **Venda recusada na volta** | Se o servidor recusar (item apagado, marca pausada), a tela avisa mas **quem resolve é o gerente, na mão** | Precisa de uma tela de conferência |
| **Ícones do aplicativo** | São quadrados de cor sólida, gerados por código. Trocar pela sua arte é só substituir dois PNGs | Quando tiver a arte |
| **Outras telas offline** | Só `/pdv` e `/painel` abrem sem internet. As demais mostram a tela *Sem internet* | Por escolha: só o caixa precisa mesmo |

---

## Como testar o PDV (o caixa do balcão)

### A ideia em uma frase

O balcão é o único canal onde o cliente **pede e paga no mesmo instante** — por
isso a venda nasce já paga e já na cozinha, num clique só.

### Onde fica

http://localhost:3010/pdv — ou o botão **🧾 PDV (balcão)** no Painel.
Quem opera: **dono, gerente e caixa**. O garçom é bloqueado de propósito: ele
lança na comanda da mesa, não mexe em dinheiro.

### Passo a passo

**1. Escolha a marca** (se houver mais de uma com cardápio de balcão).
Marca sem cardápio de balcão nem aparece — crie um em
**Cadastro → Cardápio → + Balcão**.

**2. Clique nos itens.** É o mesmo montador do totem e da comanda, em letra
grande. Complemento obrigatório (o ponto da carne, o sabor do refrigerante)
continua sendo exigido — o caixa não consegue mandar um pedido incompleto para
a cozinha.

**3. Ir para o pagamento.** Confira a lista, escolha **Dinheiro / Cartão / Pix**.
No dinheiro, digite quanto o cliente entregou e o **troco aparece na hora**, em
destaque. Se o valor não cobrir a conta, a tela avisa e o botão recusa.

**4. Identificar o cliente é opcional.** Com o telefone, a pessoa entra na base
da marca e ganha cashback quando o pedido for concluído — é como o balcão vira
CRM. Sem telefone a venda sai igual, só não dá para reconhecê-la depois.

**5. Receber.** Aparece o **código para chamar o cliente** em letra grande, o
total e o troco. O pedido já está no `/kds`. Clique **Próximo cliente** e a tela
zera para o próximo da fila.

**6. Fechamento do dia.** O botão **🧾 Fechamento do dia** mostra quanto passou
no balcão hoje, **separado por forma de pagamento** — é pela linha *Dinheiro*
que se confere a gaveta, não pelo total (cartão e Pix não estão lá).

### A prova de que funcionou

> Teste real feito aqui: venda de 1 Zé Clássico (ao ponto) + 2 refrigerantes
> (cola) = **R$ 43,70**, cliente entregou R$ 50,00 → **troco R$ 6,30**. O pedido
> `ES8T8Y` apareceu no KDS como canal `COUNTER` com 2 linhas. Uma segunda venda
> no cartão (R$ 20,70) gravou o split com **R$ 0,72 de taxa (3,5%)** para a
> plataforma e **R$ 19,98** para o restaurante — no dinheiro, o restaurante
> ficou com os R$ 43,70 inteiros. ✅

### As travas (pode tentar quebrar)

| O que você tenta | O que acontece |
|---|---|
| Mandar um item sem o complemento obrigatório | Recusa, dizendo qual escolha falta |
| Dizer que recebeu menos que o total | Recusa: "o valor recebido é menor que o total" |
| Vender numa marca pausada | Recusa e mostra o motivo da pausa |
| Entrar no `/pdv` como garçom | 403 — o caixa não é dele |
| Mandar o preço junto com o pedido | Ignorado: o preço é sempre relido do banco |

---

## Como testar as Telas de Cadastro (`/admin`)

### A ideia em uma frase

Até aqui, marca, cardápio, mesas e equipe vinham do **seed** (dados de exemplo
criados por script). Agora **você mesmo cadastra tudo pela tela**, sem programador.

### Onde fica

Entre em http://localhost:3010/painel e clique em **⚙ Cadastro** (canto superior
direito). Ou vá direto em http://localhost:3010/admin.

Quem entra: **dono** e **gerente**. Só o **dono** cria, edita e apaga usuários.

### Passo a passo (monte um restaurante do zero)

**1. Criar a marca**
Clique em **+ Nova marca**, dê um nome (ex.: *Padaria da Esquina*) e uma descrição.
O endereço público sai pronto: `/m/padaria-da-esquina`. O cardápio de **Delivery**
é criado junto, vazio.

**1.1. A cara da marca** (aba *A cara da marca*)
Envie a **logo** do computador, escolha a **cor** (com uma amostra ao vivo de
como os botões vão ficar) e ajuste o nome e a frase. É o white-label: quem abre
`/m/sua-marca` vê o restaurante, não o nosso sistema. O endereço público
continua o mesmo — só a aparência muda.

**2. Montar o cardápio** (aba *Cardápio*)
- Escolha o canal em cima (**Delivery / Salão / Balcão**). Se o canal ainda não
  existe, aparece o botão **+ Salão** / **+ Balcão** para criá-lo.
- Digite o nome da categoria e clique **+ Categoria** (ex.: *Pães*).
- Clique **+ Item em Pães**, preencha nome, descrição e preço, e **Criar item**.
- Nas setas **↑ ↓** você reordena; no **👁** esconde sem apagar; no **✎** edita.
- Dentro do item você **envia a foto do seu computador** e cria **complementos**
  (ex.: grupo *Escolha o ponto*, mínimo 1, máximo 1).
- **Copiar cardápio** traz tudo de um canal para outro **com ajuste de preço**
  (ex.: salão +20%). Só funciona em canal ainda vazio, para não bagunçar.

**3. Horários e entrega** (aba *Horários e entrega*)
- Marque os dias e horas, ou clique **Abrir 24h todo dia** para testar rápido.
- Cadastre onde entrega: **por bairro** (você lista cada um com frete e pedido
  mínimo) **ou por distância** (faixas de km).
- Configure o **cashback** desta marca: quanto volta, validade e teto de uso.

**4. Unidades e mesas** (aba *Unidades e mesas*)
- **Ligue a marca na cozinha** (uma dark kitchen tem várias marcas na mesma cozinha).
- Crie **estações** (forno, chapa, bebidas) — é para onde o prato vai no KDS.
- Crie **mesas em lote** (ex.: da 1 à 20). Cada mesa ganha seu endereço de QR.

**5. Equipe** (aba *Usuários*)
Crie a pessoa com e-mail, senha inicial e perfil. A tela explica **o que cada
perfil enxerga**. Trocar o perfil é um clique no seletor.

### A prova de que funcionou

Depois dos 5 passos, abra `http://localhost:3010/m/<sua-marca>` numa aba
anônima e **faça um pedido**. Ele cai no `/pedidos` e no `/kds` como qualquer
outro — o sistema não sabe (nem se importa) se o cardápio veio do seed ou da tela.

> Teste real feito aqui: marca *Padaria da Esquina* criada pela tela, item
> *Pão francês (kg)* a R$ 22,90, bairro *Centro* com frete R$ 7,00.
> Pedido de 2 unidades fechou em **R$ 52,80** (45,80 + 7,00). ✅

### As travas de segurança (pode tentar quebrar)

| O que você tenta | O que acontece |
|---|---|
| Criar duas marcas com o mesmo nome | Recusa: o endereço público ficaria duplicado |
| Complemento com mínimo 2 e máximo 1 | Recusa: regra impossível |
| Fechar às 10h e abrir às 18h | Recusa: o fechamento tem que ser depois da abertura |
| Copiar cardápio para um canal que já tem itens | Recusa, para não misturar |
| Apagar uma mesa com comanda aberta | Recusa: primeiro feche a conta |
| Apagar você mesmo, ou o último dono | Recusa: alguém precisa ficar com a chave |
| Gerente tentando criar usuário | Recusa: só o dono |
| Mexer no cadastro de outro restaurante | 404 — do seu ponto de vista aquilo não existe |

---

## O que ficou como "fake / ponta solta" no PDV

| Item | Situação | Quando resolve |
|---|---|---|
| **Maquininha (TEF)** | O caixa aperta "Cartão" e o sistema confia. A maquininha é separada — não há integração que confirme a aprovação | Etapa 7 |
| **Impressão** | O botão *Imprimir* usa a impressão do navegador. Impressora térmica de verdade (ESC/POS) e gaveta que abre sozinha não existem | Quando tiver a impressora |
| **Sangria e suprimento** | O fechamento mostra o que **vendeu**, não o caixa físico: não há "tirei R$ 200 da gaveta" nem fundo de troco | Se você quiser depois |
| **Cancelar venda** | Feita a venda, o estorno é pelo painel de pedidos (cancelar o pedido). Não há botão de estorno no próprio PDV | Se acontecer no uso real |
| **Cupom e cashback no balcão** | Não dá para aplicar cupom nem gastar cashback na venda de balcão — só ganhar | Junto com o resgate seguro |
| **Fechamento por turno** | O resumo é do **dia**, não do turno de cada operador | Se você tiver mais de um turno |
| **Funciona sem internet** | Não. Se a internet cair, o PDV para — é a mesma pendência do modo de contingência | Continua pendente |

---

## O que ficou como "fake / ponta solta" nas Telas de Cadastro

| Item | Situação | Quando resolve |
|---|---|---|
| **Foto do item e logo** | Salvam **no disco do servidor** (`/app/uploads`). Funciona num servidor só; com dois, cada um teria fotos diferentes | Quando escalar: S3 ou similar |
| **E-mail do usuário** | É único **no sistema inteiro**, não por restaurante. Dois restaurantes não podem usar o mesmo e-mail | Antes de abrir para vários clientes |
| **Troca de senha pelo próprio usuário** | Não existe: quem redefine é o dono, pela tela | Etapa de qualidade e confiança |
| **Apagar marca** | Não existe — só criar e editar. Apagar levaria junto pedidos e histórico | Precisa virar "arquivar", não apagar |
| **Imagem do QR da mesa** | O endereço da mesa é gerado, mas não a **figura** para imprimir | Continua pendente |
| **Cadastro de insumos e fichas técnicas** | Continua só pela tela de Estoque, não aqui | — |
| **Marca *Padaria da Esquina*** | Ficou no banco como resíduo do teste acima. Some ao rodar o seed de novo | — |

---

## Como testar a Etapa 6 (o Portal)

### A ideia em uma frase

O portal **apresenta** o restaurante a um cliente novo e depois **devolve** esse
cliente para o canal direto — o contrário do pedágio.

### Passo a passo

**1. Ativar a marca no portal**
Em http://localhost:3010/painel, no cartão de cada marca, clique em
**entrar no portal**. A linha mostra a categoria, a comissão e quantos pedidos o
portal já trouxe.

**2. A vitrine**
Abra http://localhost:3010/portal — **sem login**. As marcas que deram opt-in
aparecem ali, de qualquer restaurante da rede. Dá para buscar, filtrar por
categoria, ver só as abertas e ordenar por proximidade (escolha um bairro).

**3. O preço do portal**
Entre na Cantina pelo portal. Cada prato mostra **dois preços**:

| | |
|---|---|
| No portal | **R$ 52,53** |
| Direto com o restaurante | R$ 46,90 |

A diferença de **R$ 5,63** é a comissão de 12% — um **acréscimo pago por quem
chegou pelo portal**, não um desconto no bolso de quem cozinha.

**4. Fazer o pedido**
Monte um pedido e finalize. Na tela do checkout já aparece quanto os mesmos
itens custariam pedindo direto.

**5. O funil de graduação** ← o coração desta etapa
Na tela do pedido você recebe:

> 🎁 **Da próxima vez, peça direto e pague menos**
> Neste pedido você pagou R$ 11,26 a mais por ter chegado pelo portal.
> Cupom **DIRETOXXXXXX** — vale R$ 11,26 no site da Cantina.

**6. Para onde vai o seu dinheiro**
Mais abaixo, a divisão aparece **para o consumidor ver**:

```
🍽️ Restaurante   R$ 93,80   ← o valor CHEIO do cardápio dele
🛵 Entregador    R$  6,30
💻 Portal        R$ 11,96
```

**7. O pedido cai no gestor do restaurante**
Em http://localhost:3010/kds ele aparece como qualquer pedido. Em
http://localhost:3010/pedidos a origem é **PORTAL**. E em
http://localhost:3010/clientes o cliente está no CRM **daquele restaurante**.

**8. A carteira da rede**
Volte ao portal e consulte seu telefone em *Sua carteira da rede*: o cashback
de **3%** foi creditado. Peça em **outra marca** e veja o saldo somar — ele vale
em qualquer restaurante do portal.

**9. Pool de motoboys**
Em http://localhost:3010/entregadores, com pedidos prontos, o botão do pool
escolhe sozinho o entregador mais livre e mais perto. Se os seus estiverem
ocupados, ele busca um de **outro restaurante** que aceitou trabalhar para a
rede (no exemplo, o *Paulo*).

**10. A assinatura do SaaS**
Os planos são **Start (R$ 99)**, **Pro (R$ 249)** e **Network (R$ 499)** — a
cobrança é por empresa, não por marca. A fatura mensal é emitida pela fila, e
o cobrador é fake.

### Teste rápido pela API (opcional)

```bash
docker compose exec api npx jest
```

Devem passar **76 testes** — máquina de estados, divisão do dinheiro, papéis de
acesso, isolamento por empresa, canais de venda, cálculo de distância, divisão da
conta, taxa de serviço, cashback, segmentos, NPS, datas no fuso local, preço do
portal e split de 3 lados.

---

## O que ficou como "fake / ponta solta" na Etapa 6

| Item | Situação | Quando resolve |
|---|---|---|
| **Split no gateway** | A divisão é **calculada e gravada** por pedido, com os recebedores modelados. Mas quem executaria a transferência é o gateway — e ele ainda é fake | Etapa 7 |
| **Cobrança da assinatura** | `FakeBillingProvider`: cria assinatura, emite fatura e devolve link de mentira. Nada é cobrado de verdade | Etapa 7 |
| **Carteira da rede** | ✅ Resolvido — dá para gastar no portal, com código de confirmação; o desconto sai da fatia da plataforma | — |
| **Domínio** | A vitrine roda em `/portal` no mesmo site, como você escolheu. Virar domínio próprio é configuração, não código | Quando tiver o domínio |
| **Descoberta por proximidade** | Usa o mapa fake (linha reta, bairros de Imbituba). Sem raio de entrega real por marca na vitrine | Etapa 7 |
| **Avaliações no portal** | A vitrine não mostra nota nem comentários — o NPS existe, mas é interno de cada marca | Se você quiser depois |
| **Bloqueio por limite de plano** | ✅ Resolvido — marcas bloqueiam, pedidos cobram excedente, atraso corta em 15 dias | — |
| **Cupom de graduação** | É de uso único e vale 30 dias. Não há regra contra o cliente ficar alternando portal/direto para sempre ganhar cupom | Observar no uso real |
| **iFood** | `MarketplaceImport` continua vazio — o portal é nosso, não importa de terceiros | Etapa 7 |

---

## O que ficou como "fake / ponta solta" na Etapa 5

| Item | Situação | Quando resolve |
|---|---|---|
| **Despacho de entrega** | `FakeDeliveryProvider`: aceita a corrida e devolve id e rastreio, mas **nenhum motoboy real é chamado**. Quem escolhe o entregador é você, no painel | Etapa 7 |
| **Distância** | Continua em **linha reta** pelo mapa fake. Um mapa real dá 20-30% a mais e conhece qualquer endereço | Etapa 7 |
| **Rastreio para o cliente** | A API pública `/api/public/entrega/<código>` funciona, mas **não há tela** — o cliente ainda acompanha pelo `/pedido/<código>` | Quando fizer sentido |
| **CMV de pratos sem ficha** | Entra como **zero**, o que deixa o resultado da DRE otimista demais. A tela avisa isso | Conforme você cadastrar as fichas |
| **Estoque por unidade** | O insumo tem campo de unidade, mas o saldo é **um só** — não há estoque separado por loja | Quando houver a 2ª loja |
| **Compras** | Não há pedido de compra nem cadastro de fornecedor: a entrada é manual | Se você quiser depois |
| **DRE** | É **de caixa simplificado**: não separa competência de caixa, não trata impostos nem depreciação. Serve para o dono decidir, não para a contabilidade oficial | Nunca substitui o contador |
| **Acerto de garçom** | Calcula sobre a taxa de serviço dos pedidos que ele lançou. **Não há rateio** entre a equipe toda | Se você quiser depois |
| **Nota fiscal** | `FiscalProvider` continua vazio — nenhuma NF-e é emitida | Etapa 7 |
| **Exclusão LGPD** | É **anonimização**, como você escolheu. As mensagens enviadas viram "[removido]" e o telefone vira um apelido interno | — |

---

## O que ficou como "fake / ponta solta" na Etapa 4

| Item | Situação | Quando resolve |
|---|---|---|
| **WhatsApp** | `FakeMessagingProvider`: registra a mensagem, escreve no log e nada sai da máquina. Toda a mecânica (fila, tentativas, relatório) é real | Etapa 7 |
| **Resgate do cashback** | ✅ Resolvido — agora exige **código de 6 dígitos** para gastar o saldo. A mensagem sai pela porta de mensagens (fake hoje, WhatsApp na Etapa 7) | — |
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
| **Cadastro de usuários/marcas pela tela** | ✅ Resolvido — existe em `/admin` | — |
| **Segurança do cookie** | `secure: false` porque desenvolvimento é `http` | Vira `true` no deploy |
| **Recuperação de senha, 2FA, LGPD** | Não existem | Etapa de qualidade e confiança |
