<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe;

use App\Support\Emitente;
use NFePHP\Common\Certificate;

/**
 * Contrato que todo emissor de NFS-e implementa. A variação municipal fica
 * escondida atrás desta interface: o resto do sistema fala sempre a mesma
 * língua (payload normalizado), e cada provider (Padrão Nacional, ABRASF 2.03,
 * São Paulo, etc.) traduz para o seu webservice/layout.
 */
interface NFSeProvider
{
    /** Identificador curto do provider (ex.: "nacional", "abrasf203"). */
    public function nome(): string;

    /**
     * Emite uma NFS-e a partir do payload normalizado.
     *
     * @return array{status:string,chave:?string,numero:?string,motivo:string,xml:?string}
     */
    public function emitir(Emitente $emitente, Certificate $cert, array $payload, int $ambiente): array;

    /**
     * Consulta uma NFS-e (por chave de acesso / código de verificação, conforme o provider).
     */
    public function consultar(Emitente $emitente, Certificate $cert, string $identificador, int $ambiente): array;

    /**
     * Cancela uma NFS-e.
     */
    public function cancelar(
        Emitente $emitente,
        Certificate $cert,
        string $identificador,
        string $justificativa,
        int $ambiente
    ): array;
}
