<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Router minimalista: registra rotas por método+path e despacha.
 * Rotas protegidas exigem o Bearer token igual a API_KEY.
 */
final class Router
{
    /** @var array<int,array{method:string,path:string,handler:callable,protected:bool}> */
    private array $routes = [];

    public function add(string $method, string $path, callable $handler, bool $protected = true): void
    {
        $this->routes[] = [
            'method'    => strtoupper($method),
            'path'      => '/' . trim($path, '/'),
            'handler'   => $handler,
            'protected' => $protected,
        ];
    }

    public function dispatch(Request $req, string $apiKey): void
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $req->method || $route['path'] !== $req->path) {
                continue;
            }
            if ($route['protected']) {
                $token = $req->bearerToken();
                if ($token === null || !hash_equals($apiKey, $token)) {
                    Response::erro('Não autorizado.', 401);
                }
            }
            try {
                ($route['handler'])($req);
            } catch (\Throwable $e) {
                Response::erro($e->getMessage(), 500, [
                    'tipo' => (new \ReflectionClass($e))->getShortName(),
                ]);
            }
            return;
        }
        Response::erro('Rota não encontrada.', 404);
    }
}
