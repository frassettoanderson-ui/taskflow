<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe\Danfse;

/**
 * Cada layout de DANFSE implementa esta interface. O layout varia por município
 * (a prefeitura tem sua "cara"), mas todos consomem o mesmo XML nacional.
 */
interface DanfseRenderer
{
    public function nome(): string;

    /**
     * Recebe o XML autorizado da NFS-e e devolve os bytes do PDF.
     * $extra carrega dados do cadastro do emitente que não vêm no XML nacional
     * (ex.: 'im', 'fantasia', 'ie').
     */
    public function render(string $xmlNfse, array $extra = []): string;
}
