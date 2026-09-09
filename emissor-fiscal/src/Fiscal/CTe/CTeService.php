<?php

declare(strict_types=1);

namespace App\Fiscal\CTe;

use App\Support\CertificadoManager;
use App\Support\Contador;
use App\Support\Emitente;
use App\Support\XmlStore;
use NFePHP\CTe\Tools;
use NFePHP\CTe\Complements;
use NFePHP\DA\CTe\Dacte;

/**
 * Orquestra a emissão do CT-e (modelo 57): monta -> assina -> envia -> trata
 * protocolo -> persiste. PRIMEIRA VERSÃO — validar em homologação.
 */
final class CTeService
{
    private Tools $tools;

    public function __construct(
        private string $root,
        private Emitente $emitente,
        private int $ambiente,
        private XmlStore $store,
        private Contador $contador
    ) {
        $cert = CertificadoManager::carregar($root, $emitente->certPath, $emitente->certPassword);
        $this->tools = new Tools($emitente->nfephpConfig($ambiente), $cert);
        $this->tools->model('57');
    }

    public function emitir(array $payload): array
    {
        $serie = $this->emitente->cteSerie;
        $numero = $this->contador->proximo($this->emitente->cnpj, '57', $serie);

        $builder = new CTeBuilder($this->emitente->paraBuilder(), $this->ambiente, $serie);
        $montada = $builder->montar($payload, $numero);
        $chave = $montada['chave'];

        $xmlAssinado = $this->tools->signCTe($montada['make']->getXML());
        $resp = $this->tools->sefazEnviaCTe($xmlAssinado);

        $st = new \DOMDocument();
        $st->loadXML($resp);
        $protCTe = $st->getElementsByTagName('protCTe')->item(0);
        if ($protCTe === null) {
            $this->store->salvar($this->emitente->cnpj, $chave, $xmlAssinado, 'cte-rejeitado');
            return $this->resultado('rejeitado', $chave, null, $st, null);
        }
        $cStat = $protCTe->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $xMotivo = $protCTe->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';
        $nProt = $protCTe->getElementsByTagName('nProt')->item(0)->nodeValue ?? null;

        if ($cStat === '100') {
            $xmlProc = Complements::toAuthorize($xmlAssinado, $resp);
            $arquivo = $this->store->salvar($this->emitente->cnpj, $chave, $xmlProc, 'cte');
            return ['status' => 'autorizado', 'chave' => $chave, 'protocolo' => $nProt,
                    'motivo' => trim("{$cStat} - {$xMotivo}"), 'xml' => $xmlProc, 'arquivo' => $arquivo];
        }
        $this->store->salvar($this->emitente->cnpj, $chave, $xmlAssinado, 'cte-rejeitado');
        return ['status' => 'rejeitado', 'chave' => $chave, 'protocolo' => $nProt,
                'motivo' => trim("{$cStat} - {$xMotivo}"), 'xml' => null];
    }

    public function consultar(string $chave): array
    {
        $resp = $this->tools->sefazConsultaChave($chave);
        $st = new \DOMDocument();
        $st->loadXML($resp);
        return ['chave' => $chave,
                'cStat' => $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '',
                'motivo' => $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '',
                'xml' => $resp];
    }

    public function cancelar(string $chave, string $protocolo, string $justificativa): array
    {
        if (mb_strlen($justificativa) < 15) {
            throw new \InvalidArgumentException('Justificativa deve ter ao menos 15 caracteres.');
        }
        $resp = $this->tools->sefazCancela($chave, $justificativa, $protocolo);
        $sucesso = str_contains($resp, '<cStat>135</cStat>') || str_contains($resp, '<cStat>134</cStat>');
        if ($sucesso) {
            $this->store->salvar($this->emitente->cnpj, "{$chave}-canc", $resp, 'cte-eventos');
        }
        $st = new \DOMDocument();
        $st->loadXML($resp);
        return ['status' => $sucesso ? 'cancelado' : 'erro', 'chave' => $chave,
                'motivo' => trim(($st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '') . ' - '
                    . ($st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '')), 'xml' => $resp];
    }

    public function dacte(string $chave): array
    {
        $xml = $this->store->recuperar($this->emitente->cnpj, $chave, 'cte');
        if ($xml === null) {
            throw new \RuntimeException("XML do CT-e não encontrado para a chave {$chave}.");
        }
        $pdf = (new Dacte($xml))->render();
        $dir = "{$this->root}/storage/pdf/" . preg_replace('/\D/', '', $this->emitente->cnpj);
        if (!is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        $arquivo = "{$dir}/{$chave}.pdf";
        file_put_contents($arquivo, $pdf);
        return ['chave' => $chave, 'arquivo' => $arquivo, 'pdf_base64' => base64_encode($pdf)];
    }

    public function statusServico(): array
    {
        $resp = $this->tools->sefazStatus();
        $st = new \DOMDocument();
        $st->loadXML($resp);
        return ['cStat' => $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '',
                'motivo' => $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '',
                'ambiente' => $this->ambiente === 1 ? 'producao' : 'homologacao',
                'emitente' => $this->emitente->cnpj];
    }

    private function resultado(string $status, string $chave, ?string $prot, \DOMDocument $st, ?string $xml): array
    {
        return ['status' => $status, 'chave' => $chave, 'protocolo' => $prot,
                'motivo' => trim(($st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '') . ' - '
                    . ($st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '')), 'xml' => $xml];
    }
}
