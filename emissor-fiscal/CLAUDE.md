# Emissor Fiscal — microserviço de NF-e / NFC-e / NFS-e

Serviço **independente e reutilizável** que emite documentos fiscais falando
**direto com SEFAZ/prefeitura** (sem API paga), usando **NFePHP**. Os demais
projetos (Nauta, GestorOA, Restaurante…) consomem via **API REST interna** —
não importam biblioteca, só chamam HTTP.

## Stack
- PHP 8.1+ (ext: openssl, curl, soap, dom, mbstring)
- [NFePHP](https://github.com/nfephp-org): `sped-nfe` (NF-e/NFC-e) + `sped-da` (DANFE PDF)
- Router próprio minimalista (sem framework) — `public/index.php`
- Certificado digital **A1 (.pfx)** — nunca versionado

## Como o serviço se organiza
```
public/index.php        -> front controller + rotas
src/Http/               -> Router, Request, Response (JSON), auth Bearer
src/Support/            -> Config (.env -> config NFePHP), CertificadoManager,
                           Contador (numeração atômica), XmlStore (guarda XML)
src/Fiscal/NFe/         -> NFeBuilder (monta XML) + NFeService (assina/envia/trata)
src/Fiscal/NFCe/        -> (fase 2) modelo 65 — reaproveita sped-nfe
src/Fiscal/NFSe/        -> (fase 3) Padrão Nacional NFS-e (gov.br) + fallback municipal
storage/                -> certificados/, xml/, pdf/, logs/, contadores
```

## Autenticação
Toda rota (menos `/health`) exige header `Authorization: Bearer <API_KEY>`.
A `API_KEY` fica no `.env`. Os projetos consumidores guardam essa chave e a
enviam a cada requisição.

## Estado atual (o que está pronto / o que falta)
- ✅ Fundação: config, certificado, router, auth, storage, contador
- ✅ **NF-e (modelo 55)**: emitir (síncrono), consultar, cancelar, **carta de
  correção (CC-e)**, **DANFE PDF (sped-da)**, status SEFAZ
  — caso comum venda de mercadoria, Simples Nacional (CSOSN) e Regime Normal básico
- ⏳ **Falta testar em homologação** com certificado real (nunca rodou ainda)
- 🔜 Fase 2: **NFC-e** (modelo 65) — precisa CSC + QRCode
- 📄 **Reforma Tributária IBS/CBS**: mapeada em `docs/REFORMA-IBS-CBS.md` (não implementada)
- 🔜 Fase 3: **NFS-e** — começar pelo **Padrão Nacional** (ambiente nacional
  gov.br); municípios fora do padrão exigem adaptador por cidade

## Rodar (na VPS, onde há PHP)
```bash
composer install
cp .env.example .env   # preencher emitente + certificado + API_KEY
# subir o certificado .pfx em storage/certificados/
php -S 0.0.0.0:8400 -t public   # dev; em prod usar php-fpm + nginx
```

## Pontos de atenção fiscais (NÃO ignorar)
- `FISCAL_AMBIENTE=2` é **homologação** (sem valor fiscal). Só mudar p/ `1`
  (produção) depois de validar tudo em homologação.
- Em homologação a SEFAZ **exige** razão social do destinatário e descrição do
  produto com o texto "SEM VALOR FISCAL" — o builder já injeta isso.
- **Numeração** não pode pular nem repetir → hoje usa contador em arquivo com
  lock; multi-instância exige contador em banco (ver `src/Support/Contador.php`).
- XML autorizado deve ser **guardado por 5 anos** (obrigação legal).
- Nunca commitar `.env` nem `.pfx` (já no `.gitignore`).

## Documentação de referência
- Manual de Orientação do Contribuinte (MOC) NF-e 4.00
- NFePHP docs: https://github.com/nfephp-org/sped-nfe/tree/master/docs
- Padrão Nacional NFS-e: https://www.gov.br/nfse
