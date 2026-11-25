<?php

declare(strict_types=1);

namespace App\Support;

use NFePHP\Common\Certificate;

/**
 * Procuradores da NFS-e Nacional (contabilidade, software house): desde 01/11/2026 a API nacional aceita que
 * o certificado do PROCURADOR faça o mTLS e assine a DPS do cliente, se o cliente deu procuração eletrônica
 * (serviço NFS-e) na Receita Federal. O <emit> da DPS continua com o CNPJ do cliente.
 *
 * Fica em config/procuradores.json: { "<cpf/cnpj>": { cert_path, cert_password, titular, valido_ate, dono } }.
 * "dono" = nome da chave admin que cadastrou; só ela troca o certificado ou aponta emitentes para ele.
 */
final class Procuradores
{
    public function __construct(private string $root) {}

    public static function doc(string $v): string
    {
        return preg_replace('/\D/', '', $v);
    }

    public function buscar(string $doc): ?array
    {
        $doc = self::doc($doc);
        return $this->ler()[$doc] ?? null;
    }

    /** O procurador existe e pertence à chave admin informada. */
    public function daChave(string $doc, string $nomeChave): bool
    {
        $p = $this->buscar($doc);
        return $p !== null && ($p['dono'] ?? '') === $nomeChave;
    }

    /** Carrega o certificado do procurador (lança se não existe ou venceu). */
    public function certificado(string $doc): Certificate
    {
        $p = $this->buscar($doc);
        if ($p === null) {
            throw new \RuntimeException("Procurador {$doc} não cadastrado no motor.");
        }
        return CertificadoManager::carregar($this->root, (string) $p['cert_path'], (string) ($p['cert_password'] ?? ''));
    }

    /**
     * Cria/atualiza o procurador. Confere o .pfx com a senha antes de gravar.
     * @return array dados sem segredos
     */
    public function registrar(string $doc, string $certBase64, string $senha, string $dono): array
    {
        $doc = self::doc($doc);
        if (strlen($doc) !== 11 && strlen($doc) !== 14) {
            throw new \InvalidArgumentException('CPF/CNPJ do procurador inválido.');
        }
        $atual = $this->buscar($doc);
        if ($atual !== null && ($atual['dono'] ?? '') !== $dono) {
            throw new \DomainException('Este procurador pertence a outra chave.');
        }
        $bin = base64_decode($certBase64, true);
        if ($bin === false || strlen($bin) < 100) {
            throw new \InvalidArgumentException('certificado_base64 inválido.');
        }
        $cert = Certificate::readPfx($bin, $senha); // lança se a senha não abre
        if ($cert->isExpired()) {
            throw new \InvalidArgumentException('Certificado vencido em ' . $cert->getValidTo()->format('d/m/Y') . '.');
        }
        $certDoc = self::doc((string) ($cert->getCnpj() ?: $cert->getCpf()));
        if ($certDoc !== '' && $certDoc !== $doc) {
            throw new \InvalidArgumentException("O certificado é do documento {$certDoc}, não de {$doc}.");
        }
        $dir = $this->root . '/storage/certificados';
        if (!is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        $certPath = "storage/certificados/procurador-{$doc}.pfx";
        file_put_contents($this->root . '/' . $certPath, $bin);
        @chmod($this->root . '/' . $certPath, 0600);

        $registro = [
            'cert_path' => $certPath,
            'cert_password' => $senha,
            'titular' => (string) $cert->getCompanyName(),
            'valido_ate' => $cert->getValidTo()->format('Y-m-d'),
            'dono' => $dono,
        ];
        $this->mutar(function (array $todos) use ($doc, $registro): array {
            $todos[$doc] = $registro;
            return $todos;
        });
        return ['documento' => $doc, 'titular' => $registro['titular'], 'valido_ate' => $registro['valido_ate']];
    }

    private function caminho(): string
    {
        return $this->root . '/config/procuradores.json';
    }

    private function ler(): array
    {
        $f = $this->caminho();
        if (!is_file($f)) {
            return [];
        }
        $j = json_decode((string) file_get_contents($f), true);
        return is_array($j) ? $j : [];
    }

    private function mutar(callable $fn): void
    {
        $fp = fopen($this->caminho(), 'c+');
        if ($fp === false) {
            throw new \RuntimeException('Não foi possível abrir config/procuradores.json.');
        }
        try {
            flock($fp, LOCK_EX);
            $atual = json_decode((string) stream_get_contents($fp), true);
            $novo = $fn(is_array($atual) ? $atual : []);
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($novo, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            fflush($fp);
        } finally {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
        @chmod($this->caminho(), 0600);
    }
}
