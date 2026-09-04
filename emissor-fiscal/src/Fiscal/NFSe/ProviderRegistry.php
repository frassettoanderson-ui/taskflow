<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe;

/**
 * Decide qual NFSeProvider atende cada município.
 *
 * config/nfse-municipios.json mapeia código IBGE do município -> nome do provider,
 * com "_default" para o restante. Ex.:
 * {
 *   "_default": "nacional",
 *   "3550308": "saopaulo"
 * }
 *
 * A regra prática: quase tudo cai no "nacional" (Padrão Nacional); só se cria
 * entrada específica para uma cidade que ainda esteja fora do padrão E onde
 * exista cliente real.
 */
final class ProviderRegistry
{
    /** @var array<string,NFSeProvider> */
    private array $providers = [];
    /** @var array<string,string> */
    private array $mapa;

    public function __construct(string $root, NFSeProvider ...$providers)
    {
        foreach ($providers as $p) {
            $this->providers[$p->nome()] = $p;
        }

        $arquivo = $root . '/config/nfse-municipios.json';
        $json = is_file($arquivo) ? json_decode((string) file_get_contents($arquivo), true) : [];
        $this->mapa = is_array($json) ? $json : [];
    }

    public function paraMunicipio(string $codigoMunicipio): NFSeProvider
    {
        $nome = $this->mapa[$codigoMunicipio] ?? ($this->mapa['_default'] ?? 'nacional');
        if (!isset($this->providers[$nome])) {
            throw new \RuntimeException(
                "Provider de NFS-e '{$nome}' não implementado (município {$codigoMunicipio})."
            );
        }
        return $this->providers[$nome];
    }
}
