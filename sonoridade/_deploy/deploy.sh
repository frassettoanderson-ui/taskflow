#!/usr/bin/env bash
# Deploy do Sonoridade para a VPS antiga (89.117.79.163), porta 8180.
# Sobe app/ (com as cifras de teste) e prototipo/ (com o áudio do VS) para /var/www/sonoridade.
# Rode de dentro da pasta sonoridade/:   bash _deploy/deploy.sh
#   reinstalar a config do nginx:  bash _deploy/deploy.sh --nginx   (só depois do _deploy/https.sh,
#   porque a config já aponta para o certificado do HTTPS)
set -euo pipefail

VPS="root@89.117.79.163"
DESTINO="/var/www/sonoridade"
PORTA=8180

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--nginx" ]]; then
  echo "==> instalando o site no nginx"
  ssh "$VPS" "cat > /etc/nginx/snippets/sonoridade-miolo.conf" < _deploy/nginx-sonoridade-miolo.conf
  ssh "$VPS" "cat > /etc/nginx/sites-available/sonoridade && ln -sf /etc/nginx/sites-available/sonoridade /etc/nginx/sites-enabled/sonoridade" < _deploy/nginx-sonoridade.conf
fi

echo "==> enviando app/ e prototipo/ ($(du -sh app prototipo | awk '{print $1}' | paste -sd+ -)) para $VPS:$DESTINO"
tar -czf - app prototipo \
  | ssh "$VPS" "rm -rf $DESTINO.novo && mkdir -p $DESTINO.novo && tar -xzf - -C $DESTINO.novo \
      && rm -rf $DESTINO.velho && { [ -d $DESTINO ] && mv $DESTINO $DESTINO.velho || true; } \
      && mv $DESTINO.novo $DESTINO && chown -R www-data:www-data $DESTINO && rm -rf $DESTINO.velho"

if [[ "${1:-}" == "--nginx" ]]; then
  ssh "$VPS" "nginx -t && systemctl reload nginx"
fi

echo "==> conferindo"
ssh "$VPS" "for u in /app/ /app/js/telas/cifra.js /app/dados-teste/cifras-teste.json /prototipo/; do curl -s -o /dev/null -w \"\$u %{http_code}\n\" http://127.0.0.1:$PORTA\$u; done"

echo "==> pronto: http://89.117.79.163:$PORTA/app/"
