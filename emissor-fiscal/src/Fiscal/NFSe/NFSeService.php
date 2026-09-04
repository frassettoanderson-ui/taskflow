<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe;

use App\Support\CertificadoManager;
use App\Support\Contador;
use App\Support\Emitente;
use App\Support\XmlStore;
use NFePHP\Common\Certificate;

/**
 * Orquestra a emissão de NFS-e para um emitente, escolhendo o provider certo
 * conforme o município e guardando o XML. A complexidade municipal fica nos
 * providers (ver ProviderRegistry + NFSeProvider).
 */
final class NFSeService
{
    private Certificate $cert;

    public function __construct(
        private string $root,
        private Emitente $emitente,
        private int $ambiente,
        private XmlStore $store,
        private Contador $contador,
        private ProviderRegistry $registry
    ) {
        $this->cert = CertificadoManager::carregar($root, $emitente->certPath, $emitente->certPassword);
    }

    public function emitir(array $payload): array
    {
        $municipio = (string) ($payload['servico']['codigo_municipio_prestacao'] ?? $this->emitente->cMun);
        $provider = $this->registry->paraMunicipio($municipio);

        $serie = (int) ($payload['serie'] ?? 1);
        $numero = $this->contador->proximo($this->emitente->cnpj, 'nfse', $serie);
        $payload['numero'] = $numero;
        $payload['serie'] = $serie;

        $r = $provider->emitir($this->emitente, $this->cert, $payload, $this->ambiente);

        if ($r['status'] === 'autorizado' && !empty($r['xml']) && !empty($r['chave'])) {
            $arquivo = $this->store->salvar($this->emitente->cnpj, $r['chave'], $r['xml'], 'nfse');
            $r['arquivo'] = $arquivo;
        }
        $r['provider'] = $provider->nome();
        return $r;
    }

    public function consultar(string $identificador, string $municipio): array
    {
        $provider = $this->registry->paraMunicipio($municipio);
        return $provider->consultar($this->emitente, $this->cert, $identificador, $this->ambiente)
            + ['provider' => $provider->nome()];
    }

    public function cancelar(string $identificador, string $justificativa, string $municipio): array
    {
        if (mb_strlen($justificativa) < 15) {
            throw new \InvalidArgumentException('Justificativa deve ter ao menos 15 caracteres.');
        }
        $provider = $this->registry->paraMunicipio($municipio);
        return $provider->cancelar($this->emitente, $this->cert, $identificador, $justificativa, $this->ambiente)
            + ['provider' => $provider->nome()];
    }
}
