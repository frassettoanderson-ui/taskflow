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
        $this->tools->model(65);
    }

    /**
     * Emite uma NFC-e síncrona.
     * @return array{status:string,chave:string,protocolo:?string,motivo:string,xml:?string}
     */
    public function emitir(array $payload): array
    {
        $numero = $this->contador->proximo($this->emitente->cnpj, '65', $this->emitente->nfceSerie, $this->ambiente);

        $builder = new NFCeBuilder($this->emitente->paraBuilder(), $this->ambiente, $this->emitente->nfceSerie);
        $montada = $builder->montar($payload, $numero);
        /** @var \NFePHP\NFe\Make $make */
        $make = $montada['make'];
        $chave = $montada['chave'];

        // signNFe com model 65 injeta o QR Code (infNFeSupl) usando o CSC/CSCid.
        $xmlAssinado = $this->tools->signNFe($make->getXML());

        // Com "referencia" (ex.: id da venda), a chave e o número ficam guardados ANTES de ir para a SEFAZ.
        // Se a SEFAZ demorar ou a conexão cair, a nota fica "pendente" (pode ter sido autorizada):
        // o sistema consulta depois pela chave (/v1/nfce/sincronizar) ou pela referência (/v1/nfce/referencia).
        $referencia = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($payload['referencia'] ?? ''));
        if ($referencia !== '') {
            $this->store->salvar($this->emitente->cnpj, $chave, $xmlAssinado, 'pendente');
            $this->store->salvar($this->emitente->cnpj, "ref-{$referencia}", json_encode(['chave' => $chave, 'numero' => $numero, 'serie' => $this->emitente->nfceSerie, 'em' => date('c')]), 'referencias');
        }

        $idLote = str_pad((string) random_int(1, 999999999), 15, '0', STR_PAD_LEFT);
        try {
            $resp = $this->tools->sefazEnviaLote([$xmlAssinado], $idLote, 1); // sempre síncrono
        } catch (\Throwable $e) {
            if ($referencia === '') {
                throw $e;
            }
            return [
                'status' => 'pendente', 'chave' => $chave, 'numero' => $numero, 'protocolo' => null,
                'motivo' => 'SEFAZ sem resposta: ' . $e->getMessage(), 'xml' => null,
            ];
        }

        $st = new \DOMDocument();
        $st->loadXML($resp);
        $cStat = $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $xMotivo = $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';

        $protNFe = $st->getElementsByTagName('protNFe')->item(0);
        if ($protNFe === null) {
            $this->store->salvar($this->emitente->cnpj, $chave, $xmlAssinado, 'rejeitado');
            return [
                'status' => 'rejeitado', 'chave' => $chave, 'numero' => $numero, 'protocolo' => null,
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
                'status' => 'autorizado', 'chave' => $chave, 'numero' => $numero, 'protocolo' => $nProt,
                'motivo' => trim("{$protStat} - {$protMotivo}"), 'xml' => $xmlProc, 'arquivo' => $arquivo,
            ];
        }

        $this->store->salvar($this->emitente->cnpj, $chave, $xmlAssinado, 'rejeitado');
        return [
            'status' => 'rejeitado', 'chave' => $chave, 'numero' => $numero, 'protocolo' => $nProt,
            'motivo' => trim("{$protStat} - {$protMotivo}"), 'xml' => null,
        ];
    }

    /** Chave/número guardados para uma referência (venda) antes do envio; null se o emissor nunca recebeu. */
    public function porReferencia(string $referencia): ?array
    {
        $referencia = preg_replace('/[^A-Za-z0-9_-]/', '', $referencia);
        $j = $referencia === '' ? null : $this->store->recuperar($this->emitente->cnpj, "ref-{$referencia}", 'referencias');
        return $j ? json_decode($j, true) : null;
    }

    /**
     * Situação de uma nota pendente na SEFAZ. autorizado (guarda o XML autorizado), cancelado,
     * nao_consta (cStat 217: o número não foi usado -> inutilizar) ou pendente (SEFAZ ainda sem resposta).
     */
    public function sincronizar(string $chave): array
    {
        try {
            $resp = $this->tools->sefazConsultaChave($chave);
        } catch (\Throwable $e) {
            return ['status' => 'pendente', 'chave' => $chave, 'protocolo' => null, 'motivo' => 'SEFAZ sem resposta: ' . $e->getMessage()];
        }
        $st = new \DOMDocument();
        $st->loadXML($resp);
        $cStat = $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $xMotivo = $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';
        $prot = $st->getElementsByTagName('protNFe')->item(0);
        $pStat = $prot ? ($prot->getElementsByTagName('cStat')->item(0)->nodeValue ?? '') : '';
        $nProt = $prot ? ($prot->getElementsByTagName('nProt')->item(0)->nodeValue ?? null) : null;
        if ($cStat === '101' || $cStat === '135' || $cStat === '155') {
            return ['status' => 'cancelado', 'chave' => $chave, 'protocolo' => $nProt, 'motivo' => trim("{$cStat} - {$xMotivo}")];
        }
        if ($cStat === '100' || $pStat === '100') {
            $assinado = $this->store->recuperar($this->emitente->cnpj, $chave, 'pendente')
                ?? $this->store->recuperar($this->emitente->cnpj, $chave, 'rejeitado');
            if ($assinado !== null && $this->store->recuperar($this->emitente->cnpj, $chave, 'autorizado') === null) {
                try {
                    $this->store->salvar($this->emitente->cnpj, $chave, Complements::toAuthorize($assinado, $resp), 'autorizado');
                } catch (\Throwable) {
                    $this->store->salvar($this->emitente->cnpj, "{$chave}-consulta", $resp, 'eventos');
                }
            }
            return ['status' => 'autorizado', 'chave' => $chave, 'protocolo' => $nProt, 'motivo' => trim("{$cStat} - {$xMotivo}")];
        }
        if ($cStat === '217') {
            return ['status' => 'nao_consta', 'chave' => $chave, 'protocolo' => null, 'motivo' => trim("{$cStat} - {$xMotivo}")];
        }
        return ['status' => 'pendente', 'chave' => $chave, 'protocolo' => null, 'motivo' => trim("{$cStat} - {$xMotivo}")];
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
    /**
     * Inutilização de numeração (faixa de números que não viraram nota autorizada). cStat 102 = homologada.
     */
    public function inutilizar(int $serie, int $nIni, int $nFin, string $justificativa): array
    {
        $justificativa = trim($justificativa);
        if (mb_strlen($justificativa) < 15) {
            throw new \InvalidArgumentException('Justificativa deve ter ao menos 15 caracteres.');
        }
        if ($nIni < 1 || $nFin < $nIni) {
            throw new \InvalidArgumentException('Faixa de numeração inválida.');
        }
        $resp = $this->tools->sefazInutiliza($serie, $nIni, $nFin, $justificativa);
        $st = new \DOMDocument();
        $st->loadXML($resp);
        $infInut = $st->getElementsByTagName('infInut');
        $no = $infInut->length ? $infInut->item($infInut->length - 1) : $st;
        $cStat = $no->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $xMotivo = $no->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';
        $nProt = $no->getElementsByTagName('nProt')->item(0)->nodeValue ?? '';
        $sucesso = $cStat === '102';
        if ($sucesso) {
            $this->store->salvar($this->emitente->cnpj, "inut-{$serie}-{$nIni}-{$nFin}", $resp, 'eventos');
        }
        return [
            'status'    => $sucesso ? 'inutilizado' : 'erro',
            'protocolo' => $nProt,
            'motivo'    => trim("{$cStat} - {$xMotivo}"),
            'xml'       => $resp,
        ];
    }

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
        $sup = new \DOMDocument();
        @$sup->loadXML($xml);
        $qrNode = $sup->getElementsByTagName('qrCode')->item(0);
        $urlNode = $sup->getElementsByTagName('urlChave')->item(0);
        return ['chave' => $chave, 'arquivo' => $arquivo, 'pdf_base64' => base64_encode($pdf), 'qrCode' => $qrNode ? $qrNode->nodeValue : null, 'urlChave' => $urlNode ? $urlNode->nodeValue : null];
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
