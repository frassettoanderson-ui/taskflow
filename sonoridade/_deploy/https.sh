#!/usr/bin/env bash
# Liga o HTTPS do Sonoridade em https://sonoridade.89-117-79-163.sslip.io (uma vez só).
# Sem HTTPS o celular não libera o microfone (afinador) nem o protótipo do VS.
# Rode de dentro da pasta sonoridade/:   bash _deploy/https.sh
set -euo pipefail
VPS="root@89.117.79.163"
DOMINIO="sonoridade.89-117-79-163.sslip.io"
cd "$(dirname "$0")"

echo "==> guardando a config atual em /root/sonoridade.nginx.bak"
ssh "$VPS" "cp /etc/nginx/sites-available/sonoridade /root/sonoridade.nginx.bak"
ssh "$VPS" "cat > /etc/nginx/snippets/sonoridade-miolo.conf" < nginx-sonoridade-miolo.conf

echo "==> 1/3 site em HTTP (porta 80) para o Let's Encrypt validar"
awk 'BEGIN{p=1} /listen 443 ssl;/{p=0} p' nginx-sonoridade.conf | sed '$d' > /tmp/sonoridade-http.conf
ssh "$VPS" "cat > /etc/nginx/sites-available/sonoridade" < /tmp/sonoridade-http.conf
ssh "$VPS" "nginx -t && systemctl reload nginx"

echo "==> 2/3 certificado"
ssh "$VPS" "certbot certonly --webroot -w /var/www/sonoridade -d $DOMINIO --non-interactive --agree-tos --register-unsafely-without-email"

echo "==> 3/3 site completo (8180 + HTTPS)"
ssh "$VPS" "cat > /etc/nginx/sites-available/sonoridade" < nginx-sonoridade.conf
if ! ssh "$VPS" "nginx -t && systemctl reload nginx"; then
  echo "!! nginx recusou; voltando a config antiga"
  ssh "$VPS" "cp /root/sonoridade.nginx.bak /etc/nginx/sites-available/sonoridade && nginx -t && systemctl reload nginx"
  exit 1
fi
curl -s -o /dev/null -w "https://$DOMINIO/app/ %{http_code}\n" "https://$DOMINIO/app/"
