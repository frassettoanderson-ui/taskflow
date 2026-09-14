# Financeiro Igreja

Sistema financeiro de igreja: **entradas (dízimos, ofertas)**, **saídas (despesas)**,
**contas/caixas** (incl. conta "caixinha" com depósito/transferência e ajuste de saldo)
e **balancete mensal**. Login próprio. Preparado para rodar sob subpasta no hub (`/igreja`).

## Stack
- Node + Express + **PostgreSQL** (sem ORM pesado; `db.js` + `schema.sql`)
- Roteadores em `routes/`, views em `public/`

## Rodar local
```bash
npm install
cp .env.example .env            # ajustar DATABASE_URL e SESSION_SECRET
psql "$DATABASE_URL" -f schema.sql
node criar-usuario.js "Anderson" admin@igreja.com minhasenha
npm start                        # http://localhost:3002
```

## Deploy
- Deploy via **SSH** (a chave já está configurada): eu faço `pull + schema + pm2`; você só recarrega.

## Recentes (git)
- Editar Saldo com texto + botão caixinha legível; conta caixinha (depósito/transferência) + ajuste de saldo por conta; editar/excluir lançamentos nos relatórios; filtro por banco; coluna Banco no relatório de Despesas.

## Memória relacionada
- "Projeto Igreja Financeiro", "Deploy Igreja via SSH"
