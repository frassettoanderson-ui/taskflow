'use strict';
/**
 * Cliente do Emissor Fiscal — solte este arquivo em qualquer backend Node
 * (Express, Nest, etc.) e emita nota com uma linha. Sem dependências (usa o
 * fetch nativo do Node 18+).
 *
 * Configuração por ambiente (.env), as MESMAS que o PDV já usa:
 *   EMISSOR_URL       = http://127.0.0.1:8400        (mesma VPS)
 *                     | http://172.17.0.1:8400       (chamando do Docker p/ o host)
 *                     | https://fiscal.seudominio.com.br  (fora da VPS)
 *   EMISSOR_API_KEY   = <chave de API do seu sistema>
 *   EMISSOR_EMITENTE  = <CNPJ do emitente>           (opcional; pode passar por chamada)
 *
 * Uso:
 *   const { EmissorFiscal } = require('./emissorFiscal');
 *   const fiscal = new EmissorFiscal();
 *   const nota = await fiscal.emitirNFCe(payload);   // { ok, status, chave, xml, ... }
 *
 * IMPORTANTE: use SEMPRE no backend. Nunca no navegador (a chave de API é secreta).
 */
class EmissorFiscalError extends Error {
  constructor(message, resposta) {
    super(message);
    this.name = 'EmissorFiscalError';
    this.resposta = resposta; // corpo completo devolvido pelo motor
  }
}

class EmissorFiscal {
  constructor(opts = {}) {
    this.baseUrl = (opts.baseUrl || process.env.EMISSOR_URL || 'http://127.0.0.1:8400').replace(/\/+$/, '');
    this.apiKey = opts.apiKey || process.env.EMISSOR_API_KEY || '';
    this.emitente = opts.emitente || process.env.EMISSOR_EMITENTE || '';
    this.timeoutMs = opts.timeoutMs || 60000;
    if (!this.apiKey) throw new Error('EmissorFiscal: defina EMISSOR_API_KEY (ou opts.apiKey).');
  }

  async _post(path, body = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.baseUrl + path, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emitente: this.emitente, ...body }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        const msg = data.motivo || data.erro || `HTTP ${res.status}`;
        throw new EmissorFiscalError(`[emissor-fiscal] ${msg}`, data);
      }
      return data;
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new EmissorFiscalError('[emissor-fiscal] tempo esgotado ao falar com o motor', null);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- NF-e (produto, modelo 55) ----
  statusNFe() { return this._post('/v1/nfe/status'); }
  emitirNFe(dados) { return this._post('/v1/nfe/emitir', dados); }
  consultarNFe(chave) { return this._post('/v1/nfe/consultar', { chave }); }
  cancelarNFe(chave, protocolo, justificativa) { return this._post('/v1/nfe/cancelar', { chave, protocolo, justificativa }); }
  cartaCorrecao(chave, correcao, sequencia = 1) { return this._post('/v1/nfe/carta-correcao', { chave, correcao, sequencia }); }
  danfe(chave) { return this._post('/v1/nfe/danfe', { chave }); }
  substituirNfcePorNfe(dados) { return this._post('/v1/nfe/substituir-nfce', dados); }

  // ---- NFC-e (cupom, modelo 65) ----
  emitirNFCe(dados) { return this._post('/v1/nfce/emitir', dados); }
  consultarNFCe(chave) { return this._post('/v1/nfce/consultar', { chave }); }
  cancelarNFCe(chave, protocolo, justificativa) { return this._post('/v1/nfce/cancelar', { chave, protocolo, justificativa }); }
  danfce(chave) { return this._post('/v1/nfce/danfce', { chave }); }

  // ---- NFS-e (serviço) ----
  emitirNFSe(dados) { return this._post('/v1/nfse/emitir', dados); }
  danfse(chave) { return this._post('/v1/nfse/danfse', { chave }); }

  // ---- CT-e (57) / MDF-e (58) ----
  emitirCTe(dados) { return this._post('/v1/cte/emitir', dados); }
  dacte(chave) { return this._post('/v1/cte/dacte', { chave }); }
  emitirMDFe(dados) { return this._post('/v1/mdfe/emitir', dados); }
  encerrarMDFe(chave, protocolo, municipio_cod, uf) { return this._post('/v1/mdfe/encerrar', { chave, protocolo, municipio_cod, uf }); }
  damdfe(chave) { return this._post('/v1/mdfe/damdfe', { chave }); }
}

module.exports = { EmissorFiscal, EmissorFiscalError };
