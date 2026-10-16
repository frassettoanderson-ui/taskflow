<?php

declare(strict_types=1);

namespace App\Fiscal\GNRE;

use App\Support\CertificadoManager;
use App\Support\Emitente;

/**
 * GNRE do DIFAL (receita 100102 — ICMS consumidor final não contribuinte outra UF, EC 87/2015),
 * pelo webservice do Portal GNRE (SOAP 1.2 + certificado A1 do emitente).
 *
 * Cada UF exige campos diferentes: a configuração é lida do próprio portal (GnreConfigUF) e guardada
 * por 1 dia em storage/gnre/config-{amb}-{UF}.xml. A guia é montada a partir dela:
 * documento de origem (nº ou chave da NF-e), campos extras (chave da NF-e), período de referência,
 * destinatário, convênio e FCP. UFs fora do portal (ex.: SP, ES) devolvem status "uf_sem_gnre".
 *
 * Fluxo: gerar() envia o lote (GnreLoteRecepcao) e consulta o resultado (GnreResultadoLote) até
 * ~40 s; se ainda estiver processando, devolve o recibo para consultar() depois.
 */
final class GnreService
{
    private const NS = 'http://www.gnre.pe.gov.br';
    private string $host;
    private string $tmp;

    public function __construct(private string $root, private Emitente $emitente, private int $ambiente)
    {
        $this->host = $ambiente === 1 ? 'https://www.gnre.pe.gov.br' : 'https://www.testegnre.pe.gov.br';
        $cert = CertificadoManager::carregar($root, $emitente->certPath, $emitente->certPassword);
        $this->tmp = sys_get_temp_dir() . '/gnre-' . bin2hex(random_bytes(6));
        mkdir($this->tmp, 0700);
        file_put_contents("{$this->tmp}/key.pem", (string) $cert->privateKey);
        file_put_contents("{$this->tmp}/cert.pem", (string) $cert->publicKey);
    }

    public function __destruct()
    {
        foreach (glob("{$this->tmp}/*") ?: [] as $f) {
            @unlink($f);
        }
        @rmdir($this->tmp);
    }

    /**
     * @param array{uf:string,valor:float,fcp?:float,vencimento?:string,
     *   nfe:array{chave:string,numero:int|string,data_emissao:string},
     *   destinatario:array{cpf?:string,cnpj?:string,nome:string,municipio_cod:string}} $p
     */
    public function gerar(array $p): array
    {
        $uf = strtoupper((string) $p['uf']);
        $cfg = $this->config($uf);
        if ($cfg === null) {
            return ['status' => 'uf_sem_gnre', 'motivo' => "{$uf} não emite a guia pelo Portal GNRE: use o portal da SEFAZ de {$uf}."];
        }
        $xml = $this->montarLote($uf, $cfg, $p);
        $resp = $this->soap('GnreLoteRecepcao', 'processar', '2.00', $xml);
        $sit = $this->tag($resp, 'situacaoRecepcao', 'codigo');
        $recibo = $this->tag($resp, 'recibo', 'numero');
        if (!$recibo) {
            return ['status' => 'erro', 'motivo' => $this->tag($resp, 'situacaoRecepcao', 'descricao') ?: 'Portal GNRE não devolveu recibo (' . ($sit ?: 'sem código') . ').', 'xml_enviado' => $xml];
        }
        for ($i = 0; $i < 8; $i++) {
            sleep($i === 0 ? 3 : 5);
            $r = $this->consultar($recibo);
            if ($r['status'] !== 'processando') {
                return $r;
            }
        }
        return ['status' => 'processando', 'recibo' => $recibo, 'motivo' => 'Lote em processamento no Portal GNRE.'];
    }

    /** Resultado de um lote (com o PDF da guia). */
    public function consultar(string $recibo): array
    {
        $dados = '<TConsLote_GNRE xmlns="' . self::NS . '"><ambiente>' . $this->ambiente . '</ambiente>'
            . '<numeroRecibo>' . htmlspecialchars($recibo) . '</numeroRecibo><incluirPDFGuias>S</incluirPDFGuias>'
            . '<incluirArquivoPagamento>N</incluirArquivoPagamento><incluirNoticias>N</incluirNoticias></TConsLote_GNRE>';
        $resp = $this->soap('GnreResultadoLote', 'consultar', '2.00', $dados);
        $cod = $this->tag($resp, 'situacaoProcess', 'codigo');
        if ($cod === '401' || $cod === '601') {
            return ['status' => 'processando', 'recibo' => $recibo];
        }
        $guiaXml = preg_match('#<(?:\w+:)?guia>(.*?)</(?:\w+:)?guia>#s', $resp, $m) ? $m[1] : $resp;
        $situacaoGuia = $this->simples($guiaXml, 'situacaoGuia');
        $motivos = [];
        if (preg_match_all('#<(?:\w+:)?motivo[^>]*>.*?<(?:\w+:)?descricao>([^<]*)<#s', $guiaXml, $mm)) {
            $motivos = array_map('html_entity_decode', $mm[1]);
        }
        $codigoBarras = $this->simples($guiaXml, 'codigoBarras');
        $linha = $this->simples($guiaXml, 'linhaDigitavel');
        $pdf = $this->simples($resp, 'pdfGuias');
        $ok = $situacaoGuia === '0' && ($codigoBarras || $linha);
        return [
            'status' => $ok ? 'gerada' : 'rejeitada',
            'recibo' => $recibo,
            'situacao_lote' => $cod . ' ' . html_entity_decode($this->tag($resp, 'situacaoProcess', 'descricao') ?? ''),
            'codigo_barras' => $codigoBarras,
            'linha_digitavel' => $linha,
            'nosso_numero' => $this->simples($guiaXml, 'nossoNumero'),
            'motivo' => $motivos ? implode(' | ', $motivos) : ($ok ? null : html_entity_decode($this->tag($resp, 'situacaoProcess', 'descricao') ?? 'Guia não processada.')),
            'pdf_base64' => $pdf ?: null,
        ];
    }

    // ------------------------------------------------------------------ montagem

    private function montarLote(string $uf, \SimpleXMLElement $cfg, array $p): string
    {
        $e = $this->emitente;
        $rec = $this->receita($cfg);
        $exige = fn (string $tag) => strtoupper((string) ($rec->{$tag} ?? 'N')) === 'S';
        $chave = preg_replace('/\D/', '', (string) $p['nfe']['chave']) ?? '';
        $numero = (string) (int) $p['nfe']['numero'];
        $emissao = substr((string) $p['nfe']['data_emissao'], 0, 10);
        $hoje = (new \DateTimeImmutable('now', new \DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
        $venc = $p['vencimento'] ?? $hoje;
        $valor = round((float) $p['valor'], 2);
        $fcp = round((float) ($p['fcp'] ?? 0), 2);
        $d = $p['destinatario'];
        $mun5 = fn (string $ibge) => substr(preg_replace('/\D/', '', $ibge) ?? '', -5);

        $x = '<TDadosGNRE versao="2.00">';
        $x .= '<ufFavorecida>' . $uf . '</ufFavorecida><tipoGnre>0</tipoGnre>';
        $x .= '<contribuinteEmitente><identificacao><CNPJ>' . $e->cnpj . '</CNPJ></identificacao>'
            . '<razaoSocial>' . $this->t($e->razao, 60) . '</razaoSocial>'
            . '<endereco>' . $this->t(trim("{$e->xLgr}, {$e->nro} - {$e->xBairro}"), 60) . '</endereco>'
            . '<municipio>' . $mun5($e->cMun) . '</municipio><uf>' . $e->uf . '</uf>'
            . '<cep>' . preg_replace('/\D/', '', $e->cep) . '</cep>'
            . ($e->fone ? '<telefone>' . substr(preg_replace('/\D/', '', $e->fone) ?? '', 0, 11) . '</telefone>' : '')
            . '</contribuinteEmitente>';
        $x .= '<itensGNRE><item><receita>100102</receita>';

        // documento de origem: chave (22/24) quando a UF aceita, senão o número da nota (10)
        $tipos = [];
        foreach ($rec->tiposDocumentosOrigem->tipoDocumentoOrigem ?? [] as $t) {
            $tipos[] = (string) $t->codigo;
        }
        if ($exige('exigeDocumentoOrigem') || $tipos) {
            if (in_array('24', $tipos, true)) {
                $x .= '<documentoOrigem tipo="24">' . $chave . '</documentoOrigem>';
            } elseif (in_array('22', $tipos, true)) {
                $x .= '<documentoOrigem tipo="22">' . $chave . '</documentoOrigem>';
            } elseif (in_array('10', $tipos, true)) {
                $x .= '<documentoOrigem tipo="10">' . $numero . '</documentoOrigem>';
            }
        }
        if ($exige('exigePeriodoReferencia')) {
            $x .= '<referencia><periodo>0</periodo><mes>' . substr($emissao, 5, 2) . '</mes><ano>' . substr($emissao, 0, 4) . '</ano></referencia>';
        }
        $x .= '<dataVencimento>' . $venc . '</dataVencimento>';
        $x .= '<valor tipo="11">' . number_format($valor, 2, '.', '') . '</valor>';
        if ($fcp > 0 && $exige('exigeValorFecp')) {
            $x .= '<valor tipo="12">' . number_format($fcp, 2, '.', '') . '</valor>';
        }
        if ($exige('exigeConvenio')) {
            $x .= '<convenio>' . $this->t((string) ($p['convenio'] ?? 'EC 87/15'), 30) . '</convenio>';
        }
        if ($exige('exigeContribuinteDestinatario')) {
            $doc = !empty($d['cnpj']) ? '<CNPJ>' . preg_replace('/\D/', '', $d['cnpj']) . '</CNPJ>' : '<CPF>' . preg_replace('/\D/', '', (string) ($d['cpf'] ?? '')) . '</CPF>';
            $x .= '<contribuinteDestinatario><identificacao>' . $doc . '</identificacao>'
                . '<razaoSocial>' . $this->t((string) $d['nome'], 60) . '</razaoSocial>'
                . '<municipio>' . $mun5((string) $d['municipio_cod']) . '</municipio></contribuinteDestinatario>';
        }
        // campos extras obrigatórios que pedem a chave da NF-e (tamanho 44)
        $extras = '';
        foreach ($rec->camposAdicionais->campoAdicional ?? [] as $c) {
            $titulo = mb_strtolower(html_entity_decode((string) $c->titulo));
            if (strtoupper((string) $c->obrigatorio) !== 'S') {
                continue;
            }
            $valorExtra = null;
            if (str_contains($titulo, 'chave')) {
                $valorExtra = $chave;                       // chave de acesso da NF-e (44)
            } elseif (strtoupper((string) $c->tipo) === 'D' || str_contains($titulo, 'data')) {
                $valorExtra = $emissao;                     // ex.: RJ "Data de Emissão" (AAAA-MM-DD)
            }
            if ($valorExtra !== null) {
                $extras .= '<campoExtra><codigo>' . (string) $c->codigo . '</codigo><valor>' . $valorExtra . '</valor></campoExtra>';
            }
        }
        if ($extras) {
            $x .= '<camposExtras>' . $extras . '</camposExtras>';
        }
        $x .= '</item></itensGNRE>';
        $x .= '<valorGNRE>' . number_format($valor + ($exige('exigeValorFecp') ? $fcp : 0), 2, '.', '') . '</valorGNRE>';
        $x .= '<dataPagamento>' . $venc . '</dataPagamento>';
        $x .= '</TDadosGNRE>';

        return '<TLote_GNRE versao="2.00" xmlns="' . self::NS . '"><guias>' . $x . '</guias></TLote_GNRE>';
    }

    // ------------------------------------------------------------------ configuração da UF

    /** Configuração da UF p/ a receita 100102 (null = UF fora do Portal GNRE). Cache de 1 dia. */
    public function config(string $uf): ?\SimpleXMLElement
    {
        $dir = $this->root . '/storage/gnre';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $arq = "{$dir}/config-{$this->ambiente}-{$uf}.xml";
        if (!is_file($arq) || filemtime($arq) < time() - 86400) {
            $dados = '<TConsultaConfigUf xmlns="' . self::NS . '"><ambiente>' . $this->ambiente . '</ambiente><uf>' . $uf . '</uf><receita courier="N">100102</receita></TConsultaConfigUf>';
            $resp = $this->soap('GnreConfigUF', 'consultar', '1.00', $dados);
            if (!preg_match('#<(?:\w+:)?TConfigUf.*</(?:\w+:)?TConfigUf>#s', $resp, $m)) {
                throw new \RuntimeException('Portal GNRE não respondeu a configuração da UF ' . $uf . '.');
            }
            file_put_contents($arq, $m[0]);
        }
        $xml = (string) file_get_contents($arq);
        $cod = $this->tag($xml, 'situacaoConsulta', 'codigo');
        if ($cod !== '450') {
            if (str_contains($xml, 'nao habilitada')) {
                return null;
            }
            @unlink($arq);
            throw new \RuntimeException('Configuração da UF ' . $uf . ': ' . html_entity_decode($this->tag($xml, 'situacaoConsulta', 'descricao') ?? $cod));
        }
        $sx = simplexml_load_string(preg_replace('#(</?)\w+:#', '$1', $xml) ?? '');
        if (!$sx) {
            throw new \RuntimeException('Configuração da UF ' . $uf . ' ilegível.');
        }
        return $sx;
    }

    private function receita(\SimpleXMLElement $cfg): \SimpleXMLElement
    {
        foreach ($cfg->receitas->receita ?? [] as $r) {
            if ((string) $r['codigo'] === '100102') {
                return $r;
            }
        }
        throw new \RuntimeException('A UF não aceita a receita 100102 (DIFAL) pelo Portal GNRE.');
    }

    // ------------------------------------------------------------------ SOAP

    private function soap(string $servico, string $acao, string $versao, string $dados): string
    {
        $ns = "http://www.gnre.pe.gov.br/webservice/{$servico}";
        $env = '<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">'
            . "<soap12:Header><gnreCabecMsg xmlns=\"{$ns}\"><versaoDados>{$versao}</versaoDados></gnreCabecMsg></soap12:Header>"
            . "<soap12:Body><gnreDadosMsg xmlns=\"{$ns}\">{$dados}</gnreDadosMsg></soap12:Body></soap12:Envelope>";
        $ch = curl_init("{$this->host}/gnreWS/services/{$servico}");
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => $env, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 100,
            CURLOPT_SSLCERT => "{$this->tmp}/cert.pem", CURLOPT_SSLKEY => "{$this->tmp}/key.pem",
            CURLOPT_HTTPHEADER => ["Content-Type: application/soap+xml;charset=utf-8;action=\"{$ns}/{$acao}\""],
        ]);
        if ($this->ambiente !== 1) {
            // o servidor de TESTES da GNRE responde com certificado de *.sefaz.pe.gov.br (nome diferente do host):
            // só no ambiente de testes a checagem do nome é relaxada; a cadeia continua sendo validada.
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        }
        $r = curl_exec($ch);
        $erro = curl_error($ch);
        curl_close($ch);
        if ($r === false) {
            throw new \RuntimeException("Portal GNRE ({$servico}) fora do ar: {$erro}");
        }
        return (string) $r;
    }

    private function tag(string $xml, string $pai, string $filho): ?string
    {
        return preg_match("#<(?:\\w+:)?{$pai}>.*?<(?:\\w+:)?{$filho}>([^<]*)<#s", $xml, $m) ? trim($m[1]) : null;
    }

    private function simples(string $xml, string $tag): ?string
    {
        return preg_match("#<(?:\\w+:)?{$tag}>([^<]*)<#s", $xml, $m) ? trim($m[1]) : null;
    }

    private function t(string $s, int $max): string
    {
        $s = preg_replace('/\s+/', ' ', trim($s)) ?? '';
        return htmlspecialchars(mb_substr($s, 0, $max), ENT_XML1);
    }
}
