#!/usr/bin/env bash
# Deploy do site do Movimento Betel para a VPS antiga (89.117.79.163).
# Site estatico servido por nginx em /var/www/betel, porta 8120.
# Rode de dentro da pasta betel/:   bash _dev/deploy.sh
set -euo pipefail

VPS="root@89.117.79.163"
DESTINO="/var/www/betel"
PORTA=8120

cd "$(dirname "$0")/.."

echo "==> enviando $(du -sh . | cut -f1) para $VPS:$DESTINO"
tar --exclude='./_dev' --exclude='./CLAUDE.md' -czf - . \
  | ssh "$VPS" "mkdir -p $DESTINO && tar -xzf - -C $DESTINO && chown -R www-data:www-data $DESTINO"

echo "==> conferindo"
ssh "$VPS" "curl -s -o /dev/null -w 'index.html %{http_code}\n' http://127.0.0.1:$PORTA/"

echo "==> pronto: http://89.117.79.163:$PORTA/"
