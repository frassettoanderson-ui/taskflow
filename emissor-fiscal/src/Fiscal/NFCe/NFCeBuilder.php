<?php

declare(strict_types=1);

namespace App\Fiscal\NFCe;

use NFePHP\NFe\Make;

/**
 * Monta o XML de uma NFC-e (modelo 65) a partir de um payload normalizado.
 *
 * NFC-e = venda a consumidor final, presencial (varejo/PDV). Diferenças-chave
 * em relação à NF-e: consumidor é opcional (CPF), sempre intraestadual, aceita
 * múltiplas formas de pagamento com troco, e o QR Code é gerado na assinatura
 * (Tools->signNFe com model 65) usando o CSC/CSCid do emitente.
 *
 * O grupo de impostos por item é idêntico ao da NF-e (mesmo CSOSN/CST).
 */
final class NFCeBuilder
{
    public function __construct(
        private array $emitente,
        private int $ambiente,
        private int $serie
    ) {}

    /**
     * @return array{make:Make,chave:string,numero:int}
     */
    public function montar(array $p, int $numero): array
    {
        $this->validar($p);

        $make = new Make();
        $uf = $this->emitente['UF'];
        $cMun = $this->emitente['cMun'];

        // ------- ide -------
        $ide = new \stdClass();
        $ide->cUF = $this->codigoUF($uf);
        $ide->cNF = str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        $ide->natOp = $p['natureza_operacao'] ?? 'Venda ao consumidor';
        $ide->mod = 65;
        $ide->serie = $this->serie;
        $ide->nNF = $numero;
        $ide->dhEmi = date('Y-m-d\TH:i:sP');
        $ide->tpNF = 1;            // saída
        $ide->idDest = 1;         // NFC-e é sempre operação interna
        $ide->cMunFG = $cMun;
        $ide->tpImp = 4;          // DANFE NFC-e
        $ide->tpEmis = 1;         // normal (TODO: contingência offline tpEmis=9)
        $ide->tpAmb = $this->ambiente;
        $ide->finNFe = 1;
        $ide->indFinal = 1;       // consumidor final
        $ide->indPres = 1;        // presencial
        $ide->procEmi = 0;
        $ide->verProc = 'emissor-fiscal-1.0';
        $make->tagide($ide);

        // ------- emit -------
        $emit = new \stdClass();
        $emit->CNPJ = $this->emitente['CNPJ'];
        $emit->xNome = $this->emitente['xNome'];
        $emit->xFant = $this->emitente['xFant'] ?: null;
        $emit->IE = $this->emitente['IE'];
        $emit->CRT = $this->emitente['CRT'];
        $make->tagemit($emit);

        $enderEmit = new \stdClass();
        $enderEmit->xLgr = $this->emitente['xLgr'];
        $enderEmit->nro = $this->emitente['nro'];
        $enderEmit->xBairro = $this->emitente['xBairro'];
        $enderEmit->cMun = $cMun;
        $enderEmit->xMun = $this->emitente['xMun'];
        $enderEmit->UF = $uf;
        $enderEmit->CEP = $this->soDigitos($this->emitente['CEP']);
        $enderEmit->cPais = '1058';
        $enderEmit->xPais = 'BRASIL';
        $enderEmit->fone = $this->soDigitos($this->emitente['fone']) ?: null;
        $make->tagenderEmit($enderEmit);

        // ------- dest (opcional na NFC-e) -------
        $c = $p['consumidor'] ?? [];
        if (!empty($c['cpf']) || !empty($c['cnpj'])) {
            $dest = new \stdClass();
            if (!empty($c['cnpj'])) {
                $dest->CNPJ = $this->soDigitos($c['cnpj']);
            } else {
                $dest->CPF = $this->soDigitos($c['cpf']);
            }
            // Em homologação a razão do destinatário é fixa; na NFC-e o nome é opcional.
            if ($this->ambiente === 2) {
                $dest->xNome = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
            } elseif (!empty($c['nome'])) {
                $dest->xNome = $c['nome'];
            }
            $dest->indIEDest = 9; // não contribuinte
            $make->tagdest($dest);
        }

        // ------- itens -------
        $totalProd = 0.0;
        foreach (array_values($p['itens']) as $i => $item) {
            $n = $i + 1;
            $qtd = (float) $item['quantidade'];
            $vun = (float) $item['valor_unitario'];
            $vprod = isset($item['valor_total']) ? (float) $item['valor_total'] : round($qtd * $vun, 2);
            $totalProd += $vprod;

            $prod = new \stdClass();
            $prod->item = $n;
            $prod->cProd = (string) ($item['codigo'] ?? $n);
            $prod->cEAN = $item['ean'] ?? 'SEM GTIN';
            $prod->xProd = $this->ambiente === 2
                ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
                : $item['descricao'];
            $prod->NCM = $this->soDigitos($item['ncm']);
            $prod->CEST = !empty($item['cest']) ? $this->soDigitos($item['cest']) : null;
            $prod->CFOP = (string) $item['cfop'];
            $prod->uCom = $item['unidade'] ?? 'UN';
            $prod->qCom = number_format($qtd, 4, '.', '');
            $prod->vUnCom = number_format($vun, 10, '.', '');
            $prod->vProd = number_format($vprod, 2, '.', '');
            $prod->cEANTrib = $prod->cEAN;
            $prod->uTrib = $prod->uCom;
            $prod->qTrib = $prod->qCom;
            $prod->vUnTrib = $prod->vUnCom;
            $prod->indTot = 1;
            $make->tagprod($prod);

            $imposto = new \stdClass();
            $imposto->item = $n;
            $make->tagimposto($imposto);

            $this->montarImpostos($make, $n, $item, $vprod);
        }

        // ------- totais -------
        $icmsTot = new \stdClass();
        foreach (['vBC','vICMS','vICMSDeson','vFCP','vBCST','vST','vFCPST','vFCPSTRet',
                  'vFrete','vSeg','vDesc','vII','vIPI','vIPIDevol','vPIS','vCOFINS','vOutro'] as $z) {
            $icmsTot->$z = '0.00';
        }
        $icmsTot->vProd = number_format($totalProd, 2, '.', '');
        $icmsTot->vNF = number_format($totalProd, 2, '.', '');
        $make->tagICMSTot($icmsTot);

        // ------- transporte -------
        $transp = new \stdClass();
        $transp->modFrete = 9; // sem transporte
        $make->tagtransp($transp);

        // ------- pagamento (obrigatório; aceita várias formas + troco) -------
        $pagamentos = $p['pagamentos'] ?? [['forma' => '01', 'valor' => $totalProd]];
        $totalPago = 0.0;
        foreach ($pagamentos as $pg) {
            $totalPago += (float) ($pg['valor'] ?? 0);
        }
        $troco = max(0.0, $totalPago - $totalProd);

        $pag = new \stdClass();
        if ($troco > 0) {
            $pag->vTroco = number_format($troco, 2, '.', '');
        }
        $make->tagpag($pag);

        foreach ($pagamentos as $pg) {
            $detPag = new \stdClass();
            $detPag->indPag = 0;
            $detPag->tPag = (string) ($pg['forma'] ?? '01'); // 01 dinheiro, 03 crédito, 04 débito, 17 PIX
            $detPag->vPag = number_format((float) ($pg['valor'] ?? 0), 2, '.', '');
            $make->tagdetPag($detPag);
        }

        if (!empty($p['informacoes_adicionais'])) {
            $infAdic = new \stdClass();
            $infAdic->infCpl = $p['informacoes_adicionais'];
            $make->taginfAdic($infAdic);
        }

        $xml = $make->getXML();
        if (!$xml) {
            throw new \RuntimeException('Erro ao montar NFC-e: ' . implode(' | ', $make->getErrors()));
        }

        return ['make' => $make, 'chave' => $make->getChave(), 'numero' => $numero];
    }

    private function montarImpostos(Make $make, int $item, array $it, float $vprod): void
    {
        $origem = (string) ($it['origem'] ?? 0);
        $vprodF = number_format($vprod, 2, '.', '');

        if ($this->emitente['CRT'] == 1 || $this->emitente['CRT'] == 4) {
            // Simples Nacional / MEI -> ICMSSN
            $icms = new \stdClass();
            $icms->item = $item;
            $icms->orig = $origem;
            $icms->CSOSN = (string) ($it['csosn'] ?? '102');
            $make->tagICMSSN($icms);
        } else {
            $icms = new \stdClass();
            $icms->item = $item;
            $icms->orig = $origem;
            $icms->CST = (string) ($it['cst_icms'] ?? '00');
            $icms->modBC = 3;
            $icms->vBC = $vprodF;
            $icms->pICMS = number_format((float) ($it['aliquota_icms'] ?? 0), 2, '.', '');
            $icms->vICMS = number_format($vprod * ((float) ($it['aliquota_icms'] ?? 0) / 100), 2, '.', '');
            $make->tagICMS($icms);
        }

        $pis = new \stdClass();
        $pis->item = $item;
        $pis->CST = (string) ($it['cst_pis'] ?? '07');
        $pis->vBC = '0.00';
        $pis->pPIS = '0.00';
        $pis->vPIS = '0.00';
        $make->tagPIS($pis);

        $cofins = new \stdClass();
        $cofins->item = $item;
        $cofins->CST = (string) ($it['cst_cofins'] ?? '07');
        $cofins->vBC = '0.00';
        $cofins->pCOFINS = '0.00';
        $cofins->vCOFINS = '0.00';
        $make->tagCOFINS($cofins);
    }

    private function validar(array $p): void
    {
        if (empty($p['itens']) || !is_array($p['itens'])) {
            throw new \InvalidArgumentException('itens é obrigatório e deve ser uma lista.');
        }
        foreach ($p['itens'] as $i => $it) {
            foreach (['descricao', 'ncm', 'cfop', 'quantidade', 'valor_unitario'] as $campo) {
                if (!isset($it[$campo]) || $it[$campo] === '') {
                    throw new \InvalidArgumentException("Item #{$i}: campo '{$campo}' é obrigatório.");
                }
            }
        }
    }

    private function soDigitos(?string $v): string
    {
        return preg_replace('/\D/', '', (string) $v) ?? '';
    }

    private function codigoUF(string $uf): int
    {
        $map = [
            'RO' => 11, 'AC' => 12, 'AM' => 13, 'RR' => 14, 'PA' => 15, 'AP' => 16,
            'TO' => 17, 'MA' => 21, 'PI' => 22, 'CE' => 23, 'RN' => 24, 'PB' => 25,
            'PE' => 26, 'AL' => 27, 'SE' => 28, 'BA' => 29, 'MG' => 31, 'ES' => 32,
            'RJ' => 33, 'SP' => 35, 'PR' => 41, 'SC' => 42, 'RS' => 43, 'MS' => 50,
            'MT' => 51, 'GO' => 52, 'DF' => 53,
        ];
        return $map[$uf] ?? throw new \InvalidArgumentException("UF inválida: {$uf}");
    }
}
