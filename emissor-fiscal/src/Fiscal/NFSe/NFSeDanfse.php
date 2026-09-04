<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe;

use Com\Tecnick\Barcode\Barcode;
use Dompdf\Dompdf;

/**
 * Gera o DANFSE (PDF) do Padrão Nacional a partir do XML autorizado.
 * A ADN não serve o PDF por API (só o portal, via login gov.br), então montamos
 * um DANFSE próprio, com layout de nota e QR Code de verificação — como fazem os
 * emissores comerciais.
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
        $tpAmb   = $g('//n:tpAmb'); // 1=Produção, 2=Homologação (valor fiscal)
        $xTrib   = $g('//n:infNFSe/n:xTribNac');

        $emitNome = $g('//n:infNFSe/n:emit/n:xNome');
        $emitCnpj = $this->doc($g('//n:infNFSe/n:emit/n:CNPJ'), $g('//n:infNFSe/n:emit/n:CPF'));
        $emitEnd  = trim(
            $g('//n:infNFSe/n:emit/n:enderNac/n:xLgr') . ', ' .
            $g('//n:infNFSe/n:emit/n:enderNac/n:nro') . ' - ' .
            $g('//n:infNFSe/n:emit/n:enderNac/n:xBairro')
        );
        $emitMun  = $g('//n:infNFSe/n:xLocEmi') . '/' . $g('//n:infNFSe/n:emit/n:enderNac/n:UF');
        $emitCep  = $this->cep($g('//n:infNFSe/n:emit/n:enderNac/n:CEP'));
        $emitFone = $g('//n:infNFSe/n:emit/n:fone');
        $emitMail = $g('//n:infNFSe/n:emit/n:email');

        $tomaNome = $g('//n:DPS//n:toma/n:xNome');
        $tomaDoc  = $this->doc($g('//n:DPS//n:toma/n:CNPJ'), $g('//n:DPS//n:toma/n:CPF'));

        $descServ = $g('//n:DPS//n:serv/n:cServ/n:xDescServ');
        $cTribNac = $g('//n:DPS//n:serv/n:cServ/n:cTribNac');
        $localPre = $g('//n:infNFSe/n:xLocPrestacao');

        $vServ = $g('//n:DPS//n:valores/n:vServPrest/n:vServ');
        $vLiq  = $g('//n:infNFSe/n:valores/n:vLiq');
        $pSN   = $g('//n:DPS//n:totTrib/n:pTotTribSN');

        $selo = $tpAmb === '1' ? '' :
            '<div class="selo">DOCUMENTO EMITIDO EM AMBIENTE DE TESTE — SEM VALOR FISCAL</div>';

        $qrUri = $this->qrDataUri(self::URL_CONSULTA);
        $tomador = ($tomaNome || $tomaDoc)
            ? ($this->linha('Nome/Razão social', $tomaNome ?: '—') . $this->linha('CPF/CNPJ', $tomaDoc ?: '—'))
            : '<div class="muted">Consumidor não identificado</div>';

        $chaveFmt = trim(chunk_split($chave, 4, ' '));

        $html = '<style>
          *{font-family:DejaVu Sans, sans-serif;font-size:10px;color:#1a1a1a}
          .wrap{border:1.5px solid #333;border-radius:6px;padding:0;overflow:hidden}
          .head{background:#0e3a5f;color:#fff;padding:10px 14px}
          .head .t{font-size:15px;font-weight:bold}
          .head .s{font-size:9px;opacity:.85}
          .headrow{width:100%}
          .headrow td{vertical-align:middle}
          .numbox{text-align:right;color:#fff}
          .numbox b{font-size:18px}
          .selo{background:#fde8e8;border:1px solid #e0b4b4;color:#a12;text-align:center;
                padding:5px;font-weight:bold;font-size:9px}
          .sec{padding:8px 14px;border-top:1px solid #ddd}
          .sec h4{margin:0 0 5px;font-size:9px;letter-spacing:.6px;color:#0e3a5f;text-transform:uppercase}
          .row{margin:2px 0}
          .lbl{color:#666;font-size:8.5px}
          .val{font-weight:bold}
          .muted{color:#777}
          table.v{width:100%;border-collapse:collapse;margin-top:4px}
          table.v td{border:1px solid #ccc;padding:5px}
          .tot{text-align:right}
          .tot .big{font-size:16px;font-weight:bold;color:#0e3a5f}
          .foot{padding:10px 14px;border-top:1px solid #ddd}
          .foot td{vertical-align:middle}
          .chave{font-family:DejaVu Sans Mono, monospace;font-size:9px;word-break:break-all}
        </style>';

        $html .= '<div class="wrap">';
        $html .= '<div class="head"><table class="headrow"><tr>'
            . '<td><div class="t">NFS-e</div><div class="s">Nota Fiscal de Serviço eletrônica · Padrão Nacional</div></td>'
            . '<td class="numbox"><div class="s">Número</div><b>' . htmlspecialchars($nNFSe) . '</b>'
            . '<div class="s">Emitida em ' . htmlspecialchars($dhProc) . '</div></td>'
            . '</tr></table></div>';
        $html .= $selo;

        $html .= '<div class="sec"><h4>Prestador do serviço</h4>'
            . $this->linha('Nome/Razão social', $emitNome)
            . $this->linha('CNPJ', $emitCnpj)
            . $this->linha('Endereço', trim($emitEnd . ($emitCep ? ' — ' . $emitCep : '')))
            . $this->linha('Município/UF', $emitMun)
            . $this->linha('Contato', trim($emitFone . '  ' . $emitMail))
            . '</div>';

        $html .= '<div class="sec"><h4>Tomador do serviço</h4>' . $tomador . '</div>';

        $html .= '<div class="sec"><h4>Discriminação do serviço</h4>'
            . '<table class="v"><tr><td style="width:70%">' . htmlspecialchars($descServ)
            . '<div class="lbl" style="margin-top:4px">' . htmlspecialchars($xTrib) . '</div></td>'
            . '<td class="tot">Valor do serviço<br><b>R$ ' . $this->moeda($vServ) . '</b></td></tr></table>'
            . '<div class="row" style="margin-top:6px">'
            . '<span class="lbl">Cód. tributação nacional: </span><span class="val">' . htmlspecialchars($cTribNac) . '</span>'
            . '<span class="lbl">   ·   Local da prestação: </span><span class="val">' . htmlspecialchars($localPre) . '</span>'
            . '<span class="lbl">   ·   Competência: </span><span class="val">' . htmlspecialchars($dCompet) . '</span>'
            . '</div></div>';

        $html .= '<div class="sec"><h4>Valores</h4><table class="v"><tr>'
            . '<td>Simples Nacional<br><span class="lbl">Trib. aprox. (' . $this->moeda($pSN) . '%)</span></td>'
            . '<td class="tot">Valor líquido da nota<br><span class="big">R$ ' . $this->moeda($vLiq) . '</span></td>'
            . '</tr></table></div>';

        $html .= '<div class="foot"><table style="width:100%"><tr>'
            . '<td style="width:90px"><img src="' . $qrUri . '" style="width:82px;height:82px"></td>'
            . '<td><div class="lbl">Chave de acesso</div><div class="chave">' . htmlspecialchars($chaveFmt) . '</div>'
            . '<div class="lbl" style="margin-top:4px">Consulte a autenticidade em ' . self::URL_CONSULTA . '</div>'
            . '<div class="lbl">Série ' . htmlspecialchars($serie) . ' · DPS ' . htmlspecialchars($nDPS)
            . ' · Emissão ' . htmlspecialchars($dhEmi) . '</div>'
            . '</td></tr></table></div>';

        $html .= '</div>';

        $dompdf = new Dompdf(['defaultFont' => 'DejaVu Sans']);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        return $dompdf->output();
    }

    private function linha(string $lbl, string $val): string
    {
        if ($val === '') {
            return '';
        }
        return '<div class="row"><span class="lbl">' . htmlspecialchars($lbl) . ': </span>'
            . '<span class="val">' . htmlspecialchars($val) . '</span></div>';
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

    private function moeda(string $v): string
    {
        return number_format((float) $v, 2, ',', '.');
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
