<?php
require __DIR__ . '/auth-check.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !csrf_validar()) {
    flash_set('err', 'Requisição inválida.');
    redirecionar('admin/imoveis.php');
}
$id = input_int('id', 0);
if ($id) {
    $imgs = imagens_do_registro($pdo, 'imovel_imagens', 'imovel_id', $id);
    foreach ($imgs as $img) excluir_arquivo_imagem($img['arquivo'], 'imoveis');
    $pdo->prepare('DELETE FROM imoveis WHERE id=?')->execute([$id]);
    flash_set('ok', 'Imóvel excluído com sucesso.');
}
redirecionar('admin/imoveis.php');
