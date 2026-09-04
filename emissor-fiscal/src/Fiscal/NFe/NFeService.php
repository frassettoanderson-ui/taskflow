<?php

declare(strict_types=1);

namespace App\Fiscal\NFe;

use App\Support\Config;
use App\Support\Contador;
use App\Support\XmlStore;
use NFePHP\Common\Certificate;
use NFePHP\NFe\Tools;
use NFePHP\NFe\Complements;
use NFePHP\DA\NFe\Danfe;

/**
 * Orquestra a emissão da NF-e: monta -> assina -> envia (síncrono) ->
 * trata protocolo -> persiste XML autorizado.
 */
final class NFeService
{
    private Tools $tools;
    private array $emitente;
    private int $ambiente;
    private int $serie;

    public function __construct(
        private string $root,
        Certificate $certificado,
        private XmlStore $store,
        private Contador $contador
    ) {
        $this->emitente = Config::emitente();
        $this->ambiente = Config::int('FISCAL_AMBIENTE', 2);
        $this->serie = Config::int('NFE_SERIE', 1);

        $this->tools = new Tools(Config::nfephp(), $certificado);
        $this->tools->model('55');
    }

    /**
     * Emite uma NF-e síncrona.
     *
     * @return array{status:string,chave:string,protocolo:?string,motivo:string,xml:?string}
     */
    public function emitir(array $payload): array
    {
        $numero = $this->contador->proximo('55', $this->serie);

        $builder = new NFeBuilder($this->emitente, $this->ambiente, $this->serie);
        $montada = $builder->montar($payload, $numero);
        /** @var \NFePHP\NFe\Make $make */
        $make = $montada['make'];
        $chave = $montada['chave'];

        $xmlAssinado = $this->tools->signNFe($make->getXML());

        // Envio síncrono (indSinc = 1): resposta já traz o protocolo.
        $idLote = str_pad((string) random_int(1, 999999999), 15, '0', STR_PAD_LEFT);
        $resp = $this->tools->sefazEnviaLote([$xmlAssinado], $idLote, 1);

        $st = new \DOMDocument();
        $st->loadXML($resp);
        $cStat = $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $xMotivo = $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';

        // 104 = Lote processado (síncrono retorna o protNFe embutido)
        $protNFe = $st->getElementsByTagName('protNFe')->item(0);
        if ($protNFe === null) {
            // Rejeição de lote (não gerou protocolo)
            $this->store->salvar($chave, $xmlAssinado, 'rejeitado');
            return [
                'status'    => 'rejeitado',
                'chave'     => $chave,
                'protocolo' => null,
                'motivo'    => trim("{$cStat} - {$xMotivo}"),
                'xml'       => null,
            ];
        }

        $protStat = $protNFe->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $protMotivo = $protNFe->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';
        $nProt = $protNFe->getElementsByTagName('nProt')->item(0)->nodeValue ?? null;

        // 100 = Autorizado o uso da NF-e
        if ($protStat === '100') {
            $xmlProc = Complements::toAuthorize($xmlAssinado, $resp);
            $arquivo = $this->store->salvar($chave, $xmlProc, 'autorizado');
            return [
                'status'    => 'autorizado',
                'chave'     => $chave,
                'protocolo' => $nProt,
                'motivo'    => trim("{$protStat} - {$protMotivo}"),
                'xml'       => $xmlProc,
                'arquivo'   => $arquivo,
            ];
        }

        $this->store->salvar($chave, $xmlAssinado, 'rejeitado');
        return [
            'status'    => 'rejeitado',
            'chave'     => $chave,
            'protocolo' => $nProt,
            'motivo'    => trim("{$protStat} - {$protMotivo}"),
            'xml'       => null,
        ];
    }

    /**
     * Consulta a situação de uma NF-e pela chave de acesso.
     */
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
     * Cancela uma NF-e autorizada (dentro do prazo legal, geralmente 24h).
     */
    public function cancelar(string $chave, string $protocolo, string $justificativa): array
    {
        if (mb_strlen($justificativa) < 15) {
            throw new \InvalidArgumentException('Justificativa deve ter ao menos 15 caracteres.');
        }
        $resp = $this->tools->sefazCancela($chave, $justificativa, $protocolo);
        $st = new \DOMDocument();
        $st->loadXML($resp);
        $cStat = $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $xMotivo = $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';
        // 128 = lote de evento processado; 135 = evento registrado e vinculado
        $sucesso = in_array($cStat, ['128', '135', '155'], true)
            || str_contains($resp, '<cStat>135</cStat>');
        return [
            'status' => $sucesso ? 'cancelado' : 'erro',
            'chave'  => $chave,
            'motivo' => trim("{$cStat} - {$xMotivo}"),
            'xml'    => $resp,
        ];
    }

    /**
     * Carta de Correção Eletrônica (CC-e).
     * Corrige erros que NÃO alterem valores, impostos, dados do destinatário
     * ou a data de emissão. seq = sequência do evento (1 na primeira correção).
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
        $st = new \DOMDocument();
        $st->loadXML($resp);
        $cStat = $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '';
        $xMotivo = $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '';
        // 135 = evento registrado e vinculado à NF-e
        $sucesso = str_contains($resp, '<cStat>135</cStat>');
        if ($sucesso) {
            $this->store->salvar("{$chave}-cce-{$seq}", $resp, 'eventos');
        }
        return [
            'status' => $sucesso ? 'registrada' : 'erro',
            'chave'  => $chave,
            'motivo' => trim("{$cStat} - {$xMotivo}"),
            'xml'    => $resp,
        ];
    }

    /**
     * Gera o PDF da DANFE a partir do XML autorizado (procNFe) já guardado.
     * Retorna o caminho do arquivo e o PDF em base64.
     */
    public function danfe(string $chave): array
    {
        $xml = $this->store->recuperar($chave, 'autorizado');
        if ($xml === null) {
            throw new \RuntimeException("XML autorizado não encontrado para a chave {$chave}.");
        }
        $danfe = new Danfe($xml);
        $pdf = $danfe->render();

        $dir = $this->root . '/storage/pdf';
        if (!is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        $arquivo = $dir . '/' . $chave . '.pdf';
        file_put_contents($arquivo, $pdf);

        return [
            'chave'       => $chave,
            'arquivo'     => $arquivo,
            'pdf_base64'  => base64_encode($pdf),
        ];
    }

    /**
     * Testa a comunicação com a SEFAZ (status do serviço).
     */
    public function statusServico(): array
    {
        $resp = $this->tools->sefazStatus();
        $st = new \DOMDocument();
        $st->loadXML($resp);
        return [
            'cStat'  => $st->getElementsByTagName('cStat')->item(0)->nodeValue ?? '',
            'motivo' => $st->getElementsByTagName('xMotivo')->item(0)->nodeValue ?? '',
            'ambiente' => $this->ambiente === 1 ? 'producao' : 'homologacao',
        ];
    }
}
