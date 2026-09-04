<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Configuração global do motor (não específica de emitente).
 * Dados por empresa vivem em config/emitentes.json (ver Emitente).
 */
final class Config
{
    public static function boot(string $root): void
    {
        if (class_exists(\Dotenv\Dotenv::class) && is_file($root . '/.env')) {
            \Dotenv\Dotenv::createImmutable($root)->safeLoad();
        }
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

    /** 1 = Produção, 2 = Homologação. Global para todo o motor. */
    public static function ambiente(): int
    {
        return self::int('FISCAL_AMBIENTE', 2);
    }
}
