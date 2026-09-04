<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Carrega os emitentes cadastrados de config/emitentes.json (chaveado por CNPJ).
 * Esse arquivo contém senhas de certificado — NÃO versionar (ver .gitignore).
 *
 * Em produção com muitos clientes, troque por uma tabela de banco; a interface
 * pública (buscar/existe) permanece.
 */
final class EmitenteRepository
{
    /** @var array<string,array> */
    private array $dados;

    public function __construct(string $root)
    {
        $arquivo = $root . '/config/emitentes.json';
        if (!is_file($arquivo)) {
            throw new \RuntimeException(
                'config/emitentes.json não encontrado. Copie de config/emitentes.example.json.'
            );
        }
        $json = json_decode((string) file_get_contents($arquivo), true);
        if (!is_array($json)) {
            throw new \RuntimeException('config/emitentes.json inválido.');
        }
        // normaliza as chaves para só dígitos do CNPJ
        $this->dados = [];
        foreach ($json as $cnpj => $conf) {
            $this->dados[preg_replace('/\D/', '', (string) $cnpj)] = $conf;
        }
    }

    public function buscar(string $cnpj): Emitente
    {
        $cnpj = preg_replace('/\D/', '', $cnpj);
        if (!isset($this->dados[$cnpj])) {
            throw new \RuntimeException("Emitente {$cnpj} não cadastrado.");
        }
        return Emitente::fromArray(['cnpj' => $cnpj] + $this->dados[$cnpj]);
    }

    public function existe(string $cnpj): bool
    {
        return isset($this->dados[preg_replace('/\D/', '', $cnpj)]);
    }
}
