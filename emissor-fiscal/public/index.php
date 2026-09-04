<?php

declare(strict_types=1);

use App\Fiscal\NFe\NFeService;
use App\Fiscal\NFCe\NFCeService;
use App\Http\Request;
use App\Http\Response;
use App\Http\Router;
use App\Support\ApiKeys;
use App\Support\Config;
use App\Support\Contador;
use App\Support\EmitenteRepository;
use App\Support\XmlStore;

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';

Config::boot($root);

$apiKeys = new ApiKeys($root);
$emitentes = new EmitenteRepository($root);
$store = new XmlStore($root);
$contador = new Contador($root);

$req = new Request();
$router = new Router($apiKeys);

/**
 * Resolve o serviço de NF-e para o emitente pedido, checando o escopo do chamador.
 * O payload/consulta deve trazer "emitente": "<cnpj>".
 */
$nfeDoEmitente = static function (Request $req) use ($root, $emitentes, $store, $contador): NFeService {
    $cnpj = (string) ($req->body['emitente'] ?? '');
    if ($cnpj === '') {
        throw new InvalidArgumentException('Campo "emitente" (CNPJ) é obrigatório.');
    }
    if (!ApiKeys::podeEmitir($req->caller, $cnpj)) {
        Response::erro('Sua chave não tem permissão para emitir por este emitente.', 403);
    }
    $emit = $emitentes->buscar($cnpj);
    return new NFeService($root, $emit, Config::ambiente(), $store, $contador);
};

/** Idem, para NFC-e (modelo 65). */
$nfceDoEmitente = static function (Request $req) use ($root, $emitentes, $store, $contador): NFCeService {
    $cnpj = (string) ($req->body['emitente'] ?? '');
    if ($cnpj === '') {
        throw new InvalidArgumentException('Campo "emitente" (CNPJ) é obrigatório.');
    }
    if (!ApiKeys::podeEmitir($req->caller, $cnpj)) {
        Response::erro('Sua chave não tem permissão para emitir por este emitente.', 403);
    }
    $emit = $emitentes->buscar($cnpj);
    return new NFCeService($root, $emit, Config::ambiente(), $store, $contador);
};

// ---------------- rotas ----------------

$router->add('GET', '/health', function () {
    Response::ok(['servico' => 'emissor-fiscal', 'versao' => '1.0']);
}, protected: false);

$router->add('POST', '/v1/nfe/status', function (Request $req) use ($nfeDoEmitente) {
    Response::ok(['sefaz' => $nfeDoEmitente($req)->statusServico()]);
});

$router->add('POST', '/v1/nfe/emitir', function (Request $req) use ($nfeDoEmitente) {
    $resultado = $nfeDoEmitente($req)->emitir($req->body);
    $ok = $resultado['status'] === 'autorizado';
    Response::json(['ok' => $ok] + $resultado, $ok ? 200 : 422);
});

$router->add('POST', '/v1/nfe/consultar', function (Request $req) use ($nfeDoEmitente) {
    $chave = (string) ($req->body['chave'] ?? '');
    if (strlen($chave) !== 44) {
        Response::erro('chave de acesso inválida (44 dígitos).', 400);
    }
    Response::ok($nfeDoEmitente($req)->consultar($chave));
});

$router->add('POST', '/v1/nfe/cancelar', function (Request $req) use ($nfeDoEmitente) {
    $r = $nfeDoEmitente($req)->cancelar(
        (string) ($req->body['chave'] ?? ''),
        (string) ($req->body['protocolo'] ?? ''),
        (string) ($req->body['justificativa'] ?? '')
    );
    Response::json(['ok' => $r['status'] === 'cancelado'] + $r);
});

$router->add('POST', '/v1/nfe/carta-correcao', function (Request $req) use ($nfeDoEmitente) {
    $r = $nfeDoEmitente($req)->cartaCorrecao(
        (string) ($req->body['chave'] ?? ''),
        (string) ($req->body['correcao'] ?? ''),
        (int) ($req->body['sequencia'] ?? 1)
    );
    Response::json(['ok' => $r['status'] === 'registrada'] + $r);
});

$router->add('POST', '/v1/nfe/danfe', function (Request $req) use ($nfeDoEmitente) {
    $chave = (string) ($req->body['chave'] ?? '');
    if (strlen($chave) !== 44) {
        Response::erro('chave de acesso inválida (44 dígitos).', 400);
    }
    Response::ok($nfeDoEmitente($req)->danfe($chave));
});

// ---------------- NFC-e (modelo 65) ----------------

$router->add('POST', '/v1/nfce/status', function (Request $req) use ($nfceDoEmitente) {
    Response::ok(['sefaz' => $nfceDoEmitente($req)->statusServico()]);
});

$router->add('POST', '/v1/nfce/emitir', function (Request $req) use ($nfceDoEmitente) {
    $r = $nfceDoEmitente($req)->emitir($req->body);
    $ok = $r['status'] === 'autorizado';
    Response::json(['ok' => $ok] + $r, $ok ? 200 : 422);
});

$router->add('POST', '/v1/nfce/consultar', function (Request $req) use ($nfceDoEmitente) {
    $chave = (string) ($req->body['chave'] ?? '');
    if (strlen($chave) !== 44) {
        Response::erro('chave de acesso inválida (44 dígitos).', 400);
    }
    Response::ok($nfceDoEmitente($req)->consultar($chave));
});

$router->add('POST', '/v1/nfce/cancelar', function (Request $req) use ($nfceDoEmitente) {
    $r = $nfceDoEmitente($req)->cancelar(
        (string) ($req->body['chave'] ?? ''),
        (string) ($req->body['protocolo'] ?? ''),
        (string) ($req->body['justificativa'] ?? '')
    );
    Response::json(['ok' => $r['status'] === 'cancelado'] + $r);
});

$router->add('POST', '/v1/nfce/danfce', function (Request $req) use ($nfceDoEmitente) {
    $chave = (string) ($req->body['chave'] ?? '');
    if (strlen($chave) !== 44) {
        Response::erro('chave de acesso inválida (44 dígitos).', 400);
    }
    Response::ok($nfceDoEmitente($req)->danfce($chave));
});

// TODO(fase 3): /v1/nfse/emitir  (NFS-e — Padrão Nacional gov.br + adaptadores por provedor)

$router->dispatch($req);
