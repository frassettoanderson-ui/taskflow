<?php

declare(strict_types=1);

namespace App\Fiscal\CTe;

use NFePHP\CTe\Make;

/**
 * Monta o XML de um CT-e Normal (modelo 57), modal RODOVIÁRIO — o caso mais
 * comum de transportadora de carga. Cenários especiais (aéreo, aquaviário,
 * ferroviário, multimodal, CT-e OS, substituição, complemento) são pontos de
 * extensão a adicionar conforme a necessidade real.
 *
 * PRIMEIRA VERSÃO — validar em homologação com certificado e dados reais.
 */
final class CTeBuilder
{
    public function __construct(
        private array $emitente,
        private int $ambiente,
        private int $serie
    ) {}

    /** @return array{make:Make,chave:string,numero:int} */
    public function montar(array $p, int $numero): array
    {
        $this->validar($p);
        $make = new Make();
        $uf = $this->emitente['UF'];
        $cMun = $this->emitente['cMun'];

        $infCTe = new \stdClass();
        $infCTe->versao = '4.00';
        $make->taginfCTe($infCTe);

        // ---- ide ----
        $ini = $p['inicio'];
        $fim = $p['fim'];
        $ide = new \stdClass();
        $ide->cUF = $this->codigoUF($uf);
        $ide->cCT = str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        $ide->CFOP = (string) ($p['cfop'] ?? '5353');
        $ide->natOp = $p['natureza_operacao'] ?? 'Prestacao de servico de transporte';
        $ide->mod = 57;
        $ide->serie = $this->serie;
        $ide->nCT = $numero;
        $ide->dhEmi = date('Y-m-d\TH:i:sP');
        $ide->tpImp = 1;
        $ide->tpEmis = 1;
        $ide->tpAmb = $this->ambiente;
        $ide->tpCTe = 0;            // 0 = CT-e Normal
        $ide->procEmi = 0;
        $ide->verProc = 'emissor-fiscal-1.0';
        $ide->cMunEnv = $cMun;
        $ide->xMunEnv = $this->emitente['xMun'];
        $ide->UFEnv = $uf;
        $ide->modal = '01';        // rodoviário
        $ide->tpServ = 0;          // 0 = Normal
        $ide->cMunIni = (string) $ini['municipio_cod'];
        $ide->xMunIni = (string) $ini['municipio_nome'];
        $ide->UFIni = (string) $ini['uf'];
        $ide->cMunFim = (string) $fim['municipio_cod'];
        $ide->xMunFim = (string) $fim['municipio_nome'];
        $ide->UFFim = (string) $fim['uf'];
        $ide->retira = 1;          // 1 = Não (não há retira)
        $ide->indIEToma = 1;       // 1 = Contribuinte (ajustar conforme tomador)
        $ide->toma = (string) ($p['tomador'] ?? 0); // 0=Rem,1=Exped,2=Receb,3=Dest
        $make->tagide($ide);

        $toma = new \stdClass();
        $toma->toma = (string) ($p['tomador'] ?? 0);
        $make->tagtoma($toma);

        // ---- emit (transportadora) ----
        $emit = new \stdClass();
        $emit->CNPJ = $this->emitente['CNPJ'];
        $emit->IE = $this->emitente['IE'];
        $emit->xNome = $this->emitente['xNome'];
        $emit->xFant = $this->emitente['xFant'] ?: null;
        $make->tagemit($emit);

        $enderEmit = new \stdClass();
        $enderEmit->xLgr = $this->emitente['xLgr'];
        $enderEmit->nro = $this->emitente['nro'];
        $enderEmit->xBairro = $this->emitente['xBairro'];
        $enderEmit->cMun = $cMun;
        $enderEmit->xMun = $this->emitente['xMun'];
        $enderEmit->CEP = $this->soDigitos($this->emitente['CEP']);
        $enderEmit->UF = $uf;
        $enderEmit->fone = $this->soDigitos($this->emitente['fone']) ?: null;
        $make->tagenderEmit($enderEmit);

        // ---- remetente / destinatário ----
        $this->pessoa($make, 'rem', $p['remetente']);
        $this->pessoa($make, 'dest', $p['destinatario']);

        // ---- valores da prestação ----
        $vTPrest = (float) $p['valor_total_prestacao'];
        $vPrest = new \stdClass();
        $vPrest->vTPrest = number_format($vTPrest, 2, '.', '');
        $vPrest->vRec = number_format((float) ($p['valor_receber'] ?? $vTPrest), 2, '.', '');
        $make->tagvPrest($vPrest);

        foreach (($p['componentes'] ?? [['nome' => 'FRETE VALOR', 'valor' => $vTPrest]]) as $c) {
            $comp = new \stdClass();
            $comp->xNome = (string) $c['nome'];
            $comp->vComp = number_format((float) $c['valor'], 2, '.', '');
            $make->tagComp($comp);
        }

        // ---- ICMS ----
        $icms = new \stdClass();
        if (($this->emitente['CRT'] ?? 1) == 1) {
            $icms->cst = '90';       // Simples Nacional
            $icms->indSN = 1;
        } else {
            $icms->cst = (string) ($p['cst_icms'] ?? '00');
            $icms->vBC = $vPrest->vTPrest;
            $icms->pICMS = number_format((float) ($p['aliquota_icms'] ?? 0), 2, '.', '');
            $icms->vICMS = number_format($vTPrest * ((float) ($p['aliquota_icms'] ?? 0) / 100), 2, '.', '');
        }
        $make->tagicms($icms);

        // ---- CT-e Normal: carga + documentos + modal ----
        $make->taginfCTeNorm(new \stdClass());

        $carga = $p['carga'];
        $infCarga = new \stdClass();
        $infCarga->vCarga = number_format((float) ($carga['valor'] ?? 0), 2, '.', '');
        $infCarga->proPred = (string) ($carga['produto_predominante'] ?? 'Diversos');
        $make->taginfCarga($infCarga);

        $infQ = new \stdClass();
        $infQ->cUnid = (string) ($carga['unidade_cod'] ?? '01'); // 01=KG
        $infQ->tpMed = (string) ($carga['tipo_medida'] ?? 'PESO BRUTO');
        $infQ->qCarga = number_format((float) ($carga['quantidade'] ?? 0), 4, '.', '');
        $make->taginfQ($infQ);

        // documentos transportados (chaves de NF-e)
        foreach (($p['documentos'] ?? []) as $doc) {
            $infNFe = new \stdClass();
            $infNFe->chave = preg_replace('/\D/', '', (string) ($doc['chave_nfe'] ?? $doc));
            $make->taginfNFe($infNFe);
        }

        // modal rodoviário
        $make->taginfModal((object) ['versaoModal' => '4.00']);
        $rodo = new \stdClass();
        $rodo->RNTRC = (string) ($p['rntrc'] ?? 'ISENTO');
        $make->tagrodo($rodo);

        // responsável técnico
        $rt = $this->emitente['respTec'] ?? [];
        $respTec = new \stdClass();
        $respTec->CNPJ = $rt['CNPJ'] ?? '';
        $respTec->xContato = $rt['xContato'] ?? '';
        $respTec->email = $rt['email'] ?? '';
        $respTec->fone = $rt['fone'] ?? '';
        $make->taginfRespTec($respTec);

        $xml = $make->getXML();
        if (!$xml) {
            throw new \RuntimeException('Erro ao montar CT-e: ' . implode(' | ', $make->getErrors()));
        }
        return ['make' => $make, 'chave' => $make->getChave(), 'numero' => $numero];
    }

    private function pessoa(Make $make, string $tipo, array $d): void
    {
        $obj = new \stdClass();
        if (!empty($d['cnpj'])) {
            $obj->CNPJ = $this->soDigitos($d['cnpj']);
        } else {
            $obj->CPF = $this->soDigitos($d['cpf'] ?? '');
        }
        $obj->IE = !empty($d['ie']) ? $this->soDigitos($d['ie']) : 'ISENTO';
        $nomeKey = $tipo === 'rem' ? 'xNome' : 'xNome';
        $obj->$nomeKey = (string) ($d['nome'] ?? '');
        $obj->fone = !empty($d['fone']) ? $this->soDigitos($d['fone']) : null;
        $tipo === 'rem' ? $make->tagrem($obj) : $make->tagdest($obj);

        $e = $d['endereco'] ?? [];
        $end = new \stdClass();
        $end->xLgr = (string) ($e['logradouro'] ?? 'NAO INFORMADO');
        $end->nro = (string) ($e['numero'] ?? 'S/N');
        $end->xBairro = (string) ($e['bairro'] ?? 'CENTRO');
        $end->cMun = (string) ($e['municipio_cod'] ?? '');
        $end->xMun = (string) ($e['municipio_nome'] ?? '');
        $end->CEP = $this->soDigitos($e['cep'] ?? '');
        $end->UF = (string) ($e['uf'] ?? '');
        $end->cPais = '1058';
        $end->xPais = 'BRASIL';
        $tipo === 'rem' ? $make->tagenderReme($end) : $make->tagenderDest($end);
    }

    private function validar(array $p): void
    {
        foreach (['inicio', 'fim', 'remetente', 'destinatario', 'valor_total_prestacao', 'carga'] as $campo) {
            if (empty($p[$campo])) {
                throw new \InvalidArgumentException("Campo '{$campo}' é obrigatório no CT-e.");
            }
        }
    }

    private function soDigitos(?string $v): string
    {
        return preg_replace('/\D/', '', (string) $v) ?? '';
    }

    private function codigoUF(string $uf): int
    {
        $map = ['RO'=>11,'AC'=>12,'AM'=>13,'RR'=>14,'PA'=>15,'AP'=>16,'TO'=>17,'MA'=>21,'PI'=>22,'CE'=>23,'RN'=>24,'PB'=>25,'PE'=>26,'AL'=>27,'SE'=>28,'BA'=>29,'MG'=>31,'ES'=>32,'RJ'=>33,'SP'=>35,'PR'=>41,'SC'=>42,'RS'=>43,'MS'=>50,'MT'=>51,'GO'=>52,'DF'=>53];
        return $map[$uf] ?? throw new \InvalidArgumentException("UF inválida: {$uf}");
    }
}
