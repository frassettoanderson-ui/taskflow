# Sistema para Restaurantes

SaaS de canal próprio (gestor de pedidos + cardápio digital sem comissão) e portal/marketplace.
O contexto completo do produto está em [CLAUDE.md](./CLAUDE.md).

**Etapa atual: 1 — Cardápio → pedido → cozinha → pagamento (concluída).**

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
| **Cardápio do cliente** (sem login) | http://localhost:3010/m/cantina-da-nona |
| **Cozinha (KDS)** — precisa login | http://localhost:3010/kds |
| **Acompanhar pedido** | http://localhost:3010/pedido/`CÓDIGO` |
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
| `operador@exemplo.com` | Operador (OPERATOR) |

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

### Teste rápido pela API (opcional)

```bash
docker compose exec api npx jest
```

Devem passar **21 testes** — máquina de estados, divisão do dinheiro, papéis de
acesso e isolamento por empresa.

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
