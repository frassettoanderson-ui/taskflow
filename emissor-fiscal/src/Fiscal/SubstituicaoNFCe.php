<?php

declare(strict_types=1);

namespace App\Fiscal;

use App\Fiscal\NFe\NFeService;
use App\Fiscal\NFCe\NFCeService;
use App\Support\Contador;
use App\Support\Emitente;
use App\Support\XmlStore;

/**
 * Substitui uma NFC-e por uma NF-e: cancela a NFC-e (dentro do prazo) e emite
 * uma NF-e com os MESMOS itens, para o CNPJ do cliente, referenciando a NFC-e.
 *
 * Regra fiscal: uma venda = um documento. Só emite a NF-e se o cancelamento da
 * NFC-e der certo (não deixa as duas coexistirem).
 */
final class SubstituicaoNFCe
{
    public function __construct(
        private string $root,
        private Emitente $emitente,
        private int $ambiente,
        private XmlStore $store,
        private Contador $contador
    ) {}

    public function executar(array $body): array
    {
        $chaveNfce = preg_replace('/\D/', '', (string) ($body['chave'] ?? ''));
        $protocolo = (string) ($body['protocolo'] ?? '');
        $dest = $body['destinatario'] ?? [];
        if (strlen($chaveNfce) !== 44) {
            throw new \InvalidArgumentException('chave da NFC-e inválida (44 dígitos).');
        }
        if (empty($dest['cnpj']) && empty($dest['cpf'])) {
            throw new \InvalidArgumentException('destinatario com cnpj (ou cpf) é obrigatório.');
        }

        $xmlNfce = $this->store->recuperar($this->emitente->cnpj, $chaveNfce, 'autorizado');
        if ($xmlNfce === null) {
            throw new \RuntimeException("NFC-e {$chaveNfce} não encontrada nos autorizados.");
        }
        $itens = $this->extrairItens($xmlNfce);
        $pagamento = $this->extrairPagamento($xmlNfce);

        // 1) cancela a NFC-e (aborta tudo se não conseguir — evita duplicidade)
        $justificativa = (string) ($body['justificativa'] ?? 'Substituicao da NFC-e por NF-e a pedido do cliente');
        $nfce = new NFCeService($this->root, $this->emitente, $this->ambiente, $this->store, $this->contador);
        $cancel = $nfce->cancelar($chaveNfce, $protocolo, $justificativa);
        if (($cancel['status'] ?? '') !== 'cancelado') {
            return [
                'ok' => false,
                'etapa' => 'cancelamento_nfce',
                'mensagem' => 'Não foi possível cancelar a NFC-e (fora do prazo?). A NF-e NÃO foi emitida.',
                'nfce' => $cancel,
            ];
        }

        // 2) emite a NF-e com os mesmos itens, referenciando a NFC-e
        $payload = [
            'emitente' => $this->emitente->cnpj,
            'natureza_operacao' => $body['natureza_operacao'] ?? 'Venda de mercadoria',
            'consumidor_final' => true,
            'destinatario' => $dest,
            'itens' => $itens,
            'pagamento' => $pagamento,
            'referencias' => [$chaveNfce],
        ];
        if (!empty($body['informacoes_adicionais'])) {
            $payload['informacoes_adicionais'] = $body['informacoes_adicionais'];
        }
        $nfe = new NFeService($this->root, $this->emitente, $this->ambiente, $this->store, $this->contador);
        $emit = $nfe->emitir($payload);

        return [
            'ok' => ($emit['status'] ?? '') === 'autorizado',
            'nfce_cancelada' => $cancel,
            'nfe' => $emit,
        ];
    }

    /** Lê os itens do XML autorizado da NFC-e. */
    private function extrairItens(string $xml): array
    {
        $sx = simplexml_load_string($xml);
        if ($sx === false) {
            throw new \RuntimeException('XML da NFC-e inválido.');
        }
        $sx->registerXPathNamespace('n', 'http://www.portalfiscal.inf.br/nfe');
        $itens = [];
        foreach ($sx->xpath('//n:det') as $det) {
            $det->registerXPathNamespace('n', 'http://www.portalfiscal.inf.br/nfe');
            $prod = $det->xpath('n:prod')[0] ?? null;
            if ($prod === null) {
                continue;
            }
            $csosn = $det->xpath('.//n:ICMSSN/n:CSOSN');
            $orig = $det->xpath('.//n:orig');
            $itens[] = [
                'codigo' => (string) $prod->cProd,
                'descricao' => (string) $prod->xProd,
                'ncm' => (string) $prod->NCM,
                'cfop' => (string) $prod->CFOP,
                'unidade' => (string) $prod->uCom,
                'quantidade' => (float) $prod->qCom,
                'valor_unitario' => (float) $prod->vUnCom,
                'valor_total' => (float) $prod->vProd,
                'origem' => $orig ? (int) $orig[0] : 0,
                'csosn' => $csosn ? (string) $csosn[0] : '102',
            ];
        }
        if (empty($itens)) {
            throw new \RuntimeException('Nenhum item encontrado na NFC-e.');
        }
        return $itens;
    }

    /** Lê a forma de pagamento predominante da NFC-e. */
    private function extrairPagamento(string $xml): array
    {
        $sx = simplexml_load_string($xml);
        $sx->registerXPathNamespace('n', 'http://www.portalfiscal.inf.br/nfe');
        $tPag = $sx->xpath('//n:detPag/n:tPag');
        $total = $sx->xpath('//n:ICMSTot/n:vNF');
        return [
            'forma' => $tPag ? (string) $tPag[0] : '01',
            'valor' => $total ? (float) $total[0] : 0,
        ];
    }
}
