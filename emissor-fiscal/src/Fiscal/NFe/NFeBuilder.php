<?php

declare(strict_types=1);

namespace App\Fiscal\NFe;

use NFePHP\NFe\Make;

/**
 * Monta o XML de uma NF-e modelo 55 a partir de um payload normalizado.
 *
 * Cobre o caso mais comum (venda de mercadoria, Simples Nacional ou Regime
 * Normal com ICMS/PIS/COFINS básicos). Cenários especiais — ST, IPI,
 * exportação, importação, combustível — são pontos de extensão marcados
 * com TODO e devem ser adicionados conforme a necessidade real do cliente.
 */
final class NFeBuilder
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
        $dhEmi = date('Y-m-d\TH:i:sP');

        // ------- infNFe (inicializa o nó raiz) -------
        $infNFe = new \stdClass();
        $infNFe->versao = '4.00';
        $make->taginfNFe($infNFe);

        // ------- ide -------
        $cNF = str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        $ide = new \stdClass();
        $ide->cUF = $this->codigoUF($uf);
        $ide->cNF = $cNF;
        $ide->natOp = $p['natureza_operacao'] ?? 'Venda de mercadoria';
        $ide->mod = 55;
        $ide->serie = $this->serie;
        $ide->nNF = $numero;
        $ide->dhEmi = $dhEmi;
        $ide->tpNF = 1;              // 1 = saída
        $ide->idDest = $this->idDest($uf, $p);
        $ide->cMunFG = $cMun;
        $ide->tpImp = 1;            // DANFE normal retrato
        $ide->tpEmis = 1;          // emissão normal
        $ide->tpAmb = $this->ambiente;
        $ide->finNFe = 1;          // NF-e normal
        $ide->indFinal = ($p['consumidor_final'] ?? true) ? 1 : 0;
        $ide->indPres = 1;         // operação presencial (ajuste se e-commerce = 2)
        $ide->procEmi = 0;
        $ide->verProc = 'emissor-fiscal-1.0';
        $make->tagide($ide);

        // ------- emit -------
        $emit = new \stdClass();
        $emit->CNPJ = $this->emitente['CNPJ'];
        $emit->xNome = $this->emitente['xNome'];
        $emit->xFant = $this->emitente['xFant'] ?: null;
        $emit->IE = $this->emitente['IE'];
        $emit->IM = $this->emitente['IM'] ?: null;
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

        // ------- dest -------
        $d = $p['destinatario'];
        $dest = new \stdClass();
        if (!empty($d['cnpj'])) {
            $dest->CNPJ = $this->soDigitos($d['cnpj']);
        } elseif (!empty($d['cpf'])) {
            $dest->CPF = $this->soDigitos($d['cpf']);
        } else {
            $dest->idEstrangeiro = $d['id_estrangeiro'] ?? '';
        }
        $dest->xNome = $this->ambiente === 2
            ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
            : ($d['nome'] ?? 'CONSUMIDOR');
        // indIEDest: 1=contribuinte, 2=isento, 9=não contribuinte
        $dest->indIEDest = !empty($d['ie']) ? 1 : (!empty($d['cnpj']) ? 2 : 9);
        $dest->IE = !empty($d['ie']) ? $this->soDigitos($d['ie']) : null;
        $dest->email = $d['email'] ?? null;
        $make->tagdest($dest);

        if (!empty($d['endereco'])) {
            $e = $d['endereco'];
            $enderDest = new \stdClass();
            $enderDest->xLgr = $e['logradouro'] ?? 'NAO INFORMADO';
            $enderDest->nro = $e['numero'] ?? 'S/N';
            $enderDest->xBairro = $e['bairro'] ?? 'NAO INFORMADO';
            $enderDest->cMun = $e['municipio_cod'] ?? $cMun;
            $enderDest->xMun = $e['municipio_nome'] ?? '';
            $enderDest->UF = $e['uf'] ?? $uf;
            $enderDest->CEP = $this->soDigitos($e['cep'] ?? '');
            $enderDest->cPais = '1058';
            $enderDest->xPais = 'BRASIL';
            $make->tagenderDest($enderDest);
        }

        // ------- itens -------
        $totalProd = 0.0;
        foreach (array_values($p['itens']) as $i => $item) {
            $n = $i + 1;
            $qtd = (float) $item['quantidade'];
            $vun = (float) $item['valor_unitario'];
            $vprod = isset($item['valor_total'])
                ? (float) $item['valor_total']
                : round($qtd * $vun, 2);
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
        $icmsTot->vBC = '0.00';
        $icmsTot->vICMS = '0.00';
        $icmsTot->vICMSDeson = '0.00';
        $icmsTot->vFCP = '0.00';
        $icmsTot->vBCST = '0.00';
        $icmsTot->vST = '0.00';
        $icmsTot->vFCPST = '0.00';
        $icmsTot->vFCPSTRet = '0.00';
        $icmsTot->vProd = number_format($totalProd, 2, '.', '');
        $icmsTot->vFrete = '0.00';
        $icmsTot->vSeg = '0.00';
        $icmsTot->vDesc = '0.00';
        $icmsTot->vII = '0.00';
        $icmsTot->vIPI = '0.00';
        $icmsTot->vIPIDevol = '0.00';
        $icmsTot->vPIS = '0.00';
        $icmsTot->vCOFINS = '0.00';
        $icmsTot->vOutro = '0.00';
        $icmsTot->vNF = number_format($totalProd, 2, '.', '');
        $make->tagICMSTot($icmsTot);

        // ------- transporte -------
        $transp = new \stdClass();
        $transp->modFrete = $p['modalidade_frete'] ?? 9; // 9 = sem transporte
        $make->tagtransp($transp);

        // ------- pagamento -------
        $pag = new \stdClass();
        $make->tagpag($pag);
        $detPag = new \stdClass();
        $detPag->indPag = 0;
        $detPag->tPag = $p['pagamento']['forma'] ?? '01'; // 01=dinheiro, 03=cartão crédito...
        $detPag->vPag = number_format($totalProd, 2, '.', '');
        $make->tagdetPag($detPag);

        // ------- info adicional -------
        if (!empty($p['informacoes_adicionais'])) {
            $infAdic = new \stdClass();
            $infAdic->infCpl = $p['informacoes_adicionais'];
            $make->taginfAdic($infAdic);
        }

        // ------- responsável técnico (exigido por SC e outras UFs) -------
        $rt = $this->emitente['respTec'] ?? [];
        $respTec = new \stdClass();
        $respTec->CNPJ = $rt['CNPJ'] ?? '';
        $respTec->xContato = $rt['xContato'] ?? '';
        $respTec->email = $rt['email'] ?? '';
        $respTec->fone = $rt['fone'] ?? '';
        $make->taginfRespTec($respTec);

        $xml = $make->getXML();
        if (!$xml) {
            throw new \RuntimeException(
                'Erro ao montar NF-e: ' . implode(' | ', $make->getErrors())
            );
        }

        return ['make' => $make, 'chave' => $make->getChave(), 'numero' => $numero];
    }

    private function montarImpostos(Make $make, int $item, array $it, float $vprod): void
    {
        $origem = (string) ($it['origem'] ?? 0); // 0 = nacional
        $vprodF = number_format($vprod, 2, '.', '');

        if ($this->emitente['CRT'] == 1) {
            // Simples Nacional -> ICMSSN
            $icms = new \stdClass();
            $icms->item = $item;
            $icms->orig = $origem;
            $icms->CSOSN = (string) ($it['csosn'] ?? '102'); // 102 = sem permissão de crédito
            $make->tagICMSSN($icms);
        } else {
            // Regime Normal -> ICMS 00 (tributado integralmente) por padrão
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

        // PIS
        $pis = new \stdClass();
        $pis->item = $item;
        $pis->CST = (string) ($it['cst_pis'] ?? '07'); // 07 = isenta
        $pis->vBC = '0.00';
        $pis->pPIS = '0.00';
        $pis->vPIS = '0.00';
        $make->tagPIS($pis);

        // COFINS
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
        if (empty($p['destinatario'])) {
            throw new \InvalidArgumentException('destinatario é obrigatório.');
        }
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

    private function idDest(string $ufEmit, array $p): int
    {
        $ufDest = $p['destinatario']['endereco']['uf'] ?? $ufEmit;
        if ($ufDest === 'EX') {
            return 3; // exterior
        }
        return $ufDest === $ufEmit ? 1 : 2; // 1=interna, 2=interestadual
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
