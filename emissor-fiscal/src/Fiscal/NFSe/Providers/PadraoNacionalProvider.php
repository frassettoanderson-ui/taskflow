<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe\Providers;

use App\Fiscal\NFSe\NFSeProvider;
use App\Support\Emitente;
use NFePHP\Common\Certificate;
use NFePHP\Common\Signer;

/**
 * Provider do Padrão Nacional da NFS-e (Ambiente de Dados Nacional / SEFIN Nacional).
 *
 * Fluxo: monta o DPS (Declaração de Prestação de Serviços) -> assina (XMLDSig)
 * -> gzip + base64 -> POST REST. A API nacional autentica por **mTLS**: o
 * próprio certificado A1 do emitente é apresentado como certificado de cliente
 * TLS (não há token/API key).
 *
 * ⚠️ VERIFICAR EM HOMOLOGAÇÃO (produção restrita) antes de produção:
 *   - URLs base e caminhos dos endpoints (mudam conforme o MOC vigente).
 *   - Versão do leiaute do DPS e nomes/obrigatoriedade dos campos.
 *   - Se o emitente está CREDENCIADO no ambiente nacional para o município.
 *   - Formato exato do Id do infDPS e da resposta (chaveAcesso, nfseXmlGZipB64).
 * Referência: https://www.gov.br/nfse  (MOC + esquemas XSD)
 */
final class PadraoNacionalProvider implements NFSeProvider
{
    private const BASE_PRODUCAO = 'https://sefin.nfse.gov.br/sefinnacional';
    private const BASE_HOMOLOG  = 'https://sefin.producaorestrita.nfse.gov.br/sefinnacional';

    public function nome(): string
    {
        return 'nacional';
    }

    public function emitir(Emitente $emitente, Certificate $cert, array $payload, int $ambiente): array
    {
        $numero = (int) ($payload['numero'] ?? 1); // idealmente vem do Contador (ver NFSeService)
        $serie = (int) ($payload['serie'] ?? 1);

        $dps = $this->montarDPS($emitente, $payload, $ambiente, $numero, $serie);
        $assinado = Signer::sign($cert, $dps, 'infDPS', 'Id');

        $gzB64 = base64_encode(gzencode($assinado));
        $resp = $this->request($cert, 'POST', '/nfse', $ambiente, ['dpsXmlGZipB64' => $gzB64]);

        $body = json_decode($resp['body'], true) ?: [];

        if ($resp['status'] === 201 || $resp['status'] === 200) {
            $nfseXml = isset($body['nfseXmlGZipB64'])
                ? gzdecode(base64_decode($body['nfseXmlGZipB64']))
                : null;
            return [
                'status' => 'autorizado',
                'chave'  => $body['chaveAcesso'] ?? null,
                'numero' => (string) $numero,
                'motivo' => 'NFS-e autorizada',
                'xml'    => $nfseXml,
            ];
        }

        return [
            'status' => 'rejeitado',
            'chave'  => null,
            'numero' => (string) $numero,
            'motivo' => $this->extrairErros($body, $resp['status']),
            'xml'    => null,
        ];
    }

    public function consultar(Emitente $emitente, Certificate $cert, string $identificador, int $ambiente): array
    {
        $resp = $this->request($cert, 'GET', '/nfse/' . rawurlencode($identificador), $ambiente);
        $body = json_decode($resp['body'], true) ?: [];
        $nfseXml = isset($body['nfseXmlGZipB64'])
            ? gzdecode(base64_decode($body['nfseXmlGZipB64']))
            : null;
        return [
            'chave'  => $identificador,
            'status' => $resp['status'] === 200 ? 'encontrada' : 'nao_encontrada',
            'motivo' => $resp['status'] === 200 ? 'OK' : $this->extrairErros($body, $resp['status']),
            'xml'    => $nfseXml,
        ];
    }

    public function cancelar(
        Emitente $emitente,
        Certificate $cert,
        string $identificador,
        string $justificativa,
        int $ambiente
    ): array {
        // O cancelamento no Padrão Nacional é feito por EVENTO (pedido de
        // cancelamento e101101): monta o XML do evento, assina e faz
        // POST /nfse/{chave}/eventos. Implementar após validar o leiaute do
        // evento em homologação.
        throw new \RuntimeException(
            'Cancelamento de NFS-e (Padrão Nacional) ainda não implementado — ver docs/NFSE.md.'
        );
    }

    // ------------------------------------------------------------------

    private function montarDPS(
        Emitente $e,
        array $p,
        int $ambiente,
        int $numero,
        int $serie
    ): string {
        $serv = $p['servico'] ?? [];
        $toma = $p['tomador'] ?? [];
        $cLocEmi = $e->cMun;
        $cLocPrest = (string) ($serv['codigo_municipio_prestacao'] ?? $cLocEmi);

        $valor = number_format((float) ($serv['valor'] ?? 0), 2, '.', '');
        $aliq = number_format((float) ($serv['aliquota_iss'] ?? 0), 2, '.', '');
        $issRetido = !empty($serv['iss_retido']) ? 1 : 2; // 1=retido, 2=não retido
        $cTribNac = $this->soDigitos((string) ($serv['item_lista_servico'] ?? '')); // ex.: 010701
        $descServ = htmlspecialchars((string) ($serv['descricao'] ?? ''), ENT_XML1);

        // opSimpNac: 1=Não optante, 2=MEI, 3=ME/EPP
        $opSimpNac = match ($e->crt) {
            4 => 2,       // MEI
            1, 2 => 3,    // Simples
            default => 1, // Normal
        };

        // Id do infDPS: "DPS" + cLocEmi(7) + tpInsc(1=CNPJ) + Insc(14) + serie(5) + nDPS(15)
        $id = 'DPS'
            . str_pad($cLocEmi, 7, '0', STR_PAD_LEFT)
            . '2'
            . str_pad($e->cnpj, 14, '0', STR_PAD_LEFT)
            . str_pad((string) $serie, 5, '0', STR_PAD_LEFT)
            . str_pad((string) $numero, 15, '0', STR_PAD_LEFT);

        $tomadorTag = $this->montarTomador($toma, $ambiente);

        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="{$id}">
    <tpAmb>{$ambiente}</tpAmb>
    <dhEmi>{$this->agora()}</dhEmi>
    <verAplic>emissor-fiscal-1.0</verAplic>
    <serie>{$serie}</serie>
    <nDPS>{$numero}</nDPS>
    <dCompet>{$this->hoje()}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>{$cLocEmi}</cLocEmi>
    <prest>
      <CNPJ>{$e->cnpj}</CNPJ>
      <regTrib>
        <opSimpNac>{$opSimpNac}</opSimpNac>
        <regEspTrib>0</regEspTrib>
      </regTrib>
    </prest>
    {$tomadorTag}
    <serv>
      <locPrest><cLocPrestacao>{$cLocPrest}</cLocPrestacao></locPrest>
      <cServ>
        <cTribNac>{$cTribNac}</cTribNac>
        <xDescServ>{$descServ}</xDescServ>
      </cServ>
    </serv>
    <valores>
      <vServPrest><vServ>{$valor}</vServ></vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <cLocIncid>{$cLocPrest}</cLocIncid>
          <pAliq>{$aliq}</pAliq>
          <tpRetISSQN>{$issRetido}</tpRetISSQN>
        </tribMun>
        <totTrib><indTotTrib>0</indTotTrib></totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>
XML;
    }

    private function montarTomador(array $toma, int $ambiente): string
    {
        if (empty($toma['cpf']) && empty($toma['cnpj'])) {
            return ''; // tomador não identificado
        }
        $doc = !empty($toma['cnpj'])
            ? '<CNPJ>' . $this->soDigitos($toma['cnpj']) . '</CNPJ>'
            : '<CPF>' . $this->soDigitos($toma['cpf']) . '</CPF>';
        $nome = htmlspecialchars((string) ($toma['nome'] ?? $toma['razao'] ?? ''), ENT_XML1);
        $email = !empty($toma['email'])
            ? '<email>' . htmlspecialchars($toma['email'], ENT_XML1) . '</email>'
            : '';

        return "<toma>{$doc}<xNome>{$nome}</xNome>{$email}</toma>";
    }

    /**
     * Requisição REST com o certificado do emitente como certificado de cliente (mTLS).
     * @return array{status:int,body:string}
     */
    private function request(Certificate $cert, string $metodo, string $caminho, int $ambiente, ?array $json = null): array
    {
        $base = $ambiente === 1 ? self::BASE_PRODUCAO : self::BASE_HOMOLOG;

        // Escreve cert + chave privada em PEM temporário para o mTLS do cURL.
        $pem = tempnam(sys_get_temp_dir(), 'nfse_') . '.pem';
        file_put_contents($pem, $cert->privateKey . "\n" . $cert->publicKey);
        @chmod($pem, 0600);

        try {
            $ch = curl_init($base . $caminho);
            $headers = ['Accept: application/json'];
            $opts = [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CUSTOMREQUEST  => $metodo,
                CURLOPT_SSLCERT        => $pem,
                CURLOPT_SSLKEY         => $pem,
                CURLOPT_TIMEOUT        => 60,
            ];
            if ($json !== null) {
                $headers[] = 'Content-Type: application/json';
                $opts[CURLOPT_POSTFIELDS] = json_encode($json);
            }
            $opts[CURLOPT_HTTPHEADER] = $headers;
            curl_setopt_array($ch, $opts);

            $body = curl_exec($ch);
            if ($body === false) {
                throw new \RuntimeException('Falha na comunicação com o ambiente nacional: ' . curl_error($ch));
            }
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            return ['status' => $status, 'body' => (string) $body];
        } finally {
            @unlink($pem);
        }
    }

    private function extrairErros(array $body, int $status): string
    {
        if (!empty($body['erros']) && is_array($body['erros'])) {
            $msgs = array_map(
                fn ($e) => trim(($e['codigo'] ?? '') . ' ' . ($e['descricao'] ?? $e['mensagem'] ?? '')),
                $body['erros']
            );
            return implode(' | ', $msgs);
        }
        return $body['message'] ?? $body['mensagem'] ?? "HTTP {$status}";
    }

    private function soDigitos(?string $v): string
    {
        return preg_replace('/\D/', '', (string) $v) ?? '';
    }

    private function agora(): string
    {
        return date('Y-m-d\TH:i:sP');
    }

    private function hoje(): string
    {
        return date('Y-m-d');
    }
}
