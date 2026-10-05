#!/usr/bin/env bash
# Deploy da L3 Salvados na VPS 89.117.79.163 (a mesma do Julius). Rodar NA MÁQUINA LOCAL, dentro de versatil/app (código commitado).
# App: /var/www/l3salvados · PM2 "l3salvados" (127.0.0.1:3230, TZ America/Sao_Paulo) · nginx :8330 · banco Postgres "l3salvados".
# O .env e a pasta uploads/ da VPS ficam SÓ na VPS — não são sobrescritos.
set -euo pipefail
VPS=root@89.117.79.163
RAIZ=$(git rev-parse --show-toplevel)
PREFIXO=$(git rev-parse --show-prefix)   # ex.: versatil/app/
git -C "$RAIZ" archive --format=tar.gz -o /tmp/l3salvados.tgz "HEAD:${PREFIXO%/}"
scp -q /tmp/l3salvados.tgz $VPS:/tmp/l3salvados.tgz
ssh $VPS 'set -e; cd /var/www/l3salvados && tar xzf /tmp/l3salvados.tgz && rm /tmp/l3salvados.tgz \
  && npm ci --no-audit --no-fund >/tmp/l3salvados-install.log 2>&1 \
  && npx prisma generate >/dev/null && npx prisma db push --skip-generate \
  && NODE_OPTIONS=--max-old-space-size=3072 npx next build >/tmp/l3salvados-build.log 2>&1 \
  && (pm2 describe l3salvados >/dev/null 2>&1 && pm2 reload l3salvados || (pm2 start ecosystem.config.cjs && pm2 save)) && echo DEPLOY OK'
