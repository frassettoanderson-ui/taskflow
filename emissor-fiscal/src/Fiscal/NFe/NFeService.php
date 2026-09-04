<?php

declare(strict_types=1);

namespace App\Fiscal\NFe;

use App\Support\CertificadoManager;
use App\Support\Contador;
use App\Support\Emitente;
use App\Support\XmlStore;
use NFePHP\NFe\Tools;
use NFePHP\NFe\Complements;
use NFePHP\DA\NFe\Danfe;

/**
 * Orquestra a emissão da NF-e para UM emitente específico:
 * monta -> assina -> envia (síncrono) -> trata protocolo -> persiste XML.
 */
final class NFeService
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
        $this->tools->model(55);
    }

    /**
     * Emite uma NF-e síncrona.
     * @return array{status:string,chave:string,protocolo:?string,motivo:string,xml:?string}
     */
    public function emitir(array $payload): array
    {
        $numero = $this->contador->proximo($this->emitente->cnpj, '55', $this->emitente->nfeSerie);

        $builder = new NFeBuilder($this->emitente->paraBuilder(), $this->ambiente, $this->emitente->nfeSerie);
        $montada = $builder->montar($payload, $numero);
        /** @var \NFePHP\NFe\Make $make */
        $make = $montada['make'];
        $chave = $montada['chave'];

        $xmlAssinado = $this->tools->signNFe($make->getXML());

        $idLote = str_pad((string) random_int(1, 999999999), 15, '0', STR_PAD_LEFT);
        $resp = $this->tools->sefazEnviaLote([$xmlAssinado], $idLote, 1); // 1 = síncrono

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

        if ($protStat === '100') { // Autorizado o uso da NF-e
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

    /** Consulta a situação de uma NF-e pela chave de acesso. */
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

    /** Cancela uma NF-e autorizada (dentro do prazo legal). */
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
        return [
            'status' => $sucesso ? 'cancelado' : 'erro',
            'chave'  => $chave,
            'motivo' => $this->motivo($resp),
            'xml'    => $resp,
        ];
    }

    /**
     * Carta de Correção Eletrônica (CC-e).
     * Corrige erros que NÃO alterem valores, impostos, destinatário ou data.
     */
    public function cartaCorrecao(string $chave, string $correcao, int $seq = 1): array
    {
        $correcao = trim($correcao);
        if (mb_strlen($correcao) < 15) {
            throw new \InvalidArgumentException('A correção deve ter ao menos 15 caracteres.');
        }
        if (mb_strlen($correcao) > 1000) {
            throw new \InvalidArgumentException('A correção não pode passar de 1000 caracteres.');
        }
        $resp = $this->tools->sefazCCe($chave, $correcao, $seq);
        $sucesso = str_contains($resp, '<cStat>135</cStat>');
        if ($sucesso) {
            $this->store->salvar($this->emitente->cnpj, "{$chave}-cce-{$seq}", $resp, 'eventos');
        }
        return [
            'status' => $sucesso ? 'registrada' : 'erro',
            'chave'  => $chave,
            'motivo' => $this->motivo($resp),
            'xml'    => $resp,
        ];
    }

    /** Gera o PDF da DANFE a partir do XML autorizado já guardado. */
    public function danfe(string $chave): array
    {
        $xml = $this->store->recuperar($this->emitente->cnpj, $chave, 'autorizado');
        if ($xml === null) {
            throw new \RuntimeException("XML autorizado não encontrado para a chave {$chave}.");
        }
        $pdf = (new Danfe($xml))->render();
        $dir = "{$this->root}/storage/pdf/" . preg_replace('/\D/', '', $this->emitente->cnpj);
        if (!is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        $arquivo = "{$dir}/{$chave}.pdf";
        file_put_contents($arquivo, $pdf);
        return ['chave' => $chave, 'arquivo' => $arquivo, 'pdf_base64' => base64_encode($pdf)];
    }

    /** Testa a comunicação com a SEFAZ (status do serviço). */
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

    private function motivo(string $resp): string
    {
        $st = new \DOMDocument();
        $st->loadXML($resp);
        $c = $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $x = $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';
        return trim("{$c} - {$x}");
    }
}
