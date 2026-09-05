<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe\Providers;

use App\Fiscal\NFSe\NFSeProvider;
use App\Support\Emitente;
use NFePHP\Common\Certificate;

/**
 * Provider IPM / Atende.Net (usado por Imbituba e muitas prefeituras de SC).
 *
 * Autentica por LOGIN/SENHA (HTTP Basic = base64(CPF/CNPJ:senha)) — NÃO exige
 * certificado digital, desde que o município não obrigue a assinatura (Imbituba
 * não obriga; a própria nota traz "não assinada digitalmente"). É assim que se
 * emite para clientes sem certificado.
 *
 * Referência: IPM NTE-35/2021 (Web Service para emissão de NFS-e), v2.9.
 * - URL: https://<cidade>.atende.net/?pg=rest&service=WNERestServiceNFSe
 * - POST multipart/form-data, campo "xml"; resposta síncrona (XML) traz link do PDF.
 * - Modo teste: tag <nfse_teste>1</nfse_teste> valida sem emitir.
 */
final class IpmAtendeNetProvider implements NFSeProvider
{
    public function nome(): string
    {
        return 'ipm';
    }

    public function precisaCertificado(): bool
    {
        return false;
    }

    public function emitir(Emitente $emitente, ?Certificate $cert, array $payload, int $ambiente): array
    {
        if ($emitente->nfseSenha === '') {
            throw new \RuntimeException(
                "Emitente {$emitente->cnpj} sem 'nfse_senha' (senha do portal da prefeitura) — obrigatória no IPM."
            );
        }

        $numero = (int) ($payload['numero'] ?? 1);
        $xml = $this->montarXml($emitente, $payload, $ambiente, $numero);
        $resp = $this->post($emitente, $xml);

        return $this->tratarResposta($resp, (string) $numero, $ambiente);
    }

    public function consultar(Emitente $emitente, ?Certificate $cert, string $identificador, int $ambiente): array
    {
        // O IPM consulta por outro serviço/layout; implementar quando necessário.
        throw new \RuntimeException('Consulta de NFS-e (IPM) ainda não implementada.');
    }

    public function cancelar(
        Emitente $emitente,
        ?Certificate $cert,
        string $identificador,
        string $justificativa,
        int $ambiente
    ): array {
        throw new \RuntimeException('Cancelamento de NFS-e (IPM) ainda não implementado.');
    }

    // ------------------------------------------------------------------

    private function montarXml(Emitente $e, array $p, int $ambiente, int $numero): string
    {
        $serv = $p['servico'] ?? [];
        $toma = $p['tomador'] ?? [];

        $tom = $e->municipioTom ?: $e->cMun; // prefere TOM; cai p/ IBGE
        $valor = $this->real((float) ($serv['valor'] ?? 0));
        $aliq = $this->real((float) ($serv['aliquota_iss'] ?? 0));
        $item = preg_replace('/\D/', '', (string) ($serv['item_lista_servico'] ?? ''));
        $desc = $this->txt((string) ($serv['descricao'] ?? ''));
        $sitTrib = (string) ($serv['situacao_tributaria'] ?? '0'); // 0 = Tributada Integralmente
        $identificador = 'EF' . $e->cnpj . date('YmdHis') . $numero;

        // Modo teste em homologação: valida sem emitir.
        $tagTeste = $ambiente === 1 ? '' : '<nfse_teste>1</nfse_teste>';

        // Tomador (opcional)
        $tomadorXml = '';
        if (!empty($toma['cnpj']) || !empty($toma['cpf'])) {
            $tipo = !empty($toma['cnpj']) ? 'J' : 'F';
            $docTom = preg_replace('/\D/', '', (string) ($toma['cnpj'] ?? $toma['cpf']));
            $tomadorXml = '<tomador>'
                . "<tipo>{$tipo}</tipo>"
                . "<cpfcnpj>{$docTom}</cpfcnpj>"
                . '<nome_razao_social>' . $this->txt((string) ($toma['nome'] ?? $toma['razao'] ?? '')) . '</nome_razao_social>'
                . (!empty($toma['email']) ? '<email>' . $this->txt($toma['email']) . '</email>' : '')
                . '</tomador>';
        }

        return '<?xml version="1.0" encoding="UTF-8"?>'
            . '<nfse>'
            . $tagTeste
            . "<identificador>{$identificador}</identificador>"
            . '<nf>'
            . '<data_fato_gerador>' . date('d/m/Y') . '</data_fato_gerador>'
            . "<valor_total>{$valor}</valor_total>"
            . (!empty($p['informacoes_adicionais']) ? '<observacao>' . $this->txt($p['informacoes_adicionais']) . '</observacao>' : '')
            . '</nf>'
            . '<prestador>'
            . "<cpfcnpj>{$e->cnpj}</cpfcnpj>"
            . "<cidade>{$tom}</cidade>"
            . '</prestador>'
            . $tomadorXml
            . '<itens><lista>'
            . '<tributa_municipio_prestador>1</tributa_municipio_prestador>'
            . "<codigo_local_prestacao_servico>{$tom}</codigo_local_prestacao_servico>"
            . "<codigo_item_lista_servico>{$item}</codigo_item_lista_servico>"
            . "<descritivo>{$desc}</descritivo>"
            . "<aliquota_item_lista_servico>{$aliq}</aliquota_item_lista_servico>"
            . "<situacao_tributaria>{$sitTrib}</situacao_tributaria>"
            . "<valor_tributavel>{$valor}</valor_tributavel>"
            . '</lista></itens>'
            . '</nfse>';
    }

    /** @return array{status:int,body:string} */
    private function post(Emitente $e, string $xml): array
    {
        $sub = $e->ipmSubdominio ?: $this->slug($e->xMun);
        $url = "https://{$sub}.atende.net/?pg=rest&service=WNERestServiceNFSe";
        $auth = base64_encode($e->cnpj . ':' . $e->nfseSenha);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Authorization: Basic ' . $auth],
            CURLOPT_POSTFIELDS     => ['xml' => $xml], // multipart/form-data
            CURLOPT_TIMEOUT        => 60,
        ]);
        $body = curl_exec($ch);
        if ($body === false) {
            $err = curl_error($ch);
            curl_close($ch);
            throw new \RuntimeException('Falha na comunicação com o IPM/Atende.Net: ' . $err);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['status' => $status, 'body' => (string) $body];
    }

    private function tratarResposta(array $resp, string $numero, int $ambiente): array
    {
        $body = $resp['body'];
        $numeroNfse = $this->tag($body, 'numero_nfse');
        $link = $this->tag($body, 'link_nfse');
        $codVerif = $this->tag($body, 'cod_verificador_autenticidade');

        if ($numeroNfse !== '') {
            return [
                'status'  => 'autorizado',
                'chave'   => $codVerif ?: $numeroNfse,
                'numero'  => $numeroNfse,
                'motivo'  => 'NFS-e emitida',
                'xml'     => $body,
                'pdf_url' => $link,
            ];
        }

        // Erro (ou, em modo teste, mensagem de "nota válida para emissão")
        $msg = $this->tag($body, 'mensagem') ?: $this->tag($body, 'motivo')
            ?: $this->tag($body, 'erro') ?: $this->tag($body, 'descricao');
        $validoTeste = $ambiente === 2 && stripos($body, 'válid') !== false;

        return [
            'status' => $validoTeste ? 'valido_teste' : 'rejeitado',
            'chave'  => null,
            'numero' => $numero,
            'motivo' => $msg !== '' ? $msg : ('HTTP ' . $resp['status']),
            'xml'    => null,
        ];
    }

    private function tag(string $xml, string $tag): string
    {
        if (preg_match('#<' . preg_quote($tag, '#') . '>(.*?)</' . preg_quote($tag, '#') . '>#is', $xml, $m)) {
            return trim(html_entity_decode($m[1]));
        }
        return '';
    }

    /** Valor real com vírgula decimal (padrão IPM). */
    private function real(float $v): string
    {
        return number_format($v, 2, ',', '');
    }

    /** Texto para o XML IPM: remove "/" (não permitido) e escapa entidades. */
    private function txt(string $s): string
    {
        $s = str_replace('/', '-', $s);
        return htmlspecialchars($s, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    private function slug(string $mun): string
    {
        $s = strtr($mun, ['á'=>'a','à'=>'a','ã'=>'a','â'=>'a','é'=>'e','ê'=>'e','í'=>'i','ó'=>'o','ô'=>'o','õ'=>'o','ú'=>'u','ç'=>'c','Á'=>'a','É'=>'e','Í'=>'i','Ó'=>'o','Ú'=>'u','Ã'=>'a','Ç'=>'c']);
        return preg_replace('/[^a-z0-9]/', '', strtolower($s));
    }
}
