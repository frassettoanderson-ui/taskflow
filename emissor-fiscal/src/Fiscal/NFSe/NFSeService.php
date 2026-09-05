<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe;

use App\Fiscal\NFSe\Danfse\DanfseRegistry;
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
    private ?Certificate $cert = null;

    public function __construct(
        private string $root,
        private Emitente $emitente,
        private int $ambiente,
        private XmlStore $store,
        private Contador $contador,
        private ProviderRegistry $registry,
        private DanfseRegistry $danfseRegistry
    ) {}

    /** Escolhe o provider: override explícito do emitente, senão pelo município. */
    private function provider(string $municipio): NFSeProvider
    {
        return $this->emitente->nfseProvider !== ''
            ? $this->registry->porNome($this->emitente->nfseProvider)
            : $this->registry->paraMunicipio($municipio);
    }

    /** Carrega o certificado só quando o provider exige (clientes IPM não têm). */
    private function certPara(NFSeProvider $p): ?Certificate
    {
        if (!$p->precisaCertificado()) {
            return null;
        }
        return $this->cert ??= CertificadoManager::carregar(
            $this->root,
            $this->emitente->certPath,
            $this->emitente->certPassword
        );
    }

    public function emitir(array $payload): array
    {
        $municipio = (string) ($payload['servico']['codigo_municipio_prestacao'] ?? $this->emitente->cMun);
        $provider = $this->provider($municipio);

        $serie = (int) ($payload['serie'] ?? 1);
        $numero = $this->contador->proximo($this->emitente->cnpj, 'nfse', $serie);
        $payload['numero'] = $numero;
        $payload['serie'] = $serie;

        $r = $provider->emitir($this->emitente, $this->certPara($provider), $payload, $this->ambiente);

        if ($r['status'] === 'autorizado' && !empty($r['xml']) && !empty($r['chave'])) {
            $arquivo = $this->store->salvar($this->emitente->cnpj, $r['chave'], $r['xml'], 'nfse');
            $r['arquivo'] = $arquivo;
        }
        $r['provider'] = $provider->nome();
        return $r;
    }

    public function consultar(string $identificador, string $municipio): array
    {
        $provider = $this->provider($municipio);
        return $provider->consultar($this->emitente, $this->certPara($provider), $identificador, $this->ambiente)
            + ['provider' => $provider->nome()];
    }

    /**
     * Gera o PDF (DANFSE) da NFS-e a partir do XML autorizado guardado.
     * Se não estiver guardado, consulta na ADN e usa o XML retornado.
     */
    public function danfse(string $chave, string $municipio): array
    {
        $xml = $this->store->recuperar($this->emitente->cnpj, $chave, 'nfse');
        if ($xml === null) {
            $consulta = $this->consultar($chave, $municipio);
            $xml = $consulta['xml'] ?? null;
        }
        if (empty($xml)) {
            throw new \RuntimeException("XML da NFS-e não encontrado para a chave {$chave}.");
        }

        $renderer = $this->danfseRegistry->paraMunicipio($this->emitente->cMun);
        $pdf = $renderer->render($xml, [
            'im'       => $this->emitente->im,
            'fantasia' => $this->emitente->fantasia,
            'ie'       => $this->emitente->ie,
        ]);
        $dir = "{$this->root}/storage/pdf/" . preg_replace('/\D/', '', $this->emitente->cnpj);
        if (!is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        $arquivo = "{$dir}/{$chave}.pdf";
        file_put_contents($arquivo, $pdf);
        return ['chave' => $chave, 'arquivo' => $arquivo, 'pdf_base64' => base64_encode($pdf)];
    }

    public function cancelar(string $identificador, string $justificativa, string $municipio): array
    {
        if (mb_strlen($justificativa) < 15) {
            throw new \InvalidArgumentException('Justificativa deve ter ao menos 15 caracteres.');
        }
        $provider = $this->provider($municipio);
        return $provider->cancelar($this->emitente, $this->certPara($provider), $identificador, $justificativa, $this->ambiente)
            + ['provider' => $provider->nome()];
    }
}
