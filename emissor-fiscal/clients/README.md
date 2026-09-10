# Clientes do Emissor Fiscal (SDKs para plugar)

Bibliotecas prontas para os seus sistemas emitirem nota **sem saber nada de fiscal** —
só chamam funções. A lógica fiscal, o certificado e a comunicação com a Receita
ficam **no motor**.

## Regra de ouro
Use **sempre no backend**. A chave de API (`EMISSOR_API_KEY`) é secreta e **nunca**
pode ir para o navegador/frontend.

## Como plugar (3 passos)

1. **Copie o cliente** para o seu projeto:
   - Node: [`node/emissorFiscal.js`](node/emissorFiscal.js)
   - (PHP e outros: peça que eu gero no mesmo padrão.)

2. **Configure o `.env`** do seu sistema:
   ```
   EMISSOR_URL=http://127.0.0.1:8400        # mesma VPS
   # EMISSOR_URL=http://172.17.0.1:8400     # se o seu app roda em Docker (host gateway)
   # EMISSOR_URL=https://fiscal.seudominio.com.br  # fora da VPS
   EMISSOR_API_KEY=sua-chave-de-api
   EMISSOR_EMITENTE=00000000000000          # CNPJ do emitente (opcional)
   ```

3. **Chame numa linha** (ver [`node/exemplo-uso.js`](node/exemplo-uso.js)):
   ```js
   const { EmissorFiscal } = require('./emissorFiscal');
   const fiscal = new EmissorFiscal();
   const nota = await fiscal.emitirNFCe(payload);
   const pdf  = await fiscal.danfce(nota.chave);
   ```

## Quando o sistema sair da VPS
Só troca `EMISSOR_URL` para o subdomínio HTTPS público. **Nada muda no código.**
(É preciso, uma vez, expor o motor num subdomínio com nginx + TLS — peça que eu
preparo os comandos.)

## Métodos disponíveis (Node)
`emitirNFe`, `emitirNFCe`, `emitirNFSe`, `emitirCTe`, `emitirMDFe`,
`consultarNFe`, `cancelarNFe/NFCe`, `cartaCorrecao`, `substituirNfcePorNfe`,
`danfe`, `danfce`, `danfse`, `dacte`, `damdfe`, `encerrarMDFe`, `statusNFe`.
