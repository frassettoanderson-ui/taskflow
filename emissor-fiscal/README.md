# Emissor Fiscal

Microserviço que emite **NF-e / NFC-e / NFS-e** direto na SEFAZ/prefeitura
(via NFePHP) e expõe uma **API REST interna** para os outros projetos.

> Contexto completo e roadmap: veja [`CLAUDE.md`](./CLAUDE.md).

## Instalação (na VPS, onde há PHP)

```bash
composer install
cp .env.example .env                                   # ambiente (homologação/produção)
cp config/emitentes.example.json config/emitentes.json # empresas emitentes
cp config/api-keys.example.json config/api-keys.json   # chaves dos sistemas + escopo
```

Depois:
- Em `config/emitentes.json`: cadastre cada empresa (CNPJ, IE, endereço, série,
  caminho do certificado e senha; CSC só p/ NFC-e).
- Coloque cada certificado A1 em `storage/certificados/<cnpj>.pfx`.
- Em `config/api-keys.json`: gere uma chave por sistema (`openssl rand -hex 32`)
  e liste os CNPJs que ele pode emitir (`"*"` = qualquer um, uso da contabilidade).

> **Multi-emitente:** o motor guarda vários certificados/empresas. Toda
> requisição informa `"emitente": "<cnpj>"`, e a chave de API só emite pelos
> emitentes autorizados no seu escopo.

Suba em desenvolvimento:

```bash
php -S 0.0.0.0:8400 -t public
```

Em produção: **php-fpm + nginx** apontando o `root` para `public/`, atrás de
HTTPS, acessível só pela rede interna dos projetos.

## Endpoints

| Método | Rota | Body (além de `emitente`) |
|--------|------|-----------|
| GET  | `/health` | — (sem auth) |
| POST | `/v1/nfe/status` | — (só `emitente`) |
| POST | `/v1/nfe/emitir` | payload normalizado da nota |
| POST | `/v1/nfe/consultar` | `chave` |
| POST | `/v1/nfe/cancelar` | `chave`, `protocolo`, `justificativa` |
| POST | `/v1/nfe/carta-correcao` | `chave`, `correcao`, `sequencia?` |
| POST | `/v1/nfe/danfe` | `chave` → PDF (arquivo + base64) |

Todas (menos `/health`) exigem `Authorization: Bearer <chave-de-api>` **e** o
campo `"emitente": "<cnpj>"` no corpo.

## Exemplo

```bash
curl -X POST http://localhost:8400/v1/nfe/emitir \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @examples/nfe-venda.json
```

Resposta (autorizado):

```json
{
  "ok": true,
  "status": "autorizado",
  "chave": "42250900000000000000550010000000011000000017",
  "protocolo": "142250000000000",
  "motivo": "100 - Autorizado o uso da NF-e"
}
```

## Consumir de outro projeto

**Node/TS (GestorOA, Restaurante):**

```ts
const r = await fetch(`${FISCAL_URL}/v1/nfe/emitir`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.FISCAL_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
const nota = await r.json();
if (!nota.ok) throw new Error(nota.motivo ?? nota.erro);
```

**PHP (Nauta, Autolar):**

```php
$ch = curl_init("$fiscalUrl/v1/nfe/emitir");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer {$fiscalApiKey}",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
]);
$nota = json_decode(curl_exec($ch), true);
```

## Homologação primeiro

`FISCAL_AMBIENTE=2` no `.env` = ambiente de teste, **sem valor fiscal**.
Valide emissão, consulta e cancelamento em homologação antes de virar a chave
para `1` (produção).
