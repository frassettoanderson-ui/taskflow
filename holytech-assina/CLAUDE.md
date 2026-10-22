# HolyTech Assina

Assinatura eletrônica operada pela **HolyTech Solutions** (provedor independente) — primeiro cliente: **Atuan Contabilidade** (substituir o Autentique nos contratos).

## Como funciona
- Signatário abre o link `/assinar/s/<token>` → **lê o PDF** (pdf.js) → **código de 6 dígitos** (WhatsApp ou e-mail, configurado por conta) → **selfie pela câmera ao vivo** (sem galeria; guardada cifrada AES-256-GCM, NÃO entra no PDF) → **aceite** → assina.
- Quando todos assinam: **carimbo de tempo HolyTech** (hora consultada no NTP.br `a.ntp.br`, assinado com chave RSA-3072 da HolyTech) sobre o hash do original + evidências → **PDF final** = original + Certificado de Assinatura (QR + código de verificação) → segundo carimbo sobre o hash do PDF final → **webhook** `documento.concluido`.
- Verificação pública: `/assinar/v/<CODIGO>` (status, signatários, carimbo válido, conferência do PDF por hash no navegador). Chave pública: `/assinar/chave-publica.pem`.
- Trilha de auditoria append-only na tabela `eventos` (página aberta, documento visualizado, código enviado/validado/incorreto, selfie, assinou, concluído) com IP e dispositivo.

## API (Bearer = API key da conta)
- `POST /assinar/api/v1/documentos` `{ titulo, pdf_base64, signatarios:[{nome,cpf,email,whatsapp,papel:'parte'|'testemunha'}], external_id?, callback_url?, enviar_convite? }` → `{ id, codigo, verificacao, signatarios:[{id,nome,link,status}] }`
- `GET /assinar/api/v1/documentos/:id` · `GET /assinar/api/v1/documentos/:id/final.pdf` · `POST /assinar/api/v1/documentos/:id/cancelar`
- Webhooks: `signatario.assinou`, `documento.concluido` — header `X-HolyTech-Assinatura` = HMAC-SHA256(corpo, webhook_secret).

## Infra
- VPS da HolyTech 89.117.79.163, `/var/www/holytech-assina`, PM2 `holytech-assina`, porta 127.0.0.1:3460, nginx `holytech-dominio` → `location /assinar/`.
- Postgres `holyassina` (role própria). `.env` na VPS: `DATABASE_URL`, `CHAVE_CRIPTO` (64 hex), `URL_PUBLICA=https://holytechsolution.com.br/assinar`. **Nunca** sobe .env nem `dados/` no deploy.
- `dados/` na VPS: `originais/`, `finais/`, `selfies/` (cifradas), `chaves/` (RSA HolyTech — fazer backup!), `contas/` (segredos das contas, chmod 600).
- Deploy: `bash scripts/deploy.sh`. Nova conta: `node scripts/criar-conta.mjs "Nome"` na VPS.
- Canais por conta: `contas.canais` jsonb `{ email:{host,port,user,pass,from}, whatsapp:{provider:'whatsprofissional', token} }` — configurar só com autorização (segredos).

## Pendências
- Definir canal do código (WhatsApp / e-mail) e configurar na conta da Atuan.
- Fase 2: integrar no ERP da Atuan (gerar contrato → enviar p/ HolyTech Assina; webhook → assinado + anexo na ficha). Autentique segue em paralelo até o advogado aprovar.
- Futuro: selar o PDF final com o e-CNPJ A1 da HolyTech (PAdES) quando o CNPJ estiver ativo; prazo de guarda/expurgo das selfies (≥5 anos).
