<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe\Danfse;

/**
 * Escolhe o layout de DANFSE por município (config/nfse-danfse-municipios.json,
 * com "_default"). Ex.: { "_default": "nacional", "4207304": "imbituba" }.
 */
final class DanfseRegistry
{
    /** @var array<string,DanfseRenderer> */
    private array $renderers = [];
    /** @var array<string,string> */
    private array $mapa;

    public function __construct(string $root, DanfseRenderer ...$renderers)
    {
        foreach ($renderers as $r) {
            $this->renderers[$r->nome()] = $r;
        }
        $arquivo = $root . '/config/nfse-danfse-municipios.json';
        $json = is_file($arquivo) ? json_decode((string) file_get_contents($arquivo), true) : [];
        $this->mapa = is_array($json) ? $json : [];
    }

    public function paraMunicipio(string $codigoMunicipio): DanfseRenderer
    {
        $nome = $this->mapa[$codigoMunicipio] ?? ($this->mapa['_default'] ?? 'nacional');
        return $this->renderers[$nome] ?? $this->renderers['nacional'];
    }
}
