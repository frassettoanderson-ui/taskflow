<?php
require __DIR__ . '/auth-check.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !csrf_validar()) {
    flash_set('err', 'Requisição inválida.');
    redirecionar('admin/veiculos.php');
}
$id = input_int('id', 0);
if ($id) {
    // apaga arquivos físicos
    $imgs = imagens_do_registro($pdo, 'veiculo_imagens', 'veiculo_id', $id);
    foreach ($imgs as $img) excluir_arquivo_imagem($img['arquivo'], 'veiculos');
    // remove o registro (imagens/diferenciais saem por ON DELETE CASCADE)
    $pdo->prepare('DELETE FROM veiculos WHERE id=?')->execute([$id]);
    flash_set('ok', 'Veículo excluído com sucesso.');
}
redirecionar('admin/veiculos.php');
