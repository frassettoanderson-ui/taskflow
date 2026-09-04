<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Contador atômico de numeração de notas por modelo+série.
 * Implementação inicial em arquivo com lock (suficiente p/ 1 processo/VPS).
 *
 * ATENÇÃO: em cenário multi-instância, troque por sequência de banco
 * (ex.: SELECT ... FOR UPDATE ou uma tabela de contadores). Número pulado
 * ou repetido gera rejeição na SEFAZ e dor de cabeça fiscal.
 */
final class Contador
{
    public function __construct(private string $root) {}

    public function proximo(string $modelo, int $serie): int
    {
        $dir = $this->root . '/storage';
        $arquivo = $dir . "/contador_{$modelo}_{$serie}.txt";
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
