<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe;

use Com\Tecnick\Barcode\Barcode;
use Dompdf\Dompdf;

/**
 * Gera o DANFSE (PDF) do Padrão Nacional a partir do XML autorizado, num layout
 * no padrão de mercado (semelhante ao DANFSE municipal/ABRASF): cabeçalho,
 * prestador/tomador, discriminação, valor total, grid de tributos e QR Code.
 *
 * Campos que só existem em layouts municipais e não vêm no XML nacional (ex.:
 * código de verificação, retenções federais detalhadas) são preenchidos com a
 * chave de acesso / 0,00, que é o correto para o caso (Simples via DAS).
 */
final class NFSeDanfse
{
    private const URL_CONSULTA = 'https://www.nfse.gov.br/consultapublica';

    public function render(string $xmlNfse): string
    {
        $xml = simplexml_load_string($xmlNfse);
        if ($xml === false) {
            throw new \RuntimeException('XML da NFS-e inválido.');
        }
        $xml->registerXPathNamespace('n', 'http://www.sped.fazenda.gov.br/nfse');
        $g = function (string $xpath) use ($xml): string {
            $r = $xml->xpath($xpath);
            return $r && isset($r[0]) ? trim((string) $r[0]) : '';
        };

        $chave   = preg_replace('/\D/', '', $g('//n:infNFSe/@Id'));
        $nNFSe   = $g('//n:infNFSe/n:nNFSe');
        $serie   = $g('//n:infDPS/n:serie');
        $nDPS    = $g('//n:infDPS/n:nDPS');
        $dhProc  = $this->dataBr($g('//n:infNFSe/n:dhProc'));
        $dhEmi   = $this->dataBr($g('//n:infDPS/n:dhEmi'));
        $dCompet = $this->dataMes($g('//n:infDPS/n:dCompet'));
        $tpAmb   = $g('//n:tpAmb');
        $xTrib   = $g('//n:infNFSe/n:xTribNac');
        $cTribNac = $g('//n:DPS//n:serv/n:cServ/n:cTribNac');
        $descServ = $g('//n:DPS//n:serv/n:cServ/n:xDescServ');
        $municipio = $g('//n:infNFSe/n:xLocEmi');
        $ufEmit    = $g('//n:infNFSe/n:emit/n:enderNac/n:UF');
        $localInc  = $g('//n:infNFSe/n:xLocIncid') ?: $municipio;

        $emitNome = $g('//n:infNFSe/n:emit/n:xNome');
        $emitCnpj = $this->doc($g('//n:infNFSe/n:emit/n:CNPJ'), $g('//n:infNFSe/n:emit/n:CPF'));
        $emitIM   = $g('//n:infNFSe/n:emit/n:IM');
        $emitEnd  = trim(
            $g('//n:infNFSe/n:emit/n:enderNac/n:xLgr') . ', ' .
            $g('//n:infNFSe/n:emit/n:enderNac/n:nro') . ' - ' .
            $g('//n:infNFSe/n:emit/n:enderNac/n:xBairro')
        );
        $emitCep  = $this->cep($g('//n:infNFSe/n:emit/n:enderNac/n:CEP'));
        $emitFone = $g('//n:infNFSe/n:emit/n:fone');
        $emitMail = $g('//n:infNFSe/n:emit/n:email');

        $tomaNome = $g('//n:DPS//n:toma/n:xNome');
        $tomaDoc  = $this->doc($g('//n:DPS//n:toma/n:CNPJ'), $g('//n:DPS//n:toma/n:CPF'));
        $tomaMail = $g('//n:DPS//n:toma/n:email');

        $vServ = (float) $g('//n:DPS//n:valores/n:vServPrest/n:vServ');
        $vLiq  = (float) ($g('//n:infNFSe/n:valores/n:vLiq') ?: $vServ);
        $pAliq = (float) $g('//n:DPS//n:tribMun/n:pAliq');
        $vISS  = (float) $g('//n:DPS//n:tribMun/n:vISSQN');
        $opSN  = $g('//n:DPS//n:regTrib/n:opSimpNac');
        $optante = in_array($opSN, ['2', '3'], true) ? 'Sim' : 'Não';
        $regime  = $opSN === '2' ? 'MEI' : ($opSN === '3' ? 'Simples Nacional' : 'Normal');

        $qr = $this->qrDataUri(self::URL_CONSULTA);
        $chaveFmt = trim(chunk_split($chave, 4, ' '));
        $selo = $tpAmb === '1' ? '' :
            '<tr><td colspan="2" class="selo">DOCUMENTO EMITIDO EM AMBIENTE DE TESTE — SEM VALOR FISCAL</td></tr>';

        $tomaBloco = ($tomaNome || $tomaDoc)
            ? $this->kv('CPF/CNPJ', $tomaDoc ?: '—') . $this->kv('Razão Social', $tomaNome ?: '—')
              . ($tomaMail ? $this->kv('Email', $tomaMail) : '')
            : '<div class="muted">Consumidor não identificado</div>';

        $m = fn (float $v) => number_format($v, 2, ',', '.');

        $css = '<style>
          *{font-family:DejaVu Sans, sans-serif;font-size:9px;color:#000}
          .doc{border:1.2px solid #000}
          .hd{width:100%;border-collapse:collapse}
          .hd td{border-bottom:1.2px solid #000;padding:6px 8px;vertical-align:top}
          .hd .muni{font-size:12px;font-weight:bold;color:#1c4587}
          .hd .sub{font-size:8px;color:#333}
          .hd .tit{font-size:13px;font-weight:bold}
          .hd .rota{font-size:8px}
          .hd .box b{font-size:9px}
          .badge{border:1.5px solid #1c4587;color:#1c4587;font-weight:bold;font-size:16px;
                 text-align:center;padding:6px 8px;border-radius:4px}
          .rps{padding:4px 8px;border-bottom:1.2px solid #000;font-weight:bold;font-size:9px}
          .sec{border-bottom:1.2px solid #000;padding:5px 8px}
          .sec h4{margin:0 0 4px;font-size:9px;font-weight:bold;color:#1c4587}
          .kv{margin:1px 0}
          .kl{color:#333;font-weight:bold}
          .muted{color:#555;font-style:italic}
          .disc{min-height:150px;padding:6px 8px;border-bottom:1.2px solid #000}
          .disc h4{margin:0 0 4px;font-size:9px;font-weight:bold;color:#1c4587}
          .valtot{width:100%;border-collapse:collapse}
          .valtot td{border-bottom:1.2px solid #000;padding:6px 8px;font-weight:bold}
          .valtot .vv{text-align:left;width:160px;border-left:1px solid #000}
          .item{padding:4px 8px;border-bottom:1.2px solid #000;font-size:8.5px}
          .grid{width:100%;border-collapse:collapse}
          .grid td{border:0.6px solid #999;padding:4px 6px;width:20%;vertical-align:top}
          .grid .gl{font-weight:bold;font-size:7.5px;color:#333;display:block}
          .foot{padding:5px 8px;font-size:8px}
          .qr{width:78px;height:78px}
        </style>';

        $html = $css . '<div class="doc">';

        // Cabeçalho
        $html .= '<table class="hd"><tr>'
            . '<td style="width:62%"><div class="muni">Prefeitura do Município de ' . htmlspecialchars($municipio) . '</div>'
            . '<div class="sub">Secretaria Municipal de Fazenda</div>'
            . '<div class="tit">NOTA FISCAL DE SERVIÇO ELETRÔNICA - NFS-e</div></td>'
            . '<td><div class="box"><div class="rota">Número</div><b>' . htmlspecialchars($nNFSe) . '</b>'
            . '<div class="rota" style="margin-top:3px">Chave de acesso</div><b style="font-size:7px;font-family:DejaVu Sans Mono">' . htmlspecialchars($chave) . '</b>'
            . '<div class="rota" style="margin-top:3px">Emitida em</div><b>' . htmlspecialchars($dhProc) . '</b></div></td>'
            . '<td style="width:70px"><div class="badge">NFS-e</div></td>'
            . '</tr>' . $selo . '</table>';

        $html .= '<div class="rps">DPS Nº ' . htmlspecialchars($nDPS) . ' · Série ' . htmlspecialchars($serie)
            . ' · Emissão ' . htmlspecialchars($dhEmi) . '</div>';

        // Prestador (com QR à direita)
        $html .= '<div class="sec"><table style="width:100%"><tr><td>'
            . '<h4>Prestador de Serviços</h4>'
            . $this->kv('CPF/CNPJ', $emitCnpj) . ($emitIM ? $this->kv('Inscrição Municipal', $emitIM) : '')
            . $this->kv('Razão Social', $emitNome)
            . $this->kv('Endereço', $emitEnd . ($emitCep ? ' — CEP ' . $emitCep : ''))
            . $this->kv('Município', $municipio . ($ufEmit ? ' - ' . $ufEmit : ''))
            . $this->kv('Email', $emitMail) . $this->kv('Fone', $emitFone)
            . '</td><td style="width:90px;text-align:right;vertical-align:top">'
            . ($qr ? '<img class="qr" src="' . $qr . '">' : '') . '</td></tr></table></div>';

        // Tomador
        $html .= '<div class="sec"><h4>Tomador de Serviços</h4>' . $tomaBloco . '</div>';

        // Discriminação
        $html .= '<div class="disc"><h4>Discriminação dos Serviços</h4>'
            . nl2br(htmlspecialchars($descServ)) . '</div>';

        // Valor total
        $html .= '<table class="valtot"><tr><td>Valor Total da NFS-e</td>'
            . '<td class="vv">R$ ' . $m($vLiq) . '</td></tr></table>';

        // Item da lista
        $html .= '<div class="item"><b>Item da Lista de Serviços:</b> ' . htmlspecialchars($cTribNac)
            . ' - ' . htmlspecialchars($xTrib) . '</div>';

        // Grid de tributos
        $html .= '<table class="grid">'
            . '<tr>'
            . $this->cel('Valor Total Deduções', 'R$ ' . $m(0))
            . $this->cel('Desc. Incondicionado', 'R$ ' . $m(0))
            . $this->cel('Base de Cálculo', 'R$ ' . $m($vServ))
            . $this->cel('Alíquota (%)', $m($pAliq))
            . $this->cel('Valor do ISSQN', 'R$ ' . $m($vISS))
            . '</tr><tr>'
            . $this->cel('Valor do PIS', 'R$ ' . $m(0))
            . $this->cel('Valor da COFINS', 'R$ ' . $m(0))
            . $this->cel('Valor do INSS', 'R$ ' . $m(0))
            . $this->cel('Valor do IRRF', 'R$ ' . $m(0))
            . $this->cel('Valor do CSLL', 'R$ ' . $m(0))
            . '</tr><tr>'
            . $this->cel('Outras Retenções', 'R$ ' . $m(0))
            . $this->cel('Desc. Condicionado', 'R$ ' . $m(0))
            . $this->cel('Valor Líquido', 'R$ ' . $m($vLiq))
            . $this->cel('Competência', $dCompet)
            . $this->cel('Resp. Recolhimento', 'Prestador')
            . '</tr><tr>'
            . $this->cel('Optante Simples', $optante)
            . $this->cel('Regime', $regime)
            . $this->cel('Situação', 'Normal')
            . $this->cel('Natureza Operação', 'Tributável')
            . $this->cel('Município Credor', $localInc)
            . '</tr></table>';

        // Rodapé
        $html .= '<div class="foot"><b>Outras Informações:</b> '
            . 'Consulte a autenticidade deste documento em ' . self::URL_CONSULTA
            . ' pela chave de acesso ' . htmlspecialchars($chaveFmt) . '.</div>';

        $html .= '</div>';

        $dompdf = new Dompdf(['defaultFont' => 'DejaVu Sans']);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        return $dompdf->output();
    }

    private function kv(string $k, string $v): string
    {
        if ($v === '') {
            return '';
        }
        return '<div class="kv"><span class="kl">' . htmlspecialchars($k) . ': </span>'
            . htmlspecialchars($v) . '</div>';
    }

    private function cel(string $label, string $val): string
    {
        return '<td><span class="gl">' . htmlspecialchars($label) . '</span>'
            . htmlspecialchars($val) . '</td>';
    }

    private function qrDataUri(string $texto): string
    {
        try {
            $bobj = (new Barcode())->getBarcodeObj('QRCODE,M', $texto, 300, 300, 'black');
            return 'data:image/png;base64,' . base64_encode($bobj->getPngData());
        } catch (\Throwable) {
            return '';
        }
    }

    private function doc(string $cnpj, string $cpf): string
    {
        if ($cnpj !== '') {
            return preg_replace('/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/', '$1.$2.$3/$4-$5', $cnpj);
        }
        if ($cpf !== '') {
            return preg_replace('/(\d{3})(\d{3})(\d{3})(\d{2})/', '$1.$2.$3-$4', $cpf);
        }
        return '';
    }

    private function cep(string $cep): string
    {
        return preg_match('/^\d{8}$/', $cep) ? substr($cep, 0, 5) . '-' . substr($cep, 5) : $cep;
    }

    private function dataBr(string $iso): string
    {
        if ($iso === '') {
            return '';
        }
        try {
            return (new \DateTime($iso))->format('d/m/Y H:i');
        } catch (\Throwable) {
            return $iso;
        }
    }

    private function dataMes(string $iso): string
    {
        if ($iso === '') {
            return '';
        }
        try {
            return (new \DateTime($iso))->format('m/Y');
        } catch (\Throwable) {
            return $iso;
        }
    }
}
