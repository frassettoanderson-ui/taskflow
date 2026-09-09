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
        $vt->UF = (string) ($veic['uf'] ?? $uf);
        if (!empty($veic['condutor_cpf'])) {
            $vt->condutor = [(object) [
                'xNome' => (string) ($veic['condutor_nome'] ?? ''),
                'CPF'   => $this->soDigitos($veic['condutor_cpf']),
            ]];
        }
        $make->tagveicTracao($vt);

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
        $respTec->fone = $rt['fone'] ?? '';
        $make->taginfRespTec($respTec);

        $xml = $make->getXML();
        if (!$xml) {
            throw new \RuntimeException('Erro ao montar MDF-e: ' . implode(' | ', $make->getErrors()));
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
