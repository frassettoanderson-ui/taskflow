<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Carrega o .env e monta o array de configuração que o NFePHP espera,
 * além de expor os dados do emitente para os serviços fiscais.
 */
final class Config
{
    private static ?array $env = null;

    public static function boot(string $root): void
    {
        if (class_exists(\Dotenv\Dotenv::class) && is_file($root . '/.env')) {
            \Dotenv\Dotenv::createImmutable($root)->safeLoad();
        }
        self::$env = $_ENV;
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $v = $_ENV[$key] ?? getenv($key);
        return ($v === false || $v === null || $v === '') ? $default : (string) $v;
    }

    public static function int(string $key, int $default = 0): int
    {
        $v = self::get($key);
        return $v === null ? $default : (int) $v;
    }

    /**
     * Configuração no formato aceito por NFePHP\NFe\Tools.
     */
    public static function nfephp(): string
    {
        return json_encode([
            'atualizacao' => date('Y-m-d H:i:s'),
            'tpAmb'       => self::int('FISCAL_AMBIENTE', 2),
            'razaosocial' => self::get('EMIT_RAZAO', ''),
            'siglaUF'     => self::get('EMIT_UF', 'SC'),
            'cnpj'        => self::get('EMIT_CNPJ', ''),
            'schemes'     => 'PL_009_V4',
            'versao'      => '4.00',
            'tokenIBPT'   => '',
            'CSC'         => self::get('NFCE_CSC', ''),
            'CSCid'       => self::get('NFCE_CSC_ID', ''),
            'proxyConf'   => [
                'proxyIp'   => '',
                'proxyPort' => '',
                'proxyUser' => '',
                'proxyPass' => '',
            ],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Dados do emitente usados na montagem das notas.
     */
    public static function emitente(): array
    {
        return [
            'CNPJ'    => self::get('EMIT_CNPJ', ''),
            'xNome'   => self::get('EMIT_RAZAO', ''),
            'xFant'   => self::get('EMIT_FANTASIA', ''),
            'IE'      => self::get('EMIT_IE', 'ISENTO'),
            'IM'      => self::get('EMIT_IM', ''),
            'CRT'     => self::int('EMIT_CRT', 1),
            'UF'      => self::get('EMIT_UF', 'SC'),
            'cMun'    => self::get('EMIT_MUNICIPIO_COD', ''),
            'xMun'    => self::get('EMIT_MUNICIPIO_NOME', ''),
            'xLgr'    => self::get('EMIT_LOGRADOURO', ''),
            'nro'     => self::get('EMIT_NUMERO', 'S/N'),
            'xBairro' => self::get('EMIT_BAIRRO', ''),
            'CEP'     => self::get('EMIT_CEP', ''),
            'fone'    => self::get('EMIT_FONE', ''),
        ];
    }
}
