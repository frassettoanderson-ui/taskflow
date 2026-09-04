<?php

declare(strict_types=1);

namespace App\Support;

use NFePHP\Common\Certificate;

/**
 * Carrega o certificado A1 (.pfx) e valida a validade.
 * O conteúdo do .pfx nunca é logado.
 */
final class CertificadoManager
{
    public static function carregar(string $root): Certificate
    {
        $path = Config::get('CERT_PATH', 'storage/certificados/certificado.pfx');
        if ($path && !self::isAbsolute($path)) {
            $path = $root . '/' . ltrim($path, '/');
        }
        if (!$path || !is_file($path)) {
            throw new \RuntimeException("Certificado não encontrado em: {$path}");
        }

        $senha = Config::get('CERT_PASSWORD', '');
        $conteudo = file_get_contents($path);
        if ($conteudo === false) {
            throw new \RuntimeException('Falha ao ler o arquivo do certificado.');
        }

        $cert = Certificate::readPfx($conteudo, (string) $senha);

        if ($cert->isExpired()) {
            throw new \RuntimeException(
                'Certificado expirado em ' . $cert->getValidTo()->format('d/m/Y') . '.'
            );
        }

        return $cert;
    }

    private static function isAbsolute(string $path): bool
    {
        return (bool) preg_match('#^([A-Za-z]:[\\\\/]|/)#', $path);
    }
}
