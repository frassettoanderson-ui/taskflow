# Sistema para Restaurantes

SaaS de canal próprio (gestor de pedidos + cardápio digital sem comissão) e portal/marketplace.
O contexto completo do produto está em [CLAUDE.md](./CLAUDE.md).

**Etapa atual: 0 — Fundação (concluída).**

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
