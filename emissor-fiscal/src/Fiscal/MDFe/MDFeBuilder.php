<?php

declare(strict_types=1);

namespace App\Fiscal\MDFe;

use NFePHP\MDFe\Make;

/**
 * Monta o XML de um MDF-e (modelo 58), modal RODOVIÁRIO. O MDF-e "amarra" as
 * NF-e/CT-e de um carregamento e acompanha a carga na estrada.
 *
 * PRIMEIRA VERSÃO — validar em homologação com certificado e dados reais.
 * O Make do MDF-e monta o grupo modal automaticamente a partir das tags
 * componentes (infANTT, veicTracao, etc.).
 */
final class MDFeBuilder
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

        // ---- ide ----
        $ide = new \stdClass();
        $ide->cUF = $this->codigoUF($uf);
        $ide->tpAmb = $this->ambiente;
        $ide->tpEmit = 1;              // 1 = emitente do documento
        $ide->mod = 58;
        $ide->serie = $this->serie;
        $ide->nMDF = $numero;
        $ide->cMDF = str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        $ide->cDV = 0;                // placeholder; o Make recalcula pela chave
        $ide->modal = 1;              // rodoviário
        $ide->dhEmi = date('Y-m-d\TH:i:sP');
        $ide->tpEmis = 1;
        $ide->procEmi = 0;
        $ide->verProc = 'emissor-fiscal-1.0';
        $ide->UFIni = (string) $p['uf_inicio'];
        $ide->UFFim = (string) $p['uf_fim'];
        $make->tagide($ide);

        // municípios de carregamento
        foreach (($p['municipios_carga'] ?? []) as $mc) {
            $m = new \stdClass();
            $m->cMunCarrega = (string) $mc['municipio_cod'];
            $m->xMunCarrega = (string) $mc['municipio_nome'];
            $make->taginfMunCarrega($m);
        }

        // ---- emit ----
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
        $enderEmit->cMun = $this->emitente['cMun'];
        $enderEmit->xMun = $this->emitente['xMun'];
        $enderEmit->CEP = $this->soDigitos($this->emitente['CEP']);
        $enderEmit->UF = $uf;
        $enderEmit->fone = $this->soDigitos($this->emitente['fone']) ?: null;
        $enderEmit->email = null;
        $make->tagenderEmit($enderEmit);

        // ---- modal rodoviário: ANTT (RNTRC) + veículo de tração ----
        $antt = new \stdClass();
        $antt->RNTRC = (string) ($p['rntrc'] ?? 'ISENTO');
        $make->taginfANTT($antt);

        $veic = $p['veiculo'];
        $vt = new \stdClass();
        $vt->cInt = (string) ($veic['codigo_interno'] ?? '1');
        $vt->placa = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $veic['placa']));
        $vt->tara = (string) ($veic['tara'] ?? '0');
        $vt->tpRod = (string) ($veic['tipo_rodado'] ?? '03'); // 03 = Cavalo Mecânico
        $vt->tpCar = (string) ($veic['tipo_carroceria'] ?? '00'); // 00 = não aplicável
        $vt->UF = (string) ($veic['uf'] ?? $uf);
        if (!empty($veic['condutor_cpf'])) {
            $vt->condutor = [(object) [
                'xNome' => (string) ($veic['condutor_nome'] ?? ''),
                'CPF'   => $this->soDigitos($veic['condutor_cpf']),
            ]];
        }
        $make->tagveicTracao($vt);

        // reboques (carretas) — obrigatório ao menos um com cavalo mecânico
        foreach (($p['reboques'] ?? []) as $i => $rb) {
            $vr = new \stdClass();
            $vr->cInt = (string) ($rb['codigo_interno'] ?? (string) ($i + 1));
            $vr->placa = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $rb['placa']));
            $vr->tara = (string) ($rb['tara'] ?? '0');
            $vr->capKG = (string) ($rb['capacidade_kg'] ?? '0');
            $vr->tpCar = (string) ($rb['tipo_carroceria'] ?? '00');
            $vr->UF = (string) ($rb['uf'] ?? $uf);
            $make->tagveicReboque($vr);
        }

        // ---- documentos por município de descarga ----
        foreach ($p['descargas'] as $desc) {
            $md = new \stdClass();
            $md->cMunDescarga = (string) $desc['municipio_cod'];
            $md->xMunDescarga = (string) $desc['municipio_nome'];
            $make->taginfMunDescarga($md);

            foreach (($desc['nfe'] ?? []) as $chNFe) {
                $n = new \stdClass();
                $n->cMunDescarga = (string) $desc['municipio_cod'];
                $n->chNFe = preg_replace('/\D/', '', (string) $chNFe);
                $make->taginfNFe($n);
            }
            foreach (($desc['cte'] ?? []) as $chCTe) {
                $c = new \stdClass();
                $c->cMunDescarga = (string) $desc['municipio_cod'];
                $c->chCTe = preg_replace('/\D/', '', (string) $chCTe);
                $make->taginfCTe($c);
            }
        }

        // ---- produto predominante (obrigatório no rodoviário) + lotação ----
        $pp = $p['produto_predominante'] ?? [];
        $prodPred = new \stdClass();
        $prodPred->tpCarga = (string) ($pp['tipo_carga'] ?? '05'); // 05 = Carga Geral
        $prodPred->xProd = (string) ($pp['descricao'] ?? 'PRODUTOS DIVERSOS');
        $prodPred->NCM = (string) ($pp['ncm'] ?? '21069090');
        // infLotacao: obrigatória quando há um único documento (carga de lotação)
        $lot = $p['lotacao'] ?? [];
        $prodPred->infLotacao = (object) [
            'infLocalCarrega'    => (object) ['CEP' => $this->soDigitos($lot['cep_carrega'] ?? $this->emitente['CEP'])],
            'infLocalDescarrega' => (object) ['CEP' => $this->soDigitos($lot['cep_descarrega'] ?? ($p['descargas'][0]['cep'] ?? '88010000'))],
        ];
        $make->tagprodPred($prodPred);

        // ---- contratante(s) do serviço de transporte (tomador) ----
        foreach (($p['contratantes'] ?? []) as $ct) {
            $c = new \stdClass();
            if (!empty($ct['cnpj'])) {
                $c->CNPJ = $this->soDigitos($ct['cnpj']);
            } else {
                $c->CPF = $this->soDigitos($ct['cpf'] ?? '');
            }
            $c->xNome = (string) ($ct['nome'] ?? '');
            $make->taginfContratante($c);
        }

        // ---- pagamento do frete (obrigatório p/ carga lotação) ----
        $pagto = $p['pagamento'] ?? [];
        $ct0 = $p['contratantes'][0] ?? [];
        $vFrete = number_format((float) ($pagto['valor'] ?? 100), 2, '.', '');
        $pag = new \stdClass();
        $pag->xNome = (string) ($pagto['nome'] ?? ($ct0['nome'] ?? 'CONTRATANTE'));
        $docPag = $pagto['cnpj'] ?? ($ct0['cnpj'] ?? '');
        if ($docPag !== '') {
            $pag->CNPJ = $this->soDigitos($docPag);
        } else {
            $pag->CPF = $this->soDigitos($pagto['cpf'] ?? ($ct0['cpf'] ?? ''));
        }
        $pag->Comp = [(object) ['tpComp' => '99', 'vComp' => $vFrete, 'xComp' => 'Frete']];
        $pag->vContrato = $vFrete;
        $pag->indPag = (string) ($pagto['forma'] ?? '0'); // 0 = à vista
        $pag->infBanc = (object) ['PIX' => $this->soDigitos($pagto['pix'] ?? $this->emitente['CNPJ'])];
        $make->taginfPag($pag);

        // ---- seguro da carga (obrigatório p/ transportadora no rodoviário) ----
        $seguro = $p['seguro'] ?? [];
        $seg = new \stdClass();
        $seg->respSeg = (string) ($seguro['responsavel'] ?? '2'); // 2 = Emitente do MDF-e (transportador)
        $seg->CNPJ = $this->emitente['CNPJ'];                      // responsável pelo seguro
        $seg->infSeg = (object) [                                 // seguradora
            'xSeg' => (string) ($seguro['seguradora'] ?? 'SEGURADORA TESTE'),
            'CNPJ' => $this->soDigitos($seguro['seguradora_cnpj'] ?? $this->emitente['CNPJ']),
        ];
        $seg->nApol = (string) ($seguro['apolice'] ?? '0000000001');
        $seg->nAver = [(string) ($seguro['averbacao'] ?? '01020304050607080910')]; // array (uma ou mais averbações)
        $make->tagseg($seg);

        // ---- totais ----
        $tot = new \stdClass();
        $tot->qCTe = (string) ($p['tot']['qtd_cte'] ?? 0);
        $tot->qNFe = (string) ($p['tot']['qtd_nfe'] ?? 0);
        $tot->vCarga = number_format((float) $p['tot']['valor_carga'], 2, '.', '');
        $tot->cUnid = (string) ($p['tot']['unidade_cod'] ?? '01'); // 01=KG
        $tot->qCarga = number_format((float) $p['tot']['peso_carga'], 4, '.', '');
        $make->tagtot($tot);

        // responsável técnico
        $rt = $this->emitente['respTec'] ?? [];
        $respTec = new \stdClass();
        $respTec->CNPJ = $rt['CNPJ'] ?? '';
        $respTec->xContato = $rt['xContato'] ?? '';
        $respTec->email = $rt['email'] ?? '';
        $respTec->fone = !empty($rt['fone']) ? $rt['fone'] : '4899999999';
        $make->taginfRespTec($respTec);

        try {
            $make->getXML();
        } catch (\Throwable $e) {
            $erros = $make->getErrors();
            throw new \RuntimeException('Erro ao montar MDF-e: '
                . (empty($erros) ? $e->getMessage() : implode(' | ', $erros)));
        }
        return ['make' => $make, 'chave' => $make->getChave(), 'numero' => $numero];
    }

    private function validar(array $p): void
    {
        foreach (['uf_inicio', 'uf_fim', 'veiculo', 'descargas', 'tot'] as $campo) {
            if (empty($p[$campo])) {
                throw new \InvalidArgumentException("Campo '{$campo}' é obrigatório no MDF-e.");
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
