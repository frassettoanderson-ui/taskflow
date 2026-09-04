<?php

declare(strict_types=1);

namespace App\Fiscal\NFCe;

use App\Support\CertificadoManager;
use App\Support\Contador;
use App\Support\Emitente;
use App\Support\XmlStore;
use NFePHP\NFe\Tools;
use NFePHP\NFe\Complements;
use NFePHP\DA\NFe\Danfce;

/**
 * Orquestra a emissão da NFC-e (modelo 65) para um emitente.
 * A NFC-e é sempre síncrona e exige CSC/CSCid configurados (o QR Code é
 * gerado na assinatura). Não há Carta de Correção para NFC-e.
 */
final class NFCeService
{
    private Tools $tools;

    public function __construct(
        private string $root,
        private Emitente $emitente,
        private int $ambiente,
        private XmlStore $store,
        private Contador $contador
    ) {
        if ($emitente->csc === '' || $emitente->cscId === '') {
            throw new \RuntimeException(
                "Emitente {$emitente->cnpj} sem CSC/CSCid configurados — obrigatórios para NFC-e."
            );
        }
        $cert = CertificadoManager::carregar($root, $emitente->certPath, $emitente->certPassword);
        $this->tools = new Tools($emitente->nfephpConfig($ambiente), $cert);
        $this->tools->model('65');
    }

    /**
     * Emite uma NFC-e síncrona.
     * @return array{status:string,chave:string,protocolo:?string,motivo:string,xml:?string}
     */
    public function emitir(array $payload): array
    {
        $numero = $this->contador->proximo($this->emitente->cnpj, '65', $this->emitente->nfceSerie);

        $builder = new NFCeBuilder($this->emitente->paraBuilder(), $this->ambiente, $this->emitente->nfceSerie);
        $montada = $builder->montar($payload, $numero);
        /** @var \NFePHP\NFe\Make $make */
        $make = $montada['make'];
        $chave = $montada['chave'];

        // signNFe com model 65 injeta o QR Code (infNFeSupl) usando o CSC/CSCid.
        $xmlAssinado = $this->tools->signNFe($make->getXML());

        $idLote = str_pad((string) random_int(1, 999999999), 15, '0', STR_PAD_LEFT);
        $resp = $this->tools->sefazEnviaLote([$xmlAssinado], $idLote, 1); // sempre síncrono

        $st = new \DOMDocument();
        $st->loadXML($resp);
        $cStat = $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $xMotivo = $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';

        $protNFe = $st->getElementsByTagName('protNFe')->item(0);
        if ($protNFe === null) {
            $this->store->salvar($this->emitente->cnpj, $chave, $xmlAssinado, 'rejeitado');
            return [
                'status' => 'rejeitado', 'chave' => $chave, 'protocolo' => null,
                'motivo' => trim("{$cStat} - {$xMotivo}"), 'xml' => null,
            ];
        }

        $protStat = $protNFe->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $protMotivo = $protNFe->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';
        $nProt = $protNFe->getElementsByTagName('nProt')->item(0)->nodeValue ?? null;

        if ($protStat === '100') {
            $xmlProc = Complements::toAuthorize($xmlAssinado, $resp);
            $arquivo = $this->store->salvar($this->emitente->cnpj, $chave, $xmlProc, 'autorizado');
            return [
                'status' => 'autorizado', 'chave' => $chave, 'protocolo' => $nProt,
                'motivo' => trim("{$protStat} - {$protMotivo}"), 'xml' => $xmlProc, 'arquivo' => $arquivo,
            ];
        }

        $this->store->salvar($this->emitente->cnpj, $chave, $xmlAssinado, 'rejeitado');
        return [
            'status' => 'rejeitado', 'chave' => $chave, 'protocolo' => $nProt,
            'motivo' => trim("{$protStat} - {$protMotivo}"), 'xml' => null,
        ];
    }

    public function consultar(string $chave): array
    {
        $resp = $this->tools->sefazConsultaChave($chave);
        $st = new \DOMDocument();
        $st->loadXML($resp);
        return [
            'chave'  => $chave,
            'cStat'  => $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '',
            'motivo' => $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '',
            'xml'    => $resp,
        ];
    }

    /**
     * Cancela uma NFC-e. Atenção: o prazo de cancelamento da NFC-e é curto e
     * varia por UF (frequentemente 30 minutos) — fora do prazo, rejeita.
     */
    public function cancelar(string $chave, string $protocolo, string $justificativa): array
    {
        if (mb_strlen($justificativa) < 15) {
            throw new \InvalidArgumentException('Justificativa deve ter ao menos 15 caracteres.');
        }
        $resp = $this->tools->sefazCancela($chave, $justificativa, $protocolo);
        $sucesso = str_contains($resp, '<cStat>135</cStat>') || str_contains($resp, '<cStat>155</cStat>');
        if ($sucesso) {
            $this->store->salvar($this->emitente->cnpj, "{$chave}-canc", $resp, 'eventos');
        }
        $st = new \DOMDocument();
        $st->loadXML($resp);
        return [
            'status' => $sucesso ? 'cancelado' : 'erro',
            'chave'  => $chave,
            'motivo' => trim(
                ($st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '') . ' - ' .
                ($st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '')
            ),
            'xml'    => $resp,
        ];
    }

    /** Gera o PDF da DANFCE (cupom 80mm) a partir do XML autorizado. */
    public function danfce(string $chave): array
    {
        $xml = $this->store->recuperar($this->emitente->cnpj, $chave, 'autorizado');
        if ($xml === null) {
            throw new \RuntimeException("XML autorizado não encontrado para a chave {$chave}.");
        }
        $pdf = (new Danfce($xml))->render();
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
        return [
            'cStat'    => $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '',
            'motivo'   => $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '',
            'ambiente' => $this->ambiente === 1 ? 'producao' : 'homologacao',
            'emitente' => $this->emitente->cnpj,
        ];
    }
}
