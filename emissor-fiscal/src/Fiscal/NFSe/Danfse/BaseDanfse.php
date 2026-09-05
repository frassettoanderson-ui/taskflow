<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe\Danfse;

use Com\Tecnick\Barcode\Barcode;
use Dompdf\Dompdf;

/**
 * Base dos layouts de DANFSE: extrai os dados do XML nacional para um array
 * normalizado e oferece utilitários (QR, formatação, geração do PDF).
 */
abstract class BaseDanfse implements DanfseRenderer
{
    protected const URL_CONSULTA = 'https://www.nfse.gov.br/consultapublica';

    /** Extrai todos os campos usados pelos layouts. */
    protected function extrair(string $xmlNfse, array $extra = []): array
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

        $chave = preg_replace('/\D/', '', $g('//n:infNFSe/@Id'));

        return [
            'chave'      => $chave,
            'nNFSe'      => $g('//n:infNFSe/n:nNFSe'),
            'serie'      => $g('//n:infDPS/n:serie'),
            'nDPS'       => $g('//n:infDPS/n:nDPS'),
            'dhProc'     => $this->dataBr($g('//n:infNFSe/n:dhProc')),
            'dhEmi'      => $this->dataBr($g('//n:infDPS/n:dhEmi')),
            'dCompet'    => $this->dataMes($g('//n:infDPS/n:dCompet')),
            'tpAmb'      => $g('//n:tpAmb'),
            'xTribNac'   => $g('//n:infNFSe/n:xTribNac'),
            'cTribNac'   => $g('//n:DPS//n:serv/n:cServ/n:cTribNac'),
            'descServ'   => $g('//n:DPS//n:serv/n:cServ/n:xDescServ'),
            'municipio'  => $g('//n:infNFSe/n:xLocEmi'),
            'localPrest' => $g('//n:infNFSe/n:xLocPrestacao'),
            'localIncid' => $g('//n:infNFSe/n:xLocIncid') ?: $g('//n:infNFSe/n:xLocEmi'),
            // Prestador
            'emitNome'   => $g('//n:infNFSe/n:emit/n:xNome'),
            'emitFant'   => (string) ($extra['fantasia'] ?? ''),
            'emitDoc'    => $this->doc($g('//n:infNFSe/n:emit/n:CNPJ'), $g('//n:infNFSe/n:emit/n:CPF')),
            'emitIM'     => $g('//n:infNFSe/n:emit/n:IM') ?: (string) ($extra['im'] ?? ''),
            'emitIE'     => (string) ($extra['ie'] ?? ''),
            'emitLgr'    => $g('//n:infNFSe/n:emit/n:enderNac/n:xLgr'),
            'emitNro'    => $g('//n:infNFSe/n:emit/n:enderNac/n:nro'),
            'emitBairro' => $g('//n:infNFSe/n:emit/n:enderNac/n:xBairro'),
            'emitMun'    => $g('//n:infNFSe/n:xLocEmi'),
            'emitUF'     => $g('//n:infNFSe/n:emit/n:enderNac/n:UF'),
            'emitCep'    => $this->cep($g('//n:infNFSe/n:emit/n:enderNac/n:CEP')),
            'emitFone'   => $g('//n:infNFSe/n:emit/n:fone'),
            'emitMail'   => $g('//n:infNFSe/n:emit/n:email'),
            // Tomador
            'tomaNome'   => $g('//n:DPS//n:toma/n:xNome'),
            'tomaDoc'    => $this->doc($g('//n:DPS//n:toma/n:CNPJ'), $g('//n:DPS//n:toma/n:CPF')),
            'tomaLgr'    => $g('//n:DPS//n:toma/n:end//n:xLgr'),
            'tomaNro'    => $g('//n:DPS//n:toma/n:end//n:nro'),
            'tomaBairro' => $g('//n:DPS//n:toma/n:end//n:xBairro'),
            'tomaMun'    => $g('//n:DPS//n:toma/n:end//n:xMun'),
            'tomaUF'     => $g('//n:DPS//n:toma/n:end//n:UF'),
            'tomaCep'    => $this->cep($g('//n:DPS//n:toma/n:end//n:CEP')),
            'tomaMail'   => $g('//n:DPS//n:toma/n:email'),
            // Valores
            'vServ'      => (float) $g('//n:DPS//n:valores/n:vServPrest/n:vServ'),
            'vLiq'       => (float) ($g('//n:infNFSe/n:valores/n:vLiq') ?: $g('//n:DPS//n:valores/n:vServPrest/n:vServ')),
            'pAliq'      => (float) $g('//n:DPS//n:tribMun/n:pAliq'),
            'vISS'       => (float) $g('//n:DPS//n:tribMun/n:vISSQN'),
            'pTribSN'    => (float) $g('//n:DPS//n:totTrib/n:pTotTribSN'),
            'opSN'       => $g('//n:DPS//n:regTrib/n:opSimpNac'),
        ];
    }

    protected function pdf(string $html): string
    {
        $dompdf = new Dompdf(['defaultFont' => 'DejaVu Sans']);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        return $dompdf->output();
    }

    protected function qr(string $texto): string
    {
        try {
            $b = (new Barcode())->getBarcodeObj('QRCODE,M', $texto, 300, 300, 'black');
            return 'data:image/png;base64,' . base64_encode($b->getPngData());
        } catch (\Throwable) {
            return '';
        }
    }

    protected function moeda(float $v): string
    {
        return number_format($v, 2, ',', '.');
    }

    protected function e(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES);
    }

    protected function doc(string $cnpj, string $cpf): string
    {
        if ($cnpj !== '') {
            return preg_replace('/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/', '$1.$2.$3/$4-$5', $cnpj);
        }
        if ($cpf !== '') {
            return preg_replace('/(\d{3})(\d{3})(\d{3})(\d{2})/', '$1.$2.$3-$4', $cpf);
        }
        return '';
    }

    protected function cep(string $cep): string
    {
        return preg_match('/^\d{8}$/', $cep) ? substr($cep, 0, 5) . '-' . substr($cep, 5) : $cep;
    }

    protected function dataBr(string $iso): string
    {
        if ($iso === '') {
            return '';
        }
        try {
            return (new \DateTime($iso))->format('d/m/Y H:i:s');
        } catch (\Throwable) {
            return $iso;
        }
    }

    protected function dataMes(string $iso): string
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
