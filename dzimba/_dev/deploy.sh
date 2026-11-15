#!/usr/bin/env bash
# Deploy do site da Academia D'Zimba para a VPS antiga (89.117.79.163).
# Rode de dentro da pasta dzimba/:   bash _dev/deploy.sh
#   - site estático (inclui a landing /corrida/) → /var/www/dzimba
#   - API do curso de corrida (corrida/api) → /opt/dzimba-corrida (fora da pasta pública; pm2 "dzimba-corrida" :8404)
#     .env, data/ e node_modules da VPS NUNCA são sobrescritos
set -euo pipefail
VPS="root@89.117.79.163"
DESTINO="/var/www/dzimba"
API="/opt/dzimba-corrida"
DOMINIO="academiadzimba.com.br"
cd "$(dirname "$0")/.."

echo "==> site → $VPS:$DESTINO"
tar --exclude='./_dev' --exclude='./CLAUDE.md' --exclude='./corrida/api' -czf - . \
  | ssh "$VPS" "mkdir -p $DESTINO && tar -xzf - -C $DESTINO && chown -R www-data:www-data $DESTINO"

echo "==> API do curso → $VPS:$API"
tar --exclude='./node_modules' --exclude='./data' --exclude='./.env' -czf - -C corrida/api . \
  | ssh "$VPS" "mkdir -p $API/data && tar -xzf - -C $API && cd $API && npm install --omit=dev --no-audit --no-fund --silent \
      && (pm2 reload dzimba-corrida 2>/dev/null || pm2 start ecosystem.config.js) && pm2 save >/dev/null"

echo "==> conferindo"
curl -s -o /dev/null -w "https://$DOMINIO/ %{http_code}\n" "https://$DOMINIO/"
curl -s -o /dev/null -w "https://$DOMINIO/corrida/ %{http_code}\n" "https://$DOMINIO/corrida/"
curl -s -w "  ← /corrida/api/config\n" "https://$DOMINIO/corrida/api/config"; echo
