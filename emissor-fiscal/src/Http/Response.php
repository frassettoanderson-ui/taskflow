<?php

declare(strict_types=1);

namespace App\Http;

final class Response
{
    public static function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function ok(array $data = []): void
    {
        self::json(['ok' => true] + $data, 200);
    }

    public static function erro(string $mensagem, int $status = 400, array $extra = []): void
    {
        self::json(['ok' => false, 'erro' => $mensagem] + $extra, $status);
    }
}
