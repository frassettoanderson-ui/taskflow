#!/usr/bin/env bash
# Deploy do site da Container Barbearia para a VPS antiga (89.117.79.163).
# Rode de dentro da pasta container-barbearia/:   bash _dev/deploy.sh
# Site estático → /var/www/container-barbearia (nginx; endereço provisório até o domínio do cliente)
set -euo pipefail
VPS="root@89.117.79.163"
DESTINO="/var/www/container-barbearia"
HOST="container.89-117-79-163.sslip.io"
cd "$(dirname "$0")/.."

echo "==> site → $VPS:$DESTINO"
tar --exclude='./_dev' --exclude='./_fontes' --exclude='./docs' --exclude='./.taste-skill' --exclude='./.claude' \
    --exclude='./_v1' --exclude='./assets' --exclude='./site.css' --exclude='./shots' --exclude='./CLAUDE.md' --exclude='./names.json' -czf - . \
  | ssh "$VPS" "rm -rf $DESTINO.novo && mkdir -p $DESTINO.novo && tar -xzf - -C $DESTINO.novo \
      && rm -rf $DESTINO.antigo && (test -d $DESTINO && mv $DESTINO $DESTINO.antigo || true) && mv $DESTINO.novo $DESTINO \
      && chown -R www-data:www-data $DESTINO"

echo "==> conferindo"
for p in "" centro.html vila-nova.html nova-brasilia.html; do
  curl -s -o /dev/null -w "https://$HOST/$p %{http_code}\n" "https://$HOST/$p"
done
