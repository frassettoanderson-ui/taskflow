<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Contador atômico de numeração por emitente + modelo + série.
 * Implementação em arquivo com lock (suficiente p/ 1 processo/VPS).
 *
 * ATENÇÃO: multi-instância exige sequência de banco (SELECT ... FOR UPDATE).
 * Número pulado ou repetido gera rejeição na SEFAZ.
 */
final class Contador
{
    public function __construct(private string $root) {}

    public function proximo(string $cnpj, string $modelo, int $serie): int
    {
        $cnpj = preg_replace('/\D/', '', $cnpj);
        $dir = $this->root . '/storage/contadores';
        if (!is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        $arquivo = $dir . "/{$cnpj}_{$modelo}_{$serie}.txt";
        $fp = fopen($arquivo, 'c+');
        if ($fp === false) {
            throw new \RuntimeException('Não foi possível abrir o contador.');
        }
        try {
            if (!flock($fp, LOCK_EX)) {
                throw new \RuntimeException('Não foi possível travar o contador.');
            }
            $atual = (int) trim((string) stream_get_contents($fp));
            $proximo = $atual + 1;
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, (string) $proximo);
            fflush($fp);
            return $proximo;
        } finally {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }
}
