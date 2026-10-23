# Holysign (ex-"HolyTech Assina")

Assinatura eletrônica **by HolyTech** (provedor independente), estilo Autentique: **https://holytechsolution.com.br/holysign** (links antigos /assinar redirecionam 301).
Cadastro aberto (plano grátis = `HOLYSIGN_LIMITE_GRATIS` docs/mês, padrão 5; plano `cortesia` = sem limite). Empresas de teste (sem cobrança): **Nauta, Atuan e Oxfitness** → marcar `contas.plano='cortesia', limite_mensal=NULL` depois que criarem a conta. Cor do produto: verde-petróleo #0E7C7B.

## Painel (pessoas) — public/app.html + app.js + painel.css (app de uma página, rotas por hash)
- `#/` landing · `#/entrar` · `#/criar` · `#/esqueci` · `#/convite/:token` · `#/redefinir/:token`
- `#/docs` (abas aguardando/assinados/cancelados/termos, busca) · `#/novo` (PDF arrastar, signatários, "já enviar assinado pela empresa", enviar convite) · `#/doc/:id` (assinantes, copiar/reenviar link, trilha, baixar PDF, cancelar)
- `#/config/:aba` empresa · empresa-assina (representantes/termo) · envio (SMTP/WhatsPro da conta, segredos cifrados) · integracao (gerar API key / segredo webhook — mostrados 1x; webhook_url da conta) · equipe (convite por link) · senha
- Backend: `src/painel.js` (rotas /conta/* e /app/api/*), `src/auth.js` (scrypt, sessão cookie hs_sessao, convites), `src/documentos.js` (criar/cancelar/reenviar — usado pela API e pelo painel), `src/representantes.js`.
- E-mail da plataforma (esqueci senha, convites, canal padrão das contas): `.env` HOLYSIGN_SMTP_HOST/PORT/USER/PASS/FROM — **ainda não configurado** (sem ele: esqueci-senha avisa p/ falar com suporte; convites só por link copiado; contas sem canal próprio não recebem código).

## Como funciona
- Signatário abre o link `/holysign/s/<token>` → **lê o PDF** (pdf.js) → **código de 6 dígitos** (WhatsApp ou e-mail, configurado por conta) → **selfie pela câmera ao vivo** (sem galeria; guardada cifrada AES-256-GCM, NÃO entra no PDF) → **aceite** → assina.
- Quando todos assinam: **carimbo de tempo HolyTech** (hora consultada no NTP.br `a.ntp.br`, assinado com chave RSA-3072 da HolyTech) sobre o hash do original + evidências → **PDF final** = original + Certificado de Assinatura (QR + código de verificação) → segundo carimbo sobre o hash do PDF final → **webhook** `documento.concluido`.
- Verificação pública: `/holysign/v/<CODIGO>` (status, signatários, carimbo válido, conferência do PDF por hash no navegador). Chave pública: `/holysign/chave-publica.pem`.
- Trilha de auditoria append-only na tabela `eventos` (página aberta, documento visualizado, código enviado/validado/incorreto, selfie, assinou, concluído) com IP e dispositivo.

## API (Bearer = API key da conta)
- `POST /holysign/api/v1/documentos` `{ titulo, pdf_base64, signatarios:[{nome,cpf,email,whatsapp,papel:'parte'|'testemunha'}], external_id?, callback_url?, enviar_convite? }` → `{ id, codigo, verificacao, signatarios:[{id,nome,link,status}] }`
- `GET /holysign/api/v1/documentos/:id` · `GET /holysign/api/v1/documentos/:id/final.pdf` · `POST /holysign/api/v1/documentos/:id/cancelar`
- Webhooks: `signatario.assinou`, `documento.concluido` — header `X-HolyTech-Assinatura` = HMAC-SHA256(corpo, webhook_secret).

## Representante com assinatura automática (ex.: contador da Atuan)
- `node scripts/representante.mjs criar "<conta>" '{"nome","cpf","cargo","registro","email","whatsapp"}'` → cadastra e gera o **Termo de autorização** (documento `tipo='autorizacao'`) + link p/ ele assinar 1x com código + selfie. Ao concluir → `representantes.autorizado_em`.
- API: `assinatura_representante: true` (ou o id) no POST → documento já nasce com o signatário papel `contratada` assinado (`otp_canal='autorizacao'`, base = código do termo, selfie_hash do termo); evento `assinatura_representante`. Sem autorização vigente → 400.
- `listar "<conta>"` · `revogar <id>` (não afeta documentos já assinados).

## Infra
- VPS da HolyTech 89.117.79.163, `/var/www/holytech-assina`, PM2 `holytech-assina`, porta 127.0.0.1:3460, nginx `holytech-dominio` → `location /holysign/`.
- Postgres `holyassina` (role própria). `.env` na VPS: `DATABASE_URL`, `CHAVE_CRIPTO` (64 hex), `URL_PUBLICA=https://holytechsolution.com.br/holysign`. **Nunca** sobe .env nem `dados/` no deploy.
- `dados/` na VPS: `originais/`, `finais/`, `selfies/` (cifradas), `chaves/` (RSA HolyTech — fazer backup!), `contas/` (segredos das contas, chmod 600).
- Deploy: `bash scripts/deploy.sh`. Nova conta: `node scripts/criar-conta.mjs "Nome"` na VPS.
- Canais por conta: `contas.canais` jsonb `{ email:{host,port,user,pass,from}, whatsapp:{provider:'whatsprofissional', token} }` — configurar só com autorização (segredos).

## Pendências
- Definir canal do código (WhatsApp / e-mail) e configurar na conta da Atuan.
- Fase 2: integrar no ERP da Atuan (gerar contrato → enviar p/ HolyTech Assina; webhook → assinado + anexo na ficha). Autentique segue em paralelo até o advogado aprovar.
- Futuro: selar o PDF final com o e-CNPJ A1 da HolyTech (PAdES) quando o CNPJ estiver ativo; prazo de guarda/expurgo das selfies (≥5 anos).
