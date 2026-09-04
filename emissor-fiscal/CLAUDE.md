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

## Multi-emitente (multi-tenant)
O motor guarda **vários emitentes** (empresas) em `config/emitentes.json`,
chaveados por CNPJ, cada um com seu certificado A1, série e CSC. Toda
requisição informa `"emitente": "<cnpj>"` e o motor usa o certificado certo.
Casos de uso: o Restaurante sempre manda o próprio CNPJ; a contabilidade (Nauta)
manda o CNPJ do cliente da vez.

## Autenticação + escopo
Toda rota (menos `/health`) exige `Authorization: Bearer <chave>`. As chaves
ficam em `config/api-keys.json`, cada uma mapeada a um sistema e à lista de
CNPJs que pode emitir (`"*"` = qualquer emitente, uso da contabilidade). Uma
chave só emite pelos emitentes do seu escopo.

## NFS-e — estratégia (fase 3)
Não se integra prefeitura por prefeitura. Camadas:
1. **Padrão Nacional NFS-e (ADN gov.br)** — 1 integração cobre os municípios
   que aderiram (a maioria, e crescendo). É o ponto de partida.
2. **Adaptadores por PROVEDOR** (não por cidade): a maioria fora do padrão usa
   ABRASF 1.0/2.0/2.03, ou GINFES/ISSNet/WebISS/Betha… ~5 adaptadores cobrem
   centenas de cidades. `sped-nfse` ajuda nos ABRASF.
3. Só se implementa o adaptador da cidade onde há **cliente real**.
Interface `NFSeProvider` + registry `codigo_municipio → provider`.

## Retorno síncrono
Emissão é **síncrona** (chama e espera a SEFAZ). Se a resposta se perder mas a
nota tiver sido autorizada, reconciliar via `/v1/nfe/consultar` pela chave.
Assíncrono+webhook só se o volume exigir.

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
