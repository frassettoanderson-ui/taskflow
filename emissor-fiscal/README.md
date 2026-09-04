# Emissor Fiscal

Microserviço que emite **NF-e / NFC-e / NFS-e** direto na SEFAZ/prefeitura
(via NFePHP) e expõe uma **API REST interna** para os outros projetos.

> Contexto completo e roadmap: veja [`CLAUDE.md`](./CLAUDE.md).

## Instalação (na VPS, onde há PHP)

```bash
composer install
cp .env.example .env
# edite o .env: emitente, certificado, API_KEY (openssl rand -hex 32)
# coloque o certificado A1 em storage/certificados/certificado.pfx
```

Suba em desenvolvimento:

```bash
php -S 0.0.0.0:8400 -t public
```

Em produção: **php-fpm + nginx** apontando o `root` para `public/`, atrás de
HTTPS, acessível só pela rede interna dos projetos.

## Endpoints

| Método | Rota | O que faz |
|--------|------|-----------|
| GET  | `/health` | Ping (sem auth) |
| GET  | `/v1/nfe/status` | Status do serviço na SEFAZ |
| POST | `/v1/nfe/emitir` | Emite NF-e (síncrono). Body = payload normalizado |
| POST | `/v1/nfe/consultar` | `{ "chave": "..." }` situação da NF-e |
| POST | `/v1/nfe/cancelar` | `{ "chave", "protocolo", "justificativa" }` |

Todas (menos `/health`) exigem `Authorization: Bearer <API_KEY>`.

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
