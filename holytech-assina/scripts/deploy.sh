#!/usr/bin/env bash
# Deploy do HolyTech Assina na VPS da HolyTech (89.117.79.163). Não sobe .env nem dados/.
set -e
cd "$(dirname "$0")/.."
VPS=root@89.117.79.163
PKG=/tmp/holytech-assina-$(date +%s).tgz
tar czf "$PKG" --exclude=node_modules --exclude=dados --exclude=.env package.json ecosystem.config.cjs src public scripts CLAUDE.md
scp -q "$PKG" $VPS:/tmp/holytech-assina.tgz
rm -f "$PKG"
ssh $VPS 'set -e; mkdir -p /var/www/holytech-assina && cd /var/www/holytech-assina && tar xzf /tmp/holytech-assina.tgz && rm /tmp/holytech-assina.tgz \
  && npm install --omit=dev --no-audit --no-fund --silent \
  && (pm2 describe holytech-assina >/dev/null 2>&1 && pm2 reload holytech-assina --update-env || pm2 start ecosystem.config.cjs) && pm2 save >/dev/null \
  && sleep 2 && curl -s http://127.0.0.1:3460/assinar/saude'
echo
