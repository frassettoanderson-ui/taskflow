<?php

declare(strict_types=1);

namespace App\Admin;

/**
 * Cadastro de emitentes via API (usado por um painel/PDV), para que o certificado,
 * a senha e o CSC sejam registrados no motor SEM ninguém editar arquivo à mão.
 * Grava em config/emitentes.json (com lock) e salva o .pfx em storage/certificados.
 *
 * Só deve ser chamado por uma chave de API com flag "admin".
 */
final class EmitenteAdminService
{
    public function __construct(private string $root) {}

    /**
     * Cria/atualiza um emitente. $certBase64 (opcional) = conteúdo do .pfx em base64.
     * @return array dados salvos (sem segredos)
     */
    public function registrar(array $d, ?string $certBase64): array
    {
        $cnpj = preg_replace('/\D/', '', (string) ($d['cnpj'] ?? ''));
        if (strlen($cnpj) !== 14) {
            throw new \InvalidArgumentException('cnpj inválido (14 dígitos).');
        }
        foreach (['razao', 'uf', 'municipio_cod', 'municipio_nome'] as $req) {
            if (empty($d[$req])) {
                throw new \InvalidArgumentException("Campo '{$req}' é obrigatório.");
            }
        }

        // salva o certificado, se enviado
        $certPath = "storage/certificados/{$cnpj}.pfx";
        if ($certBase64 !== null && $certBase64 !== '') {
            $bin = base64_decode($certBase64, true);
            if ($bin === false || strlen($bin) < 100) {
                throw new \InvalidArgumentException('certificado_base64 inválido.');
            }
            file_put_contents($this->root . '/' . $certPath, $bin);
            @chmod($this->root . '/' . $certPath, 0600);
        }

        $registro = array_filter([
            'razao' => (string) $d['razao'],
            'fantasia' => (string) ($d['fantasia'] ?? ''),
            'ie' => (string) ($d['ie'] ?? 'ISENTO'),
            'im' => (string) ($d['im'] ?? ''),
            'crt' => (int) ($d['crt'] ?? 1),
            'uf' => strtoupper((string) $d['uf']),
            'municipio_cod' => (string) $d['municipio_cod'],
            'municipio_nome' => (string) $d['municipio_nome'],
            'logradouro' => (string) ($d['logradouro'] ?? ''),
            'numero' => (string) ($d['numero'] ?? 'S/N'),
            'bairro' => (string) ($d['bairro'] ?? ''),
            'cep' => preg_replace('/\D/', '', (string) ($d['cep'] ?? '')),
            'fone' => preg_replace('/\D/', '', (string) ($d['fone'] ?? '')),
            'cert_path' => $certPath,
            'cert_password' => (string) ($d['cert_password'] ?? ''),
            'nfe_serie' => (int) ($d['nfe_serie'] ?? 1),
            'nfce_serie' => (int) ($d['nfce_serie'] ?? 1),
            'cte_serie' => (int) ($d['cte_serie'] ?? 1),
            'mdfe_serie' => (int) ($d['mdfe_serie'] ?? 1),
            'csc_id' => (string) ($d['csc_id'] ?? ''),
            'csc' => (string) ($d['csc'] ?? ''),
            'nfse_provider' => (string) ($d['nfse_provider'] ?? ''),
            'nfse_senha' => (string) ($d['nfse_senha'] ?? ''),
            'resp_tec_contato' => (string) ($d['resp_tec_contato'] ?? ''),
            'resp_tec_email' => (string) ($d['resp_tec_email'] ?? ''),
        ], fn ($v) => $v !== '' && $v !== null);

        // preserva cert_password/csc antigos se não vieram agora (update parcial)
        $this->mutarJson($this->emitentesPath(), function (array $atual) use ($cnpj, $registro): array {
            $anterior = $atual[$cnpj] ?? [];
            foreach (['cert_password', 'csc', 'nfse_senha'] as $segredo) {
                if (empty($registro[$segredo]) && !empty($anterior[$segredo])) {
                    $registro[$segredo] = $anterior[$segredo];
                }
            }
            $atual[$cnpj] = $registro;
            return $atual;
        });

        // libera o CNPJ no escopo da chave de emissão (por valor da chave ou por nome)
        if (!empty($d['liberar_chave'])) {
            $this->liberarChavePorValor($cnpj, (string) $d['liberar_chave']);
        }
        foreach ((array) ($d['liberar_para'] ?? []) as $nomeChave) {
            $this->liberarChave($cnpj, (string) $nomeChave);
        }

        return ['cnpj' => $cnpj] + $this->semSegredos($registro);
    }

    public function listar(): array
    {
        $json = $this->lerJson($this->emitentesPath());
        $out = [];
        foreach ($json as $cnpj => $e) {
            $out[] = ['cnpj' => (string) $cnpj] + $this->semSegredos($e);
        }
        return $out;
    }

    public function remover(string $cnpj): void
    {
        $cnpj = preg_replace('/\D/', '', $cnpj);
        $this->mutarJson($this->emitentesPath(), function (array $atual) use ($cnpj): array {
            unset($atual[$cnpj]);
            return $atual;
        });
    }

    /** Libera o CNPJ no escopo da chave identificada pelo seu VALOR (token). */
    private function liberarChavePorValor(string $cnpj, string $keyValue): void
    {
        $this->mutarJson($this->apiKeysPath(), function (array $chaves) use ($cnpj, $keyValue): array {
            if (isset($chaves[$keyValue])) {
                $chaves[$keyValue]['emitentes'] = array_values(array_unique(
                    [...($chaves[$keyValue]['emitentes'] ?? []), $cnpj]
                ));
            }
            return $chaves;
        });
    }

    private function liberarChave(string $cnpj, string $nomeChave): void
    {
        $this->mutarJson($this->apiKeysPath(), function (array $chaves) use ($cnpj, $nomeChave): array {
            foreach ($chaves as &$conf) {
                if (($conf['nome'] ?? '') === $nomeChave) {
                    $conf['emitentes'] = array_values(array_unique([...($conf['emitentes'] ?? []), $cnpj]));
                }
            }
            return $chaves;
        });
    }

    private function semSegredos(array $e): array
    {
        $e['cert_password'] = !empty($e['cert_password']) ? '***definido***' : '';
        $e['csc'] = !empty($e['csc']) ? '***definido***' : '';
        $e['nfse_senha'] = !empty($e['nfse_senha']) ? '***definido***' : '';
        return $e;
    }

    private function emitentesPath(): string
    {
        return $this->root . '/config/emitentes.json';
    }

    private function apiKeysPath(): string
    {
        return $this->root . '/config/api-keys.json';
    }

    private function lerJson(string $path): array
    {
        if (!is_file($path)) {
            return [];
        }
        $j = json_decode((string) file_get_contents($path), true);
        return is_array($j) ? $j : [];
    }

    /** Read-modify-write com lock exclusivo. */
    private function mutarJson(string $path, callable $fn): void
    {
        $fp = fopen($path, 'c+');
        if ($fp === false) {
            throw new \RuntimeException("Não foi possível abrir {$path}.");
        }
        try {
            if (!flock($fp, LOCK_EX)) {
                throw new \RuntimeException('Não foi possível travar o arquivo.');
            }
            $conteudo = stream_get_contents($fp);
            $atual = json_decode((string) $conteudo, true);
            $atual = is_array($atual) ? $atual : [];
            $novo = $fn($atual);
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($novo, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            fflush($fp);
        } finally {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }
}
