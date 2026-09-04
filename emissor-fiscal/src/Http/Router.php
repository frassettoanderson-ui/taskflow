<?php

declare(strict_types=1);

namespace App\Http;

use App\Support\ApiKeys;

/**
 * Router minimalista: registra rotas por método+path e despacha.
 * Rotas protegidas exigem um Bearer token válido em config/api-keys.json;
 * o contexto do chamador (nome + emitentes permitidos) fica em $req->caller.
 */
final class Router
{
    /** @var array<int,array{method:string,path:string,handler:callable,protected:bool}> */
    private array $routes = [];

    public function __construct(private ApiKeys $apiKeys) {}

    public function add(string $method, string $path, callable $handler, bool $protected = true): void
    {
        $this->routes[] = [
            'method'    => strtoupper($method),
            'path'      => '/' . trim($path, '/'),
            'handler'   => $handler,
            'protected' => $protected,
        ];
    }

    public function dispatch(Request $req): void
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $req->method || $route['path'] !== $req->path) {
                continue;
            }
            if ($route['protected']) {
                $caller = $this->apiKeys->autenticar($req->bearerToken());
                if ($caller === null) {
                    Response::erro('Não autorizado.', 401);
                }
                $req->caller = $caller;
            }
            try {
                ($route['handler'])($req);
            } catch (\InvalidArgumentException $e) {
                Response::erro($e->getMessage(), 400, ['tipo' => 'validacao']);
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
