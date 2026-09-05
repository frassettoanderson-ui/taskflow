<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Representa uma empresa emitente (um CNPJ, um certificado, sua numeração).
 * O motor guarda vários destes — a requisição escolhe qual usar.
 */
final class Emitente
{
    public function __construct(
        public readonly string $cnpj,
        public readonly string $razao,
        public readonly string $fantasia,
        public readonly string $ie,
        public readonly string $im,
        public readonly int $crt,
        public readonly string $uf,
        public readonly string $cMun,
        public readonly string $xMun,
        public readonly string $xLgr,
        public readonly string $nro,
        public readonly string $xBairro,
        public readonly string $cep,
        public readonly string $fone,
        public readonly string $certPath,
        public readonly string $certPassword,
        public readonly int $nfeSerie,
        public readonly int $nfceSerie,
        public readonly string $cscId,
        public readonly string $csc,
        public readonly string $respTecCnpj,
        public readonly string $respTecContato,
        public readonly string $respTecEmail,
        public readonly string $respTecFone,
        // NFS-e: provider explícito e credenciais municipais (ex.: IPM login/senha)
        public readonly string $nfseProvider,
        public readonly string $nfseSenha,
        public readonly string $municipioTom,
        public readonly string $ipmSubdominio,
    ) {}

    public static function fromArray(array $d): self
    {
        $req = static function (string $k) use ($d): string {
            if (!isset($d[$k]) || $d[$k] === '') {
                throw new \InvalidArgumentException("Emitente: campo obrigatório '{$k}' ausente.");
            }
            return (string) $d[$k];
        };

        return new self(
            cnpj:         preg_replace('/\D/', '', $req('cnpj')),
            razao:        $req('razao'),
            fantasia:     (string) ($d['fantasia'] ?? ''),
            ie:           (string) ($d['ie'] ?? 'ISENTO'),
            im:           (string) ($d['im'] ?? ''),
            crt:          (int) ($d['crt'] ?? 1),
            uf:           $req('uf'),
            cMun:         $req('municipio_cod'),
            xMun:         $req('municipio_nome'),
            xLgr:         $req('logradouro'),
            nro:          (string) ($d['numero'] ?? 'S/N'),
            xBairro:      $req('bairro'),
            cep:          preg_replace('/\D/', '', (string) ($d['cep'] ?? '')),
            fone:         preg_replace('/\D/', '', (string) ($d['fone'] ?? '')),
            certPath:     $req('cert_path'),
            certPassword: (string) ($d['cert_password'] ?? ''),
            nfeSerie:     (int) ($d['nfe_serie'] ?? 1),
            nfceSerie:    (int) ($d['nfce_serie'] ?? 1),
            cscId:        (string) ($d['csc_id'] ?? ''),
            csc:          (string) ($d['csc'] ?? ''),
            // Responsável técnico (empresa do software). Fallback: o próprio emitente.
            respTecCnpj:    preg_replace('/\D/', '', (string) ($d['resp_tec_cnpj'] ?? ($d['cnpj'] ?? ''))),
            respTecContato: (string) ($d['resp_tec_contato'] ?? ($d['razao'] ?? 'Responsavel Tecnico')),
            respTecEmail:   (string) ($d['resp_tec_email'] ?? 'contato@example.com'),
            respTecFone:    preg_replace('/\D/', '', (string) ($d['resp_tec_fone'] ?? ($d['fone'] ?? ''))),
            nfseProvider:   (string) ($d['nfse_provider'] ?? ''),
            nfseSenha:      (string) ($d['nfse_senha'] ?? ''),
            municipioTom:   preg_replace('/\D/', '', (string) ($d['municipio_tom'] ?? '')),
            ipmSubdominio:  (string) ($d['ipm_subdominio'] ?? ''),
        );
    }

    /** Config no formato que o NFePHP\NFe\Tools espera. */
    public function nfephpConfig(int $ambiente): string
    {
        return json_encode([
            'atualizacao' => date('Y-m-d H:i:s'),
            'tpAmb'       => $ambiente,
            'razaosocial' => $this->razao,
            'siglaUF'     => $this->uf,
            'cnpj'        => $this->cnpj,
            'schemes'     => 'PL_009_V4',
            'versao'      => '4.00',
            'tokenIBPT'   => '',
            'CSC'         => $this->csc,
            'CSCid'       => $this->cscId,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /** Formato consumido pelo NFeBuilder. */
    public function paraBuilder(): array
    {
        return [
            'CNPJ' => $this->cnpj, 'xNome' => $this->razao, 'xFant' => $this->fantasia,
            'IE' => $this->ie, 'IM' => $this->im, 'CRT' => $this->crt, 'UF' => $this->uf,
            'cMun' => $this->cMun, 'xMun' => $this->xMun, 'xLgr' => $this->xLgr,
            'nro' => $this->nro, 'xBairro' => $this->xBairro, 'CEP' => $this->cep,
            'fone' => $this->fone,
            'respTec' => [
                'CNPJ'     => $this->respTecCnpj,
                'xContato' => $this->respTecContato,
                'email'    => $this->respTecEmail,
                'fone'     => $this->respTecFone,
            ],
        ];
    }
}
