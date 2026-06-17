# Decisões de Produto e Arquitetura — GestorOA

Registro das decisões tomadas quando o prompt era ambíguo ou silencioso, conforme item 4 da "Ordem de Implementação". Critério: preferir o comportamento descrito no prompt; quando ausente, o mais simples que preserve a cadeia **Empresa → Obrigações → Prazos → Entrega → Protocolo**.

## Infra / Stack

- **D-001 — Fila com fallback Postgres.** A VPS pode não ter Redis. `QUEUE_DRIVER` controla o driver: `postgres` (default, jobs persistidos em tabela `Job` + worker em processo) ou `bullmq` (Redis). A camada de fila é abstraída em `server/src/queue/` para troca sem mexer nos jobs. *(Confirmado pelo usuário.)*
- **D-002 — Monorepo em subpasta.** O projeto vive em `gestor-oa/` dentro do repositório existente, com npm workspaces (`shared`, `server`, `web`). *(Confirmado pelo usuário.)*
- **D-003 — Portas.** Server `4002`, web (Vite) `5174`, para não colidir com os outros projetos do usuário (igreja/finanças usam 4001/8080).

## Auth / Tenant (Módulo 0)

- **D-004 — Refresh token rotativo.** A cada `/refresh`, o refresh antigo é revogado e um novo emitido (rotação). Sessões ficam na tabela `Sessao` com `revokedAt`; logout revoga a sessão atual.
- **D-005 — Horários de acesso.** Armazenados como lista de janelas `{ diaSemana 0-6, inicio "HH:mm", fim "HH:mm" }` em JSON no usuário. Se a lista estiver vazia/nula, acesso liberado em qualquer horário. Verificação no timezone America/Sao_Paulo.
- **D-006 — Recuperação de senha.** Token de uso único (hash no banco), expira em 1h. Por privacidade, a resposta é sempre genérica ("se o e-mail existir, enviaremos instruções"), independente de o e-mail existir.
- **D-007 — Primeiro usuário.** O registro do escritório cria o tenant + primeiro usuário com TODAS as flags de permissão ligadas (admin de fato), sem um papel "admin" rígido — o RBAC é por flags (Módulo 4).

## Convenções gerais

- **D-008 — Respostas da API.** Sempre `{ ok: boolean, data?: T, error?: { code, message, details? } }`. Paginação: `{ ok, data: { items, page, limit, total, totalPages } }`.
- **D-009 — Soft delete.** `deletedAt` nas entidades com histórico; queries padrão filtram `deletedAt: null`.
- **D-010 — Auditoria.** Middleware do Prisma intercepta create/update/delete das entidades principais e grava `LogAuditoria` com diff antes/depois. O contexto (usuário/escritório) é injetado via AsyncLocalStorage por requisição.
