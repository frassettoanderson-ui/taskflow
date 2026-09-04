<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Persiste os XMLs autorizados/rejeitados por chave de acesso.
 * A guarda dos XMLs por 5 anos é obrigação fiscal — em produção,
 * espelhe também em storage externo (S3/backup).
 */
final class XmlStore
{
    public function __construct(private string $root) {}

    public function salvar(string $chave, string $xml, string $tipo = 'autorizado'): string
    {
        $dir = $this->root . '/storage/xml/' . $tipo;
        if (!is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        $arquivo = $dir . '/' . $chave . '.xml';
        file_put_contents($arquivo, $xml);
        return $arquivo;
    }

    public function recuperar(string $chave, string $tipo = 'autorizado'): ?string
    {
        $arquivo = $this->root . '/storage/xml/' . $tipo . '/' . $chave . '.xml';
        return is_file($arquivo) ? (file_get_contents($arquivo) ?: null) : null;
    }
}
