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

    /**
     * @param int $ambiente 1=produção, 2=homologação. Sequências são INDEPENDENTES
     *                      por ambiente (produção começa do 1; homologação herda a
     *                      sequência antiga na primeira chamada — migração automática).
     */
    public function proximo(string $cnpj, string $modelo, int $serie, int $ambiente = 2): int
    {
        $cnpj = preg_replace('/\D/', '', $cnpj);
        $dir = $this->root . '/storage/contadores';
        if (!is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        $arquivo = $dir . "/{$cnpj}_{$modelo}_{$serie}_a{$ambiente}.txt";
        // Migração: contadores antigos (sem ambiente) rodavam em homologação —
        // o contador de homolog herda o valor pra não repetir numeração lá.
        $legado = $dir . "/{$cnpj}_{$modelo}_{$serie}.txt";
        if (!is_file($arquivo) && $ambiente === 2 && is_file($legado)) {
            copy($legado, $arquivo);
        }
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
