<?php

declare(strict_types=1);

namespace App\Fiscal\MDFe;

use App\Support\CertificadoManager;
use App\Support\Contador;
use App\Support\Emitente;
use App\Support\XmlStore;
use NFePHP\MDFe\Tools;
use NFePHP\MDFe\Complements;
use NFePHP\DA\MDFe\Damdfe;

/**
 * Orquestra a emissão do MDF-e (modelo 58): monta -> assina -> envia lote ->
 * consulta recibo -> trata protocolo -> persiste. Inclui encerramento (evento
 * obrigatório ao fim da viagem). PRIMEIRA VERSÃO — validar em homologação.
 */
final class MDFeService
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
        $this->tools = new Tools($emitente->nfephpConfig($ambiente, '3.00'), $cert);
    }

    public function emitir(array $payload): array
    {
        $serie = $this->emitente->mdfeSerie;
        $numero = $this->contador->proximo($this->emitente->cnpj, '58', $serie);

        $builder = new MDFeBuilder($this->emitente->paraBuilder(), $this->ambiente, $serie);
        $montada = $builder->montar($payload, $numero);
        $chave = $montada['chave'];

        $xmlAssinado = $this->tools->signMDFe($montada['make']->getXML());
        $idLote = str_pad((string) random_int(1, 999999999), 15, '0', STR_PAD_LEFT);
        // Envio SÍNCRONO (o assíncrono foi desativado pela SEFAZ para MDF-e).
        $resp = $this->tools->sefazEnviaLote([$xmlAssinado], $idLote, 1);

        $rp = new \DOMDocument();
        $rp->loadXML($resp);
        $prot = $rp->getElementsByTagName('protMDFe')->item(0);
        $cStat = $prot?->getElementsByTagName('cStat')->item(0)->nodeValue
            ?? ($rp->getElementsByTagName('cStat')->item(0)->nodeValue ?? '');
        $nProt = $prot?->getElementsByTagName('nProt')->item(0)->nodeValue ?? null;

        if ($cStat === '100') {
            $xmlProc = Complements::toAuthorize($xmlAssinado, $resp);
            $arquivo = $this->store->salvar($this->emitente->cnpj, $chave, $xmlProc, 'mdfe');
            return ['status' => 'autorizado', 'chave' => $chave, 'protocolo' => $nProt,
                    'motivo' => $this->motivo($resp), 'xml' => $xmlProc, 'arquivo' => $arquivo];
        }
        $this->store->salvar($this->emitente->cnpj, $chave, $xmlAssinado, 'mdfe-rejeitado');
        return ['status' => 'rejeitado', 'chave' => $chave, 'protocolo' => $nProt,
                'motivo' => $this->motivo($resp), 'xml' => null];
    }

    public function consultar(string $chave): array
    {
        $resp = $this->tools->sefazConsultaChave($chave);
        return ['chave' => $chave, 'motivo' => $this->motivo($resp), 'xml' => $resp];
    }

    public function cancelar(string $chave, string $protocolo, string $justificativa): array
    {
        if (mb_strlen($justificativa) < 15) {
            throw new \InvalidArgumentException('Justificativa deve ter ao menos 15 caracteres.');
        }
        $resp = $this->tools->sefazCancela($chave, $justificativa, $protocolo);
        $sucesso = str_contains($resp, '<cStat>135</cStat>');
        if ($sucesso) {
            $this->store->salvar($this->emitente->cnpj, "{$chave}-canc", $resp, 'mdfe-eventos');
        }
        return ['status' => $sucesso ? 'cancelado' : 'erro', 'chave' => $chave,
                'motivo' => $this->motivo($resp), 'xml' => $resp];
    }

    /**
     * Encerramento do MDF-e (obrigatório ao fim da viagem).
     */
    public function encerrar(string $chave, string $protocolo, string $municipioCod, string $uf): array
    {
        // Assinatura NFePHP: sefazEncerra(chave, nProt, cUF, cMun, dtEnc)
        $cUF = $this->codigoUF($uf);
        $dtEnc = date('Y-m-d');
        $resp = $this->tools->sefazEncerra($chave, $protocolo, (string) $cUF, $municipioCod, $dtEnc);
        $sucesso = str_contains($resp, '<cStat>135</cStat>');
        if ($sucesso) {
            $this->store->salvar($this->emitente->cnpj, "{$chave}-enc", $resp, 'mdfe-eventos');
        }
        return ['status' => $sucesso ? 'encerrado' : 'erro', 'chave' => $chave,
                'motivo' => $this->motivo($resp), 'xml' => $resp];
    }

    public function damdfe(string $chave): array
    {
        $xml = $this->store->recuperar($this->emitente->cnpj, $chave, 'mdfe');
        if ($xml === null) {
            throw new \RuntimeException("XML do MDF-e não encontrado para a chave {$chave}.");
        }
        $pdf = (new Damdfe($xml))->render();
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

    private function codigoUF(string $uf): int
    {
        $map = ['RO'=>11,'AC'=>12,'AM'=>13,'RR'=>14,'PA'=>15,'AP'=>16,'TO'=>17,'MA'=>21,'PI'=>22,'CE'=>23,'RN'=>24,'PB'=>25,'PE'=>26,'AL'=>27,'SE'=>28,'BA'=>29,'MG'=>31,'ES'=>32,'RJ'=>33,'SP'=>35,'PR'=>41,'SC'=>42,'RS'=>43,'MS'=>50,'MT'=>51,'GO'=>52,'DF'=>53];
        return $map[strtoupper($uf)] ?? 0;
    }

    private function motivo(string $resp): string
    {
        $st = new \DOMDocument();
        @$st->loadXML($resp);
        $c = $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $x = $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';
        return trim("{$c} - {$x}");
    }
}
