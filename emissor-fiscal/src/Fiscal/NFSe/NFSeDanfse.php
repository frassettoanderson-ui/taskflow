<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe;

use Dompdf\Dompdf;

/**
 * Gera o DANFSE (PDF) do Padrão Nacional a partir do XML autorizado da NFS-e.
 * A ADN só serve o PDF oficial em produção; em teste (e como fallback), montamos
 * um DANFSE próprio, legível, com os dados essenciais da nota.
 */
final class NFSeDanfse
{
    public function render(string $xmlNfse): string
    {
        $xml = simplexml_load_string($xmlNfse);
        if ($xml === false) {
            throw new \RuntimeException('XML da NFS-e inválido.');
        }
        $ns = 'http://www.sped.fazenda.gov.br/nfse';
        $xml->registerXPathNamespace('n', $ns);
        $g = function (string $xpath) use ($xml): string {
            $r = $xml->xpath($xpath);
            return $r && isset($r[0]) ? trim((string) $r[0]) : '';
        };

        $idInf   = $g('//n:infNFSe/@Id');
        $chave   = preg_replace('/\D/', '', $idInf);
        $nNFSe   = $g('//n:infNFSe/n:nNFSe');
        $dhProc  = $this->dataBr($g('//n:infNFSe/n:dhProc'));
        $amb     = $g('//n:infNFSe/n:ambGer');
        $xTrib   = $g('//n:infNFSe/n:xTribNac');
        $vLiq    = $g('//n:infNFSe/n:valores/n:vLiq');

        $emitNome = $g('//n:infNFSe/n:emit/n:xNome');
        $emitCnpj = $this->doc($g('//n:infNFSe/n:emit/n:CNPJ'), $g('//n:infNFSe/n:emit/n:CPF'));
        $emitEnd  = trim(
            $g('//n:infNFSe/n:emit/n:enderNac/n:xLgr') . ', ' .
            $g('//n:infNFSe/n:emit/n:enderNac/n:nro') . ' - ' .
            $g('//n:infNFSe/n:emit/n:enderNac/n:xBairro')
        );
        $emitMun  = $g('//n:infNFSe/n:xLocEmi') . '/' . $g('//n:infNFSe/n:emit/n:enderNac/n:UF');
        $emitFone = $g('//n:infNFSe/n:emit/n:fone');
        $emitMail = $g('//n:infNFSe/n:emit/n:email');

        $tomaNome = $g('//n:DPS//n:toma/n:xNome');
        $tomaDoc  = $this->doc($g('//n:DPS//n:toma/n:CNPJ'), $g('//n:DPS//n:toma/n:CPF'));

        $descServ = $g('//n:DPS//n:serv/n:cServ/n:xDescServ');
        $cTribNac = $g('//n:DPS//n:serv/n:cServ/n:cTribNac');
        $dCompet  = $this->dataBr($g('//n:DPS//n:dCompet'));
        $localPre = $g('//n:infNFSe/n:xLocPrestacao');

        $selo = $amb === '1' ? '' :
            '<div class="selo">DOCUMENTO EMITIDO EM AMBIENTE DE TESTE — SEM VALOR FISCAL</div>';

        $tomaBloco = ($tomaNome || $tomaDoc)
            ? $this->bloco('TOMADOR DO SERVIÇO', [
                'Nome/Razão social' => $tomaNome ?: '—',
                'CPF/CNPJ'          => $tomaDoc ?: '—',
              ])
            : $this->bloco('TOMADOR DO SERVIÇO', ['' => 'Consumidor não identificado']);

        $html = '<style>
            *{font-family:DejaVu Sans, sans-serif;font-size:11px;color:#111}
            .tit{text-align:center;font-size:15px;font-weight:bold;margin:0}
            .sub{text-align:center;font-size:10px;color:#555;margin:2px 0 10px}
            .selo{background:#fde8e8;border:1px solid #e0b4b4;color:#a12;
                  text-align:center;padding:5px;font-weight:bold;margin:8px 0;font-size:10px}
            .box{border:1px solid #999;border-radius:4px;margin:6px 0;padding:8px}
            .box h4{margin:0 0 6px;font-size:10px;letter-spacing:.5px;color:#444;
                    border-bottom:1px solid #ddd;padding-bottom:3px}
            .row{margin:2px 0}
            .lbl{color:#666;font-size:9px}
            .val{font-weight:bold}
            .chave{font-family:DejaVu Sans Mono, monospace;font-size:10px;word-break:break-all}
            .valor{font-size:20px;font-weight:bold;text-align:right}
        </style>';

        $html .= '<p class="tit">NFS-e — Nota Fiscal de Serviço eletrônica</p>';
        $html .= '<p class="sub">Padrão Nacional · Número ' . htmlspecialchars($nNFSe)
            . ' · Emitida em ' . htmlspecialchars($dhProc) . '</p>';
        $html .= $selo;

        $html .= '<div class="box"><h4>CHAVE DE ACESSO</h4><div class="chave">'
            . htmlspecialchars($chave) . '</div></div>';

        $html .= $this->bloco('PRESTADOR DO SERVIÇO', [
            'Nome/Razão social' => $emitNome,
            'CNPJ'              => $emitCnpj,
            'Endereço'          => $emitEnd,
            'Município/UF'      => $emitMun,
            'Telefone'          => $emitFone,
            'E-mail'            => $emitMail,
        ]);

        $html .= $tomaBloco;

        $html .= $this->bloco('SERVIÇO PRESTADO', [
            'Descrição'                  => $descServ,
            'Código de tributação nac.'  => $cTribNac,
            'Atividade (LC 116)'         => $xTrib,
            'Local da prestação'         => $localPre,
            'Competência'                => $dCompet,
        ]);

        $html .= '<div class="box"><h4>VALOR DO SERVIÇO</h4>'
            . '<div class="valor">R$ ' . number_format((float) $vLiq, 2, ',', '.') . '</div></div>';

        $dompdf = new Dompdf(['defaultFont' => 'DejaVu Sans']);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        return $dompdf->output();
    }

    private function bloco(string $titulo, array $campos): string
    {
        $h = '<div class="box"><h4>' . htmlspecialchars($titulo) . '</h4>';
        foreach ($campos as $lbl => $val) {
            if ($val === '' || $val === null) {
                continue;
            }
            $h .= '<div class="row">';
            if ($lbl !== '') {
                $h .= '<span class="lbl">' . htmlspecialchars($lbl) . ': </span>';
            }
            $h .= '<span class="val">' . htmlspecialchars((string) $val) . '</span></div>';
        }
        return $h . '</div>';
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
}
