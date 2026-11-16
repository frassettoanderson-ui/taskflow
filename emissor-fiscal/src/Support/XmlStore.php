<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Persiste os XMLs por emitente e chave de acesso.
 * A guarda dos XMLs por 5 anos é obrigação fiscal — em produção,
 * espelhe também em storage externo (S3/backup).
 *
 * Layout: storage/xml/<cnpj>/<tipo>/<chave>.xml
 */
final class XmlStore
{
    public function __construct(private string $root) {}

    /** Seguranca: a chave e o tipo viram nome de arquivo; so letras, numeros, - e _ (nada de "../"). */
    public static function nomeSeguro(string $s): string
    {
        if (!preg_match('/^[A-Za-z0-9_-]{1,120}$/', $s)) {
            throw new \InvalidArgumentException('chave inválida.');
        }
        return $s;
    }

    public function salvar(string $cnpj, string $chave, string $xml, string $tipo = 'autorizado'): string
    {
        $cnpj = preg_replace('/\D/', '', $cnpj);
        $chave = self::nomeSeguro($chave);
        $tipo = self::nomeSeguro($tipo);
        $dir = "{$this->root}/storage/xml/{$cnpj}/{$tipo}";
        if (!is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        $arquivo = "{$dir}/{$chave}.xml";
        file_put_contents($arquivo, $xml);
        return $arquivo;
    }

    public function recuperar(string $cnpj, string $chave, string $tipo = 'autorizado'): ?string
    {
        $cnpj = preg_replace('/\D/', '', $cnpj);
        if (!preg_match('/^[A-Za-z0-9_-]{1,120}$/', $chave) || !preg_match('/^[A-Za-z0-9_-]{1,120}$/', $tipo)) {
            return null; // chave/tipo com caracteres estranhos: não existe
        }
        $arquivo = "{$this->root}/storage/xml/{$cnpj}/{$tipo}/{$chave}.xml";
        return is_file($arquivo) ? (file_get_contents($arquivo) ?: null) : null;
    }
}
