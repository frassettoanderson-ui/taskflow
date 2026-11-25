<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe\Danfse;

use Dompdf\Dompdf;

/**
 * Layout oficial do Portal Nacional (DANFSe v2.0), o mesmo que o emissor do gov.br gera.
 * Só é usado quando quem chama pede layout "oficial" (o padrão por município continua o mesmo).
 * $extra aceita: im, fantasia, ie e cancelada (bool).
 */
final class DanfseOficial extends BaseDanfse
{
    private const URL_QR = 'https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=';

    /** @var array<string,array{0:string,1:string}>|null código IBGE => [nome, UF] */
    private static ?array $municipios = null;

    public function __construct(private string $root = '') {}

    public function nome(): string
    {
        return 'oficial';
    }

    public function render(string $xmlNfse, array $extra = []): string
    {
        $xml = simplexml_load_string($xmlNfse);
        if ($xml === false) {
            throw new \RuntimeException('XML da NFS-e inválido.');
        }
        $xml->registerXPathNamespace('n', 'http://www.sped.fazenda.gov.br/nfse');
        $g = function (string $x) use ($xml): string {
            $r = $xml->xpath($x);
            return $r && isset($r[0]) ? trim((string) $r[0]) : '';
        };
        $inf = '//n:infNFSe';
        $dps = '//n:infDPS';
        $emit = "{$inf}/n:emit";
        $toma = "{$dps}/n:toma";
        $vDps = "{$dps}/n:valores";
        $vNf = "{$inf}/n:valores";

        $chave = preg_replace('/\D/', '', $g("{$inf}/@Id"));
        $cancelada = !empty($extra['cancelada']);
        $teste = $g("{$dps}/n:tpAmb") === '2';

        // ── cabeçalho
        $ufEmit = $g("{$emit}/n:enderNac/n:UF");
        $munEmit = $g("{$inf}/n:xLocEmi") ?: $this->municipio($g("{$emit}/n:enderNac/n:cMun"))[0];

        // ── prestador
        $prest = [
            'doc'  => $this->doc($g("{$emit}/n:CNPJ"), $g("{$emit}/n:CPF")) ?: $g("{$dps}/n:prest/n:NIF"),
            'im'   => $g("{$emit}/n:IM") ?: $g("{$dps}/n:prest/n:IM") ?: (string) ($extra['im'] ?? ''),
            'fone' => $this->fone($g("{$emit}/n:fone") ?: $g("{$dps}/n:prest/n:fone")),
            'nome' => $g("{$emit}/n:xNome"),
            'cMun' => $g("{$emit}/n:enderNac/n:cMun"),
            'uf'   => $ufEmit,
            'cep'  => $g("{$emit}/n:enderNac/n:CEP"),
            'end'  => $this->endereco($g("{$emit}/n:enderNac/n:xLgr"), $g("{$emit}/n:enderNac/n:nro"), $g("{$emit}/n:enderNac/n:xCpl"), $g("{$emit}/n:enderNac/n:xBairro")),
            'mail' => $g("{$emit}/n:email") ?: $g("{$dps}/n:prest/n:email"),
        ];
        $prest['mun'] = $munEmit;

        // ── tomador
        $temToma = $g("{$toma}/n:xNome") !== '' || $g("{$toma}/n:CNPJ") !== '' || $g("{$toma}/n:CPF") !== '' || $g("{$toma}/n:NIF") !== '';
        $tCMun = $g("{$toma}/n:end/n:endNac/n:cMun");
        [$tMun, $tUf] = $this->municipio($tCMun);
        $tomador = [
            'doc'  => $this->doc($g("{$toma}/n:CNPJ"), $g("{$toma}/n:CPF")) ?: $g("{$toma}/n:NIF"),
            'im'   => $g("{$toma}/n:IM"),
            'fone' => $this->fone($g("{$toma}/n:fone")),
            'nome' => $g("{$toma}/n:xNome"),
            'mun'  => $tMun ?: $g("{$toma}/n:end/n:endExt/n:xCidade"),
            'uf'   => $tUf,
            'cMun' => $tCMun,
            'cep'  => $g("{$toma}/n:end/n:endNac/n:CEP"),
            'end'  => $this->endereco($g("{$toma}/n:end/n:xLgr"), $g("{$toma}/n:end/n:nro"), $g("{$toma}/n:end/n:xCpl"), $g("{$toma}/n:end/n:xBairro")),
            'mail' => $g("{$toma}/n:email"),
        ];

        // ── serviço e tributos
        $cLocPrest = $g("{$dps}/n:serv/n:locPrest/n:cLocPrestacao");
        $localPrest = $cLocPrest !== ''
            ? $this->trio($g("{$inf}/n:xLocPrestacao") ?: $this->municipio($cLocPrest)[0], $this->municipio($cLocPrest)[1], '-')
            : $this->trio($g("{$dps}/n:serv/n:locPrest/n:cPaisPrestacao"), '', '-');
        $cLocIncid = $g("{$inf}/n:cLocIncid");
        $localIncid = $cLocIncid !== '' || $g("{$inf}/n:xLocIncid") !== ''
            ? $this->trio($g("{$inf}/n:xLocIncid") ?: $this->municipio($cLocIncid)[0], $this->municipio($cLocIncid)[1], '-')
            : '-';

        $opSN = $g("{$dps}/n:prest/n:regTrib/n:opSimpNac");
        $simples = [
            '1' => 'Não Optante',
            '2' => 'Optante - Microempreendedor Individual (MEI)',
            '3' => 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)',
        ][$opSN] ?? '-';
        $regAp = [
            '1' => 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
            '2' => 'Regime de apuração dos tributos federais pelo SN e o ISSQN pela NFS-e conforme respectiva legislação municipal do tributo',
            '3' => 'Regime de apuração dos tributos federais e municipal pela NFS-e conforme respectivas legislações federal e municipal de cada tributo',
        ][$g("{$dps}/n:prest/n:regTrib/n:regApTribSN")] ?? '-';

        $tribISSQN = [
            '1' => 'Operação Tributável', '2' => 'Imunidade', '3' => 'Exportação de Serviço', '4' => 'Não Incidência',
        ][$g("{$vDps}/n:trib/n:tribMun/n:tribISSQN")] ?? '-';
        $retISSQN = [
            '1' => 'Não Retido', '2' => 'Retido pelo Tomador', '3' => 'Retido pelo Intermediário',
        ][$g("{$vDps}/n:trib/n:tribMun/n:tpRetISSQN")] ?? '-';
        $tpRetPC = $g("{$vDps}/n:trib/n:tribFed/n:piscofins/n:tpRetPisCofins");
        $descRetPC = [
            '1' => '1 - PIS/COFINS/CSLL Retidos',
            '2' => '2 - PIS/COFINS/CSLL Não Retidos',
        ][$tpRetPC] ?? '0 - PIS/COFINS/CSLL Não Retidos';

        $vServ = $g("{$vDps}/n:vServPrest/n:vServ");
        $vLiq = $g("{$vNf}/n:vLiq") ?: $vServ;
        $temIbsCbs = $g("{$inf}/n:IBSCBS/n:totCIBS/n:vTotNF") !== '';
        $vTotIbsCbs = $temIbsCbs ? (float) $g("{$inf}/n:IBSCBS/n:totCIBS/n:gIBS/n:vIBSTot") + (float) $g("{$inf}/n:IBSCBS/n:totCIBS/n:gCBS/n:vCBS") : 0.0;
        $vLiqIbsCbs = $temIbsCbs ? (float) $g("{$inf}/n:IBSCBS/n:totCIBS/n:vTotNF") : 0.0;

        // ── informações complementares
        $compl = [];
        $pFed = $g("{$vDps}/n:trib/n:totTrib/n:pTotTrib/n:pTotTribFed");
        $vFed = $g("{$vDps}/n:trib/n:totTrib/n:vTotTrib/n:vTotTribFed");
        $pSN = $g("{$vDps}/n:trib/n:totTrib/n:pTotTribSN");
        if ($pFed !== '') {
            $compl[] = 'Totais aproximados dos Tributos cfe. Lei n° 12.741/2012: Federais: ' . $this->pct($pFed) . ' %; Estaduais: '
                . $this->pct($g("{$vDps}/n:trib/n:totTrib/n:pTotTrib/n:pTotTribEst")) . ' %; Municipais: '
                . $this->pct($g("{$vDps}/n:trib/n:totTrib/n:pTotTrib/n:pTotTribMun")) . ' %;';
        } elseif ($vFed !== '') {
            $compl[] = 'Totais aproximados dos Tributos cfe. Lei n° 12.741/2012: Federais: R$ ' . $this->moeda((float) $vFed) . '; Estaduais: R$ '
                . $this->moeda((float) $g("{$vDps}/n:trib/n:totTrib/n:vTotTrib/n:vTotTribEst")) . '; Municipais: R$ '
                . $this->moeda((float) $g("{$vDps}/n:trib/n:totTrib/n:vTotTrib/n:vTotTribMun")) . ';';
        } elseif ($pSN !== '' && (float) $pSN > 0) {
            $compl[] = 'Total aproximado dos Tributos cfe. Lei n° 12.741/2012 (Simples Nacional): ' . $this->pct($pSN) . ' %;';
        }
        foreach ([$g("{$dps}/n:serv/n:infoCompl/n:xInfComp"), $g("{$inf}/n:xOutInf")] as $t) {
            if ($t !== '') {
                $compl[] = $t;
            }
        }

        // ── montagem
        $c = fn (string $l, string $v, int $span = 1, string $cls = '') => $this->celula($l, $v, $span, $cls);
        $t = fn (string $titulo) => '<td class="tit"><b>' . $this->e($titulo) . '</b></td>';
        $linha = fn (string ...$tds) => '<tr>' . implode('', $tds) . '</tr>';
        $bloco = fn (string $linhas, bool $traco = true, string $cls = '') => '<table class="g' . ($traco ? ' tr' : '') . ($cls ? " {$cls}" : '') . '">' . self::COLS . $linhas . '</table>';
        $dash = fn (string $v) => $v === '' ? '-' : $v;
        $rs = fn (string $v) => $v === '' || (float) $v == 0.0 ? '-' : 'R$ ' . $this->moeda((float) $v);
        $ibgeCep = fn (string $cMun, string $cep) => ($cMun !== '' ? substr($cMun, 0, 2) . '.' . substr($cMun, 2) : '-') . ' / ' . ($cep !== '' ? $this->cepPonto($cep) : '-');

        $situacao = $cancelada ? 'NFS-e Cancelada' : ([
            '100' => 'NFS-e Gerada', '101' => 'NFS-e de Substituição Gerada', '102' => 'NFS-e de Decisão Judicial', '103' => 'NFS-e Avulsa',
        ][$g("{$inf}/n:cStat")] ?? 'NFS-e Gerada');
        $emitente = ['1' => 'Prestador', '2' => 'Tomador', '3' => 'Intermediário'][$g("{$dps}/n:tpEmit")] ?? 'Prestador';

        $logo = is_file(__DIR__ . '/logo-nfse.png') ? 'data:image/png;base64,' . base64_encode((string) file_get_contents(__DIR__ . '/logo-nfse.png')) : '';
        $qr = $chave !== '' ? $this->qr(self::URL_QR . $chave) : '';

        $html = '<html><head><meta charset="utf-8"><style>' . self::CSS . '</style></head><body>';
        $html .= '<div class="moldura"></div>';
        if ($cancelada) {
            $html .= '<div class="tarja">CANCELADA</div>';
        } elseif ($teste) {
            $html .= '<div class="tarja teste">SEM VALOR FISCAL</div>';
        }
        $html .= '<div class="pag">';

        // cabeçalho cinza
        $html .= '<table class="g cab">' . self::COLS . '<tr>'
            . '<td>' . ($logo ? '<img src="' . $logo . '" class="logo">' : '') . '</td>'
            . '<td colspan="2" class="titulo">DANFSe v2.0<br>Documento Auxiliar da NFS-e</td>'
            . '<td class="amb"><div class="mun">Município: ' . $this->e($munEmit . ($ufEmit ? " - {$ufEmit}" : '')) . '</div>'
            . '<div>Ambiente Gerador: ' . $this->e($dash($g("{$inf}/n:ambGer"))) . '</div>'
            . '<div>Tipo de Ambiente: ' . $this->e($dash($g("{$dps}/n:tpAmb"))) . '</div></td>'
            . '</tr></table>';

        // identificação + QR
        $qrCel = '<td rowspan="4" class="qr">' . ($qr ? '<img src="' . $qr . '">' : '')
            . '<div>A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e</div></td>';
        $html .= $bloco(
            $linha('<td colspan="3" class="grande"><div class="l l7">CHAVE DE ACESSO DA NFS-e</div><div class="v">' . $this->e($chave) . '</div></td>', $qrCel)
            . $linha($c('NÚMERO DA NFS-e', $g("{$inf}/n:nNFSe"), 1, 'l7'), $c('COMPETÊNCIA DA NFS-e', $this->dia($g("{$dps}/n:dCompet")), 1, 'l7'), $c('DATA E HORA DA EMISSÃO DA NFS-e', $this->dataBr($g("{$inf}/n:dhProc")), 1, 'l7'))
            . $linha($c('NÚMERO DA DPS', $g("{$dps}/n:nDPS"), 1, 'l7'), $c('SÉRIE DA DPS', $g("{$dps}/n:serie"), 1, 'l7'), $c('DATA E HORA DA EMISSÃO DA DPS', $this->dataBr($g("{$dps}/n:dhEmi")), 1, 'l7'))
            . $linha($c('EMITENTE DA NFS-e', $emitente, 1, 'l7 cinza'), $c('SITUAÇÃO DA NFS-e', $situacao, 1, 'l7'), $c('FINALIDADE', '-', 1, 'l7'))
            ,
            false,
            'topo'
        );

        // prestador
        $html .= $bloco(
            $linha($t('PRESTADOR / FORNECEDOR'), $c('CNPJ / CPF / NIF', $dash($prest['doc'])), $c('Indicador Municipal (Inscrição)', $dash($prest['im'])), $c('Telefone', $dash($prest['fone'])))
            . $linha($c('Nome / Nome Empresarial', $this->corte($prest['nome'], 80), 2), $c('Município / Sigla UF', $this->duo($prest['mun'], $prest['uf'])), $c('Código IBGE / CEP', $ibgeCep($prest['cMun'], $prest['cep'])))
            . $linha($c('Endereço', $this->corte($prest['end'], 80), 2), $c('E-mail', $this->corte($prest['mail'], 70), 2))
            . $linha($c('Simples Nacional na Data de Competência', $this->corte($simples, 40)), $c('Regime de Apuração Tributária pelo SN', $this->corte($regAp, 120), 3))
        );

        // tomador
        if ($temToma) {
            $html .= $bloco(
                $linha($t('TOMADOR / ADQUIRENTE'), $c('CNPJ / CPF / NIF', $dash($tomador['doc'])), $c('Indicador Municipal (Inscrição)', $dash($tomador['im'])), $c('Telefone', $dash($tomador['fone'])))
                . $linha($c('Nome / Nome Empresarial', $this->corte($tomador['nome'], 80), 2), $c('Município / Sigla UF', $tomador['mun'] !== '' ? $this->duo($tomador['mun'], $tomador['uf']) : '-'), $c('Código IBGE / CEP', $tomador['cMun'] !== '' || $tomador['cep'] !== '' ? $ibgeCep($tomador['cMun'], $tomador['cep']) : '-'))
                . $linha($c('Endereço', $dash($this->corte($tomador['end'], 80)), 2), $c('E-mail', $dash($this->corte($tomador['mail'], 70)), 2))
            );
        } else {
            $html .= '<table class="g tr">' . self::COLS . '<tr><td colspan="4" class="aviso">TOMADOR DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</td></tr></table>';
        }
        $html .= '<table class="g tr">' . self::COLS . '<tr><td colspan="4" class="aviso">DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</td></tr></table>';
        $html .= '<table class="g tr">' . self::COLS . '<tr><td colspan="4" class="aviso">INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</td></tr></table>';

        // serviço
        $cTribNac = $g("{$dps}/n:serv/n:cServ/n:cTribNac");
        $codTrib = (preg_match('/^\d{6}$/', $cTribNac) ? substr($cTribNac, 0, 2) . '.' . substr($cTribNac, 2, 2) . '.' . substr($cTribNac, 4, 2) : $dash($cTribNac))
            . ' / ' . $dash($g("{$dps}/n:serv/n:cServ/n:cTribMun"));
        $nbs = $g("{$dps}/n:serv/n:cServ/n:cNBS");
        $nbsFmt = preg_match('/^\d{9}$/', $nbs) ? substr($nbs, 0, 1) . '.' . substr($nbs, 1, 4) . '.' . substr($nbs, 5, 2) . '.' . substr($nbs, 7, 2) : $dash($nbs);
        $html .= $bloco(
            $linha($t('SERVIÇO PRESTADO'), $c('Código de Tributação Nacional/Municipal', $codTrib), $c('Código da NBS', $nbsFmt), $c('Local da Prestação / Sigla UF / País', $localPrest))
            . '<tr><td colspan="4" class="livre">' . $this->e($dash($g("{$inf}/n:xTribNac"))) . '</td></tr>'
            . '<tr><td colspan="4" class="desc"><div class="l">Descrição do Serviço</div><div class="v">' . nl2br($this->e($dash($g("{$dps}/n:serv/n:cServ/n:xDescServ")))) . '</div></td></tr>'
        );

        // ISSQN
        $pAliq = $g("{$vNf}/n:pAliqAplic") ?: $g("{$vDps}/n:trib/n:tribMun/n:pAliq");
        $html .= $bloco(
            $linha($t('TRIBUTAÇÃO MUNICIPAL (ISSQN)'), $c('Tipo de Tributação do ISSQN', $tribISSQN), $c('Município / Sigla UF / País de Incidência do ISSQN', $localIncid, 2))
            . $linha($c('BC ISSQN', $rs($g("{$vNf}/n:vBC"))), $c('Alíquota Aplicada', $pAliq === '' || (float) $pAliq == 0.0 ? '-' : $this->pct($pAliq) . '%'), $c('Retenção do ISSQN', $retISSQN), $c('ISSQN Apurado', $rs($g("{$vNf}/n:vISSQN"))))
        );

        // federais
        $fed = "{$vDps}/n:trib/n:tribFed";
        $html .= $bloco(
            $linha($t('TRIBUTAÇÃO FEDERAL (EXCETO CBS)'), $c('IRRF', $rs($g("{$fed}/n:vRetIRRF"))), $c('Contribuição Previdenciária - Retida', $rs($g("{$fed}/n:vRetCP"))), $c('Contribuições Sociais - Retidas', $rs($g("{$fed}/n:vRetCSLL"))))
            . $linha($c('PIS - Débito Apuração Própria', $rs($g("{$fed}/n:piscofins/n:vPis"))), $c('COFINS - Débito Apuração Própria', $rs($g("{$fed}/n:piscofins/n:vCofins"))), $c('Descrição Contrib. Sociais - Retidas', $descRetPC, 2))
        );

        // IBS/CBS (reforma tributária; sem o grupo, tudo "-")
        $html .= $bloco(
            $linha($t('TRIBUTAÇÃO IBS/CBS'), $c('CST / cClassTrib', '- / -'), $c('Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF', '- / - / - / -', 2))
            . $linha($c('Exclusões e Reduções da Base de Cálculo', 'R$ 0,00'), $c('Base de Cálculo Após Exclusões e Reduções', '-'), $c('Red. Alíquota IBS / Red. Alíquota CBS', '- / - / -'), $c('Alíquota - IBS UF / IBS Mun', '- / -'))
            . $linha($c('Aliq. Efetiva Municipal - IBS', '-'), $c('Valor Apurado Municipal - IBS', '-'), $c('Aliq. Efetiva Estadual - IBS', '-'), $c('Valor Apurado Estadual - IBS', '-'))
            . $linha($c('Valor Total Apurado - IBS', '-'), $c('Alíquota - CBS', '-'), $c('Alíquota Efetiva - CBS', '-'), $c('Valor Total Apurado - CBS', '-'))
        );

        // valores
        $html .= $bloco(
            $linha($t('VALOR TOTAL DA NFS-e'), $c('VALOR DA OPERAÇÃO / SERVIÇO', 'R$ ' . $this->moeda((float) $vServ)), $c('Desconto Incondicionado', $rs($g("{$vDps}/n:vDescCondIncond/n:vDescIncond"))), $c('Desconto Condicionado', $rs($g("{$vDps}/n:vDescCondIncond/n:vDescCond"))))
            . $linha($c('Total das Retenções (ISSQN / Federais)', $rs($g("{$vNf}/n:vTotalRet"))), $c('VALOR LÍQUIDO DA NFS-e', 'R$ ' . $this->moeda((float) $vLiq)), $c('Total do IBS/CBS', 'R$ ' . $this->moeda($vTotIbsCbs)), $c('VALOR LÍQUIDO DA NFS-e + IBS/CBS', 'R$ ' . $this->moeda($vLiqIbsCbs), 1, 'cinza'))
        );

        // informações complementares
        $html .= '<table class="g tr">' . self::COLS . '<tr><td colspan="4" class="compl"><b class="t7">INFORMAÇÕES COMPLEMENTARES</b>'
            . '<div class="txt">' . implode('<br>', array_map(fn ($s) => nl2br($this->e($s)), $compl)) . '</div></td></tr></table>';

        $html .= '</div>';

        // canhoto
        $html .= '<div class="can" style="left:9pt;width:137.6pt"><b>DATA CIENTIFICAÇÃO:</b></div>'
            . '<div class="can" style="left:153.6pt;width:137.5pt;border-left:0"><b>IDENTIFICAÇÃO E ASSINATURA</b></div>'
            . '<div class="can" style="left:298.1pt;width:282.2pt;border-left:0"><b>N° NFS-e / CHAVE NFS-e</b><div class="v">' . $this->e($g("{$inf}/n:nNFSe") . ' / ' . $chave) . '</div></div>';

        $html .= '</body></html>';

        $dompdf = new Dompdf(['defaultFont' => 'Helvetica', 'isRemoteEnabled' => false]);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        return $dompdf->output();
    }

    private const COLS = '<colgroup><col style="width:144.6pt"><col style="width:144.5pt"><col style="width:144.6pt"><col style="width:144.6pt"></colgroup>';

    private const CSS = '
        @page{margin:0}
        body{margin:0;font-family:Helvetica,Arial,sans-serif;color:#000}
        .moldura{position:absolute;left:5pt;top:5pt;width:583pt;height:830pt;border:1pt solid #000}
        .pag{position:absolute;left:8.5pt;top:5.7pt;width:578.3pt}
        table.g{width:578.3pt;border-collapse:collapse;table-layout:fixed}
        table.g.tr{border-top:0.5pt solid #000}
        table.g td{vertical-align:top;padding:0.6pt 3.4pt 0 3.4pt;height:18.6pt;overflow:hidden}
        table.cab{border-bottom:0.5pt solid #000}
        table.g.cab td{background:#f2f2f2;height:29.5pt;padding:0 3.4pt}
        .cab .logo{width:115.7pt;height:22.9pt;margin-top:4.6pt}
        table.g.cab td.titulo{text-align:center;font-weight:bold;font-size:9pt;line-height:10.5pt;padding-top:6.5pt}
        table.g.cab td.amb{font-size:6pt;line-height:7pt;padding-top:4.5pt}
        table.topo td{height:19.2pt}
        table.g.topo td.grande{padding-top:4.5pt;height:16pt}
        .cab .amb .mun{font-size:8pt;line-height:9.5pt}
        .l{font-size:6pt;font-weight:bold;line-height:7pt}
        .l7 .l,.l7{font-size:7pt}
        .v{font-size:7pt;line-height:8.4pt}
        .grande{height:18pt}
        .cinza{background:#f2f2f2}
        table.g td.tit{background:#f2f2f2;font-size:7pt;line-height:8pt}
        table.g td.aviso{text-align:center;font-size:7pt;height:7.9pt;padding:0;line-height:8pt}
        table.g td.livre{font-size:7pt;height:12.5pt;padding-top:2.5pt}
        table.g td.desc{height:18pt}
        table.g td.qr{text-align:left;font-size:6pt;line-height:6.6pt;padding-top:4.5pt}
        td.qr img{width:45pt;height:45pt;display:block;margin:0 auto 2.5pt auto}
        table.g td.compl{height:30pt}
        .t7{font-size:7pt}
        .compl .txt{font-size:7pt;line-height:8.4pt;margin-top:11pt}
        .can{position:absolute;top:795.8pt;height:18.1pt;border:1pt solid #000;padding:1pt 3.5pt;font-size:6pt;line-height:7pt}
        .can .v{font-size:7pt;line-height:8pt}
        .tarja{position:absolute;left:40pt;top:330pt;width:520pt;text-align:center;font-size:72pt;font-weight:bold;color:#c62828;opacity:0.28;transform:rotate(-30deg)}
        .tarja.teste{font-size:52pt}
    ';

    private function celula(string $rotulo, string $valor, int $span, string $cls): string
    {
        return '<td' . ($span > 1 ? ' colspan="' . $span . '"' : '') . ($cls ? ' class="' . $cls . '"' : '') . '>'
            . '<div class="l">' . $this->e($rotulo) . '</div><div class="v">' . $this->e($valor === '' ? '-' : $valor) . '</div></td>';
    }

    /** @return array{0:string,1:string} [nome, UF] pelo código IBGE */
    private function municipio(string $codigo): array
    {
        if ($codigo === '') {
            return ['', ''];
        }
        if (self::$municipios === null) {
            $base = $this->root !== '' ? $this->root : dirname(__DIR__, 4);
            $arq = $base . '/config/municipios-ibge.json';
            $j = is_file($arq) ? json_decode((string) file_get_contents($arq), true) : null;
            self::$municipios = is_array($j) ? $j : [];
        }
        $m = self::$municipios[$codigo] ?? null;
        return is_array($m) ? [(string) $m[0], (string) $m[1]] : ['', ''];
    }

    private function trio(string $a, string $b, string $c): string
    {
        return ($a !== '' ? $a : '-') . ' / ' . ($b !== '' ? $b : '-') . ' / ' . $c;
    }

    private function duo(string $mun, string $uf): string
    {
        return ($mun !== '' ? $mun : '-') . ' / ' . ($uf !== '' ? $uf : '-');
    }

    private function endereco(string $lgr, string $nro, string $cpl, string $bairro): string
    {
        return implode(', ', array_filter([$lgr, $nro, $cpl, $bairro], fn ($x) => $x !== ''));
    }

    private function fone(string $f): string
    {
        $d = preg_replace('/\D/', '', $f);
        if (strlen($d) === 11) {
            return '(' . substr($d, 0, 2) . ') ' . substr($d, 2, 5) . '-' . substr($d, 7);
        }
        if (strlen($d) === 10) {
            return '(' . substr($d, 0, 2) . ') ' . substr($d, 2, 4) . '-' . substr($d, 6);
        }
        return $f;
    }

    private function cepPonto(string $cep): string
    {
        $d = preg_replace('/\D/', '', $cep);
        return strlen($d) === 8 ? substr($d, 0, 2) . '.' . substr($d, 2, 3) . '-' . substr($d, 5) : $cep;
    }

    private function pct(string $v): string
    {
        return number_format((float) $v, 2, ',', '.');
    }

    private function dia(string $iso): string
    {
        if ($iso === '') {
            return '-';
        }
        try {
            return (new \DateTime($iso))->format('d/m/Y');
        } catch (\Throwable) {
            return $iso;
        }
    }

    /** Corta texto longo como o DANFSe oficial ("Optante - Microempresa ou Empresa de ..."). */
    private function corte(string $s, int $max): string
    {
        return mb_strlen($s) > $max ? rtrim(mb_substr($s, 0, $max - 3)) . ' ...' : $s;
    }
}
