#!/usr/bin/env bash
# ============================================================
# Setup do Emissor Fiscal na VPS (Debian/Ubuntu).
# Instala PHP + extensões + Composer e prepara o projeto.
# Não toca em nada dos apps Node existentes.
#
# Uso (dentro da pasta emissor-fiscal, na VPS):
#   bash deploy/setup-vps.sh
# ============================================================
set -euo pipefail

echo ">> Instalando PHP CLI e extensões (curl, xml, mbstring, soap, gd, zip)..."
sudo apt-get update -y
sudo apt-get install -y \
  php-cli php-common php-curl php-xml php-mbstring php-soap php-gd php-zip \
  unzip git

echo ">> PHP instalado:"
php -v | head -1

echo ">> Conferindo extensões obrigatórias..."
for ext in openssl curl dom soap mbstring; do
  if php -m | grep -qi "^${ext}$"; then
    echo "   ok: ${ext}"
  else
    echo "   FALTA: ${ext}  (instale php-${ext})"
  fi
done

echo ">> Instalando Composer..."
if ! command -v composer >/dev/null 2>&1; then
  EXPECTED_SIG="$(curl -s https://composer.github.io/installer.sig)"
  php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
  ACTUAL_SIG="$(php -r "echo hash_file('sha384', 'composer-setup.php');")"
  if [ "$EXPECTED_SIG" != "$ACTUAL_SIG" ]; then
    echo "ERRO: assinatura do instalador do Composer não confere. Abortando."
    rm -f composer-setup.php
    exit 1
  fi
  sudo php composer-setup.php --install-dir=/usr/local/bin --filename=composer
  rm -f composer-setup.php
fi
composer --version

echo ">> Instalando dependências do projeto (composer install)..."
composer install --no-dev --optimize-autoloader

echo ">> Garantindo pastas de storage..."
mkdir -p storage/certificados storage/xml storage/pdf storage/logs storage/contadores
chmod -R 770 storage

echo ""
echo ">> Setup concluído."
echo "   Verifique se estes arquivos existem (NÃO vêm do Git):"
echo "     - .env"
echo "     - config/emitentes.json"
echo "     - config/api-keys.json"
echo "     - storage/certificados/<cnpj>.pfx"
echo ""
echo "   Para testar (homologação): "
echo "     php -S 127.0.0.1:8400 -t public"
