# Versátil — loja (Next.js 16 + Prisma/Postgres + Asaas)

## Rodar local
```bash
cp .env.example .env   # já existe em dev
npm install
npm run dev            # sobe Postgres embutido (5433), aplica schema, seed e Next em http://localhost:3100
```
- Loja: http://localhost:3100 · Painel: http://localhost:3100/painel (usuário do seed: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_SENHA` do .env)
- Sem `ASAAS_API_KEY` = **modo demonstração** (Pix fictício + botão "simular pagamento").

## Produção
- `DATABASE_URL` de um Postgres real, `AUTH_SECRET` forte, `PUBLIC_URL` com o domínio, `UPLOAD_DIR` persistente.
- Asaas: `ASAAS_API_KEY` (conta da LOJA), `ASAAS_ENV=producao|sandbox`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_SPLIT_WALLET_ID` + `ASAAS_SPLIT_PERCENT` (taxa de serviço — só no servidor).
- Webhook no Asaas → `POST {PUBLIC_URL}/api/webhooks/asaas` (eventos PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_REFUNDED) com o mesmo token.
- `npm run build && npm start` (porta 3100). `npx prisma db push` para o schema. Seed (`npm run seed`) é idempotente e nunca apaga nada; em produção só cria admin/categorias.

## WhatsApp (fase 2)
- `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` no .env. Vazio = modo demonstração (envios simulados).
- Painel → Disparos → "Buscar grupos do WhatsApp" → ativar os grupos que recebem ofertas.
- `PUBLIC_URL` precisa ser o domínio público (vai no link das mensagens).
