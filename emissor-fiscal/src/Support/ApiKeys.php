<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Autenticação + escopo por chave de API.
 *
 * config/api-keys.json mapeia cada chave a um sistema consumidor e aos CNPJs
 * que ele pode emitir. Ex.:
 * {
 *   "CHAVE_DO_RESTAURANTE": { "nome": "restaurante", "emitentes": ["11111111000199"] },
 *   "CHAVE_DA_CONTABILIDADE": { "nome": "nauta", "emitentes": ["*"] }
 * }
 *
 * "*" = pode emitir por qualquer emitente cadastrado (uso da contabilidade).
 */
final class ApiKeys
{
    /** @var array<string,array{nome:string,emitentes:array<string>}> */
    private array $chaves;

    public function __construct(string $root)
    {
        $arquivo = $root . '/config/api-keys.json';
        if (!is_file($arquivo)) {
            throw new \RuntimeException(
                'config/api-keys.json não encontrado. Copie de config/api-keys.example.json.'
            );
        }
        $json = json_decode((string) file_get_contents($arquivo), true);
        $this->chaves = is_array($json) ? $json : [];
    }

    /**
     * Valida o token e retorna o contexto do chamador, ou null se inválido.
     * @return array{nome:string,emitentes:array<string>}|null
     */
    public function autenticar(?string $token): ?array
    {
        if ($token === null || $token === '') {
            return null;
        }
        foreach ($this->chaves as $chave => $conf) {
            if (hash_equals((string) $chave, $token)) {
                return [
                    'nome'      => (string) ($conf['nome'] ?? 'desconhecido'),
                    'emitentes' => array_map(
                        fn ($c) => $c === '*' ? '*' : preg_replace('/\D/', '', (string) $c),
                        (array) ($conf['emitentes'] ?? [])
                    ),
                ];
            }
        }
        return null;
    }

    /** O chamador pode emitir por este CNPJ? */
    public static function podeEmitir(array $caller, string $cnpj): bool
    {
        $cnpj = preg_replace('/\D/', '', $cnpj);
        $permitidos = $caller['emitentes'] ?? [];
        return in_array('*', $permitidos, true) || in_array($cnpj, $permitidos, true);
    }
}
