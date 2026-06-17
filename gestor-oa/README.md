# GestorOA

SaaS multi-tenant de **gestão de obrigações acessórias** para escritórios de contabilidade brasileiros. Réplica funcional da mecânica do "Acessórias" — é a camada de **gestão e entrega** (não apura impostos).

> Cadeia central: **Empresa → Regime/Grupos → Obrigações → Prazos (Entregas) → Entrega → Protocolo → Cliente final**

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node 20+, Express, TypeScript |
| ORM/Banco | Prisma + PostgreSQL |
| Frontend | React 18 + Vite + TypeScript (PWA) |
| Estilo | Tailwind CSS (azul-petróleo / cinza-claro) |
| Auth | JWT (access 15min + refresh httpOnly 7d), bcrypt |
| Filas | BullMQ + Redis, **com fallback Postgres** |
| E-mail | Nodemailer (SMTP) |
| OCR | pdf-parse + Tesseract.js |
| Deploy | VPS Ubuntu + PM2 + Nginx + certbot |

Monorepo (npm workspaces): `shared/` (tipos TS), `server/` (API), `web/` (PWA).

## Status de implementação

Construção **fase por fase**. Concluído:

- ✅ **Módulo 0 — Fundação, Auth e Tenant**: registro de escritório, login (com horários de acesso), refresh rotativo, logout, recuperação de senha por e-mail, multi-tenant, RBAC granular por flags, auditoria automática (Prisma middleware), configurações do escritório (logo, From, SMTP próprio).

Próximos: Módulo 1 (Empresas) → 2 (Obrigações) → 3 (Entregas) → 4 (Usuários/Permissões) → ...

## Setup local

### Pré-requisitos
- Node 20+
- PostgreSQL rodando

### Passos

```bash
cd gestor-oa
cp .env.example .env          # ajuste DATABASE_URL e segredos JWT
npm install                   # instala todos os workspaces

# Banco
npm run prisma:generate
npm run prisma:migrate        # cria as tabelas
npm run seed:demo             # dados de demonstração

# Desenvolvimento (API :4002 + Web :5174)
npm run dev
```

Acesse `http://localhost:5174`.

### Logins de demonstração (após `seed:demo`)

| Papel | E-mail | Senha |
|-------|--------|-------|
| Admin | admin@demo.com.br | senha123 |
| Fiscal | fiscal@demo.com.br | senha123 |
| Pessoal | pessoal@demo.com.br | senha123 |

## Build de produção

```bash
npm run build                 # shared + server + web
# server -> server/dist ; web -> web/dist (estático servido pelo Nginx)
```

## Deploy (VPS)

1. `npm ci && npm run build`
2. `cd server && npx prisma migrate deploy`
3. `pm2 start ecosystem.config.js` (sobe a API na porta 4002)
4. Copie `web/dist` para `/var/www/gestoroa/web`
5. Configure o Nginx com base em [`infra/nginx.conf.example`](infra/nginx.conf.example)
6. `certbot --nginx -d gestoroa.seudominio.com.br`

## Primeiros passos — ciclo mensal (visão geral)

> Disponível conforme os módulos forem entregues:

1. **Gerar competência** (Módulo 3): job mensal cria as entregas datadas de cada obrigação ativa.
2. **Robô baixa a guia** (Módulo 5): solta os PDFs na "Caixa do Robô"; ele identifica empresa+obrigação+competência e dá baixa.
3. **Cliente recebe com protocolo** (Módulos 7/8): documento é distribuído por e-mail/WhatsApp/Área VIP com link `/p/{token}` que registra a visualização.

## Convenções

- API REST em `/api/v1`, resposta `{ ok, data, error }`, paginação `?page=&limit=` (máx 100).
- Multi-tenant: tudo isolado por `escritorioId`.
- Soft delete (`deletedAt`), auditoria automática, RBAC por flags.
- Timezone `America/Sao_Paulo`; validação Zod com mensagens em PT-BR.
- Decisões de produto registradas em [`DECISIONS.md`](DECISIONS.md).
