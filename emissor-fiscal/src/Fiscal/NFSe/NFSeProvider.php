<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe;

use App\Support\Emitente;
use NFePHP\Common\Certificate;

/**
 * Contrato que todo emissor de NFS-e implementa. A variação municipal fica
 * escondida atrás desta interface: o resto do sistema fala sempre a mesma
 * língua (payload normalizado), e cada provider (Padrão Nacional, IPM/Atende.Net,
 * ABRASF, etc.) traduz para o seu webservice/layout.
 */
interface NFSeProvider
{
    /** Identificador curto do provider (ex.: "nacional", "ipm"). */
    public function nome(): string;

    /** Se o provider exige certificado digital para assinar/transmitir. */
    public function precisaCertificado(): bool;

    /**
     * Emite uma NFS-e a partir do payload normalizado.
     * @return array{status:string,chave:?string,numero:?string,motivo:string,xml:?string,pdf_url?:string}
     */
    public function emitir(Emitente $emitente, ?Certificate $cert, array $payload, int $ambiente): array;

    /** Consulta uma NFS-e (por chave / código / número, conforme o provider). */
    public function consultar(Emitente $emitente, ?Certificate $cert, string $identificador, int $ambiente): array;

    /** Cancela uma NFS-e. */
    public function cancelar(
        Emitente $emitente,
        ?Certificate $cert,
        string $identificador,
        string $justificativa,
        int $ambiente
    ): array;
}
