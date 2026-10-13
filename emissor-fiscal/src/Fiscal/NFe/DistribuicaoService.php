<?php

declare(strict_types=1);

namespace App\Fiscal\NFe;

use App\Support\CertificadoManager;
use App\Support\Emitente;
use NFePHP\NFe\Tools;

/**
 * Busca no Ambiente Nacional (NFeDistribuicaoDFe) o XML de uma NF-e emitida CONTRA o emitente
 * (nota de compra), pela chave de acesso. Sem a "Ciência da Operação" a SEFAZ só entrega o resumo:
 * com $manifestar, registra a ciência (evento 210210) e consulta de novo.
 * Não emite nada e não mexe na numeração; o XML fica em storage/xml/{cnpj}/recebidas/{chave}.xml.
 */
final class DistribuicaoService
{
    private Tools $tools;

    public function __construct(private string $root, private Emitente $emitente, private int $ambiente)
    {
        $cert = CertificadoManager::carregar($root, $emitente->certPath, $emitente->certPassword);
        $this->tools = new Tools($emitente->nfephpConfig($ambiente), $cert);
        $this->tools->model(55);
    }

    /** @return array{status:string,motivo:string,xml:?string,manifestacao:?string} */
    public function buscarPorChave(string $chave, bool $manifestar = true): array
    {
        $chave = preg_replace('/\D/', '', $chave) ?? '';
        if (strlen($chave) !== 44) {
            throw new \InvalidArgumentException('Chave de acesso inválida (44 dígitos).');
        }
        $guardado = $this->arquivo($chave);
        if (is_file($guardado)) {
            return ['status' => 'xml', 'motivo' => 'XML já baixado antes.', 'xml' => (string) file_get_contents($guardado), 'manifestacao' => null];
        }

        $r = $this->consultar($chave);
        if ($r['status'] === 'xml' || !$manifestar) {
            return $r + ['manifestacao' => null];
        }

        // Só resumo (ou ainda não disponível): registra a ciência da operação e tenta de novo.
        $man = $this->cienciaDaOperacao($chave);
        for ($i = 0; $i < 3; $i++) {
            sleep(4);
            $r = $this->consultar($chave);
            if ($r['status'] === 'xml') {
                break;
            }
        }
        return $r + ['manifestacao' => $man];
    }

    /** @return array{status:string,motivo:string,xml:?string} */
    private function consultar(string $chave): array
    {
        $resp = $this->tools->sefazDistDFe(0, 0, $chave);
        $dom = new \DOMDocument();
        $dom->loadXML($resp);
        $cStat = $dom->getElementsByTagName('cStat')->item(0)?->nodeValue ?? '';
        $xMotivo = $dom->getElementsByTagName('xMotivo')->item(0)?->nodeValue ?? '';
        foreach ($dom->getElementsByTagName('docZip') as $doc) {
            $schema = $doc->getAttribute('schema');
            $conteudo = gzdecode(base64_decode($doc->nodeValue));
            if ($conteudo !== false && str_starts_with($schema, 'procNFe')) {
                $dir = dirname($this->arquivo($chave));
                if (!is_dir($dir)) {
                    mkdir($dir, 0775, true);
                }
                file_put_contents($this->arquivo($chave), $conteudo);
                return ['status' => 'xml', 'motivo' => "{$cStat} - {$xMotivo}", 'xml' => $conteudo];
            }
            if ($conteudo !== false && str_starts_with($schema, 'resNFe')) {
                return ['status' => 'resumo', 'motivo' => "{$cStat} - {$xMotivo} (só o resumo: falta a ciência da operação)", 'xml' => null];
            }
        }
        return ['status' => 'nao_encontrado', 'motivo' => "{$cStat} - {$xMotivo}", 'xml' => null];
    }

    /** Evento 210210 (Ciência da Operação). 135/136 = registrado; 573 = já havia ciência. */
    private function cienciaDaOperacao(string $chave): string
    {
        $resp = $this->tools->sefazManifesta($chave, 210210);
        $dom = new \DOMDocument();
        $dom->loadXML($resp);
        $stats = [];
        foreach ($dom->getElementsByTagName('infEvento') as $inf) {
            $stats[] = ($inf->getElementsByTagName('cStat')->item(0)?->nodeValue ?? '') . ' - ' . ($inf->getElementsByTagName('xMotivo')->item(0)?->nodeValue ?? '');
        }
        return $stats ? implode(' | ', $stats) : (($dom->getElementsByTagName('xMotivo')->item(0)?->nodeValue) ?? 'sem resposta');
    }

    private function arquivo(string $chave): string
    {
        $cnpj = preg_replace('/\D/', '', $this->emitente->cnpj);
        return "{$this->root}/storage/xml/{$cnpj}/recebidas/{$chave}.xml";
    }
}
