<?php

declare(strict_types=1);

use App\Fiscal\NFe\NFeService;
use App\Http\Request;
use App\Http\Response;
use App\Http\Router;
use App\Support\CertificadoManager;
use App\Support\Config;
use App\Support\Contador;
use App\Support\XmlStore;

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';

Config::boot($root);
$apiKey = (string) Config::get('API_KEY', '');

$req = new Request();
$router = new Router();

// Carrega os serviços fiscais sob demanda (só quando a rota precisa).
$nfe = static function () use ($root): NFeService {
    $cert = CertificadoManager::carregar($root);
    return new NFeService(
        $root,
        $cert,
        new XmlStore($root),
        new Contador($root)
    );
};

// ---------------- rotas ----------------

$router->add('GET', '/health', function () {
    Response::ok(['servico' => 'emissor-fiscal', 'versao' => '1.0']);
}, protected: false);

$router->add('GET', '/v1/nfe/status', function () use ($nfe) {
    Response::ok(['sefaz' => $nfe()->statusServico()]);
});

$router->add('POST', '/v1/nfe/emitir', function (Request $req) use ($nfe) {
    $resultado = $nfe()->emitir($req->body);
    $status = $resultado['status'] === 'autorizado' ? 200 : 422;
    Response::json(['ok' => $resultado['status'] === 'autorizado'] + $resultado, $status);
});

$router->add('POST', '/v1/nfe/consultar', function (Request $req) use ($nfe) {
    $chave = (string) ($req->body['chave'] ?? '');
    if (strlen($chave) !== 44) {
        Response::erro('chave de acesso inválida (44 dígitos).', 400);
    }
    Response::ok($nfe()->consultar($chave));
});

$router->add('POST', '/v1/nfe/cancelar', function (Request $req) use ($nfe) {
    $resultado = $nfe()->cancelar(
        (string) ($req->body['chave'] ?? ''),
        (string) ($req->body['protocolo'] ?? ''),
        (string) ($req->body['justificativa'] ?? '')
    );
    Response::json(['ok' => $resultado['status'] === 'cancelado'] + $resultado);
});

$router->add('POST', '/v1/nfe/carta-correcao', function (Request $req) use ($nfe) {
    $resultado = $nfe()->cartaCorrecao(
        (string) ($req->body['chave'] ?? ''),
        (string) ($req->body['correcao'] ?? ''),
        (int) ($req->body['sequencia'] ?? 1)
    );
    Response::json(['ok' => $resultado['status'] === 'registrada'] + $resultado);
});

$router->add('POST', '/v1/nfe/danfe', function (Request $req) use ($nfe) {
    $chave = (string) ($req->body['chave'] ?? '');
    if (strlen($chave) !== 44) {
        Response::erro('chave de acesso inválida (44 dígitos).', 400);
    }
    Response::ok($nfe()->danfe($chave));
});

// TODO(fase 2): /v1/nfce/emitir  (NFC-e modelo 65 — reaproveita sped-nfe)
// TODO(fase 3): /v1/nfse/emitir  (NFS-e — Padrão Nacional gov.br + fallbacks municipais)

$router->dispatch($req, $apiKey);
